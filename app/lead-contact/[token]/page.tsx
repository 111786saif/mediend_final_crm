import { headers } from 'next/headers'
import { Phone } from 'lucide-react'
import {
  loadLeadQrPublicLink,
  markLeadQrPublicLinkOpened,
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
      ? 'This lead does not currently have a valid phone number to call.'
      : null

  return (
    <PageShell
      title={lead.patientName || 'Lead Contact'}
      description={`Record ID ${lead.leadRef || lead.id}. This access is tracked in CRM along with mobile device and browser details.`}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-slate-200">Click here to call</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            The action will be recorded against the CRM user who opened this QR in the browser.
          </p>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <a
          href={`/api/lead-contact/${encodeURIComponent(token)}/call`}
          className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-cyan-500 px-4 py-4 text-base font-semibold text-slate-950 transition hover:bg-cyan-400"
        >
          <Phone className="h-5 w-5" />
          Click here to call
        </a>

        <p className="text-center text-xs leading-5 text-slate-500">
          Please do not share this page link outside the intended patient contact flow.
        </p>
      </div>
    </PageShell>
  )
}
