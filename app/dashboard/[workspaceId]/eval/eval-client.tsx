'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Gauge, Play, CheckCircle2, XCircle, Clock, Zap, Target, BarChart2, Cpu } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'

export function RAGEvalClient({ workspaceId }: { workspaceId: string }) {
  const [isRunning, setIsRunning] = useState(false)
  const [customQuery, setCustomQuery] = useState('')
  const [report, setReport] = useState<any>(null)

  const runEval = async (queries?: string[]) => {
    setIsRunning(true)
    try {
      const res = await fetch('/api/rag/eval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          customQueries: queries || (customQuery ? [customQuery] : undefined),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Evaluation failed')

      setReport(data.report)
      toast.success('RAG evaluation benchmark completed!')
    } catch (err: any) {
      toast.error(err?.message || 'Failed to run evaluation')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full pb-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-background p-6 border border-border/60 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Gauge className="h-3.5 w-3.5" /> Benchmarks & Verification Suite
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              RAG Retrieval Quality & Accuracy Evaluator
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Programmatic calculation of Precision@K, Mean Reciprocal Rank (MRR), Cosine Distance, and retrieval latency.
            </p>
          </div>

          <Button
            onClick={() => runEval()}
            disabled={isRunning}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-indigo-500/20 h-11 px-6 font-semibold"
          >
            {isRunning ? (
              <>
                <Spinner className="mr-2 h-4 w-4 animate-spin" />
                Evaluating RAG...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4 fill-current" />
                Run Benchmark Suite
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Custom Query Sandbox */}
      <Card className="bg-card border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Target className="h-4 w-4 text-indigo-400" /> Interactive RAG Sandbox
          </CardTitle>
          <CardDescription>
            Test any custom question against your workspace embeddings to evaluate chunk distance and Precision@K.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="e.g. What are our Q3 revenue targets and deadlines?"
              className="rounded-xl"
              onKeyDown={(e) => e.key === 'Enter' && runEval([customQuery])}
            />
            <Button
              onClick={() => runEval([customQuery])}
              disabled={!customQuery.trim() || isRunning}
              variant="secondary"
              className="rounded-xl shrink-0"
            >
              Test Query
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Metric Cards (when report exists) */}
      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-card border-border/60">
              <CardContent className="p-5 flex flex-col justify-between space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-indigo-400" /> Overall Precision@K
                </span>
                <div className="text-3xl font-extrabold text-foreground">
                  {(report.overallPrecision * 100).toFixed(0)}%
                </div>
                <span className="text-[11px] text-muted-foreground">Relevant chunk ratio</span>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/60">
              <CardContent className="p-5 flex flex-col justify-between space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5 text-purple-400" /> Mean Reciprocal Rank
                </span>
                <div className="text-3xl font-extrabold text-foreground">
                  {report.meanReciprocalRank.toFixed(2)}
                </div>
                <span className="text-[11px] text-muted-foreground">MRR ranking score</span>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/60">
              <CardContent className="p-5 flex flex-col justify-between space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" /> Avg Confidence
                </span>
                <div className="text-3xl font-extrabold text-foreground">
                  {(report.averageConfidence * 100).toFixed(0)}%
                </div>
                <span className="text-[11px] text-muted-foreground">Embedding similarity score</span>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/60">
              <CardContent className="p-5 flex flex-col justify-between space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-emerald-400" /> Avg Latency
                </span>
                <div className="text-3xl font-extrabold text-foreground">
                  {report.averageLatencyMs} ms
                </div>
                <span className="text-[11px] text-muted-foreground">Retrieval speed</span>
              </CardContent>
            </Card>
          </div>

          {/* Test Metrics Table */}
          <Card className="bg-card border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-bold">Query Benchmark Trace</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      <th className="pb-3 px-2">Query</th>
                      <th className="pb-3 px-2">Pass / Fail</th>
                      <th className="pb-3 px-2">Chunks</th>
                      <th className="pb-3 px-2">Top Distance</th>
                      <th className="pb-3 px-2">Precision@K</th>
                      <th className="pb-3 px-2">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {report.metrics.map((m: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-2 font-medium max-w-xs truncate">{m.query}</td>
                        <td className="py-3 px-2">
                          {m.pass ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-semibold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> PASS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-rose-400 font-semibold">
                              <XCircle className="h-3.5 w-3.5" /> LOW
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 font-mono text-xs">{m.retrievedCount}</td>
                        <td className="py-3 px-2 font-mono text-xs">{m.topDistance}</td>
                        <td className="py-3 px-2 font-mono text-xs">{m.precisionAtK}</td>
                        <td className="py-3 px-2 font-mono text-xs">{m.latencyMs} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
