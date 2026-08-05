// @ts-nocheck
'use client'

import { useChat } from '@ai-sdk/react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Copy, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useEffect, useRef, use, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Message, MessageAvatar, MessageContent, MessageFooter } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from 'sonner'

function getMessageText(m: any): string {
  if (!m) return ''
  let text = ''
  if (typeof m.content === 'string' && m.content.trim()) {
    text = m.content
  } else if (typeof m.text === 'string' && m.text.trim()) {
    text = m.text
  } else if (Array.isArray(m.parts) && m.parts.length > 0) {
    text = m.parts
      .map((p: any) => {
        if (typeof p === 'string') return p
        if (p?.type === 'text' && typeof p.text === 'string') return p.text
        if (typeof p?.text === 'string') return p.text
        return ''
      })
      .filter(Boolean)
      .join('')
  }
  if (!text && typeof m === 'string') {
    text = m
  }
  if (typeof text === 'string' && text.startsWith('0:"')) {
    try {
      text = JSON.parse(text.slice(2))
    } catch (e) {}
  }
  return text
}

export default function ChatPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params)
  const [input, setInput] = useState('')
  const { messages, sendMessage, status, regenerate } = useChat({
    api: `/api/chat?workspaceId=${encodeURIComponent(workspaceId)}`,
    body: { workspaceId },
  })

  const isLoading = status === 'streaming' || status === 'submitted'
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    try {
      await sendMessage({ text }, { body: { workspaceId } })
    } catch (err: any) {
      console.error('[Chat UI] sendMessage error:', err)
      toast.error(err?.message || 'Failed to send message')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Message copied to clipboard')
  }

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        <div className="max-w-3xl mx-auto w-full px-4 py-6 my-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground my-12">
              <div className="flex h-20 w-20 items-center justify-center mb-6">
                <img src="/ai-magic-icon.webp" alt="AI Magic" className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(99,102,241,0.3)]" />
              </div>
              <h3 className="text-2xl font-semibold mb-2 text-foreground">How can I help you today?</h3>
              <p className="text-sm max-w-sm">
                Ask me questions about your workspace documents or instruct me to use tools like creating tasks.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((m) => {
                const textContent = getMessageText(m)
                return (
                  <Message key={m.id} align={m.role === 'user' ? 'end' : 'start'} className="max-w-full">
                    <MessageAvatar>
                      <Avatar className={`h-8 w-8 border ${m.role === 'user' ? 'bg-secondary' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                        <AvatarFallback>{m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-indigo-400" />}</AvatarFallback>
                      </Avatar>
                    </MessageAvatar>
                    <MessageContent>
                      <Bubble variant={m.role === 'user' ? 'default' : 'muted'} className={m.role === 'user' ? 'bg-indigo-600 text-white border-0 shadow-none' : 'bg-muted/80 text-foreground border-0 shadow-none'}>
                        <BubbleContent className="border-0 shadow-none">
                          {m.role === 'user' ? (
                            <div className="whitespace-pre-wrap text-[15px]">{textContent}</div>
                          ) : (
                            <div className="prose prose-sm max-w-none text-[15px] leading-relaxed text-foreground">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    return !inline && match ? (
                                      <SyntaxHighlighter
                                        {...props}
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        className="rounded-xl my-4 overflow-hidden border border-border"
                                      >
                                        {String(children).replace(/\n$/, '')}
                                      </SyntaxHighlighter>
                                    ) : (
                                      <code {...props} className={`${className} bg-primary/20 px-1.5 py-0.5 rounded-md text-[13px] font-mono`}>
                                        {children}
                                      </code>
                                    )
                                  }
                                }}
                              >
                                {textContent}
                              </ReactMarkdown>
                            </div>
                          )}
                        </BubbleContent>
                      </Bubble>
                      
                      <MessageFooter>
                        <div className="flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(textContent)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {m.role !== 'user' && m.id === messages[messages.length - 1].id && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => regenerate()}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                )
              })}
              
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <Message align="start">
                  <MessageAvatar>
                    <Avatar className="h-8 w-8 border bg-indigo-500/10 border-indigo-500/20">
                      <AvatarFallback><Bot className="h-4 w-4 text-indigo-400" /></AvatarFallback>
                    </Avatar>
                  </MessageAvatar>
                  <MessageContent>
                    <Bubble variant="muted" className="bg-muted/50 border border-border/50">
                      <BubbleContent className="flex items-center gap-3 py-3">
                        <div className="flex gap-1">
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>
      
      {/* Fixed Message Input Panel */}
      <div className="sticky bottom-0 left-0 w-full shrink-0 bg-background/80 backdrop-blur-2xl border-t border-border/40 pt-4 pb-5 px-4 z-20">
        <div className="max-w-3xl mx-auto w-full">
          <div className="relative flex w-full items-center bg-background/60 backdrop-blur-2xl border border-border/80 shadow-[0_4px_24px_rgba(0,0,0,0.12)] rounded-[20px] p-1.5 transition-all focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-500/50 focus-within:bg-background/80">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Message Nexus AI..."
              className="flex-1 bg-transparent border-0 focus-visible:ring-0 shadow-none text-[15px] px-3 py-2.5 min-h-[44px] max-h-48 resize-none placeholder:text-muted-foreground/60 outline-none w-full"
              disabled={isLoading}
              rows={1}
            />
            <Button
              type="button"
              onClick={handleSend}
              size="icon"
              disabled={isLoading || !input.trim()}
              className="h-9 w-9 rounded-[14px] bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 transition-colors disabled:opacity-40 disabled:bg-muted disabled:text-muted-foreground/50 mb-0.5 self-end"
            >
              {isLoading ? <Spinner className="h-4 w-4 text-inherit" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground/60 mt-2 font-medium">
            Nexus AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </div>
    </div>
  )
}
