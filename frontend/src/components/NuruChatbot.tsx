import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, X, Search, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import nuruLogo from '@/assets/nuru-logo.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isSearching?: boolean;
  toolNames?: string[];
}

const TOOL_LABELS: Record<string, string> = {
  search_services: 'Finding service providers',
  search_events: 'Looking up events',
  search_people: 'Searching people',
  get_service_categories: 'Loading categories',
  get_event_types: 'Loading event types',
};

// Extracts numbered/bulleted options from the AI message content for quick replies
function extractQuickReplies(content: string): string[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const options: string[] = [];

  for (const line of lines) {
    // Match numbered items: "1. Something?" or "1) Something"
    // Match bulleted items: "- Something" or "* Something"  
    // Match emoji-prefixed items: "🎂 Something"
    const match = line.match(/^(?:\d+[\.\)]\s*|[-*•]\s*|[^\w\s]\s+)(.+)/);
    if (match) {
      let option = match[1].trim();
      // Remove trailing question marks and clean up
      option = option.replace(/\?+$/, '').trim();
      // Remove bold markdown
      option = option.replace(/\*\*/g, '').trim();
      // Only include if it looks like a short option (not a paragraph)
      if (option.length > 2 && option.length < 80 && !option.includes('\n')) {
        options.push(option);
      }
    }
  }

  // Only return if we found 2-6 options (looks like a choice list)
  return options.length >= 2 && options.length <= 6 ? options : [];
}


