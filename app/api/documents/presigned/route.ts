import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'csv']

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { workspaceId, filename } = body

    if (!workspaceId || !filename) {
      return NextResponse.json({ error: 'Missing workspaceId or filename' }, { status: 400 })
    }

    const fileExt = filename.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ error: `Unsupported file format: .${fileExt}` }, { status: 400 })
    }

    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.userId } }
    })
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: No access to workspace' }, { status: 403 })
    }

    const supabase = await createClient()
    const storagePath = `${workspaceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUploadUrl(storagePath)

    if (error || !data?.signedUrl) {
      console.error('[PresignedRoute] Failed to create signed upload URL:', error)
      return NextResponse.json({ error: `Failed to create upload URL: ${error?.message || 'Unknown error'}` }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath)

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      storagePath,
      publicUrl: publicUrlData.publicUrl,
    })
  } catch (error: any) {
    console.error('[PresignedRoute] Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
