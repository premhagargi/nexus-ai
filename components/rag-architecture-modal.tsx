'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Layers, Database, Search, Cpu, CheckCircle2, ShieldCheck, Sparkles, Network, ArrowRight } from 'lucide-react'

export function RAGArchitectureModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      title: '1. Intent Routing & Query Optimization',
      icon: Cpu,
      color: 'from-blue-500 to-indigo-600',
      description: 'Cerebras LLM reformulates raw user inputs into standalone queries, stripping noise and identifying tool vs. RAG execution routes.',
      tech: ['Cerebras Cloud', 'Intent Router', 'Query Expansion'],
    },
    {
      title: '2. Vector & Hybrid Keyword Search',
      icon: Database,
      color: 'from-purple-500 to-pink-600',
      description: 'Dual retrieval using Google GenAI 768-dim embeddings (`gemini-embedding-001`) with PostgreSQL `pgvector` Cosine Distance + TSVector FTS keyword fallback.',
      tech: ['pgvector', 'Cosine Distance <->', 'TSVector Keyword Search'],
    },
    {
      title: '3. Hybrid RERANK & Diversity Filtering',
      icon: Layers,
      color: 'from-amber-500 to-orange-600',
      description: 'Candidates are scored using token overlap boosts, neighbor chunk expansion, and MMR (Maximal Marginal Relevance) diversity filtering.',
      tech: ['Lexical Rerank', 'Neighbor Window (+/- 1)', 'MMR Chunk Selection'],
    },
    {
      title: '4. Citation Verification & Hallucination Guardrails',
      icon: ShieldCheck,
      color: 'from-emerald-500 to-teal-600',
      description: 'Extracted response claim sentences are token-matched against retrieved passage chunks to produce a live 0-100% Grounding Score.',
      tech: ['Claim Token Verification', 'Grounding Score', 'Source Tracking'],
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl bg-card/95 backdrop-blur-xl border-border/80 text-foreground rounded-2xl shadow-2xl overflow-hidden p-0">
        <div className="relative bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-background p-6 border-b border-border/50">
          <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-indigo-400 uppercase tracking-widest">
            <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" /> Architecture & Engine Trace
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            Nexus AI RAG Pipeline Architecture
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Production-grade Retrieval-Augmented Generation with strict tenant isolation and live grounding checks.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Step Selector Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {steps.map((step, idx) => {
              const Icon = step.icon
              const isActive = activeStep === idx
              return (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-md shadow-indigo-500/5'
                      : 'border-border/60 bg-muted/20 hover:bg-muted/50 hover:border-border'
                  }`}
                >
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${step.color} text-white mb-2 shadow-sm`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold line-clamp-1">{step.title}</span>
                </button>
              )
            })}
          </div>

          {/* Step Detail Card */}
          <div className="p-5 rounded-2xl border border-border/60 bg-muted/20 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                {steps[activeStep].title}
              </h3>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/5">
                Step {activeStep + 1} of 4
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {steps[activeStep].description}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {steps[activeStep].tech.map((t, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-md bg-card border border-border/80 text-xs font-mono text-foreground/80 shadow-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Code & Vector Spec Preview */}
          <div className="rounded-xl border border-border/60 bg-[#181825] p-4 font-mono text-xs text-indigo-200/90 leading-relaxed overflow-x-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-white/50">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Network className="h-3.5 w-3.5 text-indigo-400" /> PostgreSQL Vector & Tenant Isolation SQL
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">pgvector 0.3.0</span>
            </div>
            <pre className="text-[11px] leading-5 text-indigo-300">
{`-- Partitioned Cosine Vector Search
SELECT id, "documentId", content, metadata, embedding <-> $2::vector AS distance
FROM "DocumentChunk"
WHERE "workspaceId" = $1  -- Strict Tenant Isolation
ORDER BY embedding <-> $2::vector
LIMIT 8;`}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-border/50 bg-muted/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Multi-tenant workspace isolation guaranteed
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
            Close Inspector
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
