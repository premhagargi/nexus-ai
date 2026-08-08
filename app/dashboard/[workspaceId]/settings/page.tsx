import { requireWorkspaceAccess } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const auth = await requireWorkspaceAccess(workspaceId)

  if (!auth) {
    redirect('/dashboard')
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { owner: true }
  })

  if (!workspace) return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
      <p className="text-lg font-semibold text-foreground">Workspace not found</p>
      <p className="text-sm">This workspace may have been deleted or you don&apos;t have access.</p>
    </div>
  )

  return (
    <SettingsClient
      workspaceId={workspaceId}
      initialName={workspace.name}
      initialSlug={workspace.slug}
      ownerEmail={workspace.owner.email}
    />
  )
}
