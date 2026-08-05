import prisma from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params
  
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: true
    }
  })

  if (!workspace) return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
      <p className="text-lg font-semibold text-foreground">Workspace not found</p>
      <p className="text-sm">This workspace may have been deleted or you don&apos;t have access.</p>
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-3xl font-semibold tracking-tighter">Settings</h2>
        <p className="text-muted-foreground">
          Manage workspace settings and preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Profile</CardTitle>
          <CardDescription>
            Update your workspace details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name</Label>
            <Input id="name" defaultValue={workspace.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Workspace URL Slug</Label>
            <Input id="slug" defaultValue={workspace.slug} />
          </div>
          <Button disabled className="cursor-default opacity-70">Save Changes</Button>
        </CardContent>
      </Card>
      
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-500">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions for this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive">Delete Workspace</Button>
        </CardContent>
      </Card>
    </div>
  )
}
