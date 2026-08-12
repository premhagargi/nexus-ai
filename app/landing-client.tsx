"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion"
import {
  ArrowRight, FileText, MessageSquare, Sparkles, Lock, Zap,
  Layers, Search, CheckCircle2, Database, Terminal, Upload,
  Hash, Folder, Bot, Braces, Command, BookOpen, Code2, Cpu,
  Network, KeyRound, Eye, ShieldCheck, GitBranch, Gauge,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavLink { label: string; href: string }
interface Feature { icon: ReactNode; title: string; description: string; detail: string }
interface WorkflowStep { label: string; description: string; icon: ReactNode }

// ─── Data ────────────────────────────────────────────────────────────────────
// Every claim on this page describes something actually implemented and
// verified against the live application — see ARCHITECTURE.md / INTERVIEW_GUIDE.md
// in the repo for the technical detail behind each one.

const NAV_LINKS: NavLink[] = [
  { label: "How it works", href: "#product" },
  { label: "Under the hood", href: "#pipeline" },
  { label: "Trust", href: "#security" },
]

const WORKFLOW_STEPS: WorkflowStep[] = [
  { label: "Upload", description: "Drop in PDFs, DOCX, or plain text — extracted, chunked, and embedded in the background.", icon: <Upload className="w-5 h-5" /> },
  { label: "Ask", description: "Hybrid retrieval — vector similarity plus keyword search — scoped to your workspace at the SQL level.", icon: <Search className="w-5 h-5" /> },
  { label: "Verify", description: "Every answer is scored against its source chunks, so you can see how grounded it actually is.", icon: <ShieldCheck className="w-5 h-5" /> },
  { label: "Act", description: "Turn an answer into a task, a note, or a report — the assistant calls real tools, not just text.", icon: <Zap className="w-5 h-5" /> },
]

const FEATURES: Feature[] = [
  {
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Grounded, cited answers",
    description: "Responses stream token-by-token, then get scored sentence-by-sentence against retrieved chunks — a real grounding percentage, not a canned disclaimer.",
    detail: "grounded_score: 100%",
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: "Isolated workspaces",
    description: "Every retrieval query is scoped with a workspaceId clause inside the SQL itself. Another workspace's documents can't enter the result set — not filtered out, never fetched.",
    detail: 'WHERE "workspaceId" = $1',
  },
  {
    icon: <Bot className="w-5 h-5" />,
    title: "Real agent tools",
    description: "The assistant can create tasks, search documents, run sandboxed calculations, and summarize a workspace — each call logged with its arguments and result.",
    detail: "8 tools · audited execution",
  },
  {
    icon: <Gauge className="w-5 h-5" />,
    title: "Built-in RAG evaluation",
    description: "A benchmark suite computes Precision@K and Mean Reciprocal Rank against your live retrieval — not a synthetic demo dataset.",
    detail: "Precision@K · MRR · latency",
  },
]

const ARCHITECTURE_NODES = [
  { label: "Next.js UI", sub: "Frontend only", icon: <Code2 className="w-4 h-4" /> },
  { label: "Session cookie", sub: "httpOnly, same-origin", icon: <KeyRound className="w-4 h-4" /> },
  { label: "FastAPI backend", sub: "Auth · RAG · agent", icon: <Network className="w-4 h-4" /> },
  { label: "Postgres + pgvector", sub: "Hybrid retrieval", icon: <Database className="w-4 h-4" /> },
  { label: "Cerebras + Google", sub: "LLM & embeddings", icon: <Cpu className="w-4 h-4" /> },
  { label: "Prometheus + OTel", sub: "Metrics, logs, traces", icon: <Eye className="w-4 h-4" /> },
]

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 40, delay = 1000) {
  const [displayed, setDisplayed] = useState("")
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  useEffect(() => {
    if (!started) return
    if (displayed.length >= text.length) return
    const t = setTimeout(() => setDisplayed(text.slice(0, displayed.length + 1)), speed)
    return () => clearTimeout(t)
  }, [displayed, started, text, speed])

  return displayed
}

