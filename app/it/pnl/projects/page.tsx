import { redirect } from 'next/navigation'

/** Deep links redirect to main IT P&L — projects are managed on the Projects tab. */
export default function ItProjectsRedirectPage() {
  redirect('/it/pnl?tab=projects')
}
