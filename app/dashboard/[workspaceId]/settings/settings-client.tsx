'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateWorkspace, deleteWorkspace } from '@/app/actions'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { Users, Mail, Send, ShieldCheck, UserPlus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SettingsClientProps {
  workspaceId: string
  initialName: string
  initialSlug: string
  ownerEmail: string
}

export function SettingsClient({ workspaceId, initialName, initialSlug, ownerEmail }: SettingsClientProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  // Invite states
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingInvite, setSendingInvite] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Workspace name cannot be empty')
    setSaving(true)
    try {
      await updateWorkspace(workspaceId, name.trim())
      toast.success('Workspace name updated!')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to update workspace')
    } finally {
      setSaving(false)
    }
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || sendingInvite) return

    setSendingInvite(true)
    try {
      const res = await fetch('/api/workspace/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          email: inviteEmail.trim(),
          role: 'MEMBER',
        }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(`Invitation email sent to ${inviteEmail.trim()} via Resend!`)
        setInviteEmail('')
      } else {
        toast.error(data.error || 'Failed to send invitation')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invitation')
    } finally {
      setSendingInvite(false)
    }
  }

  const handleDelete = async () => {
    if (confirmText !== initialName) return
    setDeleting(true)
    try {
      await deleteWorkspace(workspaceId)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workspace')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl pb-10">
      <div>
        <h2 className="text-3xl font-semibold tracking-tighter">Settings</h2>
        <p className="text-muted-foreground mt-1">
          Manage workspace profile, collaboration, and preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Workspace Profile</CardTitle>
          <CardDescription>Update your workspace name.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Engineering Docs"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Owner</Label>
            <p className="text-sm font-medium text-foreground">{ownerEmail}</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || name.trim() === initialName || !name.trim()}
          >
            {saving && <Spinner className="mr-2 h-4 w-4 text-inherit" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Team Member Invitation via Resend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-400" />
            Invite Teammates
          </CardTitle>
          <CardDescription>
            Send email invites to join this workspace (powered by Resend & adchariot.in).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Teammate Email Address</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@adchariot.in"
                  required
                />
                <Button type="submit" disabled={sendingInvite || !inviteEmail.trim()}>
                  {sendingInvite ? (
                    <Spinner className="h-4 w-4 text-inherit" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5" /> Invite
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/20 bg-red-500/5">
        <CardHeader>
          <CardTitle className="text-red-500">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions. Deleting your workspace will remove all documents, chats, and tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            Delete Workspace
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &quot;{initialName}&quot;?</DialogTitle>
            <DialogDescription>
              This will permanently delete all documents, conversations, and tasks. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm">
              Type <span className="font-semibold text-foreground">{initialName}</span> to confirm
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={initialName}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setConfirmText('') }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== initialName || deleting}
              onClick={handleDelete}
            >
              {deleting && <Spinner className="mr-2 h-4 w-4 text-inherit" />}
              {deleting ? 'Deleting...' : 'Delete Workspace'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
