import { mapCircleCode } from '@/lib/mysql-code-mappings'

export type IncomingLeadSummary = {
  campaignId: string | null
  leadDate: string | null
  category: string | null
  treatment: string | null
  circle: string | null
  city: string | null
  patientName: string | null
  phone: string | null
  email: string | null
}

export type IncomingLeadEditableFields = {
  Lead_Date?: string | null
  Patient_Number?: string | null
  AlternativePhone?: string | null
  Whatsapp?: string | null
  Patient_Name?: string | null
  PatientEmail?: string | null
  Age?: string | null
  Sex?: string | null
  Profession?: string | null
  Circle?: string | null
  city_option?: string | null
  address?: string | null
  website?: string | null
  ip?: string | null
  Category?: string | null
  Treatment?: string | null
  DiseaseDetails?: string | null
  Status?: string | null
  SubStatus?: string | null
  MOP?: string | null
  Source?: string | null
  Lead_Source?: string | null
  campaign_id?: string | null
  source?: string | null
  externalCampaignId?: string | null
  circle?: string | null
  city?: string | null
  patientName?: string | null
  phone?: string | null
  email?: string | null
}

export type IncomingLeadEditValues = {
  Lead_Date: string
  Patient_Number: string
  AlternativePhone: string
  Whatsapp: string
  Patient_Name: string
  PatientEmail: string
  Age: string
  Sex: string
  Profession: string
  Circle: string
  city_option: string
  address: string
  website: string
  ip: string
  Category: string
  Treatment: string
  DiseaseDetails: string
  Status: string
  SubStatus: string
  MOP: string
  Source: string
  Lead_Source: string
  campaign_id: string
}

function toEditableString(value: unknown) {
  if (value == null) return ''
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value).trim()
}

function getFirstMatchingField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (key in record) {
      return record[key]
    }
  }
  return undefined
}

