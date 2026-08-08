# Nexus AI - Multi-Workspace Document Assistant

A production-grade RAG (Retrieval-Augmented Generation) application with an AI assistant that answers questions grounded in uploaded workspace documents, executes autonomous tools, and guarantees strict tenant isolation.

---

## 🏗️ System Architecture

```mermaid
graph TD
    Client[Next.js 16 Client / UI] <--> AuthMiddleware[Edge Auth Middleware / Jose JWT]
    AuthMiddleware <--> NextServer[Next.js App Router API Routes]
    
    subgraph Data & Storage Layer
        NextServer <--> Prisma[Prisma ORM]
        Prisma <--> Postgres[(PostgreSQL + pgvector DB)]
        NextServer <--> SupabaseStorage[Supabase Object Storage]
    end

    subgraph RAG & AI Pipeline
        NextServer <--> QueryOptimizer[Cerebras LLM - Query Reformulator]
        NextServer <--> EmbeddingClient[Google GenAI - gemini-embedding-001]
        NextServer <--> HybridSearch[pgvector Vector & TSVector Hybrid Search]
        NextServer <--> CerebrasInference[Cerebras API - Streaming LLM + Function Calling]
    end

    subgraph Async Processing & Integrations
        NextServer <--> Inngest[Inngest Event Bus & Workers]
        Inngest --> DocProcessor[Doc Ingestion: PDF / DOCX / TXT Chunking]
        CerebrasInference --> Tools[Tool Execution: Tasks, Slack Webhooks, Reports]
    end
```

---

## ⚡ RAG Retrieval & Inference Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Next.js Chat UI
    participant API as /api/chat Endpoint
    participant LLM_Q as Query Optimizer (Cerebras)
    participant EMB as Embedder (Google GenAI)
    participant DB as Postgres pgvector
    participant LLM_F as Inference Model (Cerebras)

    User->>UI: Types question (e.g. "wjhat is our Q3 revenue?")
    UI->>API: POST /api/chat { workspaceId, messages }
    API->>LLM_Q: Reformulate & correct query spelling/pronouns
    LLM_Q-->>API: Standalone query: "what is our Q3 revenue?"
    API->>EMB: Generate 768-dim normalized embedding
    EMB-->>API: Float vector [768]
    API->>DB: Cosine Vector Search + TSVector Keyword Fallback (workspaceId scoped)
    DB-->>API: Top-K matching document chunks + distance scores
    API->>LLM_F: Stream prompt (System + Context + Query + Tools)
    LLM_F-->>UI: SSE Token Stream + Tool Trigger Execution
```

> 📖 For a deep dive into architectural decision records (ADRs), tenant isolation proof, and quality benchmarks, see [**ARCHITECTURE.md**](./ARCHITECTURE.md).

---

## Key Features

- **Multi-Tenant Workspaces**: Workspaces isolate all documents, conversations, tasks, and vector embeddings.
- **Strict Isolation**: Single PostgreSQL vector store (`pgvector`) partitioned by `workspaceId` at the SQL query level:
  ```sql
  WHERE "workspaceId" = ${workspaceId} ORDER BY embedding <-> ${vectorStr}::vector
  ```
- **Document Ingestion Pipeline**: Auto-chunks `.pdf`, `.docx`, and `.txt` files with Google GenAI embeddings (`gemini-embedding-001`).
- **Autonomous AI Tool Executions**:
  - `save_task`: Saves specific action items directly into the workspace task board.
  - `summarize_workspace`: Multi-position document sampling & executive workspace summaries (with optional Slack webhooks).
  - `search_documents`, `create_note`, `generate_report`, `compare_documents`, `extract_data`.
- **RAG Quality Evaluation Suite**: Programmatic Precision@K, MRR (Mean Reciprocal Rank), and distance benchmarking via `/api/rag/eval`.
- **Custom JWT Auth System**: Bypasses external provider rate limits using `jose` & `bcryptjs` for unrestricted end-to-end automated Playwright testing.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with `pgvector` (Supabase / Docker Postgres)
- **File Storage**: Supabase Storage
- **ORM**: Prisma
- **LLM Engine**: Cerebras Cloud (`gpt-oss-120b`) / Gemini 2.5 Flash
- **Embeddings**: Google Generative AI Embeddings (`gemini-embedding-001`)
- **Queue / Async Jobs**: Inngest
- **UI**: Tailwind CSS, shadcn/ui, Framer Motion, Recharts
- **Testing & Benchmarks**: Playwright, RAG Eval Suite

---

## Running Locally

### Option 1: Using Docker (Recommended for instant setup)

1. **Clone & install:**
   ```bash
   git clone https://github.com/premhagargi/nexus-ai.git
   cd nexus-ai
   npm install
   ```

2. **Start PostgreSQL + pgvector container:**
   ```bash
   docker-compose up -d
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Run database migrations & dev server:**
   ```bash
   npx prisma db push
   npm run dev
   ```

### Option 2: Using Supabase Cloud

1. Set `DATABASE_URL` and `DIRECT_URL` in `.env` pointing to your Supabase Postgres instance.
2. Run `npx prisma db push` and `npm run dev`.

---

## Testing Tenant Isolation

1. Sign up and create **Workspace A**. Upload a document containing unique text (e.g. *"The secret passcode is Omega"*).
2. Ask the assistant in Workspace A: *"What is the secret passcode?"* (It answers correctly).
3. Create **Workspace B**. Ask the assistant: *"What is the secret passcode?"*
4. The assistant declines or reports no matching information, proving strict tenant isolation at the vector database level.
