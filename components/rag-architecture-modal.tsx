'use client'

import { useState } from 'react'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Layers, Database, Cpu, CheckCircle2, ShieldCheck, Sparkles, Network, XIcon } from 'lucide-react'

export function RAGArchitectureModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      title: '1. Intent Routing & Query Optimization',
      icon: Cpu,
      description: 'Cerebras LLM reformulates raw user inputs into standalone queries, stripping noise and identifying tool vs. RAG execution routes.',
      tech: ['Cerebras Cloud', 'Intent Router', 'Query Expansion'],
    },
    {
      title: '2. Vector & Hybrid Keyword Search',
      icon: Database,
      description: 'Dual retrieval using Google GenAI 768-dim embeddings (`gemini-embedding-001`) with PostgreSQL `pgvector` Cosine Distance + TSVector FTS keyword fallback.',
      tech: ['pgvector', 'Cosine Distance <->', 'TSVector Keyword Search'],
    },
    {
      title: '3. Hybrid RERANK & Diversity Filtering',
      icon: Layers,
      description: 'Candidates are scored using token overlap boosts, neighbor chunk expansion, and MMR (Maximal Marginal Relevance) diversity filtering.',
      tech: ['Lexical Rerank', 'Neighbor Window (+/- 1)', 'MMR Chunk Selection'],
    },
    {
      title: '4. Citation Verification & Hallucination Guardrails',
      icon: ShieldCheck,
      description: 'Extracted response claim sentences are token-matched against retrieved passage chunks to produce a live 0-100% Grounding Score.',
      tech: ['Claim Token Verification', 'Grounding Score', 'Source Tracking'],
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl lg:max-w-3xl max-h-[85vh] flex flex-col bg-card border-border text-foreground rounded-xl shadow-xl overflow-hidden p-0 gap-0"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> Architecture & Engine Trace
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              RAG Pipeline Inspector
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              How a query moves through retrieval, reranking, and grounding verification.
            </DialogDescription>
          </div>
          <DialogClose
            render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {/* Step Selector Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {steps.map((step, idx) => {
              const Icon = step.icon
              const isActive = activeStep === idx
              return (
                <button
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`flex flex-col items-start gap-2 p-3 rounded-lg border text-left transition-colors ${
                    isActive
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  <div className="p-1.5 rounded-md bg-primary text-primary-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold leading-snug line-clamp-2">{step.title}</span>
                </button>
              )
            })}
          </div>

          {/* Step Detail Card */}
          <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-foreground">
                {steps[activeStep].title}
              </h3>
              <Badge variant="outline" className="shrink-0">
                Step {activeStep + 1} of {steps.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {steps[activeStep].description}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {steps[activeStep].tech.map((t, i) => (
                <span
                  key={i}
                  className="px-2 py-1 rounded-md bg-card border border-border text-xs font-mono text-foreground/80"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Code & Vector Spec Preview */}
          <div className="rounded-lg border border-border bg-[#1c1c1c] p-4 font-mono text-xs text-white/80 leading-relaxed overflow-x-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-white/50">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                <Network className="h-3.5 w-3.5" /> PostgreSQL Vector & Tenant Isolation SQL
              </span>
              <span className="text-[10px] text-white/40 font-semibold">pgvector 0.3.0</span>
            </div>
            <pre className="text-[11px] leading-5 text-white/70">
{`-- Partitioned Cosine Vector Search
SELECT id, "documentId", content, metadata, embedding <-> $2::vector AS distance
FROM "DocumentChunk"
WHERE "workspaceId" = $1  -- Strict Tenant Isolation
ORDER BY embedding <-> $2::vector
LIMIT 8;`}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-t border-border bg-muted/10">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Multi-tenant workspace isolation guaranteed
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
