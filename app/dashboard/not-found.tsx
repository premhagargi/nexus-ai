'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  LayoutDashboard, 
  SearchX, 
  Home,
  Plus
} from 'lucide-react'

export default function WorkspaceNotFound() {
  const router = useRouter()

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground">
      {/* Background Mesh */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-purple-600/15 blur-[120px]" />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center p-8 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-2xl shadow-2xl">
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 opacity-30 blur-lg animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
            <SearchX className="h-10 w-10" />
          </div>
        </div>

        <h1 className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent font-mono">
          404
        </h1>

        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
          Workspace Not Found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
          The workspace you requested does not exist or you do not have permission to view it.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="w-full sm:w-auto px-5 py-5 border-border hover:bg-muted"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              className="w-full sm:w-auto px-6 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/25"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              All Workspaces
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
