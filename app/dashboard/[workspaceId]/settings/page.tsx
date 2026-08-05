import prisma from '@/lib/prisma'
import { SettingsClient } from './settings-client'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  
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
