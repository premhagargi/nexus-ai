# Nexus AI - Multi-Workspace Document Assistant

A RAG (Retrieval-Augmented Generation) application with an AI assistant that answers questions grounded in uploaded documents, takes actions via tools, and keeps knowledge strictly separated by workspaces.

## Features

- **Multi-Tenant Workspaces**: Users can create and switch between multiple workspaces.
- **Strict Isolation**: A single shared PostgreSQL vector store (pgvector) handles all workspaces. Security and isolation are enforced in the database queries via `workspaceId` filtering.
- **Document Ingestion**: Upload `.pdf`, `.docx`, and `.txt` files. They are automatically chunked, embedded using Google GenAI embeddings, and stored in the vector database.
- **RAG Chat & Tool Calling**: Chat with the workspace's documents. The assistant provides citations from the uploaded documents and honestly declines if the information is unavailable.
- **Custom Authentication**: Custom JWT-based authentication bypassing external provider constraints. Completely free, no rate limits!
- **AI Tools**:
  - `save_task`: The AI can save tasks/action items directly into the workspace's task board.
  - `summarize_workspace`: The AI can read all workspace documents and generate a holistic summary.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL with `pgvector` (Supabase Postgres)
- **File Storage**: Supabase Storage
- **ORM**: Prisma
- **AI/LLM**: Google Gemini 2.5 Flash via AI SDK
- **Embeddings**: Google Generative AI Embeddings (`text-embedding-004`)
- **UI**: Tailwind CSS, shadcn/ui

## Running Locally

### Prerequisites
- Node.js 18+
- A Postgres database with `pgvector` enabled (e.g., Supabase free tier).
- A Supabase Storage bucket named `documents`.
- A Google Gemini API key.

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/premhagargi/nexus-ai.git
   cd nexus-ai
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Copy `.env.example` to `.env` and fill in your keys:
   ```bash
   cp .env.example .env
   ```

4. **Run database migrations:**
   ```bash
   npx prisma db push
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000) in your browser. You can sign up with any email/password.

## Testing the Isolation
1. Sign up and create a workspace "Workspace A". Upload a document containing unique facts (e.g. "The secret passcode is Omega").
2. Ask the assistant: "What is the secret passcode?" (It will answer correctly).
3. Create "Workspace B". Ask the assistant: "What is the secret passcode?"
4. The assistant will refuse to answer or say it's not found in the workspace, proving strict tenant isolation at the vector query level.

## Deployment
This application can be deployed to Vercel (or Render/Netlify).
1. Connect your GitHub repository to Vercel.
2. Add the environment variables from your `.env` file to the Vercel project settings.
3. Deploy! (Next.js automatically handles the build process).
