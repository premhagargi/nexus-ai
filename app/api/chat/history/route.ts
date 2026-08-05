// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

/* ─── Auth helper ─── */
async function authCheck(workspaceId: string) {
  const session = await getSession()
  if (!session?.userId) return { error: 'Unauthorized', status: 401 }

  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  })
  if (!membership) return { error: 'Unauthorized', status: 401 }

  return { userId: session.userId }
}

/* ────────────────────────────────────────────
   GET /api/chat/history?workspaceId=xxx
   Returns messages for the workspace conversation
   ──────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId)
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

    const auth = await authCheck(workspaceId)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const conversation = await prisma.conversation.findFirst({
      where: { workspaceId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!conversation) return NextResponse.json({ messages: [] })

    // Return in format useChat initialMessages expects:
    // { id, role, parts: [{type:'text', text}], content }
    const messages = conversation.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        id: m.id,
        role: m.role,
        parts: [{ type: 'text', text: m.content }],
        content: m.content,
      }))

    return NextResponse.json({ messages, conversationId: conversation.id })
  } catch (e: any) {
    console.error('[History API] GET error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/* ────────────────────────────────────────────
   POST /api/chat/history
   Saves a single message to the workspace conversation
   ──────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { workspaceId, role, content } = body
    if (!workspaceId || !role || !content) {
      return NextResponse.json(
        { error: 'workspaceId, role, content required' },
        { status: 400 }
      )
    }

    const auth = await authCheck(workspaceId)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    // Find or create conversation for this workspace
    let conversation = await prisma.conversation.findFirst({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    })
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { workspaceId } })
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      })
    }

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role,
        content: typeof content === 'string' ? content : JSON.stringify(content),
      },
    })

    return NextResponse.json({ message })
  } catch (e: any) {
    console.error('[History API] POST error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

/* ────────────────────────────────────────────
   DELETE /api/chat/history?workspaceId=xxx
   Deletes all messages in the workspace conversation
   ──────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  try {
    const workspaceId = req.nextUrl.searchParams.get('workspaceId')
    if (!workspaceId)
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

    const auth = await authCheck(workspaceId)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    await prisma.message.deleteMany({
      where: { conversation: { workspaceId } },
    })

    console.log(`[History API] Cleared messages for workspace ${workspaceId}`)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[History API] DELETE error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
