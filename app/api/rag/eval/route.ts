import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { evaluateWorkspaceRAG } from '@/lib/rag-eval'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { workspaceId, customQueries } = body

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.userId } },
    })

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const defaultQueries = [
      'What are the key themes in these documents?',
      'Summary of main topics and conclusions',
      'Action items and responsibilities',
      'Important metrics, dates, and amounts',
    ]

    const queriesToTest = Array.isArray(customQueries) && customQueries.length > 0
      ? customQueries.slice(0, 10)
      : defaultQueries

    const googleApiKey =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      ''

    const report = await evaluateWorkspaceRAG(workspaceId, queriesToTest, googleApiKey)

    return NextResponse.json({ success: true, report })
  } catch (error: any) {
    console.error('[RAG Eval API] Failed to run evaluation:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to evaluate RAG system' },
      { status: 500 }
    )
  }
}
