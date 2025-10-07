import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';

type Msg = {
  id: number;
  text?: string;
  time: string;
  sent: boolean;
  image?: string;
};

const ProviderChat = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const providerId = searchParams.get('providerId');
  const providerName = searchParams.get('providerName') || 'Service Provider';
  const providerImage = searchParams.get('providerImage') || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=150&h=150&fit=crop&crop=face';
  const serviceId = searchParams.get('serviceId');
  const eventId = searchParams.get('eventId');

  const [messages, setMessages] = useState<Msg[]>([
    { id: 1, text: `Hi! I'm interested in your services for my event.`, time: '10:00 AM', sent: true },
    { id: 2, text: `Hello! Thank you for reaching out. I'd be happy to help with your event. What are the details?`, time: '10:02 AM', sent: false },
  ]);

  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, imagePreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (inputFileRef.current) inputFileRef.current.value = '';
  };

  const sendMessage = () => {
    if (!input.trim() && !imageFile) return;

    const newMsg: Msg = {
      id: messages.length + 1,
      text: input.trim() || undefined,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sent: true,
      image: imagePreview || undefined
    };

    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    removeImage();
  };

  const handleAssignProvider = () => {
    if (!serviceId || !eventId) return;

    const events = JSON.parse(localStorage.getItem('events') || '[]');
    const updatedEvents = events.map((event: any) => {
      if (event.id === eventId) {
        return {
          ...event,
          services: event.services.map((service: any) =>
            service.id === serviceId
              ? { ...service, providerName }
              : service
          )
        };
      }
      return event;
    });

    localStorage.setItem('events', JSON.stringify(updatedEvents));
    navigate(`/event-management/${eventId}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
            <img
              src={providerImage}
              alt={providerName}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h3 className="font-semibold">{providerName}</h3>
            <p className="text-sm text-muted-foreground">Service Provider</p>
          </div>
        </div>
        
        {serviceId && eventId && (
          <Button
            size="sm"
            onClick={handleAssignProvider}
            className="shrink-0"
          >
            Assign Provider
          </Button>
        )}
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] md:max-w-md px-4 py-2 rounded-lg ${
              msg.sent ? 'bg-[hsl(var(--nuru-yellow))]/20 text-foreground' : 'bg-muted'
            }`}>
              {msg.image && (
                <div className="mb-2 rounded-lg overflow-hidden border border-border">
                  <img src={msg.image} alt="sent" className="w-full h-40 object-cover" />
                </div>
              )}
              {msg.text && <p className="text-sm break-words">{msg.text}</p>}
              <p className={`text-xs mt-1 ${msg.sent ? 'text-foreground/70' : 'text-muted-foreground'}`}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        {imagePreview && (
          <div className="mb-3 relative w-full max-h-48 rounded-lg overflow-hidden border border-border">
            <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
            <button
              onClick={removeImage}
              className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-transparent rounded-lg px-3 py-2 flex-1 border border-border">
            <input
              type="text"
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground min-w-0"
              aria-label="Type a message"
            />

            <label className="p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors shrink-0" title="Attach image">
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              <input
                ref={inputFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          <Button
            size="sm"
            className="px-4 py-2 rounded-lg shrink-0"
            onClick={sendMessage}
            disabled={!input.trim() && !imagePreview}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProviderChat;
