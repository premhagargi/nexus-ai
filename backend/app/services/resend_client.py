"""Transactional email via Resend — same provider/domain as the original
Next.js `Resend` SDK usage in app/api/workspace/invite/route.ts.
"""
import resend

from app.core.config import get_settings


def send_workspace_invite(to_email: str, workspace_name: str, inviter_email: str, role: str, invite_url: str):
    settings = get_settings()
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY is not configured in server environment")

    resend.api_key = settings.resend_api_key
    domain = settings.resend_domain

    html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
          <h2 style="margin-top: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Join {workspace_name}</h2>
          <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6;">
            You have been invited by <strong>{inviter_email}</strong> to join the <strong>{workspace_name}</strong> workspace on Nexus AI with the <strong>{role}</strong> role.
          </p>
          <div style="margin: 32px 0;">
            <a href="{invite_url}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block;">Accept Invitation</a>
          </div>
          <p style="color: #71717a; font-size: 12px; margin-bottom: 0;">
            If you did not expect this invitation, you can safely ignore this email.
          </p>
        </div>
    """

    return resend.Emails.send(
        {
            "from": f"Nexus AI Workspace <invites@{domain}>",
            "to": [to_email],
            "subject": f"You've been invited to join {workspace_name} on Nexus AI",
            "html": html,
        }
    )
