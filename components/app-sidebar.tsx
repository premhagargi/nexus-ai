'use client'

import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { Workspace } from '@prisma/client'
import Link from 'next/link'
import { LayoutDashboard, MessageSquare, Files, CheckSquare, Settings, Activity, ChevronsUpDown, LogOut, Sparkles } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useState, useOptimistic, startTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createWorkspace } from '@/app/actions'
import { Loader2, Plus } from 'lucide-react'

export function AppSidebar({ workspaces, currentWorkspaceId }: { workspaces: Workspace[], currentWorkspaceId?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0]

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [optimisticWorkspaces, addOptimisticWorkspace] = useOptimistic(
    workspaces,
    (state, newWorkspace: Workspace) => [...state, newWorkspace]
  )

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return

    const name = newWorkspaceName.trim()
    setIsDialogOpen(false)
    setNewWorkspaceName('')

    startTransition(() => {
      addOptimisticWorkspace({
        id: 'temp-' + Date.now(),
        name,
        slug: 'temp',
        ownerId: 'temp',
        createdAt: new Date(),
      })
    })

    try {
      const newId = await createWorkspace(name)
      router.push(`/dashboard/${newId}`)
    } catch (error) {
      console.error(error)
      // On error, the optimistic update will be reverted naturally when the server state refreshes
    }
  }

  return (
    <Sidebar className="border-r border-white/5 bg-background/40 backdrop-blur-2xl shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
      <SidebarHeader className="pt-6 pb-4 px-4">
        <div className="flex items-center gap-3 px-2 pb-6 mb-2 border-b border-white/5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">Nexus AI</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 transition-all duration-300 ease-out hover:shadow-[0_0_15px_rgba(255,255,255,0.03)] rounded-xl group outline-none">
            <div className="flex flex-col items-start text-left gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Workspace</span>
              <span className="truncate font-semibold text-sm group-hover:text-indigo-300 transition-colors">{currentWorkspace?.name || 'Nexus AI'}</span>
            </div>
            <ChevronsUpDown className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-background/95 backdrop-blur-xl border-white/10 rounded-xl" align="start">
            {optimisticWorkspaces.map(w => (
              <DropdownMenuItem key={w.id} className="cursor-pointer hover:bg-white/10 transition-colors focus:bg-white/10 py-2.5 rounded-lg">
                <Link href={`/dashboard/${w.id}`} className="w-full font-medium flex items-center">
                  {w.id.startsWith('temp-') ? <Loader2 className="h-3 w-3 animate-spin mr-2 inline" /> : null}
                  {w.name}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-white/10 my-1" />
            <DropdownMenuItem className="cursor-pointer py-2.5 rounded-lg text-indigo-400 hover:text-indigo-300 focus:text-indigo-300" onSelect={(e) => { e.preventDefault(); setIsDialogOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-2xl border-white/10 text-foreground shadow-2xl">
            <form onSubmit={handleCreateWorkspace}>
              <DialogHeader>
                <DialogTitle className="text-xl">Create Workspace</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Add a new knowledge workspace for your team.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Workspace Name
                  </Label>
                  <Input
                    id="name"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="bg-white/5 border-white/10 focus-visible:ring-indigo-500"
                    placeholder="e.g. Engineering Docs"
                    autoComplete="off"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="hover:bg-white/5">
                  Cancel
                </Button>
                <Button type="submit" disabled={!newWorkspaceName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20">
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SidebarHeader>
      
      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 mb-3 px-2">Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.push(`/dashboard/${currentWorkspace?.id}`)} isActive={pathname === `/dashboard/${currentWorkspace?.id}`} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer">
                  <LayoutDashboard className="h-[18px] w-[18px] mr-2.5" />
                  <span className="font-medium text-[15px]">Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.push(`/dashboard/${currentWorkspace?.id}/chat`)} isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/chat`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer">
                  <MessageSquare className="h-[18px] w-[18px] mr-2.5" />
                  <span className="font-medium text-[15px]">AI Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.push(`/dashboard/${currentWorkspace?.id}/documents`)} isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/documents`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer">
                  <Files className="h-[18px] w-[18px] mr-2.5" />
                  <span className="font-medium text-[15px]">Knowledge Base</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.push(`/dashboard/${currentWorkspace?.id}/tasks`)} isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/tasks`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer">
                  <CheckSquare className="h-[18px] w-[18px] mr-2.5" />
                  <span className="font-medium text-[15px]">Tasks</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.push(`/dashboard/${currentWorkspace?.id}/logs`)} isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/logs`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer">
                  <Activity className="h-[18px] w-[18px] mr-2.5" />
                  <span className="font-medium text-[15px]">Tool Logs</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => router.push(`/dashboard/${currentWorkspace?.id}/settings`)} isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/settings`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer">
                  <Settings className="h-[18px] w-[18px] mr-2.5" />
                  <span className="font-medium text-[15px]">Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <form action="/auth/signout" method="post">
              <SidebarMenuButton type="submit" className="w-full rounded-xl transition-all duration-300 hover:bg-red-500/10 text-red-400 hover:text-red-300 h-12 flex items-center justify-center group border border-transparent hover:border-red-500/20">
                <LogOut className="h-[18px] w-[18px] mr-2.5 group-hover:-translate-x-1 transition-transform" />
                <span className="font-semibold text-[15px]">Sign Out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
