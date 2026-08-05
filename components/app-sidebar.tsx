'use client'

import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { Workspace } from '@prisma/client'
import Link from 'next/link'
import { LayoutDashboard, MessageSquare, Files, CheckSquare, Settings, Activity, ChevronsUpDown, LogOut } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function AppSidebar({ workspaces, currentWorkspaceId }: { workspaces: Workspace[], currentWorkspaceId?: string }) {
  const pathname = usePathname()
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId) || workspaces[0]

  return (
    <Sidebar>
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" className="w-full justify-between px-4 py-6">
              <div className="flex flex-col items-start text-left">
                <span className="text-xs text-muted-foreground">Workspace</span>
                <span className="truncate font-semibold text-sm">{currentWorkspace?.name || 'Nexus AI'}</span>
              </div>
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            {workspaces.map(w => (
              <DropdownMenuItem key={w.id}>
                <Link href={`/dashboard/${w.id}`} className="cursor-pointer">
                  {w.name}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname === `/dashboard/${currentWorkspace?.id}`}>
                  <Link href={`/dashboard/${currentWorkspace?.id}`}>
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Overview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/chat`)}>
                  <Link href={`/dashboard/${currentWorkspace?.id}/chat`}>
                    <MessageSquare className="h-4 w-4" />
                    <span>Chat</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/documents`)}>
                  <Link href={`/dashboard/${currentWorkspace?.id}/documents`}>
                    <Files className="h-4 w-4" />
                    <span>Documents</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/tasks`)}>
                  <Link href={`/dashboard/${currentWorkspace?.id}/tasks`}>
                    <CheckSquare className="h-4 w-4" />
                    <span>Tasks</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/logs`)}>
                  <Link href={`/dashboard/${currentWorkspace?.id}/logs`}>
                    <Activity className="h-4 w-4" />
                    <span>Tool Logs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton isActive={pathname.includes(`/dashboard/${currentWorkspace?.id}/settings`)}>
                  <Link href={`/dashboard/${currentWorkspace?.id}/settings`}>
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <form action="/auth/signout" method="post">
              <SidebarMenuButton type="submit" className="text-red-500 hover:text-red-600 hover:bg-red-500/10">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
