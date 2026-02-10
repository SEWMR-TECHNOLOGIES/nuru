import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Image, MapPin, X, Send, Plus, ChevronLeft, MessageCircle, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useConversations, useConversationMessages, useSendMessage } from '@/data/useSocial';
import { messagesApi } from '@/lib/api/messages';
import { uploadsApi } from '@/lib/api/uploads';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import UserSearchInput from '@/components/events/UserSearchInput';
import type { SearchedUser } from '@/hooks/useUserSearch';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/** Get two-letter initials from a name */
const getInitials = (name?: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const Messages = () => {
  useWorkspaceMeta({
    title: 'Messages',
    description: 'Chat with event organizers, service providers, and your community on Nuru.'
  });

  const { data: currentUser } = useCurrentUser();
  const { conversations, loading: conversationsLoading, error: conversationsError, refetch: refetchConversations, clearUnread } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { messages, loading: messagesLoading, refetch: refetchMessages, appendMessage } = useConversationMessages(selectedConversationId || '');
  const { sendMessage, loading: sending } = useSendMessage();

  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showChatList, setShowChatList] = useState(true);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [initialMessage, setInitialMessage] = useState('');
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputFileRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useIsMobile();

  // FIX: Ref to prevent duplicate mark-as-read calls
  const lastMarkedRef = useRef<string | null>(null);

  // Select first conversation by default
  useEffect(() => {
    if (conversations.length > 0 && !selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, imagePreview]);

  // FIX: Mark conversation as read when selected — only fires once per conversation
  useEffect(() => {
    if (selectedConversationId && selectedConversationId !== lastMarkedRef.current) {
      lastMarkedRef.current = selectedConversationId;
      clearUnread(selectedConversationId);
      messagesApi.markAsRead(selectedConversationId).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

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

    const messageContent = input.trim();
    let uploadedUrl: string | undefined;

    // Upload image first if present
    if (imageFile) {
      setUploadingImage(true);
      try {
        const uploadRes = await uploadsApi.upload(imageFile);
        if (uploadRes.success && uploadRes.data?.url) {
          uploadedUrl = uploadRes.data.url;
        } else {
          toast.error('Failed to upload image');
          setUploadingImage(false);
          return;
        }
      } catch {
        toast.error('Failed to upload image');
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }

    const attachments = uploadedUrl ? [uploadedUrl] : undefined;

    // Optimistic: append message locally for instant feedback
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      is_sender: true,
      sender_id: currentUser?.id,
      attachments: attachments || [],
      created_at: new Date().toISOString(),
    };
    appendMessage(optimisticMsg);
    setInput('');
    removeImage();

    try {
      await sendMessage(selectedConversationId, messageContent, attachments);
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
    if (!initialMessage.trim()) {
      toast.error('Please type a message to start the conversation');
      return;
    }

    // Check if conversation already exists with this user
    const existingConv = conversations.find(c => c.participant?.id === user.id);
    if (existingConv) {
      setNewChatOpen(false);
      setInitialMessage('');
      setSelectedConversationId(existingConv.id);
      if (isMobile) setShowChatList(false);
      return;
    }

    setStartingChat(true);
    try {
      const response = await messagesApi.startConversation({
        recipient_id: user.id,
        message: initialMessage.trim(),
      });
      if (response.success && response.data) {
        setNewChatOpen(false);
        setInitialMessage('');
        await refetchConversations();
        setSelectedConversationId(response.data.id || null);
        if (isMobile) setShowChatList(false);
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
      <div className="h-full flex bg-muted/20">
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
    <Dialog open={newChatOpen} onOpenChange={(open) => { setNewChatOpen(open); if (!open) setInitialMessage(''); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">Search for a user to start chatting with</p>
            <UserSearchInput 
              onSelect={handleStartNewChat} 
              placeholder="Search by name, email, or phone..." 
              disabled={startingChat || !initialMessage.trim()}
              allowRegister={false}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Your first message</label>
            <input
              type="text"
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Type your message..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            />
            {!initialMessage.trim() && (
              <p className="text-xs text-muted-foreground mt-1">Type a message before selecting a user</p>
            )}
          </div>
          {startingChat && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
    <div className="h-full flex bg-muted/20">
      {/* Chat List */}
      <div className={`${isMobile ? (showChatList ? 'w-full' : 'hidden') : 'w-80'} bg-card border-r border-border overflow-y-auto`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-lg">Messages</h2>
          <Button size="sm" className="rounded-lg p-2" aria-label="New message" onClick={() => setNewChatOpen(true)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-2 space-y-1">
          {conversations.map((conversation) => {
            const isSelected = conversation.id === selectedConversationId;
            const participantName = conversation.participant?.name || 'Unknown';
            
            return (
              <button
                key={conversation.id}
                onClick={() => handleSelectConversation(conversation.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 ${
                  isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                }`}
              >
                <div className="relative">
                  <Avatar className={`w-12 h-12 ${isSelected ? 'ring-2 ring-primary/40' : ''}`}>
                    {conversation.participant?.avatar ? (
                      <AvatarImage src={conversation.participant.avatar} alt={participantName} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                      {getInitials(participantName)}
                    </AvatarFallback>
                  </Avatar>
                  {conversation.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-4 bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center rounded-full px-1 ring-2 ring-card">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`font-medium text-sm truncate ${
                        conversation.unread_count > 0 ? 'text-foreground font-semibold' : 'text-foreground/80'
                      }`}
                    >
                      {participantName}
                    </h3>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {conversation.last_message?.sent_at 
                        ? new Date(conversation.last_message.sent_at).toLocaleDateString([], { day: '2-digit', month: 'short' })
                        : ''}
                    </span>
                  </div>

                  <p className={`text-sm truncate mt-0.5 ${conversation.unread_count > 0 ? 'font-medium text-foreground/90' : 'text-muted-foreground'}`}>
                    {conversation.last_message?.content || 'No messages yet'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`${isMobile ? (showChatList ? 'hidden' : 'w-full') : 'flex-1'} flex flex-col bg-card`}>
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-border flex items-center gap-3">
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setShowChatList(true)}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
              <Avatar className="w-10 h-10">
                {selectedConversation.participant?.avatar ? (
                  <AvatarImage src={selectedConversation.participant.avatar} alt="User" />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                  {getInitials(selectedConversation.participant?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold">
                  {selectedConversation.participant?.name || 'Unknown'}
                </h3>
                <p className="text-sm text-muted-foreground">Chat</p>
              </div>
            </div>

            {/* Messages area */}
            <div ref={messagesRef} className="flex-1 p-3 md:p-4 overflow-y-auto space-y-3 bg-muted/10">
            {messagesLoading && messages.length === 0 ? (
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
                messages.map((msg) => {
                  const isSender = msg.is_sender || msg.sender_id === currentUser?.id;
                  return (
                    <div key={msg.id} className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                      {/* Receiver avatar */}
                      {!isSender && (
                        <Avatar className="w-7 h-7 mr-2 mt-1 flex-shrink-0">
                          {selectedConversation.participant?.avatar ? (
                            <AvatarImage src={selectedConversation.participant.avatar} alt="" />
                          ) : null}
                          <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                            {getInitials(selectedConversation.participant?.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className={`max-w-[75%] md:max-w-xs lg:max-w-md px-3 md:px-4 py-2 ${
                        isSender 
                          ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md' 
                          : 'bg-card border border-border text-foreground rounded-2xl rounded-bl-md shadow-sm'
                      }`}>
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mb-2 rounded-lg overflow-hidden">
                              <img src={msg.attachments[0]} alt="attachment" className="w-full h-32 md:h-40 object-cover" />
                            </div>
                        )}
                        {msg.content && <p className="text-sm break-words">{msg.content}</p>}
                        <p className={`text-[10px] mt-1 ${isSender ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {msg.created_at ? new Date(msg.created_at.endsWith('Z') || msg.created_at.includes('+') ? msg.created_at : msg.created_at + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Upload progress indicator */}
            {uploadingImage && (
              <div className="px-4 py-2 border-t border-border flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading image...</span>
              </div>
            )}

            {/* Input area */}
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
                <div className="flex items-center gap-1 md:gap-2 bg-background rounded-full px-3 md:px-4 py-2 flex-1 border border-border shadow-sm">
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted-foreground min-w-0"
                    aria-label="Type a message"
                  />

                  <label className="p-1.5 hover:bg-muted rounded-full cursor-pointer transition-colors shrink-0" title="Attach image">
                    <Image className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
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
                  size="icon"
                  className="rounded-full w-10 h-10 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                  onClick={handleSendMessage}
                  disabled={(!input.trim() && !imagePreview) || sending || uploadingImage}
                  aria-label="Send message"
                >
                  {(sending || uploadingImage) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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