function useMousePosition() {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  useEffect(() => {
    const handler = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY) }
    window.addEventListener("mousemove", handler)
    return () => window.removeEventListener("mousemove", handler)
  }, [x, y])

  return { x, y }
}

// ─── Shared Components ───────────────────────────────────────────────────────

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border bg-background/80 text-muted-foreground backdrop-blur-sm">
      {children}
    </span>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-4">
      {children}
    </span>
  )
}

function DotGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dotgrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" className="text-foreground" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotgrid)" />
      </svg>
    </div>
  )
}

function NoiseOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[100] opacity-[0.015]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  )
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar({ isAuthenticated }: { isAuthenticated?: boolean }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 32)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border/50" : "bg-transparent"
      }`}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="#" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
              <Network className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[15px] font-semibold text-foreground tracking-tighter">nexus</span>
          </a>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isAuthenticated && (
            <a href="/login" className="hidden sm:block text-[13px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
              Sign in
            </a>
          )}
          <a
            href={isAuthenticated ? "/dashboard" : "/signup"}
            className="text-[13px] font-medium text-primary bg-primary/10 hover:bg-white px-4 py-1.5 rounded-lg transition-colors"
          >
            {isAuthenticated ? "Go to workspace" : "Get started"}
          </a>
        </div>
      </div>
    </motion.nav>
  )
}

// ─── Workspace Mockup ────────────────────────────────────────────────────────

function WorkspaceMockup() {
  const aiResponse = useTypewriter(
    "The report cites an AI maturity score of 45 out of 100, driven primarily by fragmented tooling across practice areas.",
    30,
    2000
  )

  const sidebarItems = [
    { icon: <Hash className="w-3.5 h-3.5" />, label: "General", active: false },
    { icon: <FileText className="w-3.5 h-3.5" />, label: "Q3 Report", active: true },
    { icon: <Folder className="w-3.5 h-3.5" />, label: "Contracts", active: false },
    { icon: <BookOpen className="w-3.5 h-3.5" />, label: "Due Diligence", active: false },
  ]

  const tasks = [
    { label: "Review AI maturity findings", done: true },
    { label: "Summarize practice-area risks", done: false },
    { label: "Share with deal team", done: false },
  ]

  return (
    <motion.div
      className="relative w-full rounded-2xl border border-border/50 bg-background shadow-2xl shadow-primary/5 overflow-hidden"
      initial={{ opacity: 0, x: 40, rotateY: -2 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 bg-background/80">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="text-[11px] text-muted-foreground bg-muted/50 px-3 py-0.5 rounded-md">
            nexus — Deal Room
          </div>
        </div>
        <div className="w-12" />
      </div>

      <div className="flex h-[340px] sm:h-[380px]">
        {/* Sidebar */}
        <div className="hidden sm:flex w-48 flex-col border-r border-border/50 bg-background/80 p-3">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-[9px] font-semibold text-emerald-400">A</span>
            </div>
            <span className="text-[12px] font-medium text-zinc-300">Audit Workspace</span>
          </div>

          <div className="space-y-0.5">
            {sidebarItems.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] ${
                  item.active
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-border/50">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 mb-2">Tasks</div>
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <div key={task.label} className="flex items-start gap-2 px-2">
                  <div className={`w-3 h-3 rounded-sm border mt-0.5 flex-shrink-0 ${
                    task.done ? "bg-emerald-500/20 border-emerald-500/40" : "border-zinc-700"
                  }`}>
                    {task.done && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <span className={`text-[11px] leading-tight ${task.done ? "text-muted-foreground line-through" : "text-muted-foreground"}`}>
                    {task.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-[13px] font-medium text-zinc-300">Q3 Report Analysis</span>
            <Tag>RAG</Tag>
          </div>

          {/* Chat */}
          <div className="flex-1 space-y-4 overflow-hidden">
            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-muted rounded-xl rounded-tr-sm px-3.5 py-2.5 max-w-[80%]">
                <p className="text-[12px] text-foreground leading-relaxed">
                  According to the report, what&apos;s the AI maturity score?
                </p>
              </div>
            </div>

            {/* AI response */}
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-muted border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-background/80 border border-border/50 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                  <p className="text-[12px] text-zinc-300 leading-relaxed">
                    {aiResponse}
                    <motion.span
                      className="inline-block w-[2px] h-3.5 bg-zinc-400 ml-0.5 align-middle"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                  </p>
                </div>
                {/* Grounding + sources */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400">100% grounded</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border/50">
                    <FileText className="w-2.5 h-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">q3-report.pdf</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="mt-3 flex items-center gap-2 bg-background/80 border border-border/50 rounded-xl px-3.5 py-2.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[12px] text-muted-foreground">Ask about your documents...</span>
            <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50">
              <Command className="w-2.5 h-2.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">K</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero({ isAuthenticated }: { isAuthenticated?: boolean }) {
  const { x, y } = useMousePosition()
  const glowX = useSpring(x, { stiffness: 150, damping: 30 })
  const glowY = useSpring(y, { stiffness: 150, damping: 30 })

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-14">
      <DotGrid />

      {/* Mouse glow */}
      <motion.div
        className="fixed pointer-events-none z-0 w-[600px] h-[600px] rounded-full opacity-[0.03]"
        style={{
          background: "radial-gradient(circle, white 0%, transparent 70%)",
          x: glowX,
          y: glowY,
          translateX: "-50%",
          translateY: "-50%",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 w-full py-24 lg:py-0">
        <div className="grid lg:grid-cols-[1fr,1.1fr] gap-12 lg:gap-16 items-center">
          {/* Left */}
          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Tag>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Now in beta
              </Tag>
            </motion.div>

            <motion.h1
              className="mt-6 text-[clamp(2.5rem,5.5vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              The data room
              <br />
              that shows its
              <br />
              <span className="text-muted-foreground">work.</span>
            </motion.h1>

            <motion.p
              className="mt-6 text-[17px] leading-relaxed text-muted-foreground max-w-md"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
            >
              Upload your deal room documents. Ask anything. Every answer is retrieved
              from your workspace, cited, and scored for how well it&apos;s actually grounded.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
            >
              <a
                href={isAuthenticated ? "/dashboard" : "/signup"}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary text-[14px] font-medium hover:bg-white transition-colors group"
              >
                {isAuthenticated ? "Go to workspace" : "Start free"}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="#pipeline"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-muted-foreground text-[14px] font-medium hover:border-zinc-700 hover:text-zinc-300 transition-colors"
              >
                See how retrieval works
              </a>
            </motion.div>

            {/* Grounding snippet */}
            <motion.div
              className="mt-10 relative"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.65 }}
            >
              <div className="bg-background/80 border border-border/50 rounded-xl px-4 py-3 font-mono text-[12px] leading-relaxed max-w-md">
                <div className="text-muted-foreground mb-1">{"// Every response, scored."}</div>
                <div>
                  <span className="text-muted-foreground">{"{"}</span>{" "}
                  <span className="text-zinc-300">method</span>
                  <span className="text-muted-foreground">:</span>{" "}
                  <span className="text-amber-300/70">&quot;hybrid_vector_keyword&quot;</span>
                  <span className="text-muted-foreground">,</span>
                </div>
                <div className="pl-4">
                  <span className="text-zinc-300">grounded_score</span>
                  <span className="text-muted-foreground">:</span>{" "}
                  <span className="text-emerald-400/80">100</span>
                  <span className="text-muted-foreground"> {"}"}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right — workspace mockup */}
          <div className="relative z-10">
            <WorkspaceMockup />
            {/* Floating notification */}
            <motion.div
              className="absolute -top-3 -right-2 sm:right-4 bg-card border border-border/50 rounded-xl px-3 py-2 shadow-xl shadow-primary/5"
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.5 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-zinc-300">3 documents indexed</div>
                  <div className="text-[10px] text-muted-foreground">Ready to query</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Problem ─────────────────────────────────────────────────────────────────

function Problem() {
  return (
    <section className="relative py-32 lg:py-40 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl">
          <Reveal>
            <SectionLabel>The problem</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-[clamp(1.75rem,3.5vw,3rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground">
              Most AI answers ask you
              <span className="text-muted-foreground"> to just trust them.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 text-[17px] leading-relaxed text-muted-foreground max-w-xl">
              A chatbot that summarizes a data room is easy. One where you can trust the summary
              enough to act on it is the actual problem — and that means showing exactly which
              document backed which sentence, not a generic disclaimer at the bottom of the reply.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <div className="mt-16 grid sm:grid-cols-3 gap-4">
            {[
              { icon: <Search className="w-4 h-4" />, title: "Search finds files, not answers", body: "Keyword search tells you which document mentions a term. It can't tell you what the term means in context." },
              { icon: <MessageSquare className="w-4 h-4" />, title: "Generic chat can't cite itself", body: "A model that just \"knows things\" can't point back to the paragraph it got an answer from — or admit it didn't find one." },
              { icon: <GitBranch className="w-4 h-4" />, title: "Tools live in five different tabs", body: "Reading a finding and acting on it — filing a task, flagging a risk — usually means switching apps entirely." },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-background/80 border border-border/50 rounded-2xl p-5 hover:border-border transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-muted/50 border border-border flex items-center justify-center text-muted-foreground mb-3">
                  {item.icon}
                </div>
                <div className="text-[14px] font-semibold text-foreground">{item.title}</div>
                <div className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">{item.body}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

function Workflow() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setActive((p) => (p + 1) % WORKFLOW_STEPS.length), 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <section className="relative py-32 lg:py-40" id="product">
      <DotGrid />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-[1fr,1.3fr] gap-16 items-start">
          <div>
            <Reveal>
              <SectionLabel>How it works</SectionLabel>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground">
                From raw documents
                <br />
                <span className="text-muted-foreground">to grounded answers.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed max-w-sm">
                Four steps, every one of them visible — not a black box between your question and its answer.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <div className="space-y-2">
              {WORKFLOW_STEPS.map((step, i) => (
                <motion.button
                  key={step.label}
                  className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 ${
                    active === i
                      ? "bg-background/80 border-border"
                      : "bg-transparent border-border/50 hover:border-border"
                  }`}
                  onClick={() => setActive(i)}
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      active === i
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/50 text-muted-foreground"
                    }`}>
                      {step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-[15px] font-semibold transition-colors ${
                          active === i ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {step.label}
                        </span>
                        {active === i && (
                          <motion.div
                            className="h-px flex-1 bg-zinc-700/40"
                            layoutId="workflowLine"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ duration: 0.4 }}
                          />
                        )}
                      </div>
                      <AnimatePresence mode="wait">
                        {active === i && (
                          <motion.p
                            className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                          >
                            {step.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── RAG Flow ────────────────────────────────────────────────────────────────

function RAGFlow() {
  const stages = [
    { label: "Documents", sub: "PDF, DOCX, text", icon: <FileText className="w-4 h-4" /> },
    { label: "Chunking", sub: "Recursive splitting", icon: <Braces className="w-4 h-4" /> },
    { label: "Embeddings", sub: "768-dim vectors", icon: <Cpu className="w-4 h-4" /> },
    { label: "Hybrid search", sub: "Vector + keyword", icon: <Database className="w-4 h-4" /> },
    { label: "Rerank", sub: "Diversity-selected", icon: <Search className="w-4 h-4" /> },
    { label: "Verify", sub: "Grounding scored", icon: <ShieldCheck className="w-4 h-4" /> },
  ]

  return (
    <section className="relative py-32 lg:py-40" id="pipeline">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Reveal>
            <SectionLabel>Under the hood</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground">
              Hybrid retrieval,
              <span className="text-muted-foreground"> not just vector search.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
              pgvector cosine search and Postgres full-text search run together, merged and
              reranked — with a fuzzy fallback for typo-heavy queries neither one catches alone.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="relative">
            <div className="hidden lg:block absolute top-1/2 left-[8%] right-[8%] h-px bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 -translate-y-1/2" />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-3">
              {stages.map((stage, i) => (
                <Reveal key={stage.label} delay={0.1 + i * 0.07}>
                  <motion.div
                    className="relative bg-background/80 border border-border/50 rounded-2xl p-4 text-center hover:border-border transition-all group"
                    whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center mx-auto text-muted-foreground group-hover:text-foreground group-hover:bg-muted transition-colors">
                      {stage.icon}
                    </div>
                    <div className="mt-3 text-[13px] font-semibold text-foreground">{stage.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{stage.sub}</div>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Real query example */}
        <Reveal delay={0.4}>
          <div className="mt-16 max-w-2xl mx-auto">
            <div className="bg-background/80 border border-border/50 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground font-mono">rag_service.py</span>
              </div>
              <div className="p-4 font-mono text-[12px] leading-relaxed">
                <div>
                  <span className="text-muted-foreground">SELECT</span>{" "}
                  <span className="text-zinc-300">id, content, embedding</span>{" "}
                  <span className="text-muted-foreground">{"<->"}</span>{" "}
                  <span className="text-amber-300/70">$2::vector</span>{" "}
                  <span className="text-muted-foreground">AS distance</span>
                </div>
                <div>
                  <span className="text-muted-foreground">FROM</span>{" "}
                  <span className="text-emerald-400/80">&quot;DocumentChunk&quot;</span>
                </div>
                <div>
                  <span className="text-muted-foreground">WHERE</span>{" "}
                  <span className="text-zinc-300">&quot;workspaceId&quot;</span>{" "}
                  <span className="text-muted-foreground">=</span>{" "}
                  <span className="text-purple-400/70">$1</span>
                </div>
                <div className="mt-2 text-muted-foreground">{"-- isolation enforced in the query, not after it"}</div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Features ────────────────────────────────────────────────────────────────

function Features() {
  return (
    <section className="relative py-32 lg:py-40">
      <DotGrid />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <Reveal>
          <SectionLabel>Capabilities</SectionLabel>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground max-w-lg">
            Built to be checked,
            <span className="text-muted-foreground"> not just trusted.</span>
          </h2>
        </Reveal>

        <div className="mt-16 space-y-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={0.1 + i * 0.08}>
              <motion.div
                className="group grid md:grid-cols-[1fr,auto] items-center gap-8 p-6 md:p-8 rounded-2xl border border-border/50 hover:border-border bg-background/80 transition-all"
                whileHover={{ x: 6 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-[17px] font-semibold text-foreground">{feature.title}</h3>
                    <p className="mt-1.5 text-[14px] text-muted-foreground leading-relaxed max-w-md">
                      {feature.description}
                    </p>
                  </div>
                </div>

                <div className="hidden md:block">
                  <div className="bg-background border border-border/50 rounded-xl px-4 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {feature.detail}
                  </div>
                </div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Architecture ────────────────────────────────────────────────────────────

function Architecture() {
  return (
    <section className="relative py-32 lg:py-40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Reveal>
            <SectionLabel>Architecture</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground">
              Frontend and backend,
              <span className="text-muted-foreground"> deployed independently.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed">
              A Next.js UI with zero database access, talking to a Python backend that owns
              every retrieval, every tool call, and every metric.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="bg-background/80 border border-border/50 rounded-2xl p-6 md:p-10 overflow-x-auto">
            <div className="flex items-center gap-3 min-w-[720px] justify-between">
              {ARCHITECTURE_NODES.map((node, i) => (
                <div key={node.label} className="flex items-center gap-3">
                  <motion.div
                    className="bg-background border border-border/50 rounded-xl p-4 flex flex-col items-center gap-2 w-32 hover:border-primary/20 transition-all group"
                    whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 25 } }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
                      {node.icon}
                    </div>
                    <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                      {node.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {node.sub}
                    </span>
                  </motion.div>
                  {i < ARCHITECTURE_NODES.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-zinc-700 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Trust ───────────────────────────────────────────────────────────────────

function Trust() {
  const items = [
    { icon: <Lock className="w-4 h-4" />, title: "Workspace-scoped by design", description: "Isolation is enforced inside the SQL query itself — a WHERE workspaceId clause on every retrieval, not a filter applied after the fact." },
    { icon: <KeyRound className="w-4 h-4" />, title: "Session-based auth", description: "JWT-backed sessions stored in an httpOnly cookie — never exposed to client-side JavaScript." },
    { icon: <Eye className="w-4 h-4" />, title: "Tool execution audit trail", description: "Every AI tool call — task creation, document search, code execution — is logged with its arguments and result." },
    { icon: <ShieldCheck className="w-4 h-4" />, title: "Grounding verification", description: "Responses are scored against retrieved source chunks, so you can see how much of an answer is actually backed by your documents." },
    { icon: <Gauge className="w-4 h-4" />, title: "Request-level observability", description: "Every request carries a correlation ID through metrics, logs, and traces, so a slow or failed answer can be traced end to end." },
    { icon: <Network className="w-4 h-4" />, title: "Independently deployable", description: "Frontend and backend ship separately — a backend fix or scale-up never requires redeploying the UI." },
  ]

  return (
    <section className="relative py-32 lg:py-40" id="security">
      <DotGrid />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-[1fr,1.5fr] gap-16 items-start">
          <div>
            <Reveal>
              <SectionLabel>Trust</SectionLabel>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-foreground">
                Isolation you can
                <br />
                <span className="text-muted-foreground">point to in the query.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-4 text-[15px] text-muted-foreground leading-relaxed max-w-sm">
                Deal room data doesn&apos;t mix — not because of a filter applied afterward,
                but because the isolation boundary lives in the retrieval query itself.
              </p>
            </Reveal>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((item, i) => (
              <Reveal key={item.title} delay={0.1 + i * 0.06}>
                <div className="group p-5 rounded-2xl border border-border/50 hover:border-border bg-background/80 transition-all h-full">
                  <div className="w-9 h-9 rounded-xl bg-muted/50 border border-border flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors mb-3">
                    {item.icon}
                  </div>
                  <h3 className="text-[14px] font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── CTA ─────────────────────────────────────────────────────────────────────

function FinalCTA({ isAuthenticated }: { isAuthenticated?: boolean }) {
  return (
    <section className="relative py-32 lg:py-40">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <div className="relative bg-background/80 border border-border/50 rounded-3xl p-10 md:p-16 overflow-hidden">
            <DotGrid />
            <div className="relative z-10 max-w-lg">
              <h2 className="text-[clamp(1.75rem,3.5vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground">
                Stop trusting.
                <br />
                Start verifying.
              </h2>
              <p className="mt-4 text-[16px] text-muted-foreground leading-relaxed">
                Set up a workspace, upload a document, and ask it a question — the grounding
                score is right there under the answer.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={isAuthenticated ? "/dashboard" : "/signup"}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary/10 text-primary text-[14px] font-medium hover:bg-white transition-colors group"
                >
                  {isAuthenticated ? "Go to workspace" : "Get started free"}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                {!isAuthenticated && (
                  <a
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 text-muted-foreground text-[14px] font-medium hover:border-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    Sign in
                  </a>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer({ isAuthenticated }: { isAuthenticated?: boolean }) {
  return (
    <footer className="border-t border-border/50">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
              <Network className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-[15px] font-semibold text-foreground tracking-tighter">nexus</span>
            <span className="text-[13px] text-muted-foreground ml-2">M&amp;A due diligence, grounded.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#product" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">How it works</a>
            <a href="#security" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">Trust</a>
            <a href={isAuthenticated ? "/dashboard" : "/signup"} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors">
              {isAuthenticated ? "Workspace" : "Get started"}
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/50">
          <span className="text-[12px] text-zinc-700">© 2026 Nexus AI</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <main className="bg-background text-foreground antialiased selection:bg-zinc-700/30 overflow-x-hidden">
      <NoiseOverlay />
      <Navbar isAuthenticated={isAuthenticated} />
      <Hero isAuthenticated={isAuthenticated} />
      <Problem />
      <Workflow />
      <RAGFlow />
      <Features />
      <Architecture />
      <Trust />
      <FinalCTA isAuthenticated={isAuthenticated} />
      <Footer isAuthenticated={isAuthenticated} />
    </main>
  )
}
