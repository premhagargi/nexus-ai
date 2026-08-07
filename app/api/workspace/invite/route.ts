import { NextRequest, NextResponse } from 'next/server'
import { requireWorkspaceAccess } from '@/lib/auth'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { workspaceId, email, role = 'MEMBER' } = body

    if (!workspaceId || !email?.trim()) {
      return NextResponse.json({ error: 'workspaceId and email are required' }, { status: 400 })
    }

    const auth = await requireWorkspaceAccess(workspaceId)
    if (!auth || auth.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only workspace owners can send member invitations' }, { status: 403 })
    }

    const apiKey = process.env.RESEND_API_KEY
    const domain = process.env.RESEND_DOMAIN || 'adchariot.in'

    if (!apiKey) {
      return NextResponse.json({ error: 'RESEND_API_KEY is not configured in server environment' }, { status: 500 })
    }

    const resend = new Resend(apiKey)

    const workspaceName = auth.workspace.name
    const inviteUrl = `${req.nextUrl.origin}/login?invitedWorkspace=${workspaceId}`

    const { data, error } = await resend.emails.send({
      from: `Nexus AI Workspace <invites@${domain}>`,
      to: [email.trim()],
      subject: `You've been invited to join ${workspaceName} on Nexus AI`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
          <h2 style="margin-top: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Join ${workspaceName}</h2>
          <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6;">
            You have been invited by <strong>${auth.user.email}</strong> to join the <strong>${workspaceName}</strong> workspace on Nexus AI with the <strong>${role}</strong> role.
          </p>
          <div style="margin: 32px 0;">
            <a href="${inviteUrl}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #71717a; font-size: 12px; margin-bottom: 0;">
            If you did not expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('[Resend Invite Error]:', error)
      return NextResponse.json({ error: error.message || 'Failed to send invite email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailId: data?.id, invitedEmail: email.trim() })
  } catch (error: any) {
    console.error('[Workspace Invite API Error]:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
