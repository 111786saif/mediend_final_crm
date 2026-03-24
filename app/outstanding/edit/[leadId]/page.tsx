import { redirect } from 'next/navigation'

export default async function OutstandingEditRedirectPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params
  redirect(`/pl/outstanding/${leadId}`)
}
