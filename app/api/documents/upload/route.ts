import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import prisma from '@/lib/prisma'
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { TaskType } from '@google/generative-ai'
import mammoth from 'mammoth'

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const workspaceId = formData.get('workspaceId') as string

    if (!file || !workspaceId) {
      return NextResponse.json({ error: 'Missing file or workspaceId' }, { status: 400 })
    }

    const supabase = await createClient()

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${workspaceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file)

    if (uploadError) throw uploadError

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

    // Process async
    processDocument(document.id, uploadData.path, workspaceId, file.name).catch(console.error)

    return NextResponse.json({ success: true, documentId: document.id })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function processDocument(documentId: string, storagePath: string, workspaceId: string, filename: string) {
  try {
    const supabase = await createClient()
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath)

    if (downloadError || !fileData) throw new Error('Failed to download file')

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const ext = filename.split('.').pop()?.toLowerCase()
    
    let text = ''
    if (ext === 'pdf') {
      const pdfParse = require('pdf-parse')
      const parsed = await pdfParse(buffer)
      text = parsed.text
    } else if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      text = buffer.toString('utf-8')
    }

    if (!text.trim()) {
      throw new Error('No text extracted from document')
    }

    // Chunking
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    })
    
    const docs = await splitter.createDocuments([text], [{ source: filename }])
    
    // Embeddings
    const embeddings = new GoogleGenerativeAIEmbeddings({
      model: "text-embedding-004",
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    })
    
    for (const doc of docs) {
      const vector = await embeddings.embedQuery(doc.pageContent)
      const vectorStr = `[${vector.join(',')}]`

      await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" (id, "workspaceId", "documentId", content, embedding, metadata, "createdAt")
        VALUES (
          gen_random_uuid(), 
          ${workspaceId}, 
          ${documentId}, 
          ${doc.pageContent}, 
          ${vectorStr}::vector, 
          ${doc.metadata}::jsonb, 
          NOW()
        )
      `
    }
    
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'COMPLETED' }
    })
    
  } catch (error) {
    console.error('Error in processDocument:', error)
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'FAILED' }
    })
  }
}
