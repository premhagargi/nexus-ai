'use client'

import { useChat } from '@ai-sdk/react'
import { Button } from '@/components/ui/button'
import { Send, Bot, User, Copy, Check, RefreshCw, Square, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useEffect, useRef, use, useState, useCallback, useLayoutEffect } from 'react'
import { useQuery, useQueryClient, useIsRestoring } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from 'sonner'

import { RAGArchitectureModal } from '@/components/rag-architecture-modal'
import { ShieldCheck, Cpu, Layers, CheckCircle2, AlertTriangle, HelpCircle, FileText, Search, PlusSquare, FileBarChart, ArrowLeftRight, Database, Terminal } from 'lucide-react'

/* ─── helpers ─── */

function getMessageText(m: any): string {
  if (!m) return ''
  if (typeof m.content === 'string' && m.content.trim()) {
    return m.content
  }
  if (typeof m.text === 'string' && m.text.trim()) return m.text
  if (Array.isArray(m.parts) && m.parts.length > 0) {
    const joined = m.parts
      .map((p: any) => {
        if (typeof p === 'string') return p
        if (p?.type === 'text' && typeof p.text === 'string') return p.text
        if (typeof p?.text === 'string') return p.text
        return ''
      })
      .filter(Boolean)
      .join('')
    if (joined) return joined
  }
  if (typeof m === 'string') return m
  return ''
}

/* ─── copy button with feedback ─── */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label="Copy message"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

/* ─── code block with copy ─── */

function CodeBlock({ language, children }: { language: string; children: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group my-4 rounded-xl overflow-hidden border border-border/60 bg-[#1e1e2e]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-b border-white/5">
        <span className="text-xs text-white/40 font-mono">{language}</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'transparent',
          fontSize: '0.8125rem',
          lineHeight: '1.6',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  )
}

/* ─── markdown renderer ─── */

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '')
          if (!inline && match) {
            return (
              <CodeBlock language={match[1]}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            )
          }
          return (
            <code
              {...props}
              className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[0.8125rem] font-mono text-foreground"
            >
              {children}
            </code>
          )
        },
        p({ children }) {
          return <p className="mb-3 last:mb-0 leading-7">{children}</p>
        },
        ul({ children }) {
          return <ul className="mb-3 last:mb-0 ml-6 list-disc space-y-1.5 leading-7">{children}</ul>
        },
        ol({ children }) {
          return <ol className="mb-3 last:mb-0 ml-6 list-decimal space-y-1.5 leading-7">{children}</ol>
        },
        li({ children }) {
          return <li className="leading-7">{children}</li>
        },
        h1({ children }) {
          return <h1 className="text-xl font-semibold mt-6 mb-3 first:mt-0">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-lg font-semibold mt-5 mb-2.5 first:mt-0">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-base font-semibold mt-4 mb-2 first:mt-0">{children}</h3>
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-border pl-4 my-3 text-muted-foreground italic">
              {children}
            </blockquote>
          )
        },
        table({ children }) {
          return (
            <div className="my-4 overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          )
        },
        thead({ children }) {
          return <thead className="bg-muted/50 border-b border-border">{children}</thead>
        },
        th({ children }) {
          return <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">{children}</th>
        },
        td({ children }) {
          return <td className="px-4 py-2.5 border-t border-border/50">{children}</td>
        },
        hr() {
          return <hr className="my-6 border-border/60" />
        },
        a({ href, children }) {
          if (href?.startsWith('tool://')) {
            const toolName = href.replace('tool://', '')
            let Icon = Cpu
            if (toolName === 'save_task') Icon = PlusSquare
            if (toolName === 'summarize_workspace') Icon = Layers
            if (toolName === 'search_documents') Icon = Search
            if (toolName === 'create_note') Icon = FileText
            if (toolName === 'generate_report') Icon = FileBarChart
            if (toolName === 'compare_documents') Icon = ArrowLeftRight
            if (toolName === 'extract_data') Icon = Database
            if (toolName === 'run_code_sandbox') Icon = Terminal
            
            return (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2 py-1 text-[13px] font-medium text-indigo-400 border border-indigo-500/20 my-1">
                <Icon className="h-3.5 w-3.5 animate-pulse" />
                {children}
              </span>
            )
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              {children}
            </a>
          )
        },
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}



