import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'

const KEY = 'facebook_lead_ads'
const schema = z.object({
  appId: z.string().trim().optional().default(''),
  appSecret: z.string().trim().optional().default(''),
  pages: z.array(z.object({
    pageId: z.string().trim().min(1), pageName: z.string().trim().min(1), accessToken: z.string().trim().min(1),
    campaigns: z.array(z.object({ facebookCampaignId: z.string().trim().min(1), facebookCampaignName: z.string().trim().min(1), crmCampaignId: z.string().trim().optional().default('') })).default([]),
  })).default([]),
})
function admin(request: NextRequest) { const user = getSessionFromRequest(request); return user && (user.role === 'ADMIN' || user.role === 'MD' || user.role === 'SUPER_ADMIN') ? user : null }
export async function GET(request: NextRequest) {
  const user = admin(request); if (!user) return unauthorizedResponse()
  const row = await prisma.appSetting.findUnique({ where: { key: KEY } })
  const data = row ? schema.parse(JSON.parse(row.value)) : { appId: '', appSecret: '', pages: [] }
  return successResponse({ ...data, appSecret: data.appSecret ? '••••••••' : '', pages: data.pages.map((p) => ({ ...p, accessToken: p.accessToken ? '••••••••' : '' })) })
}
export async function PATCH(request: NextRequest) {
  const user = admin(request); if (!user) return unauthorizedResponse()
  try {
    const incoming = schema.parse(await request.json())
    const existing = await prisma.appSetting.findUnique({ where: { key: KEY } })
    const previous = existing ? schema.parse(JSON.parse(existing.value)) : { appId: '', appSecret: '', pages: [] }
    const value = { ...incoming, appSecret: incoming.appSecret === '••••••••' ? previous.appSecret : incoming.appSecret,
      pages: incoming.pages.map((page) => ({ ...page, accessToken: page.accessToken === '••••••••' ? previous.pages.find((old) => old.pageId === page.pageId)?.accessToken ?? '' : page.accessToken })) }
    await prisma.appSetting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(value), updatedBy: user.id }, create: { key: KEY, value: JSON.stringify(value), updatedBy: user.id } })
    return successResponse({ saved: true })
  } catch { return errorResponse('Invalid Facebook settings', 400) }
}
