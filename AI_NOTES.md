# AI Notes

## AI Tools and Models Used
I used **Google Gemini 3.1 Pro (High)** as the primary autonomous agent (via Google's Antigravity CLI/IDE environment) to build this application end-to-end. I also utilized the **Gemini 2.5 Flash** model and **Gemini Embedding Model (text-embedding-004)** for the runtime execution within the Next.js API routes for the RAG and tool-calling capabilities. 

The work was highly automated: I provided the comprehensive system requirements (the assessment spec), and the AI architected the database schema, wrote the Prisma configuration, generated the Next.js App Router API endpoints, and built the polished UI using `shadcn/ui` and `framer-motion`. I guided the AI by refining UI requests and injecting API keys.

## Key Decisions
1. **Shared Vector Store Isolation (pgvector + Prisma)**
   I opted to use a single `DocumentChunk` table in PostgreSQL with a raw `Unsupported("vector")` type in Prisma. This allows me to perform raw SQL similarity searches `ORDER BY embedding <-> $1` combined with a strict `WHERE "workspaceId" = $2` clause. This strictly enforces tenant isolation at the database level without the overhead of dynamically creating indexes per workspace.
   
2. **Document Processing Strategy (Serverless vs Background Worker)**
   I used standard Next.js API routes with a detached Promise (`.catch(console.error)`) for document processing. While a dedicated background worker (like Inngest) is best for production to avoid serverless timeouts, the detached Promise allows for a seamless UX in this prototype without complicating the deployment architecture. The chunking uses a `RecursiveCharacterTextSplitter` (1000 size, 200 overlap) which strikes a balance between preserving context and adhering to token limits.

3. **Tool Calling Integration (Vercel AI SDK)**
   I chose the Vercel AI SDK (`ai` package) with the `@ai-sdk/google` provider because it natively handles streaming, tool execution, and context management in a clean, declarative way. Tools like `save_task` and `summarize_workspace` are defined with `zod` schemas, automatically validating inputs and logging executions to the database before returning the result to the LLM.

## Hardest Bug / Wrong Turn
**Prisma 7 Beta vs Prisma 6 Stable Compatibility:**
During initialization, the environment unintentionally pulled `Prisma CLI 7.9.1` which contains breaking changes to how `DATABASE_URL` is configured in `schema.prisma` (requiring `prisma.config.ts`). The deployment crashed during the generation step.
*How I fixed it:* I immediately noticed the validation errors in the logs (`The datasource property 'url' is no longer supported in schema files`). Instead of attempting to wrestle with undocumented beta features, I explicitly downgraded Prisma to the stable `^6.0.0` version, which immediately resolved the issue and restored standard Prisma functionality.

## Future Improvements
With more time, I would:
- Implement a true background worker queue (e.g., Upstash/Trigger.dev) for parsing massive PDFs asynchronously.
- Persist the `useChat` messages to the database so that users can resume previous chat sessions, utilizing the `Conversation` and `Message` tables that are already designed in the Prisma schema.
- Implement a hybrid search (BM25 Keyword + Vector) to improve retrieval recall for specific acronyms or ID numbers in the documents.
