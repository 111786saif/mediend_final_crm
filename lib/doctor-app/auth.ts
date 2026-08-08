import crypto from 'crypto'
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth'
import { normalizeIndianPhone } from '@/lib/doctor-app/phone'
import { sendAuthkeyTemplate } from '@/lib/whatsapp/authkey'

const DOCTOR_APP_JWT_SECRET: Secret =
  process.env.DOCTOR_APP_JWT_SECRET || process.env.JWT_SECRET || 'doctor-app-secret'
const DOCTOR_APP_REFRESH_SECRET =
  (process.env.DOCTOR_APP_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    'doctor-app-refresh-secret') as Secret
const DOCTOR_APP_JWT_EXPIRES_IN = (process.env.DOCTOR_APP_JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn']
const DOCTOR_APP_REFRESH_EXPIRES_IN = (process.env.DOCTOR_APP_REFRESH_EXPIRES_IN ||
  '30d') as SignOptions['expiresIn']
const DOCTOR_APP_JWT_EXPIRES_IN_TEXT = String(DOCTOR_APP_JWT_EXPIRES_IN)
const DOCTOR_APP_REFRESH_EXPIRES_IN_TEXT = String(DOCTOR_APP_REFRESH_EXPIRES_IN)
const AUTHKEY_WHATSAPP_TEMPLATE_ID =
  process.env.AUTHKEY_WHATSAPP_TEMPLATE_ID || process.env.DOCTOR_APP_WHATSAPP_TEMPLATE_ID || ''
const AUTHKEY_COUNTRY_CODE = process.env.AUTHKEY_COUNTRY_CODE || '91'
const DOCTOR_APP_OTP_EXPIRES_IN_MINUTES = Number(process.env.DOCTOR_APP_OTP_EXPIRES_IN_MINUTES || 10)
const DOCTOR_APP_TEST_OTP_ENABLED = process.env.DOCTOR_APP_TEST_OTP_ENABLED === 'true'
const DOCTOR_APP_TEST_OTP_PHONE = normalizeIndianPhone(process.env.DOCTOR_APP_TEST_OTP_PHONE || '')
const DOCTOR_APP_TEST_OTP_CODE = (process.env.DOCTOR_APP_TEST_OTP_CODE || '').trim()

export interface DoctorAppAuthUser {
  accountId: string
  doctorId: string
  email: string
  name: string
}

export type DoctorAppSessionUser = DoctorAppAuthUser

export interface DoctorAppLoginResult {
  doctor: {
    id: string
    name: string
    email: string
  }
  accessToken: string
  expiresIn: string
  refreshToken: string
  refreshExpiresIn: string
}

export class DoctorAppWhatsappOtpError extends Error {
  status: number

  constructor(message: string, status: number = 503) {
    super(message)
    this.name = 'DoctorAppWhatsappOtpError'
    this.status = status
  }
}

function isDoctorAppTestOtpPhone(phone: string) {
  return (
    DOCTOR_APP_TEST_OTP_ENABLED &&
    DOCTOR_APP_TEST_OTP_PHONE.length === 10 &&
    DOCTOR_APP_TEST_OTP_CODE.length > 0 &&
    phone === DOCTOR_APP_TEST_OTP_PHONE
  )
}

function parseDurationToMs(input: string, fallbackMs: number) {
  const match = input.trim().match(/^(\d+)\s*([smhd])$/i)
  if (!match) return fallbackMs

  const value = Number(match[1])
  const unit = match[2].toLowerCase()
  const multiplier =
    unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000

  return value * multiplier
}

function issueAccessToken(user: DoctorAppAuthUser) {
  return jwt.sign(
    {
      sub: user.doctorId,
      accountId: user.accountId,
      email: user.email,
      name: user.name,
      type: 'access',
    },
    DOCTOR_APP_JWT_SECRET,
    { expiresIn: DOCTOR_APP_JWT_EXPIRES_IN }
  )
}

export function getDoctorAppSessionFromRequest(request: Request): DoctorAppSessionUser | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)

  try {
    const decoded = jwt.verify(token, DOCTOR_APP_JWT_SECRET) as {
      sub?: string
      accountId?: string
      email?: string
      name?: string
      type?: string
    }

    if (!decoded?.sub || !decoded.accountId || decoded.type !== 'access') {
      return null
    }

    return {
      doctorId: decoded.sub,
      accountId: decoded.accountId,
      email: decoded.email || '',
      name: decoded.name || '',
    }
  } catch {
    return null
  }
}

