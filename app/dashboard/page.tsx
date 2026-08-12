import { backendFetch } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DashboardIndexPage() {
  // GET /api/workspaces auto-provisions a default "Personal Workspace" on
  // the backend if the user has none yet (see app/api/routes/workspaces.py),
  // so this page just needs to redirect to whichever workspace comes back.
  const workspaces = await backendFetch<Array<{ id: string }>>('/api/workspaces')

  if (workspaces === null) {
    redirect('/login')
  }

  redirect(`/dashboard/${workspaces[0].id}`)
}
