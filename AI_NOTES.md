# AI Collaboration Notes

## Tools & Split of Work
I used Google Deepmind's Antigravity (Gemini Flash/Pro models) extensively to scaffold and build this application. The AI handled the vast majority of the boilerplate code generation (Next.js layout creation, component styling, Supabase client initialization) and database setup. 

I took the lead on the architectural requirements—specifically enforcing strict RLS/tenant isolation conceptually (and pivoting the implementation when necessary), deciding exactly how the RAG context chunks were formatted, and debugging critical pathway blockers like authentication rate limits.

## Key Decisions

1. **Custom Auth vs Supabase Auth**:
   Initially, the AI and I set up Supabase Auth. However, Supabase's Free Tier rate limits (3 signups per hour) severely hindered end-to-end testing, especially when deploying and running Playwright scripts. I made the decision to completely rip out Supabase Auth and replace it with a custom JWT-based authentication system backed directly by the `User` table in PostgreSQL using `jose` (for Edge compatibility) and `bcryptjs`. This solved the testing blocker while retaining security.

2. **Workspace Isolation in RAG**:
   To guarantee strict tenant isolation within the single shared `DocumentChunk` table, I enforced the `workspaceId` filter directly inside the Prisma `$queryRaw` vector search query, rather than relying strictly on RLS or filtering the results post-retrieval. 
   ```sql
   WHERE "workspaceId" = ${workspaceId}
   ORDER BY embedding <-> ${vectorStr}::vector
   ```
   This ensures that no matter what the LLM decides to do, or what prompt injection occurs, chunks from Workspace B can never physically be retrieved during a session in Workspace A.

3. **Tool Calling Abstraction**:
   I utilized Vercel's AI SDK (`streamText`) which provides a very clean `tools` abstraction. Instead of building a complex manual loop of LLM -> stop -> parse json -> call function -> pass back to LLM, the AI SDK handles the tool execution loop seamlessly. I simply defined tools like `save_task` with a Zod schema and an `execute` handler that interacts directly with Prisma.

## The Hardest Bug & AI Wrong Turn

The most frustrating AI-induced wrong turn involved the handling of Next.js Server Actions and the `pdf-parse` library. 

Early on, I asked the AI to build the document ingestion pipeline. It placed the `pdf-parse` ingestion logic inside a Next.js Server Action (`app/actions/documents.ts`). However, `pdf-parse` relies on heavily native Node.js binaries and C++ bindings. When running `next build`, Next.js's static analyzer aggressively parses server actions and attempts to bundle them. This caused a massive cascade of Webpack configuration errors (`Module not found: Can't resolve 'fs'`) during the production build step, completely breaking deployment.

The AI suggested increasingly complex `next.config.ts` Webpack configurations (like `serverComponentsExternalPackages` and `fallback: { fs: false }`), which did not solve the root issue. 

I noticed the issue was fundamentally about where Next.js was trying to bundle the native dependency. I fixed it by explicitly moving the ingestion logic out of Server Actions and into standard Next.js API Routes (`app/api/documents/upload/route.ts`), where Next.js handles Node dependencies natively without aggressively bundling them for the client/edge context in the same way. Additionally, I dynamically imported `pdf-parse` within the function scope to completely hide it from the static analyzer during build time.

## Future Improvements
- **Hybrid Search**: Implement keyword-based search alongside vector search to improve RAG accuracy for specific names or terms that embeddings might miss.
- **Streaming UI**: Implement the AI SDK's `useChat` hook more robustly on the frontend to stream the assistant's tokens into the UI in real-time, improving perceived latency.
- **Edge Functions**: Move the actual embedding and chunking pipeline into a background queue or Edge function so the user's upload request doesn't hang while waiting for the Gemini API to embed 100 chunks.