async function issueRefreshToken(user: DoctorAppAuthUser) {
  const ttlMs = parseDurationToMs(DOCTOR_APP_REFRESH_EXPIRES_IN_TEXT, 30 * 24 * 60 * 60 * 1_000)
  const expiresAt = new Date(Date.now() + ttlMs)
  const jti = crypto.randomUUID()

  await prisma.doctorAppRefreshToken.create({
    data: {
      accountId: user.accountId,
      jti,
      expiresAt,
    },
  })

  const refreshToken = jwt.sign(
    {
      sub: user.doctorId,
      accountId: user.accountId,
      jti,
      type: 'refresh',
    },
    DOCTOR_APP_REFRESH_SECRET,
    { expiresIn: DOCTOR_APP_REFRESH_EXPIRES_IN }
  )

  return {
    refreshToken,
    refreshExpiresIn: DOCTOR_APP_REFRESH_EXPIRES_IN_TEXT,
  }
}

export async function loginDoctorApp(email: string, password: string): Promise<DoctorAppLoginResult | null> {
  const normalizedEmail = email.trim().toLowerCase()

  const account = await prisma.doctorAppAccount.findUnique({
    where: { email: normalizedEmail },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  })

  if (!account || !account.isActive || !account.doctor.isActive) {
    return null
  }

  const isValid = await verifyPassword(password, account.passwordHash)
  if (!isValid) {
    return null
  }

  const authUser: DoctorAppAuthUser = {
    accountId: account.id,
    doctorId: account.doctor.id,
    email: account.email,
    name: account.doctor.name,
  }

  const accessToken = issueAccessToken(authUser)
  const { refreshToken, refreshExpiresIn } = await issueRefreshToken(authUser)

  await prisma.doctorAppAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
  })

  return {
    doctor: {
      id: account.doctor.id,
      name: account.doctor.name,
      email: account.email,
    },
    accessToken,
    expiresIn: DOCTOR_APP_JWT_EXPIRES_IN_TEXT,
    refreshToken,
    refreshExpiresIn,
  }
}

