'use client'

import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import type { Workspace } from '@/types/models'
import Link from 'next/link'
import { LayoutDashboard, MessageSquare, Files, CheckSquare, Settings, Activity, ChevronsUpDown, LogOut, Sparkles, Gauge } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuShortcut } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useState, useOptimistic, startTransition, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Field, FieldGroup } from '@/components/ui/field'
import { Plus } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

export function AppSidebar({ workspaces, currentWorkspaceId }: { workspaces: Workspace[], currentWorkspaceId?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0]

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createdWorkspaceId, setCreatedWorkspaceId] = useState<string | null>(null)
  
  const [optimisticWorkspaces, addOptimisticWorkspace] = useOptimistic(
    workspaces,
    (state, newWorkspace: Workspace) => [...state, newWorkspace]
  )

  useEffect(() => {
    if (createdWorkspaceId && currentWorkspaceId === createdWorkspaceId) {
      setIsCreating(false)
      setCreatedWorkspaceId(null)
    }
  }, [currentWorkspaceId, createdWorkspaceId])

  useEffect(() => {
    if (isCreating) {
      const timer = setTimeout(() => {
        setIsCreating(false)
        setCreatedWorkspaceId(null)
      }, 15000)
      return () => clearTimeout(timer)
    }
  }, [isCreating])

  const handleWorkspaceSwitch = (targetWorkspaceId: string) => {
    if (targetWorkspaceId === currentWorkspace?.id) return
    if (currentWorkspaceId && pathname.startsWith(`/dashboard/${currentWorkspaceId}`)) {
      const subPath = pathname.slice(`/dashboard/${currentWorkspaceId}`.length)
      router.push(`/dashboard/${targetWorkspaceId}${subPath}`)
    } else {
      router.push(`/dashboard/${targetWorkspaceId}`)
    }
  }

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newWorkspaceName.trim() || isCreating) return

    const name = newWorkspaceName.trim()
    setIsCreating(true)
    setIsDialogOpen(false)
    setNewWorkspaceName('')

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed to create workspace')
      const created = await res.json()
      const newId = created.id
      setCreatedWorkspaceId(newId)

      startTransition(() => {
        addOptimisticWorkspace({
          id: newId,
          name,
          slug: created.slug,
          ownerId: '',
          createdAt: new Date().toISOString(),
          role: 'OWNER',
        })
      })

      const targetUrl = currentWorkspaceId && pathname.startsWith(`/dashboard/${currentWorkspaceId}`)
        ? `/dashboard/${newId}${pathname.slice(`/dashboard/${currentWorkspaceId}`.length)}`
        : `/dashboard/${newId}`

      router.push(targetUrl)
      router.refresh()
    } catch (error) {
      console.error(error)
      setIsCreating(false)
      setCreatedWorkspaceId(null)
    }
  }

  return (
    <>
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md transition-all duration-300 animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card/90 border border-border/50 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 min-w-[280px]">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
              <Spinner className="h-10 w-10 text-primary animate-spin relative z-10" />
            </div>
            <div className="flex flex-col items-center text-center gap-1">
              <p className="text-base font-semibold text-foreground">Creating Workspace...</p>
              <p className="text-xs text-muted-foreground">Setting up your space and switching views</p>
            </div>
          </div>
        </div>
      )}

      <Sidebar className="border-r border-border/50 bg-background/40 backdrop-blur-2xl shadow-sm">
        <SidebarHeader className="pt-6 pb-4 px-4">
          <div className="flex items-center gap-3 px-2 pb-6 mb-2 border-b border-border/50">
            <div className="flex h-9 w-9 items-center justify-center">
              <img src="/ai-magic-icon.webp" alt="Nexus AI" className="h-full w-full object-contain" />
            </div>
            <span className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">Nexus AI</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="ghost" className="w-full flex items-center justify-between px-4 py-7 bg-muted/50 hover:bg-muted border border-border/50 transition-all duration-300 ease-out hover:shadow-[0_0_15px_rgba(255,255,255,0.03)] rounded-xl group outline-none">
                <div className="flex flex-col items-start text-left gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Workspace</span>
                  <span className="truncate font-semibold text-sm group-hover:text-indigo-300 transition-colors">{currentWorkspace?.name || 'Nexus AI'}</span>
                </div>
                <ChevronsUpDown className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-background/95 backdrop-blur-xl border-border rounded-xl" align="start">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Your Workspaces</DropdownMenuLabel>
                {optimisticWorkspaces.map(w => (
                  <DropdownMenuItem key={w.id} onClick={() => handleWorkspaceSwitch(w.id)} className="cursor-pointer">
                    {w.id.startsWith('temp-') ? <Spinner className="h-3 w-3 mr-2 inline" /> : null}
                    {w.name}
                    {w.id === currentWorkspace?.id && <DropdownMenuShortcut>✓</DropdownMenuShortcut>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-muted" />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setIsDialogOpen(true)} closeOnClick={false} className="cursor-pointer">
                  <Plus className="mr-2 h-4 w-4" />
                  New Workspace
                  <DropdownMenuShortcut>⌘+N</DropdownMenuShortcut>
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <form onSubmit={handleCreateWorkspace}>
                <DialogHeader>
                  <DialogTitle>Create Workspace</DialogTitle>
                  <DialogDescription>
                    Add a new workspace to organize your knowledge.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <Label htmlFor="name">Workspace Name</Label>
                    <Input
                      id="name"
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      placeholder="e.g. Engineering Docs"
                      autoComplete="off"
                      disabled={isCreating}
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!newWorkspaceName.trim() || isCreating}>
                    {isCreating ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4 inline animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Workspace'
                    )}
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
                <Link href={`/dashboard/${currentWorkspace?.id}`} prefetch={true} className="w-full">
                  <SidebarMenuButton isActive={pathname === `/dashboard/${currentWorkspace?.id}`} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer w-full">
                    <LayoutDashboard className="h-[18px] w-[18px] mr-2.5" />
                    <span className="font-medium text-[15px]">Overview</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href={`/dashboard/${currentWorkspace?.id}/chat`} prefetch={true} className="w-full">
                  <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/chat`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer w-full">
                    <MessageSquare className="h-[18px] w-[18px] mr-2.5" />
                    <span className="font-medium text-[15px]">AI Chat</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href={`/dashboard/${currentWorkspace?.id}/documents`} prefetch={true} className="w-full">
                  <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/documents`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer w-full">
                    <Files className="h-[18px] w-[18px] mr-2.5" />
                    <span className="font-medium text-[15px]">Knowledge Base</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href={`/dashboard/${currentWorkspace?.id}/tasks`} prefetch={true} className="w-full">
                  <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/tasks`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer w-full">
                    <CheckSquare className="h-[18px] w-[18px] mr-2.5" />
                    <span className="font-medium text-[15px]">Due Diligence Checklist</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href={`/dashboard/${currentWorkspace?.id}/logs`} prefetch={true} className="w-full">
                  <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/logs`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer w-full">
                    <Activity className="h-[18px] w-[18px] mr-2.5" />
                    <span className="font-medium text-[15px]">Tool Logs</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href={`/dashboard/${currentWorkspace?.id}/eval`} prefetch={true} className="w-full">
                  <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/eval`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer w-full">
                    <Gauge className="h-[18px] w-[18px] mr-2.5" />
                    <span className="font-medium text-[15px]">RAG Eval & Benchmarks</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href={`/dashboard/${currentWorkspace?.id}/settings`} prefetch={true} className="w-full">
                  <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/settings`)} className="rounded-xl transition-all duration-300 ease-out hover:translate-x-1 hover:bg-indigo-500/10 hover:text-indigo-300 data-[active=true]:bg-gradient-to-r data-[active=true]:from-indigo-500/20 data-[active=true]:to-purple-500/10 data-[active=true]:text-indigo-200 data-[active=true]:border-l-2 data-[active=true]:border-indigo-500 h-11 cursor-pointer w-full">
                    <Settings className="h-[18px] w-[18px] mr-2.5" />
                    <span className="font-medium text-[15px]">Settings</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-border/50">
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
    </>
  )
}
