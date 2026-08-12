import { redirect } from 'next/navigation'
import { backendFetch } from '@/lib/auth'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  const workspace = await backendFetch<{ id: string; name: string; slug: string; ownerEmail: string }>(
    `/api/workspaces/${workspaceId}`
  )

  if (workspace === null) redirect('/login')

  return (
    <SettingsClient
      workspaceId={workspaceId}
      initialName={workspace.name}
      initialSlug={workspace.slug}
      ownerEmail={workspace.ownerEmail}
    />
  )
}
