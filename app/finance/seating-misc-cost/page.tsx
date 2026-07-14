import { redirect } from 'next/navigation'

/** Misc / Other cost entry now lives on Sales Team Cost. */
export default function SeatingMiscCostPage() {
  redirect('/finance/sales-team-cost')
}
