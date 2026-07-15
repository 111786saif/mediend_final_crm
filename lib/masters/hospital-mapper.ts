import { parseHospitalDetails, type HospitalMasterDetails } from '@/lib/masters/hospital'

export type HospitalMasterRow = {
  id: string
  name: string
  address: string | null
  googleMapLink: string | null
  mouAgreementUrl: string | null
  hospitalShare: number | null
  mediendShare: number | null
  details: unknown
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  insuranceProviders: { insuranceId: string; insurance: { id: string; name: string } }[]
}

export function mapHospital(row: HospitalMasterRow) {
  const details = parseHospitalDetails(row.details) as HospitalMasterDetails
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    googleMapLink: row.googleMapLink,
    mouAgreementUrl: row.mouAgreementUrl,
    hospitalShare: row.hospitalShare,
    mediendShare: row.mediendShare,
    details,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    insuranceIds: row.insuranceProviders.map((p) => p.insuranceId),
    insuranceProviders: row.insuranceProviders.map((p) => ({
      id: p.insurance.id,
      name: p.insurance.name,
    })),
  }
}

export const hospitalInclude = {
  insuranceProviders: {
    include: { insurance: { select: { id: true, name: true } } },
  },
} as const
