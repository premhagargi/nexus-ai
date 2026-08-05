import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { TaskType } from '@google/generative-ai'
import mammoth from 'mammoth'
// @ts-ignore
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for serverless processing

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'csv']

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      console.warn('[DocUpload] Unauthorized upload attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const workspaceId = formData.get('workspaceId') as string | null

    if (!file || !workspaceId) {
      console.warn('[DocUpload] Missing file or workspaceId in request body')
      return NextResponse.json({ error: 'Missing file or workspaceId' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      console.warn(`[DocUpload] File size limit exceeded: ${file.size} bytes`)
      return NextResponse.json({ error: 'File size exceeds maximum allowed limit of 20MB' }, { status: 400 })
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      console.warn(`[DocUpload] Unsupported extension: .${fileExt}`)
      return NextResponse.json({ error: `Unsupported file format: .${fileExt}. Allowed formats are PDF, DOCX, TXT, MD, CSV.` }, { status: 400 })
    }

    // Verify workspace membership
    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.userId } }
    })
    if (!membership) {
      console.warn(`[DocUpload] User ${session.userId} has no membership in workspace ${workspaceId}`)
      return NextResponse.json({ error: 'Forbidden: You do not have access to this workspace' }, { status: 403 })
    }

    const supabase = await createClient()

    // Upload file to Supabase Storage bucket
    const fileName = `${workspaceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    console.log(`[DocUpload] Uploading "${file.name}" (${file.size} bytes) to storage path "${fileName}"...`)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      })

    if (uploadError) {
      console.error('[DocUpload] Supabase storage upload error:', uploadError)
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(uploadData.path)

    const document = await prisma.document.create({
      data: {
        workspaceId,
        filename: file.name,
        storageUrl: publicUrlData.publicUrl,
        uploadedBy: session.userId,
        status: 'PROCESSING'
      }
    })

    console.log(`[DocUpload] Created document record ${document.id}. Launching background process...`)

    // Launch background text extraction & vector embedding process
    processDocument(document.id, uploadData.path, workspaceId, file.name).catch((err) => {
      console.error(`[DocUpload] Background process error for document ${document.id}:`, err)
    })

    return NextResponse.json({ success: true, documentId: document.id })
  } catch (error: any) {
    console.error('[DocUpload] POST Route Handler Error:', error)
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}

async function processDocument(documentId: string, storagePath: string, workspaceId: string, filename: string) {
  console.log(`[DocUpload] Processing started for documentId=${documentId}, filename="${filename}"`)
  try {
    // Idempotency check: remove any existing chunks for this document ID
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

    // Sanitize null bytes
    text = text.replace(/\u0000/g, '')

    if (!text.trim()) {
      throw new Error('Document contains no extractable text.')
    }

    console.log(`[DocUpload] Extracted ${text.length} characters from "${filename}". Splitting text...`)

    // Recursive text splitting
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    })

    const docs = await splitter.createDocuments([text], [{ source: filename }])
    console.log(`[DocUpload] Text split into ${docs.length} chunk(s).`)

    // Embeddings Setup
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      apiKey,
    })

    // Batched embedding and insertion
    const BATCH_SIZE = 20
    const chunks = docs.map(d => d.pageContent)

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const batchDocs = docs.slice(i, i + BATCH_SIZE)

      let vectors: number[][]
      try {
        vectors = await embeddings.embedDocuments(batch)
      } catch (err) {
        console.warn(`[DocUpload] Batch ${Math.floor(i / BATCH_SIZE) + 1} embedding failed. Retrying in 2 seconds...`, err)
        await new Promise(r => setTimeout(r, 2000))
        vectors = await embeddings.embedDocuments(batch)
      }

      // Insert all chunks from this batch in a transaction
      await prisma.$transaction(
        vectors.map((vector, j) => {
          const vectorStr = `[${vector.join(',')}]`
          const metaJson = JSON.stringify(batchDocs[j].metadata || {})
          return prisma.$executeRaw`
            INSERT INTO "DocumentChunk" (id, "workspaceId", "documentId", content, embedding, metadata, "createdAt")
            VALUES (
              gen_random_uuid(),
              ${workspaceId},
              ${documentId},
              ${batchDocs[j].pageContent},
              ${vectorStr}::vector,
              ${metaJson}::jsonb,
              NOW()
            )
          `
        })
      )

      console.log(`[DocUpload] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(chunks.length / BATCH_SIZE)} into vector database.`)

      if (i + BATCH_SIZE < chunks.length) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    // Update document status to COMPLETED
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        chunkCount: docs.length,
        errorMessage: null
      }
    })

    console.log(`[DocUpload] Successfully processed documentId=${documentId} (${docs.length} total chunks).`)
  } catch (error: any) {
    console.error(`[DocUpload] Processing failed for documentId=${documentId}:`, error)

    // Clean up partial chunks on failure
    try {
      await prisma.documentChunk.deleteMany({ where: { documentId } })
    } catch (cleanupErr) {
      console.error(`[DocUpload] Failed to clean up chunks for documentId=${documentId}:`, cleanupErr)
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        errorMessage
      }
    })
  }
}
