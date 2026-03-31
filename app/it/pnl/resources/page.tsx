import { redirect } from 'next/navigation'

/** Deep links redirect to main IT P&L — resources are managed on the Resources tab. */
export default function ItResourcesRedirectPage() {
  redirect('/it/pnl?tab=resources')
}
