import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  const session = await getSession()
  if (!session?.userId) redirect('/login')

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { workspace: true }
  })

  const hasAccess = memberships.some(m => m.workspaceId === workspaceId)
  if (!hasAccess) redirect('/dashboard')

  const workspaces = memberships.map(m => m.workspace)
  const currentWorkspace = workspaces.find(w => w.id === workspaceId)

  return (
    <SidebarProvider>
      <AppSidebar workspaces={workspaces} currentWorkspaceId={workspaceId} />
      <main className="flex w-full flex-col overflow-hidden bg-background">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6 lg:h-[60px]">
          <SidebarTrigger />
          <div className="w-full flex-1">
            <h1 className="text-[15px] font-semibold tracking-tight">{currentWorkspace?.name}</h1>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6 relative">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}
