import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { backendFetch } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { Workspace } from '@/types/models'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  const workspaces = await backendFetch<Workspace[]>('/api/workspaces')
  if (workspaces === null) redirect('/login')

  const hasAccess = workspaces.some((w) => w.id === workspaceId)
  if (!hasAccess) redirect('/dashboard')

  const currentWorkspace = workspaces.find((w) => w.id === workspaceId)

  return (
    <SidebarProvider>
      <AppSidebar workspaces={workspaces} currentWorkspaceId={workspaceId} />
      <main className="flex h-screen w-full flex-col overflow-hidden bg-background">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6 lg:h-[60px]">
          <SidebarTrigger />
          <div className="w-full flex-1">
            <h1 className="text-[15px] font-semibold tracking-tight">{currentWorkspace?.name}</h1>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </SidebarProvider>
  )
}
