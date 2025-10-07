import React, { useEffect, useRef, useState } from 'react';
import { Camera, Image, MapPin, X, Send, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import sampleImage from '@/assets/feed-images/birthday.webp';
import { useIsMobile } from '@/hooks/use-mobile';

type ChatItem = {
  id: number;
  name: string;
  message: string;
  time: string;
  avatar: string;
  unread: number; // now number of unread messages
  active: boolean;
};

type Msg = {
  id: number;
  text?: string;
  time: string;
  sent: boolean;
  image?: string;
};

const Messages = () => {
  const chats: ChatItem[] = [
    {
      id: 1,
      name: 'Sarah Johnson',
      message: "Hey! Are you coming to the wedding?",
      time: '2m ago',
      avatar:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
      unread: 3,
      active: true
    },
    {
      id: 2,
      name: 'Michael Brown',
      message: 'Thanks for organizing the memorial service',
      time: '1h ago',
      avatar:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
      unread: 0,
      active: false
    },
    {
      id: 3,
      name: 'Event Planning Team',
      message: 'Your event has been approved!',
      time: '3h ago',
      avatar:
        'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=40&h=40&fit=crop&crop=face',
      unread: 7,
      active: false
    }
  ];

  const messagesPerChat: Record<number, Msg[]> = {
    1: [
      { id: 1, text: "Hey! Are you coming to the wedding?", time: '2:30 PM', sent: false, image: sampleImage },
      { id: 2, text: "Yes, I'll be there! Looking forward to it 😊", time: '2:32 PM', sent: true },
      { id: 3, text: "Great! The ceremony starts at 4 PM. Don't forget to dress formally", time: '2:33 PM', sent: false },
      { id: 4, text: "Perfect, I already have my outfit ready. Should I bring anything?", time: '2:35 PM', sent: true },
      { id: 5, text: "Just bring yourself! Everything else is taken care of", time: '2:36 PM', sent: false }
    ],
    2: [
      { id: 1, text: "Thanks for your help with the memorial logistics.", time: '11:00 AM', sent: false },
      { id: 2, text: "No problem — happy to help. Let me know if you need volunteers.", time: '11:05 AM', sent: true }
    ],
    3: [
      { id: 1, text: "Your event has been approved. Congratulations!", time: '9:20 AM', sent: false },
      { id: 2, text: "Thanks! We'll update the attendees list.", time: '9:25 AM', sent: true }
    ]
  };

  const [messages, setMessages] = useState<Msg[]>(messagesPerChat[1]);
  const [selectedChatIdx, setSelectedChatIdx] = useState<number>(0);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showChatList, setShowChatList] = useState(true);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, imagePreview]);

  const handleSelectChat = (index: number) => {
    setSelectedChatIdx(index);
    const chat = chats[index];
    setMessages(messagesPerChat[chat.id] ?? []);
    if (isMobile) {
      setShowChatList(false);
    }
  };

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentChat = chats[selectedChatIdx];

  return (
    <div className="h-full flex bg-slate-50/20">
      {/* Chat List */}
      <div className={`${isMobile ? (showChatList ? 'w-full' : 'hidden') : 'w-80'} bg-card border-r border-border overflow-y-auto`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-lg">Messages</h2>
          <Button size="sm" className="rounded-lg p-2" aria-label="New message">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-2 space-y-2">
          {chats.map((chat, idx) => {
            const isSelected = idx === selectedChatIdx;
            return (
              <button
                key={chat.id}
                onClick={() => handleSelectChat(idx)}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                  isSelected ? 'bg-nuru-yellow/20' : 'hover:bg-muted/50'
                }`}
              >
                <div className="relative">
                  <img
                    src={chat.avatar}
                    alt={chat.name}
                    className={`w-12 h-12 rounded-full object-cover ${isSelected ? 'ring-2 ring-nuru-yellow/40' : ''}`}
                  />
                  {chat.unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-4 bg-primary text-white text-[10px] font-semibold flex items-center justify-center rounded-full px-1 ring-2 ring-card">
                      {chat.unread}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`font-medium text-sm truncate ${
                        chat.unread > 0 ? 'text-foreground' : 'text-foreground/80'
                      }`}
                    >
                      {chat.name}
                    </h3>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{chat.time}</span>
                  </div>

                  <p className={`text-sm truncate mt-1 ${chat.unread > 0 ? 'font-medium text-foreground/90' : 'text-muted-foreground'}`}>
                    {chat.message}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Details */}
      <div className={`${isMobile ? (showChatList ? 'hidden' : 'w-full') : 'flex-1'} flex flex-col bg-card`}>
        <div className="p-4 border-b border-border flex items-center gap-3">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowChatList(true)}
              className="mr-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <img src={currentChat.avatar} alt={currentChat.name} className="w-10 h-10 rounded-full object-cover" />
          <div>
            <h3 className="font-semibold">{currentChat.name}</h3>
            <p className="text-sm text-muted-foreground">Active 5 minutes ago</p>
          </div>
        </div>

        <div ref={messagesRef} className="flex-1 p-3 md:p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] md:max-w-xs lg:max-w-md px-3 md:px-4 py-2 rounded-lg ${
                msg.sent ? 'bg-nuru-yellow/20 text-foreground' : 'bg-muted'
              }`}>
                {msg.image && (
                  <div className="mb-2 rounded-lg overflow-hidden border border-border">
                    <img src={msg.image} alt="sent" className="w-full h-32 md:h-40 object-cover" />
                  </div>
                )}
                {msg.text && <p className="text-sm break-words">{msg.text}</p>}
                <p className={`text-xs mt-1 ${msg.sent ? 'text-foreground/70' : 'text-muted-foreground'}`}>{msg.time}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 md:p-4 border-t border-border">
          {imagePreview && (
            <div className="mb-3 relative w-full max-h-40 md:max-h-48 rounded-lg overflow-hidden border border-border">
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
            <div className="flex items-center gap-1 md:gap-2 bg-transparent rounded-lg px-2 md:px-3 py-2 flex-1 border border-border">
              <input
                type="text"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                className="flex-1 bg-transparent text-muted-foreground text-sm outline-none placeholder:text-muted-foreground min-w-0"
                aria-label="Type a message"
              />

              <label className="p-1.5 md:p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors shrink-0" title="Attach image">
                <Image className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                <input
                  ref={inputFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              <button className="p-1.5 md:p-2 hover:bg-muted rounded-lg transition-colors shrink-0 hidden sm:block" title="Location">
                <MapPin className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
              </button>
            </div>

            <Button
              size="sm"
              className="px-3 md:px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 shrink-0"
              onClick={sendMessage}
              disabled={!input.trim() && !imagePreview}
              aria-label="Send message"
            >
              <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messages;