export function toNullableString(value: unknown) {
  if (value == null) return null
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

export function getIncomingLeadPayloadRecord(payload: unknown) {
  const root =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? ({ ...(payload as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  const nested = root.data
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return {
      root,
      target: { ...(nested as Record<string, unknown>) } as Record<string, unknown>,
      nestedInData: true,
    }
  }

  return {
    root,
    target: root,
    nestedInData: false,
  }
}

export function extractIncomingLeadSummary(payload: unknown): IncomingLeadSummary {
  const { target: record } = getIncomingLeadPayloadRecord(payload)
  const mysqlLead =
    record.mysqlLead && typeof record.mysqlLead === 'object' && !Array.isArray(record.mysqlLead)
      ? (record.mysqlLead as Record<string, unknown>)
      : null

  if (mysqlLead) {
    return {
      campaignId: toNullableString(
        mysqlLead.campaign_id ?? mysqlLead.campaignId ?? mysqlLead['campaign id'],
      ),
      leadDate: toNullableString(
        mysqlLead.LeadEntryDate ??
          mysqlLead.leadEntryDate ??
          mysqlLead.Lead_Date ??
          mysqlLead.leadDate ??
          mysqlLead.lead_date,
      ),
      category: toNullableString(mysqlLead.Category ?? mysqlLead.category),
      treatment: toNullableString(mysqlLead.Treatment ?? mysqlLead.treatment),
      circle: mapCircleCode(
        (mysqlLead.Circle ?? mysqlLead.circle) as string | number | null | undefined,
      ),
      city: toNullableString(mysqlLead.city_option ?? mysqlLead.city),
      patientName: toNullableString(
        mysqlLead.Patient_Name ?? mysqlLead.patientName ?? mysqlLead.patient_name,
      ),
      phone: toNullableString(
        mysqlLead.Patient_Number ??
          mysqlLead.phone ??
          mysqlLead.phoneNumber ??
          mysqlLead.mobile ??
          mysqlLead.mobileNumber,
      ),
      email: toNullableString(mysqlLead.PatientEmail ?? mysqlLead.email),
    }
  }

  return {
    campaignId: toNullableString(
      record.campaignId ?? record['campaign id'] ?? record.campaign_id ?? record.campaign,
    ),
    leadDate: toNullableString(
      record.LeadEntryDate ??
        record.leadEntryDate ??
        record.Lead_Date ??
        record.leadDate ??
        record.lead_date,
    ),
    category: toNullableString(record.Category ?? record.category),
    treatment: toNullableString(record.Treatment ?? record.treatment),
    circle: mapCircleCode((record.Circle ?? record.circle) as string | number | null | undefined),
    city: toNullableString(record.city_option ?? record.city),
    patientName: toNullableString(record.name ?? record.patientName ?? record.patient_name),
    phone: toNullableString(
      record.phone ?? record.phoneNumber ?? record.mobile ?? record.mobileNumber,
    ),
    email: toNullableString(record.email),
  }
}

export function extractIncomingLeadEditValues(
  payload: unknown,
  fallbacks?: {
    externalCampaignId?: string | null
    source?: string | null
  },
): IncomingLeadEditValues {
  const { target: record } = getIncomingLeadPayloadRecord(payload)
  const mysqlLead =
    record.mysqlLead && typeof record.mysqlLead === 'object' && !Array.isArray(record.mysqlLead)
      ? (record.mysqlLead as Record<string, unknown>)
      : null
  const sourceRecord = mysqlLead ?? record

  return {
    Lead_Date: toEditableString(
      getFirstMatchingField(sourceRecord, [
        'LeadEntryDate',
        'leadEntryDate',
        'Lead_Date',
        'leadDate',
        'lead_date',
      ]),
    ),
    Patient_Number: toEditableString(
      getFirstMatchingField(sourceRecord, [
        'Patient_Number',
        'phone',
        'phoneNumber',
        'mobile',
        'mobileNumber',
      ]),
    ),
    AlternativePhone: toEditableString(
      getFirstMatchingField(sourceRecord, ['AlternativePhone', 'alternatePhone', 'alternateNumber']),
    ),
    Whatsapp: toEditableString(
      getFirstMatchingField(sourceRecord, ['Whatsapp', 'whatsapp']),
    ),
    Patient_Name: toEditableString(
      getFirstMatchingField(sourceRecord, ['Patient_Name', 'patientName', 'patient_name', 'name']),
    ),
    PatientEmail: toEditableString(
      getFirstMatchingField(sourceRecord, ['PatientEmail', 'patientEmail', 'email']),
    ),
    Age: toEditableString(getFirstMatchingField(sourceRecord, ['Age', 'age'])),
    Sex: toEditableString(getFirstMatchingField(sourceRecord, ['Sex', 'sex'])),
    Profession: toEditableString(
      getFirstMatchingField(sourceRecord, ['Profession', 'profession']),
    ),
    Circle: toEditableString(
      getFirstMatchingField(sourceRecord, ['Circle', 'circle']),
    ),
    city_option: toEditableString(
      getFirstMatchingField(sourceRecord, ['city_option', 'city']),
    ),
    address: toEditableString(getFirstMatchingField(sourceRecord, ['address'])),
    website: toEditableString(getFirstMatchingField(sourceRecord, ['website'])),
    ip: toEditableString(getFirstMatchingField(sourceRecord, ['ip'])),
    Category: toEditableString(getFirstMatchingField(sourceRecord, ['Category', 'category'])),
    Treatment: toEditableString(getFirstMatchingField(sourceRecord, ['Treatment', 'treatment'])),
    DiseaseDetails: toEditableString(
      getFirstMatchingField(sourceRecord, ['DiseaseDetails', 'diseaseDetails']),
    ),
    Status: toEditableString(getFirstMatchingField(sourceRecord, ['Status', 'status'])),
    SubStatus: toEditableString(
      getFirstMatchingField(sourceRecord, ['SubStatus', 'subStatus']),
    ),
    MOP: toEditableString(getFirstMatchingField(sourceRecord, ['MOP', 'modeOfPayment'])),
    Source: toEditableString(
      getFirstMatchingField(sourceRecord, ['Source', 'source']) ?? fallbacks?.source,
    ),
    Lead_Source: toEditableString(
      getFirstMatchingField(sourceRecord, ['Lead_Source', 'campaignName', 'leadSource']),
    ),
    campaign_id: toEditableString(
      getFirstMatchingField(sourceRecord, [
        'campaign_id',
        'campaignId',
        'campaign id',
        'campaign',
      ]) ?? fallbacks?.externalCampaignId,
    ),
  }
}

function setFirstMatchingField(
  record: Record<string, unknown>,
  keys: string[],
  value: string | null,
) {
  const existingKey = keys.find((key) => key in record)
  const targetKey = existingKey ?? keys[0]
  record[targetKey] = value
}

export function updateIncomingLeadPayload(
  payload: unknown,
  updates: IncomingLeadEditableFields,
) {
  const { root, target, nestedInData } = getIncomingLeadPayloadRecord(payload)
  const mysqlLead =
    target.mysqlLead && typeof target.mysqlLead === 'object' && !Array.isArray(target.mysqlLead)
      ? ({ ...(target.mysqlLead as Record<string, unknown>) } as Record<string, unknown>)
      : null

  const mutableTarget = { ...target }

  if (mysqlLead) {
    if (updates.Lead_Date !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['LeadEntryDate', 'leadEntryDate', 'leadDate', 'lead_date'],
        updates.Lead_Date ?? null,
      )
    }
    if (updates.Patient_Number !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['Patient_Number', 'phone', 'phoneNumber', 'mobile', 'mobileNumber'],
        updates.Patient_Number ?? null,
      )
    }
    if (updates.AlternativePhone !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['AlternativePhone', 'alternatePhone', 'alternateNumber'],
        updates.AlternativePhone ?? null,
      )
    }
    if (updates.Whatsapp !== undefined) {
      setFirstMatchingField(mysqlLead, ['Whatsapp', 'whatsapp'], updates.Whatsapp ?? null)
    }
    if (updates.Patient_Name !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['Patient_Name', 'patientName', 'patient_name'],
        updates.Patient_Name ?? null,
      )
    }
    if (updates.PatientEmail !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['PatientEmail', 'patientEmail', 'email'],
        updates.PatientEmail ?? null,
      )
    }
    if (updates.Age !== undefined) {
      setFirstMatchingField(mysqlLead, ['Age', 'age'], updates.Age ?? null)
    }
    if (updates.Sex !== undefined) {
      setFirstMatchingField(mysqlLead, ['Sex', 'sex'], updates.Sex ?? null)
    }
    if (updates.Profession !== undefined) {
      setFirstMatchingField(mysqlLead, ['Profession', 'profession'], updates.Profession ?? null)
    }
    if (updates.externalCampaignId !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['campaign_id', 'campaignId', 'campaign id'],
        updates.externalCampaignId ?? null,
      )
    }
    if (updates.campaign_id !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['campaign_id', 'campaignId', 'campaign id'],
        updates.campaign_id ?? null,
      )
    }
    if (updates.circle !== undefined) {
      setFirstMatchingField(mysqlLead, ['Circle', 'circle'], updates.circle ?? null)
    }
    if (updates.Circle !== undefined) {
      setFirstMatchingField(mysqlLead, ['Circle', 'circle'], updates.Circle ?? null)
    }
    if (updates.city !== undefined) {
      setFirstMatchingField(mysqlLead, ['city_option', 'city'], updates.city ?? null)
    }
    if (updates.city_option !== undefined) {
      setFirstMatchingField(mysqlLead, ['city_option', 'city'], updates.city_option ?? null)
    }
    if (updates.address !== undefined) {
      setFirstMatchingField(mysqlLead, ['address'], updates.address ?? null)
    }
    if (updates.website !== undefined) {
      setFirstMatchingField(mysqlLead, ['website'], updates.website ?? null)
    }
    if (updates.ip !== undefined) {
      setFirstMatchingField(mysqlLead, ['ip'], updates.ip ?? null)
    }
    if (updates.Category !== undefined) {
      setFirstMatchingField(mysqlLead, ['Category', 'category'], updates.Category ?? null)
    }
    if (updates.Treatment !== undefined) {
      setFirstMatchingField(mysqlLead, ['Treatment', 'treatment'], updates.Treatment ?? null)
    }
    if (updates.DiseaseDetails !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['DiseaseDetails', 'diseaseDetails'],
        updates.DiseaseDetails ?? null,
      )
    }
    if (updates.Status !== undefined) {
      setFirstMatchingField(mysqlLead, ['Status', 'status'], updates.Status ?? null)
    }
    if (updates.SubStatus !== undefined) {
      setFirstMatchingField(mysqlLead, ['SubStatus', 'subStatus'], updates.SubStatus ?? null)
    }
    if (updates.MOP !== undefined) {
      setFirstMatchingField(mysqlLead, ['MOP', 'modeOfPayment'], updates.MOP ?? null)
    }
    if (updates.Source !== undefined) {
      setFirstMatchingField(mysqlLead, ['Source', 'source'], updates.Source ?? null)
    }
    if (updates.Lead_Source !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['Lead_Source', 'campaignName', 'leadSource'],
        updates.Lead_Source ?? null,
      )
    }
    if (updates.patientName !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['Patient_Name', 'patientName', 'patient_name'],
        updates.patientName ?? null,
      )
    }
    if (updates.phone !== undefined) {
      setFirstMatchingField(
        mysqlLead,
        ['Patient_Number', 'phone', 'phoneNumber', 'mobile', 'mobileNumber'],
        updates.phone ?? null,
      )
    }
    if (updates.email !== undefined) {
      setFirstMatchingField(mysqlLead, ['PatientEmail', 'email'], updates.email ?? null)
    }

    mutableTarget.mysqlLead = mysqlLead
  } else {
    if (updates.Lead_Date !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['LeadEntryDate', 'leadEntryDate', 'leadDate', 'lead_date', 'Lead_Date'],
        updates.Lead_Date ?? null,
      )
    }
    if (updates.Patient_Number !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['phone', 'phoneNumber', 'mobile', 'mobileNumber', 'Patient_Number'],
        updates.Patient_Number ?? null,
      )
    }
    if (updates.AlternativePhone !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['alternatePhone', 'alternateNumber', 'AlternativePhone'],
        updates.AlternativePhone ?? null,
      )
    }
    if (updates.Whatsapp !== undefined) {
      setFirstMatchingField(mutableTarget, ['whatsapp', 'Whatsapp'], updates.Whatsapp ?? null)
    }
    if (updates.Patient_Name !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['patientName', 'patient_name', 'name', 'Patient_Name'],
        updates.Patient_Name ?? null,
      )
    }
    if (updates.PatientEmail !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['email', 'patientEmail', 'PatientEmail'],
        updates.PatientEmail ?? null,
      )
    }
    if (updates.Age !== undefined) {
      setFirstMatchingField(mutableTarget, ['age', 'Age'], updates.Age ?? null)
    }
    if (updates.Sex !== undefined) {
      setFirstMatchingField(mutableTarget, ['sex', 'Sex'], updates.Sex ?? null)
    }
    if (updates.Profession !== undefined) {
      setFirstMatchingField(mutableTarget, ['profession', 'Profession'], updates.Profession ?? null)
    }
    if (updates.externalCampaignId !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['campaignId', 'campaign_id', 'campaign id', 'campaign'],
        updates.externalCampaignId ?? null,
      )
    }
    if (updates.campaign_id !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['campaignId', 'campaign_id', 'campaign id', 'campaign'],
        updates.campaign_id ?? null,
      )
    }
    if (updates.circle !== undefined) {
      setFirstMatchingField(mutableTarget, ['circle', 'Circle'], updates.circle ?? null)
    }
    if (updates.Circle !== undefined) {
      setFirstMatchingField(mutableTarget, ['circle', 'Circle'], updates.Circle ?? null)
    }
    if (updates.city !== undefined) {
      setFirstMatchingField(mutableTarget, ['city', 'city_option'], updates.city ?? null)
    }
    if (updates.city_option !== undefined) {
      setFirstMatchingField(mutableTarget, ['city', 'city_option'], updates.city_option ?? null)
    }
    if (updates.address !== undefined) {
      setFirstMatchingField(mutableTarget, ['address'], updates.address ?? null)
    }
    if (updates.website !== undefined) {
      setFirstMatchingField(mutableTarget, ['website'], updates.website ?? null)
    }
    if (updates.ip !== undefined) {
      setFirstMatchingField(mutableTarget, ['ip'], updates.ip ?? null)
    }
    if (updates.Category !== undefined) {
      setFirstMatchingField(mutableTarget, ['category', 'Category'], updates.Category ?? null)
    }
    if (updates.Treatment !== undefined) {
      setFirstMatchingField(mutableTarget, ['treatment', 'Treatment'], updates.Treatment ?? null)
    }
    if (updates.DiseaseDetails !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['diseaseDetails', 'DiseaseDetails'],
        updates.DiseaseDetails ?? null,
      )
    }
    if (updates.Status !== undefined) {
      setFirstMatchingField(mutableTarget, ['status', 'Status'], updates.Status ?? null)
    }
    if (updates.SubStatus !== undefined) {
      setFirstMatchingField(mutableTarget, ['subStatus', 'SubStatus'], updates.SubStatus ?? null)
    }
    if (updates.MOP !== undefined) {
      setFirstMatchingField(mutableTarget, ['modeOfPayment', 'MOP'], updates.MOP ?? null)
    }
    if (updates.Source !== undefined) {
      setFirstMatchingField(mutableTarget, ['source', 'Source'], updates.Source ?? null)
    }
    if (updates.Lead_Source !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['campaignName', 'Lead_Source', 'leadSource'],
        updates.Lead_Source ?? null,
      )
    }
    if (updates.patientName !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['patientName', 'patient_name', 'name'],
        updates.patientName ?? null,
      )
    }
    if (updates.phone !== undefined) {
      setFirstMatchingField(
        mutableTarget,
        ['phone', 'phoneNumber', 'mobile', 'mobileNumber'],
        updates.phone ?? null,
      )
    }
    if (updates.email !== undefined) {
      setFirstMatchingField(mutableTarget, ['email'], updates.email ?? null)
    }
  }

  if (nestedInData) {
    root.data = mutableTarget
    return root
  }

  return mutableTarget
}
