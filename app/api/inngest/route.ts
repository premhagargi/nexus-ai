import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { processDocumentWorker } from '@/lib/inngest/functions'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processDocumentWorker],
})
