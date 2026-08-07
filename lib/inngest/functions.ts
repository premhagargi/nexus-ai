import { inngest } from './client'
import prisma from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createDocumentChunks, embedTexts } from '@/lib/rag'

export const processDocumentWorker = inngest.createFunction(
  { id: 'process-document-worker' },
  async ({ event, step }: any) => {
    const { documentId, workspaceId, storageUrl, filename, sourceType } = event.data

    // Step 1: Download & extract text from storage
    const extractedText = await step.run('extract-text', async () => {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING', errorMessage: null },
      })

      const supabase = await createClient()
      const storagePath = storageUrl.split('/documents/')[1] || filename
      const { data, error } = await supabase.storage.from('documents').download(storagePath)

      if (error || !data) {
        throw new Error(`Failed to download file from storage: ${error?.message || 'File not found'}`)
      }

      const buffer = Buffer.from(await data.arrayBuffer())
      let text = ''

      if (sourceType === 'pdf') {
        const pdfParse = require('pdf-parse/lib/pdf-parse.js')
        const pdfData = await pdfParse(buffer)
        text = pdfData.text
      } else if (sourceType === 'docx') {
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        text = result.value
      } else {
        text = buffer.toString('utf-8')
      }

      const sanitizedText = text.replace(/\u0000/g, '').trim()
      if (!sanitizedText) {
        throw new Error('Extracted document content is empty or unreadable')
      }

      return sanitizedText
    })

    // Step 2: Create text chunks
    const chunks = await step.run('chunk-document', async () => {
      const documentChunks = await createDocumentChunks(extractedText, filename, documentId, sourceType)
      if (documentChunks.length === 0) {
        throw new Error('No chunks generated from document text')
      }
      return documentChunks
    })

    // Step 3: Embed chunks & persist to pgvector database
    await step.run('embed-and-save', async () => {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || ''
      const contents = chunks.map((c: any) => c.content)
      const embeddings = await embedTexts(contents, apiKey)

      // Purge any existing chunks for this document idempotently
      await prisma.documentChunk.deleteMany({
        where: { documentId },
      })

      const BATCH_SIZE = 20
      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batchChunks = chunks.slice(i, i + BATCH_SIZE)
        const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE)

        await Promise.all(
          batchChunks.map((chunk: any, idx: number) => {
            const vector = batchEmbeddings[idx]
            const vectorStr = `[${vector.join(',')}]`
            const jsonMetadata = JSON.stringify(chunk.metadata)

            return prisma.$executeRawUnsafe(
              `INSERT INTO "DocumentChunk" ("id", "workspaceId", "documentId", "content", "embedding", "metadata", "createdAt")
               VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5::jsonb, NOW())`,
              workspaceId,
              documentId,
              chunk.content,
              vectorStr,
              jsonMetadata
            )
          })
        )
      }

      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          chunkCount: chunks.length,
          errorMessage: null,
        },
      })
    })

    return { success: true, documentId, chunkCount: chunks.length }
  }
)
