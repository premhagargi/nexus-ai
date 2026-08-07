import { NextRequest, NextResponse, after } from 'next/server'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import mammoth from 'mammoth'
// @ts-ignore
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { createDocumentChunks, embedTexts, generateFallbackEmbedding } from '@/lib/rag'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for background processing

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { workspaceId, filename, storagePath, publicUrl } = body

    if (!workspaceId || !filename || !storagePath) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.userId } }
    })
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: No access to workspace' }, { status: 403 })
    }

    const supabase = await createClient()
    const filePublicUrl = publicUrl || supabase.storage.from('documents').getPublicUrl(storagePath).data.publicUrl

    // Idempotency check: Clean up existing documents with the same filename in this workspace
    const existingDocs = await prisma.document.findMany({
      where: { workspaceId, filename }
    })
    if (existingDocs.length > 0) {
      const existingIds = existingDocs.map(d => d.id)
      console.log(`[ConfirmUpload] Idempotency cleanup: deleting ${existingIds.length} existing document(s) with filename "${filename}" in workspace ${workspaceId}`)
      await prisma.documentChunk.deleteMany({ where: { documentId: { in: existingIds } } })
      await prisma.document.deleteMany({ where: { id: { in: existingIds } } })
    }

    const document = await prisma.document.create({
      data: {
        workspaceId,
        filename,
        storageUrl: filePublicUrl,
        uploadedBy: session.userId,
        status: 'PROCESSING'
      }
    })

    const fileExt = filename.split('.').pop()?.toLowerCase() || ''
    try {
      const { inngest } = await import('@/lib/inngest/client')
      await inngest.send({
        name: 'document/process',
        data: {
          documentId: document.id,
          workspaceId,
          storagePath,
          storageUrl: filePublicUrl,
          filename,
          sourceType: fileExt,
        },
      })
    } catch (inngestErr) {
      console.warn('[ConfirmUpload] Inngest queue send warning:', inngestErr)
    }

    // Schedule background text extraction, chunking & embedding after HTTP response is sent
    after(async () => {
      try {
        await processDocument(document.id, storagePath, workspaceId, filename)
      } catch (err) {
        console.error(`[ConfirmUpload after background process] Error for doc ${document.id}:`, err)
      }
    })

    return NextResponse.json({ success: true, documentId: document.id, status: 'PROCESSING' })
  } catch (error: any) {
    console.error('[ConfirmUpload] Route Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}

async function processDocument(documentId: string, storagePath: string, workspaceId: string, filename: string) {
  console.log(`[ConfirmUpload] Processing started for documentId=${documentId}, filename="${filename}"`)
  try {
    await prisma.documentChunk.deleteMany({ where: { documentId } })

    const supabase = await createClient()

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath)

    if (downloadError || !fileData) {
      throw new Error(`Failed to download storage file: ${downloadError?.message || 'Payload empty'}`)
    }

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const ext = filename.split('.').pop()?.toLowerCase() || ''

    let text = ''
    if (ext === 'pdf') {
      const parseFn = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default || (pdfParse as any).parse
      if (typeof parseFn !== 'function') {
        throw new Error('PDF parser engine initialization failed')
      }
      const parsed = await parseFn(buffer)
      text = parsed.text || ''
      if (!text.trim()) {
        throw new Error('Could not extract text from PDF. The file may be scanned or image-only.')
      }
    } else if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value || ''
      if (!text.trim()) {
        throw new Error('Could not extract text from DOCX file. The file may be empty or corrupted.')
      }
    } else {
      text = buffer.toString('utf-8')
    }

    text = text.replace(/\u0000/g, '')

    if (!text.trim()) {
      throw new Error('Document contains no extractable text.')
    }

    console.log(`[ConfirmUpload] Extracted ${text.length} characters from "${filename}". Splitting text...`)

    const chunks = await createDocumentChunks(text, filename, documentId, ext)
    console.log(`[ConfirmUpload] Text split into ${chunks.length} chunk(s).`)

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
    const texts = chunks.map((chunk) => chunk.content)
    const vectors = await embedTexts(texts, apiKey)

    const BATCH_SIZE = 20
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE)
      const batchVectors = vectors.slice(i, i + BATCH_SIZE)

      await prisma.$transaction(
        batchChunks.map((chunk, j) => {
          let vector = batchVectors[j]
          if (!vector || !Array.isArray(vector) || vector.length !== 768) {
            vector = generateFallbackEmbedding(chunk.content)
          }
          const vectorStr = `[${vector.join(',')}]`
          return prisma.$executeRawUnsafe(
            `INSERT INTO "DocumentChunk" (id, "workspaceId", "documentId", content, embedding, metadata, "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5::jsonb, NOW())`,
            workspaceId,
            documentId,
            chunk.content,
            vectorStr,
            JSON.stringify(chunk.metadata),
          )
        }),
      )

      console.log(`[ConfirmUpload] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(chunks.length / BATCH_SIZE)} into vector database.`)
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise((r) => setTimeout(r, 300))
      }
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        chunkCount: chunks.length,
        errorMessage: null,
      },
    })

    console.log(`[ConfirmUpload] Successfully processed documentId=${documentId} (${chunks.length} total chunks).`)
  } catch (error: any) {
    console.error(`[ConfirmUpload] Processing failed for documentId=${documentId}:`, error)

    try {
      await prisma.documentChunk.deleteMany({ where: { documentId } })
    } catch (cleanupErr) {
      console.error(`[ConfirmUpload] Cleanup error for doc ${documentId}:`, cleanupErr)
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage
      }
    })

    throw new Error(errorMessage)
  }
}