const NuruChatbot = () => {
  const { data: currentUser } = useCurrentUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (currentUser && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hello ${currentUser.first_name}! 👋 I'm Nuru AI Assistant. I can help you with anything about Nuru - from creating events to finding service providers. What would you like to know?`
      }]);
    }
  }, [currentUser]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const streamChat = async (userMessage: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      if (!supabaseUrl) {
        toast.error('Backend is initializing. Please refresh and try again.');
        return;
      }

      const resp = await fetch(`${supabaseUrl}/functions/v1/nuru-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: userMessage }],
          firstName: currentUser?.first_name
        }),
      });

      if (resp.status === 429) { toast.error('Too many requests. Please try again in a moment.'); return; }
      if (resp.status === 402) { toast.error('Service temporarily unavailable.'); return; }
      if (!resp.ok || !resp.body) {
        const errorText = await resp.text();
        console.error('Function error:', errorText);
        throw new Error(`Stream failed: ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;
      let assistantContent = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '', isSearching: false }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);

            // Handle tool status indicators
            if (parsed.tool_status === 'searching') {
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = {
                  role: 'assistant',
                  content: '',
                  isSearching: true,
                  toolNames: parsed.tool_names || [],
                };
                return newMsgs;
              });
              continue;
            }

            if (parsed.tool_status === 'complete') {
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = {
                  role: 'assistant',
                  content: '',
                  isSearching: false,
                };
                return newMsgs;
              });
              continue;
            }

            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = {
                  role: 'assistant',
                  content: assistantContent,
                  isSearching: false,
                };
                return newMsgs;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message. Please try again.');
      setMessages(prev => prev.slice(0, -1));
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    try { await streamChat(userMessage); } finally { setIsLoading(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    'How do I create an event?',
    'Find me photographers in Dar es Salaam',
    'What service categories are available?',
    'Show me upcoming events'
  ];

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all bg-foreground text-background hover:bg-foreground/90"
            >
              <MessageSquare className="w-6 h-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 sm:w-[400px]"
          >
            <Card className="shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh]">
              {/* Header */}
              <CardHeader className="bg-foreground p-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-background/10 flex items-center justify-center overflow-hidden">
                      <img src={nuruLogo} alt="Nuru" className="w-6 h-6 object-contain" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-background">Nuru AI</h3>
                      <p className="text-[10px] text-background/60">Always here to help</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                    className="text-background hover:bg-background/10 h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0 flex flex-col flex-1 min-h-0">
                {/* Messages container */}
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto overscroll-y-contain p-3 space-y-3"
                  style={{ maxHeight: 'calc(85vh - 130px)' }}
                >
                  {messages.map((message, index) => (
                    <ChatMessage
                      key={index}
                      message={message}
                      currentUser={currentUser}
                    />
                  ))}

                  {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex gap-2.5">
                      <BotAvatar />
                      <div className="rounded-2xl rounded-tl-sm px-3 py-2 bg-muted max-w-[85%]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Reply Chips - shown when AI asks a follow-up question */}
                  {!isLoading && messages.length > 1 && messages[messages.length - 1]?.role === 'assistant' && (() => {
                    const lastContent = messages[messages.length - 1].content;

                    const replies = extractQuickReplies(lastContent);
                    if (replies.length === 0) return null;
                    return (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-1">Quick replies</p>
                        <div className="flex flex-wrap gap-1.5">
                          {replies.map((r, idx) => (
                            <button
                              key={idx}
                              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-foreground hover:text-background transition-colors text-foreground/80 font-medium"
                              onClick={() => { setInput(r); inputRef.current?.focus(); }}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Suggested Questions */}
                  {messages.length === 1 && (
                    <div className="space-y-1.5 pt-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium px-1">Suggestions</p>
                      {suggestedQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-foreground/80"
                          onClick={() => { setInput(q); inputRef.current?.focus(); }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-3 border-t border-border flex-shrink-0">
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask me anything..."
                      disabled={isLoading}
                      rows={1}
                      className="flex-1 resize-none bg-muted rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 disabled:opacity-50 max-h-20 overflow-y-auto"
                      autoComplete="off"
                      style={{ minHeight: '36px' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 80) + 'px';
                      }}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      size="icon"
                      className="flex-shrink-0 rounded-xl h-9 w-9 bg-foreground text-background hover:bg-foreground/90"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5 text-center tracking-wide">
                    SEWMR TECHNOLOGIES
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// -- Sub-components --

function BotAvatar() {
  return (
    <Avatar className="w-7 h-7 flex-shrink-0">
      <AvatarFallback className="bg-foreground text-background flex items-center justify-center text-[10px] font-bold">
        N
      </AvatarFallback>
    </Avatar>
  );
}

function ChatMessage({ message, currentUser }: { message: Message; currentUser: any }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {isUser ? (
        <Avatar className="w-7 h-7 flex-shrink-0">
          {currentUser?.avatar && <AvatarImage src={currentUser.avatar} alt={currentUser.first_name} />}
          <AvatarFallback className="bg-muted text-foreground flex items-center justify-center text-[10px] font-medium">
            {currentUser
              ? `${currentUser.first_name?.[0] || ''}${currentUser.last_name?.[0] || ''}`.toUpperCase()
              : <User className="w-3 h-3" />}
          </AvatarFallback>
        </Avatar>
      ) : (
        <BotAvatar />
      )}

      <div className={`max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        {/* Searching indicator */}
        {message.isSearching && (
          <div className="rounded-2xl rounded-tl-sm px-3 py-2 bg-muted mb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Search className="w-3.5 h-3.5 animate-pulse" />
              <span className="animate-pulse">
                {message.toolNames?.map(t => TOOL_LABELS[t] || t).join(', ') || 'Searching...'}
              </span>
            </div>
          </div>
        )}

        {/* Message content */}
        {message.content && (
          <div
            className={`rounded-2xl px-3 py-2 ${
              isUser
                ? 'rounded-tr-sm bg-foreground text-background'
                : 'rounded-tl-sm bg-muted text-foreground'
            }`}
          >
            <div className={`text-[13px] leading-relaxed nuru-chat-prose ${isUser ? 'text-background' : 'text-foreground'}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ children }) => (
                    <div className="my-2 -mx-1 overflow-x-auto rounded-lg border border-border">
                      <table className="min-w-full text-[11px]">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-muted/60">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-2 py-1.5 text-left font-semibold text-foreground/80 whitespace-nowrap border-b border-border">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-2 py-1.5 text-foreground/70 whitespace-nowrap border-b border-border/50">{children}</td>
                  ),
                  p: ({ children }) => <p className="my-1">{children}</p>,
                  ul: ({ children }) => <ul className="my-1 ml-3 list-disc space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="my-1 ml-3 list-decimal space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li className="text-[13px]">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-70">{children}</a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default NuruChatbot;
