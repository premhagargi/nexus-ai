// @ts-nocheck
'use client'

import { useChat } from '@ai-sdk/react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Copy, RefreshCw, Loader2 } from 'lucide-react'
import { useEffect, useRef, use } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Message, MessageAvatar, MessageContent, MessageFooter } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from 'sonner'

export default function ChatPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params)
  const { messages, input, handleInputChange, handleSubmit, isLoading, reload, setMessages } = useChat({
    api: '/api/chat',
    body: { workspaceId },
    onError: (error) => toast.error(error.message)
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Message copied to clipboard')
  }

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto w-full px-4 pt-12 pb-40">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground mt-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 mb-6 shadow-lg shadow-indigo-500/5">
                <Bot className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-semibold mb-2 text-foreground">How can I help you today?</h3>
              <p className="text-sm max-w-sm">
                Ask me questions about your workspace documents or instruct me to use tools like creating tasks.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {messages.map((m) => (
                <Message key={m.id} align={m.role === 'user' ? 'end' : 'start'} className="max-w-full">
                  <MessageAvatar>
                    <Avatar className={`h-8 w-8 border ${m.role === 'user' ? 'bg-secondary' : 'bg-indigo-500/10 border-indigo-500/20'}`}>
                      <AvatarFallback>{m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-indigo-400" />}</AvatarFallback>
                    </Avatar>
                  </MessageAvatar>
                  <MessageContent>
                    <Bubble variant={m.role === 'user' ? 'default' : 'muted'} className={m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white/5 border border-white/5 shadow-sm'}>
                      <BubbleContent>
                        {m.role === 'user' ? (
                          <div className="whitespace-pre-wrap text-[15px]">{m.content}</div>
                        ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-relaxed">
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
                                      className="rounded-xl my-4 overflow-hidden border border-white/10"
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
                              {m.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </BubbleContent>
                    </Bubble>
                    
                    <MessageFooter>
                      <div className="flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(m.content)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {m.role !== 'user' && m.id === messages[messages.length - 1].id && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => reload()}>
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </MessageFooter>
                  </MessageContent>
                </Message>
              ))}
              
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <Message align="start">
                  <MessageAvatar>
                    <Avatar className="h-8 w-8 border bg-indigo-500/10 border-indigo-500/20">
                      <AvatarFallback><Bot className="h-4 w-4 text-indigo-400" /></AvatarFallback>
                    </Avatar>
                  </MessageAvatar>
                  <MessageContent>
                    <Bubble variant="muted" className="bg-white/5 border border-white/5">
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
      
      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-12 pb-6 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto w-full pointer-events-auto">
          <form onSubmit={handleSubmit} className="relative flex w-full items-center bg-zinc-900/50 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.3)] rounded-[24px] p-2 transition-all focus-within:ring-1 focus-within:ring-white/20 focus-within:bg-zinc-900/80 group">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Message Nexus AI..."
              className="flex-1 bg-transparent border-0 focus-visible:ring-0 shadow-none text-[15px] px-4 py-6 h-auto placeholder:text-muted-foreground/70"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input?.trim()} className="h-10 w-10 rounded-[16px] bg-white text-black hover:bg-zinc-200 shrink-0 transition-colors disabled:opacity-50 disabled:bg-white/10 disabled:text-white/40">
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
          <p className="text-center text-[11px] text-muted-foreground/60 mt-3 font-medium">
            Nexus AI can make mistakes. Consider verifying important information.
          </p>
        </div>
      </div>
    </div>
  )
}
