"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { motion, useScroll, useTransform, useInView, useMotionValue, useSpring, AnimatePresence } from "framer-motion"
import {
  ArrowRight, FileText, MessageSquare, Sparkles, Shield, Lock, Zap,
  Layers, Search, CheckCircle2, Database, Globe, Terminal, Plus,
  ChevronRight, Folder, Hash, Clock, Users, Bell, Upload,
  GitBranch, Server, Eye, Bot, Braces, ArrowUpRight, Command,
  BookOpen, Code2, Cpu, Network, KeyRound, Fingerprint, ShieldCheck
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface NavLink { label: string; href: string }
interface Feature { icon: ReactNode; title: string; description: string; detail: string }
interface WorkflowStep { label: string; description: string; icon: ReactNode }
interface ArchNode { label: string; icon: ReactNode; x: number; y: number }

// ─── Data ────────────────────────────────────────────────────────────────────

const NAV_LINKS: NavLink[] = [
  { label: "Product", href: "#product" },
  { label: "Docs", href: "#docs" },
  { label: "Changelog", href: "#changelog" },
  { label: "Blog", href: "#blog" },
]

const WORKFLOW_STEPS: WorkflowStep[] = [
  { label: "Upload", description: "Drop documents, PDFs, codebases — any knowledge source.", icon: <Upload className="w-5 h-5" /> },
  { label: "Index", description: "Automatic chunking, embedding, and vector storage.", icon: <Database className="w-5 h-5" /> },
  { label: "Query", description: "Natural language across your entire knowledge graph.", icon: <Search className="w-5 h-5" /> },
  { label: "Execute", description: "AI-driven actions grounded in your team's context.", icon: <Zap className="w-5 h-5" /> },
]

const FEATURES: Feature[] = [
  {
    icon: <MessageSquare className="w-5 h-5" />,
    title: "Context-aware chat",
    description: "Conversations grounded in your documents. Not hallucinated answers — cited, traceable responses.",
    detail: "nexus.chat({ context: workspace.docs })",
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: "Multi-workspace isolation",
    description: "Separate knowledge bases per team, project, or client. Full data isolation with shared billing.",
    detail: "workspace.create({ isolation: 'strict' })",
  },
  {
    icon: <Bot className="w-5 h-5" />,
    title: "AI tool execution",
    description: "Let the model call functions, query databases, trigger workflows — all within your security boundary.",
    detail: "agent.execute({ tools: [...registered] })",
  },
  {
    icon: <CheckCircle2 className="w-5 h-5" />,
    title: "Intelligent task management",
    description: "Tasks generated from conversations, auto-prioritized by context, linked to source documents.",
    detail: "tasks.derive({ from: conversation.id })",
  },
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
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-zinc-800 bg-zinc-900/80 text-zinc-400 backdrop-blur-sm">
      {children}
    </span>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-4">
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
            <circle cx="1" cy="1" r="1" fill="currentColor" className="text-white" />
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

function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 32)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50" : "bg-transparent"
      }`}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="#" className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
              <Network className="w-3.5 h-3.5 text-zinc-950" />
            </div>
            <span className="text-[15px] font-semibold text-zinc-100 tracking-tighter">nexus</span>
          </a>
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-3 py-1.5 text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors rounded-md hover:bg-zinc-800/40"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href="/login" className="hidden sm:block text-[13px] text-zinc-500 hover:text-zinc-200 transition-colors px-3 py-1.5">
            Sign in
          </a>
          <a
            href="/signup"
            className="text-[13px] font-medium text-zinc-950 bg-zinc-100 hover:bg-white px-4 py-1.5 rounded-lg transition-colors"
          >
            Get started
          </a>
        </div>
      </div>
    </motion.nav>
  )
}

// ─── Workspace Mockup ────────────────────────────────────────────────────────

function WorkspaceMockup() {
  const aiResponse = useTypewriter(
    "Based on the Q3 earnings report, revenue grew 23% YoY to $4.2B. The primary driver was enterprise adoption in APAC, which accounted for 34% of new ARR. I've linked the relevant sections below.",
    30,
    2000
  )

  const sidebarItems = [
    { icon: <Hash className="w-3.5 h-3.5" />, label: "General", active: false },
    { icon: <FileText className="w-3.5 h-3.5" />, label: "Q3 Earnings", active: true },
    { icon: <Folder className="w-3.5 h-3.5" />, label: "Product Specs", active: false },
    { icon: <BookOpen className="w-3.5 h-3.5" />, label: "Research", active: false },
  ]

  const tasks = [
    { label: "Review APAC expansion plan", done: true },
    { label: "Update investor deck", done: false },
    { label: "Share findings with team", done: false },
  ]

  return (
    <motion.div
      className="relative w-full rounded-2xl border border-zinc-800/80 bg-zinc-950 shadow-2xl shadow-black/40 overflow-hidden"
      initial={{ opacity: 0, x: 40, rotateY: -2 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      transition={{ duration: 1, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/60 bg-zinc-900/50">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="text-[11px] text-zinc-600 bg-zinc-800/50 px-3 py-0.5 rounded-md">
            nexus — Acme Corp workspace
          </div>
        </div>
        <div className="w-12" />
      </div>

      <div className="flex h-[340px] sm:h-[380px]">
        {/* Sidebar */}
        <div className="hidden sm:flex w-48 flex-col border-r border-zinc-800/60 bg-zinc-900/30 p-3">
          <div className="flex items-center gap-2 mb-4 px-2">
            <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <span className="text-[9px] font-semibold text-emerald-400">A</span>
            </div>
            <span className="text-[12px] font-medium text-zinc-300">Acme Corp</span>
          </div>

          <div className="space-y-0.5">
            {sidebarItems.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] ${
                  item.active
                    ? "bg-zinc-800/80 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-400"
                }`}
              >
                {item.icon}
                {item.label}
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-zinc-800/40">
            <div className="text-[10px] uppercase tracking-wider text-zinc-600 px-2 mb-2">Tasks</div>
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <div key={task.label} className="flex items-start gap-2 px-2">
                  <div className={`w-3 h-3 rounded-sm border mt-0.5 flex-shrink-0 ${
                    task.done ? "bg-emerald-500/20 border-emerald-500/40" : "border-zinc-700"
                  }`}>
                    {task.done && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <span className={`text-[11px] leading-tight ${task.done ? "text-zinc-600 line-through" : "text-zinc-400"}`}>
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
            <FileText className="w-4 h-4 text-zinc-500" />
            <span className="text-[13px] font-medium text-zinc-300">Q3 Earnings Analysis</span>
            <Tag>RAG</Tag>
          </div>

          {/* Chat */}
          <div className="flex-1 space-y-4 overflow-hidden">
            {/* User message */}
            <div className="flex justify-end">
              <div className="bg-zinc-800 rounded-xl rounded-tr-sm px-3.5 py-2.5 max-w-[80%]">
                <p className="text-[12px] text-zinc-200 leading-relaxed">
                  What were the key takeaways from our Q3 earnings report?
                </p>
              </div>
            </div>

            {/* AI response */}
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-3 h-3 text-zinc-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                  <p className="text-[12px] text-zinc-300 leading-relaxed">
                    {aiResponse}
                    <motion.span
                      className="inline-block w-[2px] h-3.5 bg-zinc-400 ml-0.5 align-middle"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                  </p>
                </div>
                {/* Sources */}
                <div className="flex gap-2 mt-2">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/40 border border-zinc-800/60">
                    <FileText className="w-2.5 h-2.5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">Q3-report.pdf</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800/40 border border-zinc-800/60">
                    <FileText className="w-2.5 h-2.5 text-zinc-500" />
                    <span className="text-[10px] text-zinc-500">apac-growth.csv</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="mt-3 flex items-center gap-2 bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-3.5 py-2.5">
            <Search className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-[12px] text-zinc-600">Ask about your documents...</span>
            <div className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/60">
              <Command className="w-2.5 h-2.5 text-zinc-600" />
              <span className="text-[10px] text-zinc-600">K</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
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
              className="mt-6 text-[clamp(2.5rem,5.5vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-zinc-100"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              The workspace
              <br />
              that thinks
              <br />
              <span className="text-zinc-500">with your team.</span>
            </motion.h1>

            <motion.p
              className="mt-6 text-[17px] leading-relaxed text-zinc-500 max-w-md"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.35 }}
            >
              Upload your knowledge. Ask anything. Get cited, grounded answers
              — then turn them into tasks, workflows, and actions.
            </motion.p>

            <motion.div
              className="mt-8 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
            >
              <a
                href="/signup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-100 text-zinc-950 text-[14px] font-medium hover:bg-white transition-colors group"
              >
                Start building
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 text-[14px] font-medium hover:border-zinc-700 hover:text-zinc-300 transition-colors"
              >
                Read the docs
              </a>
            </motion.div>

            {/* API snippet */}
            <motion.div
              className="mt-10 relative"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.65 }}
            >
              <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-3 font-mono text-[12px] leading-relaxed max-w-md">
                <div className="text-zinc-600 mb-1">{"// One call. Full context."}</div>
                <div>
                  <span className="text-zinc-500">const</span>{" "}
                  <span className="text-zinc-300">answer</span>{" "}
                  <span className="text-zinc-600">=</span>{" "}
                  <span className="text-zinc-500">await</span>{" "}
                  <span className="text-emerald-400/80">nexus</span>
                  <span className="text-zinc-500">.query</span>
                  <span className="text-zinc-600">(</span>
                  <span className="text-amber-300/70">{'"What drove Q3 growth?"'}</span>
                  <span className="text-zinc-600">)</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right — workspace mockup */}
          <div className="relative z-10">
            <WorkspaceMockup />
            {/* Floating notification */}
            <motion.div
              className="absolute -top-3 -right-2 sm:right-4 bg-zinc-900 border border-zinc-800/80 rounded-xl px-3 py-2 shadow-xl shadow-black/30"
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
                  <div className="text-[10px] text-zinc-600">Ready to query</div>
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
            <h2 className="text-[clamp(1.75rem,3.5vw,3rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-zinc-100">
              Your team&apos;s knowledge is trapped
              <span className="text-zinc-600"> in forty different tabs.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 text-[17px] leading-relaxed text-zinc-500 max-w-xl">
              Documents in one tool. Chat in another. Tasks in a third. Search that finds filenames, never answers.
              Your team re-explains the same context every day — to each other and to their tools.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { n: "40%", label: "of time lost to context-switching" },
              { n: "12+", label: "tools per knowledge worker" },
              { n: "3.2h", label: "per day searching for information" },
              { n: "68%", label: "of knowledge never surfaces again" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700/60 transition-colors"
              >
                <div className="text-[clamp(1.5rem,3vw,2.25rem)] font-semibold text-zinc-100 tracking-tighter">{stat.n}</div>
                <div className="mt-1 text-[13px] text-zinc-500 leading-snug">{stat.label}</div>
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
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-zinc-100">
                From raw documents
                <br />
                <span className="text-zinc-500">to grounded answers.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-4 text-[15px] text-zinc-500 leading-relaxed max-w-sm">
                Four steps. No configuration wizards, no prompt engineering, no data pipelines to maintain.
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
                      ? "bg-zinc-900/80 border-zinc-700/60"
                      : "bg-transparent border-zinc-800/30 hover:border-zinc-800/60"
                  }`}
                  onClick={() => setActive(i)}
                  whileHover={{ x: 4 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      active === i
                        ? "bg-zinc-100 text-zinc-950"
                        : "bg-zinc-800/50 text-zinc-500"
                    }`}>
                      {step.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-[15px] font-semibold transition-colors ${
                          active === i ? "text-zinc-100" : "text-zinc-500"
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
                            className="mt-1.5 text-[13px] text-zinc-400 leading-relaxed"
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
    { label: "Documents", sub: "PDF, Markdown, Code", icon: <FileText className="w-4 h-4" /> },
    { label: "Chunking", sub: "Semantic splitting", icon: <Braces className="w-4 h-4" /> },
    { label: "Embeddings", sub: "Vector representation", icon: <Cpu className="w-4 h-4" /> },
    { label: "Vector store", sub: "Indexed & searchable", icon: <Database className="w-4 h-4" /> },
    { label: "Retrieval", sub: "Context-ranked", icon: <Search className="w-4 h-4" /> },
    { label: "Generation", sub: "Cited response", icon: <Sparkles className="w-4 h-4" /> },
  ]

  return (
    <section className="relative py-32 lg:py-40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Reveal>
            <SectionLabel>Under the hood</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-zinc-100">
              Retrieval-augmented generation,
              <span className="text-zinc-500"> without the plumbing.</span>
            </h2>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-1/2 left-[8%] right-[8%] h-px bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 -translate-y-1/2" />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-3">
              {stages.map((stage, i) => (
                <Reveal key={stage.label} delay={0.1 + i * 0.07}>
                  <motion.div
                    className="relative bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 text-center hover:border-zinc-700/60 transition-all group"
                    whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 25 } }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-zinc-800/60 border border-zinc-700/30 flex items-center justify-center mx-auto text-zinc-400 group-hover:text-zinc-200 group-hover:bg-zinc-800 transition-colors">
                      {stage.icon}
                    </div>
                    <div className="mt-3 text-[13px] font-semibold text-zinc-200">{stage.label}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-600">{stage.sub}</div>
                  </motion.div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Code example */}
        <Reveal delay={0.4}>
          <div className="mt-16 max-w-2xl mx-auto">
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800/60">
                <Terminal className="w-3.5 h-3.5 text-zinc-600" />
                <span className="text-[11px] text-zinc-600 font-mono">query.ts</span>
              </div>
              <div className="p-4 font-mono text-[12px] leading-relaxed">
                <div>
                  <span className="text-zinc-500">const</span>{" "}
                  <span className="text-zinc-300">response</span>{" "}
                  <span className="text-zinc-600">=</span>{" "}
                  <span className="text-zinc-500">await</span>{" "}
                  <span className="text-emerald-400/80">nexus</span>
                  <span className="text-zinc-500">.query</span>
                  <span className="text-zinc-600">{"({"}</span>
                </div>
                <div className="pl-4">
                  <span className="text-zinc-400">workspace</span>
                  <span className="text-zinc-600">:</span>{" "}
                  <span className="text-amber-300/70">{'"acme-corp"'}</span>
                  <span className="text-zinc-600">,</span>
                </div>
                <div className="pl-4">
                  <span className="text-zinc-400">question</span>
                  <span className="text-zinc-600">:</span>{" "}
                  <span className="text-amber-300/70">{'"Summarize Q3 revenue by region"'}</span>
                  <span className="text-zinc-600">,</span>
                </div>
                <div className="pl-4">
                  <span className="text-zinc-400">citations</span>
                  <span className="text-zinc-600">:</span>{" "}
                  <span className="text-purple-400/70">true</span>
                  <span className="text-zinc-600">,</span>
                </div>
                <div>
                  <span className="text-zinc-600">{"})"}</span>
                </div>
                <div className="mt-2 text-zinc-600">{"// → { answer, sources: [...], confidence: 0.94 }"}</div>
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
          <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-zinc-100 max-w-lg">
            Everything you need.
            <span className="text-zinc-500"> Nothing you don&apos;t.</span>
          </h2>
        </Reveal>

        <div className="mt-16 space-y-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={0.1 + i * 0.08}>
              <motion.div
                className="group grid md:grid-cols-[1fr,auto] items-center gap-8 p-6 md:p-8 rounded-2xl border border-zinc-800/40 hover:border-zinc-700/60 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all"
                whileHover={{ x: 6 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <div className="flex items-start gap-5">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/60 border border-zinc-700/30 flex items-center justify-center flex-shrink-0 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-[17px] font-semibold text-zinc-100">{feature.title}</h3>
                    <p className="mt-1.5 text-[14px] text-zinc-500 leading-relaxed max-w-md">
                      {feature.description}
                    </p>
                  </div>
                </div>

                <div className="hidden md:block">
                  <div className="bg-zinc-950 border border-zinc-800/60 rounded-xl px-4 py-2.5 font-mono text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors whitespace-nowrap">
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
  const nodes = [
    { label: "Client SDK", icon: <Code2 className="w-4 h-4" />, col: 0, row: 1 },
    { label: "API Gateway", icon: <Globe className="w-4 h-4" />, col: 1, row: 1 },
    { label: "Auth", icon: <KeyRound className="w-4 h-4" />, col: 1, row: 0 },
    { label: "RAG Engine", icon: <Cpu className="w-4 h-4" />, col: 2, row: 1 },
    { label: "Vector DB", icon: <Database className="w-4 h-4" />, col: 3, row: 0 },
    { label: "LLM Router", icon: <Network className="w-4 h-4" />, col: 3, row: 1 },
    { label: "Task Engine", icon: <CheckCircle2 className="w-4 h-4" />, col: 3, row: 2 },
    { label: "Response", icon: <MessageSquare className="w-4 h-4" />, col: 4, row: 1 },
  ]

  return (
    <section className="relative py-32 lg:py-40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <Reveal>
            <SectionLabel>Architecture</SectionLabel>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-zinc-100">
              Built for production.
              <span className="text-zinc-500"> Not a prototype.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-4 text-[15px] text-zinc-500 leading-relaxed">
              Multi-tenant, horizontally scalable, and deployed at the edge. Every query is authenticated, encrypted, and audited.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <div className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-6 md:p-10 overflow-x-auto">
            <div className="grid grid-cols-5 gap-x-3 gap-y-3 min-w-[600px]">
              {Array.from({ length: 15 }, (_, idx) => {
                const col = idx % 5
                const row = Math.floor(idx / 5)
                const node = nodes.find((n) => n.col === col && n.row === row)

                if (!node) return <div key={idx} />

                return (
                  <motion.div
                    key={node.label}
                    className="bg-zinc-950 border border-zinc-800/60 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-zinc-600/60 transition-all group"
                    whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 25 } }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-zinc-800/60 border border-zinc-700/30 flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors">
                      {node.icon}
                    </div>
                    <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors text-center">
                      {node.label}
                    </span>
                  </motion.div>
                )
              })}
            </div>

            {/* Flow arrows */}
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-zinc-800/40">
              {["Request", "Authenticate", "Retrieve", "Generate", "Respond"].map((step, i, arr) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-600 font-mono">{step}</span>
                  {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-zinc-700" />}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Security ────────────────────────────────────────────────────────────────

function Security() {
  const items = [
    { icon: <Lock className="w-4 h-4" />, title: "End-to-end encryption", description: "AES-256 at rest, TLS 1.3 in transit. Zero plaintext storage." },
    { icon: <Shield className="w-4 h-4" />, title: "SOC 2 Type II", description: "Audited controls for security, availability, and confidentiality." },
    { icon: <Eye className="w-4 h-4" />, title: "Full audit trail", description: "Every query, document access, and action is logged and exportable." },
    { icon: <Fingerprint className="w-4 h-4" />, title: "SSO & RBAC", description: "SAML, OIDC, SCIM provisioning with granular role-based access." },
    { icon: <Server className="w-4 h-4" />, title: "Data residency", description: "Choose where your data lives. US, EU, and APAC regions available." },
    { icon: <ShieldCheck className="w-4 h-4" />, title: "GDPR & HIPAA", description: "Built compliant from day one. BAA available for healthcare teams." },
  ]

  return (
    <section className="relative py-32 lg:py-40">
      <DotGrid />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-[1fr,1.5fr] gap-16 items-start">
          <div>
            <Reveal>
              <SectionLabel>Enterprise</SectionLabel>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.15] tracking-[-0.03em] text-zinc-100">
                Security is not
                <br />
                <span className="text-zinc-500">an afterthought.</span>
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="mt-4 text-[15px] text-zinc-500 leading-relaxed max-w-sm">
                Built for teams that handle sensitive data. Every layer is designed with defense in depth, from authentication to storage.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-6 flex items-center gap-2">
                <a
                  href="#"
                  className="inline-flex items-center gap-2 text-[13px] text-zinc-400 hover:text-zinc-200 transition-colors group"
                >
                  Security whitepaper
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
              </div>
            </Reveal>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((item, i) => (
              <Reveal key={item.title} delay={0.1 + i * 0.06}>
                <div className="group p-5 rounded-2xl border border-zinc-800/40 hover:border-zinc-700/50 bg-zinc-900/20 hover:bg-zinc-900/40 transition-all h-full">
                  <div className="w-9 h-9 rounded-xl bg-zinc-800/50 border border-zinc-700/30 flex items-center justify-center text-zinc-400 group-hover:text-zinc-200 transition-colors mb-3">
                    {item.icon}
                  </div>
                  <h3 className="text-[14px] font-semibold text-zinc-200">{item.title}</h3>
                  <p className="mt-1 text-[13px] text-zinc-500 leading-relaxed">{item.description}</p>
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

function FinalCTA() {
  return (
    <section className="relative py-32 lg:py-40">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal>
          <div className="relative bg-zinc-900/40 border border-zinc-800/50 rounded-3xl p-10 md:p-16 overflow-hidden">
            <DotGrid />
            <div className="relative z-10 max-w-lg">
              <h2 className="text-[clamp(1.75rem,3.5vw,3rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-zinc-100">
                Stop searching.
                <br />
                Start knowing.
              </h2>
              <p className="mt-4 text-[16px] text-zinc-500 leading-relaxed">
                Set up your workspace in under two minutes. No credit card, no sales call. Just your documents and your questions.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-100 text-zinc-950 text-[14px] font-medium hover:bg-white transition-colors group"
                >
                  Get started free
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 text-zinc-400 text-[14px] font-medium hover:border-zinc-600 hover:text-zinc-300 transition-colors"
                >
                  Talk to us
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  const columns = [
    { title: "Product", links: ["Features", "Security", "Changelog", "Roadmap"] },
    { title: "Developers", links: ["Documentation", "API Reference", "SDKs", "Status"] },
    { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
  ]

  return (
    <footer className="border-t border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
                <Network className="w-3.5 h-3.5 text-zinc-950" />
              </div>
              <span className="text-[15px] font-semibold text-zinc-100 tracking-tighter">nexus</span>
            </div>
            <p className="text-[13px] text-zinc-600 leading-relaxed max-w-[200px]">
              The AI workspace for teams that take their knowledge seriously.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <div className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider mb-4">{col.title}</div>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-6 border-t border-zinc-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[12px] text-zinc-700">© 2026 Nexus AI, Inc.</span>
          <div className="flex items-center gap-4">
            <a href="#" className="text-[12px] text-zinc-700 hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="#" className="text-[12px] text-zinc-700 hover:text-zinc-400 transition-colors">Terms</a>
            <a href="#" className="text-[12px] text-zinc-700 hover:text-zinc-400 transition-colors">DPA</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main className="bg-zinc-950 text-zinc-100 antialiased selection:bg-zinc-700/30 overflow-x-hidden">
      <NoiseOverlay />
      <Navbar />
      <Hero />
      <Problem />
      <Workflow />
      <RAGFlow />
      <Features />
      <Architecture />
      <Security />
      <FinalCTA />
      <Footer />
    </main>
  )
}
