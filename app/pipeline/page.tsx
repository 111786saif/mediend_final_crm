import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

/**
 * Legacy/generic `/pipeline` path — redirect to the role-specific pipeline page.
 * There is no standalone Pipeline page at this URL.
 */
export default async function PipelineRedirectPage() {
  const user = await getSession()

  if (!user) {
    redirect('/login')
  }

  switch (user.role) {
    case 'SUPER_ADMIN':
      redirect('/executive-assistant/pipeline')
    case 'BD':
    case 'ADMIN':
      redirect('/bd/pipeline')
    case 'TEAM_LEAD':
    case 'ASSISTANT_CATEGORY_MANAGER':
    case 'CATEGORY_MANAGER':
    case 'SALES_HEAD':
      redirect('/team-lead/pipeline')
    case 'EXECUTIVE_ASSISTANT':
      redirect('/executive-assistant/pipeline')
    default:
      redirect('/home')
  }
}
