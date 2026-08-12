// Plain TypeScript mirrors of the FastAPI backend's JSON response shapes
// (see backend/app/api/routes/*.py). The frontend no longer depends on
// @prisma/client for types — it has no database connection at all.

export interface Workspace {
  id: string
  name: string
  slug: string
  ownerId: string
  createdAt: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
}

export interface Task {
  id: string
  workspaceId: string
  title: string
  description: string | null
  completed: boolean
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  filename: string
  storageUrl: string
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  errorMessage: string | null
  chunkCount: number | null
  createdAt: string
}

export interface ToolExecution {
  id: string
  workspaceId: string
  toolName: string
  arguments: Record<string, unknown> | null
  result: Record<string, unknown> | null
  createdAt: string
}
