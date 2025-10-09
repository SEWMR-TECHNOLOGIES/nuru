import React, { useEffect, useRef, useState } from 'react';
import { Send, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useNavigate } from 'react-router-dom';

type Msg = {
  id: number;
  text: string;
  time: string;
  sent: boolean;
  isSupport?: boolean;
};

const LiveChat = () => {
  useWorkspaceMeta({
    title: 'Live Chat - Support',
    description: 'Chat with our support team for instant help with your Nuru account.'
  });

  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: 1,
      text: "Hello! Welcome to Nuru Support. How can I help you today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sent: false,
      isSupport: true
    }
  ]);
  const [input, setInput] = useState('');
  const messagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;

    const newMsg: Msg = {
      id: messages.length + 1,
      text: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sent: true
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');

    // Simulate support response after 1 second
    setTimeout(() => {
      const supportMsg: Msg = {
        id: messages.length + 2,
        text: "Thank you for your message! Our support team is reviewing your inquiry and will respond shortly.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sent: false,
        isSupport: true
      };
      setMessages((prev) => [...prev, supportMsg]);
    }, 1000);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-lg">💬</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Nuru Support</h3>
          <p className="text-sm text-muted-foreground">Online - Typically replies instantly</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/help')}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] md:max-w-md px-4 py-2 rounded-lg ${
              msg.sent 
                ? 'bg-nuru-yellow/20 text-foreground' 
                : 'bg-muted'
            }`}>
              {msg.isSupport && (
                <p className="text-xs font-semibold text-primary mb-1">Support Team</p>
              )}
              <p className="text-sm break-words">{msg.text}</p>
              <p className={`text-xs mt-1 ${msg.sent ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                {msg.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-transparent rounded-lg px-3 py-2 flex-1 border border-border">
            <input
              type="text"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="flex-1 bg-transparent text-muted-foreground text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Type a message"
            />
          </div>

          <Button
            size="sm"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95"
            onClick={sendMessage}
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LiveChat;
