import React, { useEffect, useRef, useState } from 'react';
import { Image, MapPin, X, Send, Plus, ChevronLeft, MessageCircle, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useConversations, useConversationMessages, useSendMessage } from '@/data/useSocial';
import { messagesApi } from '@/lib/api/messages';
import { Skeleton } from '@/components/ui/skeleton';
import UserSearchInput from '@/components/events/UserSearchInput';
import type { SearchedUser } from '@/hooks/useUserSearch';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
const Messages = () => {
  useWorkspaceMeta({
    title: 'Messages',
    description: 'Chat with event organizers, service providers, and your community on Nuru.'
  });

  const { conversations, loading: conversationsLoading, error: conversationsError, refetch: refetchConversations } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { messages, loading: messagesLoading, refetch: refetchMessages } = useConversationMessages(selectedConversationId || '');
  const { sendMessage, loading: sending } = useSendMessage();

  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showChatList, setShowChatList] = useState(true);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  // Select first conversation by default
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, imagePreview]);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
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

  const handleSendMessage = async () => {
    if ((!input.trim() && !imageFile) || !selectedConversationId) return;

    try {
      await sendMessage(selectedConversationId, input.trim(), imageFile ? [imagePreview!] : undefined);
      setInput('');
      removeImage();
      refetchMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);

  const handleStartNewChat = async (user: SearchedUser) => {
    setStartingChat(true);
    try {
      const response = await messagesApi.startConversation({
        recipient_id: user.id,
        content: `Hi ${user.first_name}!`,
        context_type: "general",
      });
      if (response.success && response.data) {
        setNewChatOpen(false);
        refetchConversations();
        setSelectedConversationId(response.data.conversation?.id || null);
        toast.success(`Chat started with ${user.first_name}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to start conversation");
    } finally {
      setStartingChat(false);
    }
  };

  if (conversationsLoading) {
    return (
      <div className="h-full flex bg-slate-50/20">
        <div className="w-80 bg-card border-r border-border overflow-y-auto">
          <div className="p-4 border-b border-border">
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="p-2 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 flex items-center gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border"><Skeleton className="h-6 w-32" /></div>
          <div className="space-y-4 p-4 flex-1">
            {[1,2,3,4].map(i => (
              <div key={i} className={`flex ${i%2===0?'justify-end':'justify-start'}`}>
                <Skeleton className={`h-12 rounded-lg ${i%2===0?'w-48':'w-56'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (conversationsError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Failed to load messages. Please try again.</p>
          <Button onClick={() => refetchConversations()}>Retry</Button>
        </div>
      </div>
    );
  }

  const newChatDialog = (
    <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-3">Search for a user to start chatting with</p>
          <UserSearchInput 
            onSelect={handleStartNewChat} 
            placeholder="Search by name, email, or phone..." 
            disabled={startingChat}
            allowRegister={false}
          />
          {startingChat && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Starting conversation...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  if (conversations.length === 0) {
    return (
      <>
        {newChatDialog}
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">No messages yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Start a conversation with an event organizer or service provider
            </p>
            <Button onClick={() => setNewChatOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Message
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
    {newChatDialog}
    <div className="h-full flex bg-slate-50/20">
      {/* Chat List */}
      <div className={`${isMobile ? (showChatList ? 'w-full' : 'hidden') : 'w-80'} bg-card border-r border-border overflow-y-auto`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-lg">Messages</h2>
          <Button size="sm" className="rounded-lg p-2" aria-label="New message" onClick={() => setNewChatOpen(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-2 space-y-2">
          {conversations.map((conversation) => {
            const isSelected = conversation.id === selectedConversationId;
            const otherParticipant = conversation.participants?.find(p => p.user_id !== conversation.last_message?.sender_id);
            
            return (
              <button
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                  isSelected ? 'bg-nuru-yellow/20' : 'hover:bg-muted/50'
                }`}
              >
                <div className="relative">
                  <img
                    src={otherParticipant?.user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'}
                    alt={otherParticipant?.user?.first_name || 'User'}
                    className={`w-12 h-12 rounded-full object-cover ${isSelected ? 'ring-2 ring-nuru-yellow/40' : ''}`}
                  />
                  {conversation.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-4 bg-primary text-white text-[10px] font-semibold flex items-center justify-center rounded-full px-1 ring-2 ring-card">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`font-medium text-sm truncate ${
                        conversation.unread_count > 0 ? 'text-foreground' : 'text-foreground/80'
                      }`}
                    >
                      {otherParticipant?.user?.first_name} {otherParticipant?.user?.last_name}
                    </h3>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {conversation.last_message?.created_at 
                        ? new Date(conversation.last_message.created_at).toLocaleDateString()
                        : ''}
                    </span>
                  </div>

                  <p className={`text-sm truncate mt-1 ${conversation.unread_count > 0 ? 'font-medium text-foreground/90' : 'text-muted-foreground'}`}>
                    {conversation.last_message?.content || 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Details */}
      <div className={`${isMobile ? (showChatList ? 'hidden' : 'w-full') : 'flex-1'} flex flex-col bg-card`}>
        {selectedConversation ? (
          <>
            <div className="p-4 border-b border-border flex items-center gap-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowChatList(true)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
              <img 
                src={selectedConversation.participants?.[0]?.user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face'} 
                alt="User" 
                className="w-10 h-10 rounded-full object-cover" 
              />
              <div className="flex-1">
                <h3 className="font-semibold">
                  {selectedConversation.participants?.[0]?.user?.first_name} {selectedConversation.participants?.[0]?.user?.last_name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedConversation.participants?.[0]?.user?.is_online ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            <div ref={messagesRef} className="flex-1 p-3 md:p-4 overflow-y-auto space-y-4">
            {messagesLoading ? (
                <div className="space-y-4 p-4">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`flex ${i%2===0?'justify-end':'justify-start'}`}>
                      <div className="space-y-2"><Skeleton className={`h-12 rounded-lg ${i%2===0?'w-48':'w-56'}`} /><Skeleton className="h-3 w-16" /></div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">No messages in this conversation</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.is_sender ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] md:max-w-xs lg:max-w-md px-3 md:px-4 py-2 rounded-lg ${
                      msg.is_sender ? 'bg-nuru-yellow/20 text-foreground' : 'bg-muted'
                    }`}>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2 rounded-lg overflow-hidden border border-border">
                          <img src={msg.attachments[0]} alt="attachment" className="w-full h-32 md:h-40 object-cover" />
                        </div>
                      )}
                      {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                      <p className={`text-xs mt-1 ${msg.is_sender ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                        {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
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
                  onClick={handleSendMessage}
                  disabled={(!input.trim() && !imagePreview) || sending}
                  aria-label="Send message"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 md:w-4 md:h-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default Messages;