export async function sendDoctorAppWhatsappOtp(phone: string) {
  const normalizedPhone = normalizeIndianPhone(phone)
  if (normalizedPhone.length !== 10) {
    throw new Error('Mobile number must be a 10-digit Indian number')
  }

  if (!AUTHKEY_WHATSAPP_TEMPLATE_ID) {
    throw new DoctorAppWhatsappOtpError(
      'WhatsApp OTP is not configured. Set AUTHKEY_WHATSAPP_TEMPLATE_ID or DOCTOR_APP_WHATSAPP_TEMPLATE_ID.',
    )
  }

  const account = await prisma.doctorAppAccount.findFirst({
    where: {
      phoneNumber: normalizedPhone,
      isActive: true,
      doctor: { isActive: true },
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  })

  if (!account) {
    return null
  }

  const otp = isDoctorAppTestOtpPhone(normalizedPhone)
    ? DOCTOR_APP_TEST_OTP_CODE
    : crypto.randomInt(100000, 1000000).toString()
  const expiresAt = new Date(Date.now() + DOCTOR_APP_OTP_EXPIRES_IN_MINUTES * 60 * 1000)

  await prisma.doctorAppWhatsappOtp.deleteMany({
    where: { accountId: account.id },
  })

  await prisma.doctorAppWhatsappOtp.create({
    data: {
      accountId: account.id,
      phoneNumber: normalizedPhone,
      otp,
      expiresAt,
    },
  })

  if (!isDoctorAppTestOtpPhone(normalizedPhone)) {
    try {
      await sendAuthkeyTemplate({
        mobile: normalizedPhone,
        wid: AUTHKEY_WHATSAPP_TEMPLATE_ID,
        countryCode: AUTHKEY_COUNTRY_CODE,
        param1: otp,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider error'
      throw new DoctorAppWhatsappOtpError(`Failed to send WhatsApp OTP: ${message}`, 502)
    }
  }

  return {
    message: 'OTP sent successfully',
    expiresInMinutes: DOCTOR_APP_OTP_EXPIRES_IN_MINUTES,
  }
}

export async function verifyDoctorAppWhatsappOtp(phone: string, otp: string): Promise<DoctorAppLoginResult | null> {
  const normalizedPhone = normalizeIndianPhone(phone)
  const normalizedOtp = otp.trim()
  if (normalizedPhone.length !== 10) {
    return null
  }

  if (isDoctorAppTestOtpPhone(normalizedPhone) && normalizedOtp === DOCTOR_APP_TEST_OTP_CODE) {
    const account = await prisma.doctorAppAccount.findFirst({
      where: {
        phoneNumber: normalizedPhone,
        isActive: true,
        doctor: { isActive: true },
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    })

    if (!account) {
      return null
    }

    const authUser: DoctorAppAuthUser = {
      accountId: account.id,
      doctorId: account.doctor.id,
      email: account.email,
      name: account.doctor.name,
    }

    const accessToken = issueAccessToken(authUser)
    const { refreshToken, refreshExpiresIn } = await issueRefreshToken(authUser)

    await prisma.doctorAppWhatsappOtp.updateMany({
      where: {
        accountId: account.id,
        verifiedAt: null,
      },
      data: { verifiedAt: new Date() },
    })

    await prisma.doctorAppAccount.update({
      where: { id: account.id },
      data: { lastLoginAt: new Date() },
    })

    return {
      doctor: {
        id: account.doctor.id,
        name: account.doctor.name,
        email: account.email,
      },
      accessToken,
      expiresIn: DOCTOR_APP_JWT_EXPIRES_IN_TEXT,
      refreshToken,
      refreshExpiresIn,
    }
  }

  const record = await prisma.doctorAppWhatsappOtp.findFirst({
    where: {
      phoneNumber: normalizedPhone,
      otp: normalizedOtp,
      verifiedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      account: {
        include: {
          doctor: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
      },
    },
  })

  if (!record) {
    return null
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await prisma.doctorAppWhatsappOtp.deleteMany({
      where: { accountId: record.accountId },
    })
    return null
  }

  if (!record.account.isActive || !record.account.doctor.isActive) {
    return null
  }

  await prisma.doctorAppWhatsappOtp.updateMany({
    where: { accountId: record.accountId },
    data: { verifiedAt: new Date() },
  })

  const authUser: DoctorAppAuthUser = {
    accountId: record.account.id,
    doctorId: record.account.doctor.id,
    email: record.account.email,
    name: record.account.doctor.name,
  }

  const accessToken = issueAccessToken(authUser)
  const { refreshToken, refreshExpiresIn } = await issueRefreshToken(authUser)

  await prisma.doctorAppAccount.update({
    where: { id: record.account.id },
    data: { lastLoginAt: new Date() },
  })

  return {
    doctor: {
      id: record.account.doctor.id,
      name: record.account.doctor.name,
      email: record.account.email,
    },
    accessToken,
    expiresIn: DOCTOR_APP_JWT_EXPIRES_IN_TEXT,
    refreshToken,
    refreshExpiresIn,
  }
}