/* ─── typing indicator ─── */

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-[6px] w-[6px] rounded-full bg-muted-foreground/40 animate-bounce"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: '1s' }}
        />
      ))}
    </div>
  )
}

function CitationVerificationBadge({ citations, rawText }: { citations?: any; rawText?: string }) {
  let meta = citations
  if (!meta && rawText && rawText.includes('<!-- RAG_METADATA:')) {
    try {
      const match = rawText.match(/<!-- RAG_METADATA:(.*?) -->/)
      if (match && match[1]) {
        meta = JSON.parse(match[1])
      }
    } catch {}
  }

  if (!meta || (!meta.retrieval && !meta.verification)) return null

  const verification = meta.verification
  const retrieval = meta.retrieval
  const groundedScore = verification?.groundedScore ?? 100
  const isHighGrounding = groundedScore >= 80

  return (
    <div className="mt-3 p-3 rounded-xl border border-border/60 bg-muted/30 backdrop-blur-xs space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-semibold ${
            isHighGrounding
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
          }`}>
            {isHighGrounding ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {groundedScore}% Grounded & Verified
          </span>
          {retrieval && (
            <span className="text-muted-foreground text-[11px] font-mono">
              ({retrieval.chunkCount} chunk(s) retrieved via {retrieval.method})
            </span>
          )}
        </div>
      </div>

      {verification?.claims && verification.claims.length > 0 && (
        <div className="pt-1.5 border-t border-border/40 space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block mb-1">
            Claim Grounding Verification Trace:
          </span>
          {verification.claims.slice(0, 3).map((claim: any, idx: number) => (
            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
              <span className={`mt-0.5 shrink-0 rounded-full h-2 w-2 ${claim.verified ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="flex-1 line-clamp-1 italic">"{claim.statement}"</span>
              {claim.sourceTitle && (
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 border border-border/50 px-1 rounded">
                  [{claim.sourceTitle}]
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── message row ─── */

function MessageRow({
  role,
  text,
  citations,
  isLast,
  onRegenerate,
  canRegenerate,
}: {
  role: string
  text: string
  citations?: any
  isLast: boolean
  onRegenerate?: () => void
  canRegenerate: boolean
}) {
  const isUser = role === 'user'
  const cleanText = text.replace(/<!-- RAG_METADATA:.*? -->/g, '').trim()

  return (
    <div className={`group/row w-full py-5 ${isUser ? '' : ''}`}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0 pt-0.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full ${
                isUser
                  ? 'bg-foreground text-background'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
              }`}
            >
              {isUser ? (
                <User className="h-3.5 w-3.5" />
              ) : (
                <Bot className="h-3.5 w-3.5" />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-sm font-semibold text-foreground">
              {isUser ? 'You' : 'Nexus AI'}
            </div>
            {isUser ? (
              <div className="whitespace-pre-wrap text-[0.9375rem] leading-7 text-foreground">
                {cleanText}
              </div>
            ) : (
              <div className="text-[0.9375rem] text-foreground">
                <MarkdownContent content={cleanText} />
                <CitationVerificationBadge citations={citations} rawText={text} />
              </div>
            )}

            {/* Actions — visible on hover */}
            {!isUser && cleanText && (
              <div className="mt-2 flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150">
                <CopyButton text={cleanText} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── History loading skeleton ─── */

function ChatSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-hidden px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Simulated message skeletons */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-7 w-7 rounded-full bg-muted animate-pulse shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-20 rounded bg-muted animate-pulse" />
                <div className="h-4 rounded bg-muted/70 animate-pulse" style={{ width: `${60 + i * 10}%` }} />
                {i !== 2 && <div className="h-4 rounded bg-muted/50 animate-pulse" style={{ width: `${40 + i * 8}%` }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t border-border/50 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3">
          <div className="h-12 rounded-2xl bg-muted/50 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   INNER: ChatInterface (receives initialMessages)
   ════════════════════════════════════════════ */

function ChatInterface({
  workspaceId,
  initialMessages,
  onHistoryCleared,
  onMessageFinished,
}: {
  workspaceId: string
  initialMessages: any[]
  onHistoryCleared: () => void
  onMessageFinished: () => void
}) {
  const [input, setInput] = useState('')
  const [clearing, setClearing] = useState(false)

  const { messages, sendMessage, status, stop } = useChat({
    // The backend persists both turns of a completed exchange to Postgres as
    // it streams (see chat_service.py's _save_messages). Marking the cached
    // history stale here — rather than on a timer — means the moment this
    // component next mounts (nav away and back), it picks up the new turn
    // instead of serving a snapshot that's missing it.
    onFinish: () => {
      onMessageFinished()
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Manually merge initial messages with new messages from useChat
  const allMessages = [
    ...initialMessages.filter((m) => m.role && (m.role === 'user' || m.role === 'assistant')),
    ...messages,
  ]

  const shouldAutoScroll = useRef(true)

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    // Increase threshold to 250 to be more forgiving during fast streams
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 250
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current) {
      // Use auto instead of smooth. Smooth scrolling can cause the scrollTop to lag 
      // behind scrollHeight during fast streams, triggering handleScroll and 
      // falsely disabling auto-scroll.
      bottomRef.current?.scrollIntoView({ behavior: 'auto' })
    }
  }, [allMessages, isLoading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    console.log(`[Chat UI] User submitting message: "${text}"`)
    setInput('')
    shouldAutoScroll.current = true
    try {
      await sendMessage({ text }, { body: { workspaceId } })
      console.log(`[Chat UI] sendMessage completed for workspaceId: "${workspaceId}"`)
    } catch (err: any) {
      console.error('[Chat UI] sendMessage error:', err)
      toast.error(err?.message || 'Failed to send message')
    }
  }

  // In ai@7, sendMessage(null) re-submits the last user message (= regenerate)
  const handleRegenerate = useCallback(async () => {
    if (isLoading) return
    shouldAutoScroll.current = true
    try {
      await sendMessage(null as any, { body: { workspaceId } })
    } catch (err: any) {
      console.error('[Chat UI] Regenerate error:', err)
      toast.error(err?.message || 'Failed to regenerate')
    }
  }, [sendMessage, workspaceId, isLoading])

  const handleClearChat = async () => {
    if (clearing || isLoading) return
    setClearing(true)
    try {
      const res = await fetch(
        `/api/chat/history?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Failed to clear chat')
      toast.success('Chat history cleared')
      // Re-mount the ChatInterface with empty history
      onHistoryCleared()
    } catch (err: any) {
      console.error('[Chat UI] Clear chat error:', err)
      toast.error(err?.message || 'Failed to clear chat')
    } finally {
      setClearing(false)
    }
  }

  const [isInspectorOpen, setIsInspectorOpen] = useState(false)

  const showThinking =
    isLoading && allMessages.length > 0 && allMessages[allMessages.length - 1]?.role === 'user'

  return (
    <div className="-mt-6 flex h-[calc(100%+1.5rem)] flex-col">
      <RAGArchitectureModal isOpen={isInspectorOpen} onClose={() => setIsInspectorOpen(false)} />
      
      {/* ── Header with Clear button & RAG Inspector button ── */}
      <div className="shrink-0 flex items-center justify-between px-6 pt-2 pb-1 border-b border-border/40 bg-muted/20">
        <button
          onClick={() => setIsInspectorOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-indigo-500/20 transition-all cursor-pointer"
        >
          <Cpu className="h-3.5 w-3.5" />
          RAG Engine Inspector
        </button>

        {allMessages.length > 0 && (
          <button
            id="clear-chat-btn"
            onClick={handleClearChat}
            disabled={clearing || isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors disabled:opacity-40"
            aria-label="Clear chat history"
          >
            {clearing ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {clearing ? 'Clearing…' : 'Clear chat'}
          </button>
        )}
      </div>

      {/* ── Scrollable message area ── */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain scrollbar-none"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {allMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="w-full max-w-2xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
              {/* Centered Input Box */}
              <div className="w-full text-left">
                <div className="relative flex items-end gap-2 rounded-2xl border border-border/80 bg-muted/40 backdrop-blur-md px-4 py-2.5 shadow-lg transition-colors focus-within:border-indigo-500/50 focus-within:bg-muted/60 focus-within:shadow-xl focus-within:shadow-indigo-500/5">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="Message Nexus AI…"
                    className="flex-1 resize bg-transparent text-[0.9375rem] leading-6 placeholder:text-muted-foreground/50 focus:outline-none min-h-[60px] max-w-full"
                    disabled={isLoading}
                  />

                  {isLoading ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => stop?.()}
                      className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                      aria-label="Stop generating"
                    >
                      <Square className="h-4 w-4 fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="h-8 w-8 shrink-0 rounded-xl bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 disabled:bg-muted disabled:text-muted-foreground transition-all"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-center text-[11px] text-muted-foreground/40">
                  Nexus AI can make mistakes. Verify important information.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="pb-4">
            {allMessages.map((m, idx) => {
              const text = getMessageText(m)
              if (!text && m.role !== 'user') return null
              return (
                <MessageRow
                  key={m.id}
                  role={m.role}
                  text={text}
                  citations={m.citations}
                  isLast={idx === allMessages.length - 1}
                  onRegenerate={handleRegenerate}
                  canRegenerate={!isLoading}
                />
              )
            })}

            {showThinking && (
              <div className="w-full py-5">
                <div className="mx-auto max-w-3xl px-4 sm:px-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 pt-0.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-sm font-semibold text-foreground">Nexus AI</div>
                      <TypingIndicator />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Fixed bottom input panel (visible only when messages exist) ── */}
      {allMessages.length > 0 && (
        <div className="shrink-0 bg-transparent backdrop-blur-md -mb-6 -mx-6 px-6 pt-2.5 pb-3 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mx-auto max-w-3xl">
            <div className="relative flex items-end gap-2 rounded-xl border border-border/60 bg-muted/40 backdrop-blur-sm px-3 py-1.5 shadow-sm transition-colors focus-within:border-indigo-500/50 focus-within:bg-muted/60 focus-within:shadow-md focus-within:shadow-indigo-500/5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Message Nexus AI…"
                className="flex-1 resize bg-transparent text-[0.9375rem] leading-6 placeholder:text-muted-foreground/50 focus:outline-none min-h-[60px] max-w-full"
                disabled={isLoading}
              />

              {isLoading ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => stop?.()}
                  className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
                  aria-label="Stop generating"
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="h-8 w-8 shrink-0 rounded-xl bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 disabled:bg-muted disabled:text-muted-foreground transition-all"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-1 text-center text-[10px] text-muted-foreground/40">
              Nexus AI can make mistakes. Verify important information.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════
   OUTER: ChatPage (loads history, shows skeleton)
   ════════════════════════════════════════════ */

type ChatHistoryResponse = { messages: any[]; conversationId?: string }

async function fetchChatHistory(workspaceId: string): Promise<ChatHistoryResponse> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`/api/chat/history?workspaceId=${encodeURIComponent(workspaceId)}`, {
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Failed to load chat history (${res.status})`)
    const data = await res.json()
    return { messages: Array.isArray(data.messages) ? data.messages : [], conversationId: data.conversationId }
  } finally {
    clearTimeout(timeoutId)
  }
}

export default function ChatPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params)
  const queryClient = useQueryClient()
  const queryKey = ['chat-history', workspaceId] as const

  // While the persisted (sessionStorage) cache is being read back in, treat
  // it like still-loading rather than momentarily rendering an empty chat.
  const isRestoring = useIsRestoring()

  const { data, isPending } = useQuery({
    queryKey,
    queryFn: () => fetchChatHistory(workspaceId),
  })

  // Key forces ChatInterface to fully re-mount (fresh useChat() state) after clearing
  const [chatKey, setChatKey] = useState(0)

  const handleHistoryCleared = useCallback(() => {
    queryClient.setQueryData<ChatHistoryResponse>(queryKey, { messages: [] })
    setChatKey((k) => k + 1)
  }, [queryClient, workspaceId])

  const handleMessageFinished = useCallback(() => {
    queryClient.invalidateQueries({ queryKey })
  }, [queryClient, workspaceId])

  // Only a genuinely cold cache (nothing in memory, nothing persisted yet to
  // restore) blocks on the skeleton. A warm cache — even one being silently
  // revalidated in the background — renders immediately with no loading flash.
  if (isPending || isRestoring) return <ChatSkeleton />

  return (
    <ChatInterface
      key={chatKey}
      workspaceId={workspaceId}
      initialMessages={data?.messages ?? []}
      onHistoryCleared={handleHistoryCleared}
      onMessageFinished={handleMessageFinished}
    />
  )
}
