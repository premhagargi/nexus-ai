// @ts-nocheck
'use client'

import { useChat } from '@ai-sdk/react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Copy, RefreshCw, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Message, MessageAvatar, MessageContent, MessageFooter } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { toast } from 'sonner'

export default function ChatPage({ params }: { params: { workspaceId: string } }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, reload, setMessages } = useChat({
    api: '/api/chat',
    body: { workspaceId: params.workspaceId },
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
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <Card className="flex flex-1 flex-col overflow-hidden border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <CardTitle>AI Assistant</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-0 rounded-md border bg-muted/20">
          <ScrollArea className="h-full p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8">
                <Bot className="h-12 w-12 mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">How can I help you today?</h3>
                <p className="text-sm max-w-sm">
                  Ask me questions about your workspace documents or instruct me to use tools like creating tasks.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 pb-4">
                {messages.map((m) => (
                  <Message key={m.id} align={m.role === 'user' ? 'end' : 'start'}>
                    <MessageAvatar>
                      <Avatar className={`h-8 w-8 border ${m.role === 'user' ? 'bg-secondary' : 'bg-primary/10'}`}>
                        <AvatarFallback>{m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</AvatarFallback>
                      </Avatar>
                    </MessageAvatar>
                    <MessageContent>
                      <Bubble variant={m.role === 'user' ? 'default' : 'muted'}>
                        <BubbleContent>
                          {m.role === 'user' ? (
                            <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                          ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
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
                                        className="rounded-md my-2"
                                      >
                                        {String(children).replace(/\n$/, '')}
                                      </SyntaxHighlighter>
                                    ) : (
                                      <code {...props} className={`${className} bg-primary/20 px-1 py-0.5 rounded text-xs`}>
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
                        <div className="flex items-center gap-2 opacity-0 group-hover/message:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(m.content)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                          {m.role !== 'user' && m.id === messages[messages.length - 1].id && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => reload()}>
                              <RefreshCw className="h-3 w-3" />
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
                      <Avatar className="h-8 w-8 border bg-primary/10">
                        <AvatarFallback><Bot className="h-4 w-4" /></AvatarFallback>
                      </Avatar>
                    </MessageAvatar>
                    <MessageContent>
                      <Bubble variant="muted">
                        <BubbleContent className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>
        <CardFooter className="px-0 pb-0 pt-4">
          <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask anything..."
              className="flex-1 bg-muted/50 border-border/50 focus-visible:ring-1"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}
