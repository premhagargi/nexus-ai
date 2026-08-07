'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  LayoutDashboard, 
  BookOpen, 
  Sparkles, 
  Bot, 
  SearchX, 
  Home,
  ShieldAlert,
  Compass
} from 'lucide-react'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground selection:bg-indigo-500/30">
      {/* Background Glowing Mesh Gradients */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-purple-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.07]" />

      {/* Main Glassmorphism Card */}
      <div className="relative z-10 flex w-full max-w-lg flex-col items-center text-center p-8 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-2xl shadow-2xl shadow-indigo-500/5">
        
        {/* Floating 404 Icon & Badge */}
        <div className="relative mb-6 flex items-center justify-center">
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-30 blur-lg animate-pulse" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shadow-inner">
            <SearchX className="h-10 w-10" />
          </div>
        </div>

        {/* 404 Numbers */}
        <h1 className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-6xl font-extrabold tracking-tight text-transparent sm:text-7xl font-mono">
          404
        </h1>

        {/* Title & Description */}
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Page Not Found
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-sm">
          The page or workspace resource you are looking for doesn&apos;t exist, was moved, or is temporarily unavailable.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="w-full sm:w-auto px-5 py-5 border-border hover:bg-muted font-medium transition-all"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              className="w-full sm:w-auto px-6 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all"
            >
              <Home className="mr-2 h-4 w-4" />
              Return to Dashboard
            </Button>
          </Link>
        </div>

        {/* Quick Links Header */}
        <div className="mt-10 w-full border-t border-border/60 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5 mb-3">
            <Compass className="h-3.5 w-3.5 text-indigo-400" /> Popular Destinations
          </p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-muted/20 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all font-medium text-foreground group"
            >
              <LayoutDashboard className="h-4 w-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>Workspaces</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-muted/20 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all font-medium text-foreground group"
            >
              <BookOpen className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Knowledge Base</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-muted/20 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all font-medium text-foreground group"
            >
              <Sparkles className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Playground</span>
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-muted/20 hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all font-medium text-foreground group"
            >
              <Bot className="h-4 w-4 text-purple-400 group-hover:scale-110 transition-transform" />
              <span>Agents Studio</span>
            </Link>
          </div>
        </div>

      </div>

      {/* Footer Branding */}
      <p className="mt-8 text-xs text-muted-foreground/60 font-mono">
        Nexus AI Workspace Engine &bull; 404 Resource Guard
      </p>
    </div>
  )
}
