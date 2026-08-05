// @ts-nocheck
'use client'

import { useChat } from '@ai-sdk/react'
import { Button } from '@/components/ui/button'
import { Send, Bot, User, Copy, Check, RefreshCw, Square, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useEffect, useRef, use, useState, useCallback, useLayoutEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from 'sonner'

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

/* ─── auto-resize textarea hook ─── */

function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])
  return ref
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

/* ─── message row ─── */

function MessageRow({
  role,
  text,
  isLast,
  onRegenerate,
  canRegenerate,
}: {
  role: string
  text: string
  isLast: boolean
  onRegenerate?: () => void
  canRegenerate: boolean
}) {
  const isUser = role === 'user'

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
                {text}
              </div>
            ) : (
              <div className="text-[0.9375rem] text-foreground">
                <MarkdownContent content={text} />
              </div>
            )}

            {/* Actions — visible on hover */}
            {!isUser && text && (
              <div className="mt-2 flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity duration-150">
                <CopyButton text={text} />
    
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
}: {
  workspaceId: string
  initialMessages: any[]
  onHistoryCleared: () => void
}) {
  const [input, setInput] = useState('')
  const [clearing, setClearing] = useState(false)

  const { messages, sendMessage, status, stop } = useChat({
    api: `/api/chat?workspaceId=${encodeURIComponent(workspaceId)}`,
    body: { workspaceId },
    // Don't use initialMessages here — we manually merge below
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const textareaRef = useAutoResize(input)

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
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 120
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  const showThinking =
    isLoading && allMessages.length > 0 && allMessages[allMessages.length - 1]?.role === 'user'

  return (
    <div className="flex h-full flex-col bg-background">
      {/* ── Header with Clear button ── */}
      {allMessages.length > 0 && (
        <div className="shrink-0 flex items-center justify-end px-4 sm:px-6 pt-3 pb-1">
          <div className="mx-auto max-w-3xl w-full flex justify-end">
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
          </div>
        </div>
      )}

      {/* ── Scrollable message area ── */}
      <div
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain scrollbar-none"
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {allMessages.length === 0 ? (
          /* ── Empty state ── */
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-4 px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  How can I help you today?
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
                  Ask questions about your workspace documents or instruct me to perform tasks.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="pb-4">
            {allMessages.map((m, idx) => {
              const text = getMessageText(m)
              if (!text && m.role !== 'user') return null
              return (
                <MessageRow
                  key={m.id}
                  role={m.role}
                  text={text}
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

      {/* ── Fixed input panel ── */}
      <div className="shrink-0 border-t border-border/50 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-3">
          <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-muted/30 px-4 py-2 shadow-sm transition-colors focus-within:border-indigo-500/50 focus-within:bg-muted/50 focus-within:shadow-md focus-within:shadow-indigo-500/5">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Message Nexus AI…"
              className="flex-1 resize-none bg-transparent text-[0.9375rem] leading-6 placeholder:text-muted-foreground/50 focus:outline-none"
              disabled={isLoading}
              rows={1}
              style={{ minHeight: '24px', maxHeight: '200px' }}
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
          <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
            Nexus AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════
   OUTER: ChatPage (loads history, shows skeleton)
   ════════════════════════════════════════════ */

export default function ChatPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [initialMessages, setInitialMessages] = useState<any[]>([])
  // Key forces ChatInterface to fully re-mount after clearing
  const [chatKey, setChatKey] = useState(0)

  const CACHE_KEY = `nexus_chat_history_${workspaceId}`

  const fetchHistory = useCallback((forceRefresh = false) => {
    // Serve from sessionStorage cache instantly
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          const { messages, ts } = JSON.parse(cached)
          const AGE_MS = Date.now() - ts
          // Serve cache immediately if < 5 minutes old
          if (AGE_MS < 5 * 60 * 1000 && Array.isArray(messages)) {
            setInitialMessages(messages)
            setHistoryLoaded(true)
            // Still revalidate in background silently
            fetchHistory(true)
            return
          }
        }
      } catch {}
    }

    setHistoryLoaded(false)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    fetch(`/api/chat/history?workspaceId=${encodeURIComponent(workspaceId)}`, {
      signal: controller.signal,
    })
      .then((r) => {
        clearTimeout(timeoutId)
        return r.json()
      })
      .then((data) => {
        const msgs = data.messages && Array.isArray(data.messages) ? data.messages : []
        setInitialMessages(msgs)
        // Write to cache
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ messages: msgs, ts: Date.now() }))
        } catch {}
      })
      .catch(() => {
        clearTimeout(timeoutId)
        setInitialMessages([])
      })
      .finally(() => {
        setHistoryLoaded(true)
      })
  }, [workspaceId, CACHE_KEY])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const handleHistoryCleared = useCallback(() => {
    // Bust the cache
    try { sessionStorage.removeItem(CACHE_KEY) } catch {}
    setInitialMessages([])
    setChatKey((k) => k + 1)
    setHistoryLoaded(true)
  }, [CACHE_KEY])

  if (!historyLoaded) return <ChatSkeleton />

  return (
    <ChatInterface
      key={chatKey}
      workspaceId={workspaceId}
      initialMessages={initialMessages}
      onHistoryCleared={handleHistoryCleared}
    />
  )
}
