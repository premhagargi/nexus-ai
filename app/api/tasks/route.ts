import { NextRequest, NextResponse } from 'next/server'
import { requireWorkspaceAccess } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const auth = await requireWorkspaceAccess(workspaceId)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized workspace access' }, { status: 403 })
  }

  const tasks = await prisma.task.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { workspaceId, title, description } = body

    if (!workspaceId || !title?.trim()) {
      return NextResponse.json({ error: 'workspaceId and title are required' }, { status: 400 })
    }

    const auth = await requireWorkspaceAccess(workspaceId)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized workspace access' }, { status: 403 })
    }

    const task = await prisma.task.create({
      data: {
        workspaceId,
        title: title.trim(),
        description: description?.trim() || null,
      },
    })

    return NextResponse.json(task)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
