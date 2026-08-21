import { headers } from 'next/headers'
import { MessageSquare, Phone } from 'lucide-react'
import {
  loadLeadQrPublicLink,
  markLeadQrPublicLinkOpened,
  normalizeLeadQrPhone,
  parseLeadQrDeviceInfo,
  recordLeadQrEvent,
} from '@/lib/lead-qr'

export const dynamic = 'force-dynamic'

function PageShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
        <div className="w-full rounded-3xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl shadow-black/30">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-cyan-300">
              Lead Contact
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm leading-6 text-slate-300">{description}</p>
          </div>
          {children ? <div className="mt-6">{children}</div> : null}
        </div>
      </div>
    </div>
  )
}

export default async function LeadContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ error?: string }>
}) {
  const { token } = await params
  const resolvedSearchParams = (await searchParams) ?? {}
  const publicLink = await loadLeadQrPublicLink(token)

  if (!publicLink) {
    return (
      <PageShell
        title="QR link expired"
        description="This lead QR link is invalid or has expired. Please rescan it from the CRM."
      />
    )
  }

  const lead = publicLink.lead
  const primaryCallPhone = normalizeLeadQrPhone(lead.phoneNumber ?? '')
  const alternateCallPhone = normalizeLeadQrPhone(lead.alternateNumber ?? '')
  const hasAlternateCall = Boolean(alternateCallPhone && alternateCallPhone !== primaryCallPhone)

  const headerStore = await headers()
  const requestHeaders = new Headers(headerStore)
  const pathname = `/lead-contact/${token}`
  const deviceInfo = parseLeadQrDeviceInfo(requestHeaders.get('user-agent'))

  await markLeadQrPublicLinkOpened(publicLink.id)

  await recordLeadQrEvent({
    headers: requestHeaders,
    requestUrl: pathname,
    route: pathname,
    method: 'GET',
    lead,
    actorUserId: publicLink.actorUser.id,
    actorRole: publicLink.actorUser.role,
    actorName: publicLink.actorUser.name ?? null,
    auditAction: 'QR_PUBLIC_PAGE_VIEWED',
    crmAction: 'CRM_LEAD_QR_PUBLIC_PAGE_VIEWED',
    summary: `QR contact page viewed from ${deviceInfo.label} for ${lead.patientName || lead.leadRef || 'lead'}`,
    source: 'public_page',
  })

  const errorMessage =
    resolvedSearchParams.error === 'no-phone'
      ? 'This lead does not currently have a valid phone number available.'
      : null

  return (
    <PageShell
      title={lead.patientName || 'Lead Contact'}
      description={`Record ID ${lead.leadRef || lead.id}. Actions on this page are tracked in CRM along with device & browser details.`}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-slate-200">Contact Patient / Lead</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Choose an option below to initiate a phone call or WhatsApp message. Activity is logged in CRM.
          </p>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="grid gap-3">
          <a
            href={`/api/lead-contact/${encodeURIComponent(token)}/call`}
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-500 px-4 py-4 text-base font-semibold text-slate-950 transition hover:bg-cyan-400 shadow-lg shadow-cyan-500/20"
          >
            <Phone className="h-5 w-5" />
            Click here to call
          </a>

          {hasAlternateCall ? (
            <a
              href={`/api/lead-contact/${encodeURIComponent(token)}/call?target=alternate`}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-400 px-4 py-4 text-base font-semibold text-slate-950 transition hover:bg-sky-300 shadow-lg shadow-sky-500/20"
            >
              <Phone className="h-5 w-5" />
              Click here to call alternate number
            </a>
          ) : null}

          <a
            href={`/api/lead-contact/${encodeURIComponent(token)}/whatsapp`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-4 py-4 text-base font-semibold text-slate-950 transition hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
          >
            <MessageSquare className="h-5 w-5" />
            Chat on WhatsApp
          </a>
        </div>

        <p className="text-center text-xs leading-5 text-slate-500">
          Please do not share this page link outside the intended patient contact flow.
        </p>
      </div>
    </PageShell>
  )
}
