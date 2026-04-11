import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  ChevronLeft, Loader2, Mic, MicOff, Camera, CameraOff, Monitor, MonitorOff,
  Users, MessageSquare, PhoneOff, Send, X, Hand, Smile, ShieldCheck, Volume2,
  Check, XCircle, Crown, UserPlus,
} from 'lucide-react';
import SvgIcon from '@/components/ui/svg-icon';
import videoChatIcon from '@/assets/video-chat-icon.svg';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { meetingsApi, type JoinRequest } from '@/lib/api/meetings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
  useLocalParticipant,
  useChat,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import '@livekit/components-styles';

// ── Data channel message types ──
interface DataMessage {
  type: 'reaction' | 'hand_raise' | 'hand_lower';
  payload?: string;
  sender?: string;
}

// ── Reaction overlay ──
interface FloatingReaction {
  id: string;
  emoji: string;
  sender: string;
  x: number; // random horizontal position
}

const REACTION_EMOJIS = ['👍', '👏', '❤️', '😂', '🎉', '🔥', '💯', '🙌'];

// ── Waiting Room Component ──
const WaitingRoom = ({ onAdmitted, onRejected, meetingTitle }: {
  onAdmitted: () => void;
  onRejected: () => void;
  meetingTitle: string;
}) => {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      <div className="text-center space-y-5 max-w-sm px-6">
        <div className="w-20 h-20 rounded-3xl bg-primary/15 flex items-center justify-center mx-auto">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
        <h2 className="text-white text-xl font-bold">Waiting to be admitted</h2>
        <p className="text-white/50 text-sm">
          You've requested to join <span className="text-white/80 font-medium">"{meetingTitle}"</span>.
          The host will let you in shortly.
        </p>
        <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Waiting for host approval...
        </div>
      </div>
    </div>
  );
};

// ── Join Request Notification (for hosts) ──
const JoinRequestPanel = ({ requests, onApprove, onReject }: {
  requests: JoinRequest[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) => {
  if (requests.length === 0) return null;

  return (
    <div className="absolute top-14 right-3 w-72 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="px-3 py-2 bg-amber-500/10 border-b border-white/10 flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-amber-400" />
        <span className="text-amber-300 text-xs font-semibold">{requests.length} waiting to join</span>
      </div>
      <ScrollArea className="max-h-48">
        {requests.map((req) => (
          <div key={req.id} className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
            <Avatar className="w-8 h-8">
              <AvatarImage src={req.avatar_url || ''} />
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                {req.name[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-white text-sm flex-1 truncate">{req.name}</span>
            <button onClick={() => onApprove(req.id)} className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center hover:bg-green-500/30 transition-colors">
              <Check className="w-3.5 h-3.5 text-green-400" />
            </button>
            <button onClick={() => onReject(req.id)} className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center hover:bg-red-500/30 transition-colors">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
};

// ── Google Meet-style Animated Reactions Overlay ──
const ReactionsOverlay = ({ reactions }: { reactions: FloatingReaction[] }) => (
  <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
    {reactions.map((r) => (
      <div
        key={r.id}
        className="absolute animate-[floatUp_3s_ease-out_forwards]"
        style={{
          left: `${r.x}%`,
          bottom: '80px',
        }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
          <span className="text-[10px] text-white/60 font-medium bg-black/40 px-1.5 py-0.5 rounded-full whitespace-nowrap">{r.sender}</span>
        </div>
      </div>
    ))}
  </div>
);

// ── Reaction Picker ──
const ReactionPicker = ({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) => (
  <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-[#1e1e1e] border border-white/15 rounded-full px-4 py-2.5 flex gap-1 z-50 shadow-2xl backdrop-blur-sm">
    {REACTION_EMOJIS.map((e) => (
      <button key={e} onClick={() => { onSelect(e); onClose(); }} className="text-2xl hover:scale-150 active:scale-90 transition-transform duration-200 p-1.5 rounded-full hover:bg-white/10">
        {e}
      </button>
    ))}
  </div>
);

// ── Speaking Indicator ──
const SpeakingIndicator = ({ isSpeaking }: { isSpeaking: boolean }) => {
  if (!isSpeaking) return null;
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-500/30">
      <Volume2 className="w-3 h-3 text-green-400" />
      <div className="flex gap-0.5">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-0.5 bg-green-400 rounded-full animate-pulse" style={{
            height: `${6 + Math.random() * 8}px`,
            animationDelay: `${i * 100}ms`,
          }} />
        ))}
      </div>
    </div>
  );
};

// ── Hand Raise Badge ──
const HandRaiseBadge = ({ isRaised }: { isRaised: boolean }) => {
  if (!isRaised) return null;
  return (
    <div className="absolute top-2 left-2 w-7 h-7 rounded-lg bg-amber-500/30 flex items-center justify-center animate-bounce">
      <span className="text-sm">✋</span>
    </div>
  );
};

// ── Custom Meeting UI ──
const MeetingUI = ({ onLeave, isHost, eventId, meetingId }: {
  onLeave: () => void;
  isHost: boolean;
  eventId: string;
  meetingId: string;
}) => {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { chatMessages, send: sendChat } = useChat();

  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const isMicEnabled = localParticipant?.isMicrophoneEnabled ?? false;
  const isCamEnabled = localParticipant?.isCameraEnabled ?? false;
  const isScreenSharing = localParticipant?.isScreenShareEnabled ?? false;

  // Poll for join requests (host only)
  useEffect(() => {
    if (!isHost) return;
    const poll = async () => {
      try {
        const res = await meetingsApi.listJoinRequests(eventId, meetingId);
        if (res.success && res.data) {
          setJoinRequests(res.data as JoinRequest[]);
        }
      } catch { /* ignore */ }
    };
    poll();
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [isHost, eventId, meetingId]);

  // Listen for data messages (reactions, hand raises)
  useEffect(() => {
    if (!room) return;
    const handleData = (payload: Uint8Array, participant: any) => {
      try {
        const msg: DataMessage = JSON.parse(new TextDecoder().decode(payload));
        const senderName = participant?.name || participant?.identity || 'Unknown';
        
        if (msg.type === 'reaction') {
          const id = `${Date.now()}-${Math.random()}`;
          const x = 10 + Math.random() * 80; // random horizontal position
          setFloatingReactions(prev => [...prev.slice(-8), { id, emoji: msg.payload || '👍', sender: senderName, x }]);
          setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 3000);
        } else if (msg.type === 'hand_raise') {
          setRaisedHands(prev => new Set(prev).add(participant?.identity || ''));
        } else if (msg.type === 'hand_lower') {
          setRaisedHands(prev => {
            const next = new Set(prev);
            next.delete(participant?.identity || '');
            return next;
          });
        }
      } catch { /* not our message format */ }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room]);

  const sendDataMessage = useCallback((msg: DataMessage) => {
    if (!localParticipant) return;
    const data = new TextEncoder().encode(JSON.stringify(msg));
    localParticipant.publishData(data, { reliable: true });
  }, [localParticipant]);

  const toggleMic = useCallback(async () => {
    await localParticipant?.setMicrophoneEnabled(!isMicEnabled);
  }, [localParticipant, isMicEnabled]);

  const toggleCam = useCallback(async () => {
    await localParticipant?.setCameraEnabled(!isCamEnabled);
  }, [localParticipant, isCamEnabled]);

  const toggleScreenShare = useCallback(async () => {
    try {
      await localParticipant?.setScreenShareEnabled(!isScreenSharing);
    } catch (err) {
      console.error('Screen share error:', err);
      toast.error('Screen sharing failed. Please check browser permissions.');
    }
  }, [localParticipant, isScreenSharing]);

  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  }, [chatInput, sendChat]);

  const handleReaction = useCallback((emoji: string) => {
    sendDataMessage({ type: 'reaction', payload: emoji });
    // Show locally too
    const id = `${Date.now()}-local`;
    const x = 10 + Math.random() * 80;
    setFloatingReactions(prev => [...prev.slice(-8), { id, emoji, sender: 'You', x }]);
    setTimeout(() => setFloatingReactions(prev => prev.filter(r => r.id !== id)), 3000);
  }, [sendDataMessage]);

  const toggleHandRaise = useCallback(() => {
    const newState = !handRaised;
    setHandRaised(newState);
    sendDataMessage({ type: newState ? 'hand_raise' : 'hand_lower' });
    if (newState) {
      setRaisedHands(prev => new Set(prev).add(localParticipant?.identity || ''));
    } else {
      setRaisedHands(prev => {
        const next = new Set(prev);
        next.delete(localParticipant?.identity || '');
        return next;
      });
    }
  }, [handRaised, sendDataMessage, localParticipant]);

  const handleApproveRequest = useCallback(async (requestId: string) => {
    try {
      await meetingsApi.reviewJoinRequest(eventId, meetingId, requestId, 'approve');
      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      toast.success('Participant admitted');
    } catch { toast.error('Failed to admit'); }
  }, [eventId, meetingId]);

  const handleRejectRequest = useCallback(async (requestId: string) => {
    try {
      await meetingsApi.reviewJoinRequest(eventId, meetingId, requestId, 'reject');
      setJoinRequests(prev => prev.filter(r => r.id !== requestId));
    } catch { toast.error('Failed to decline'); }
  }, [eventId, meetingId]);

  // Get participant metadata (avatar URL from LiveKit metadata)
  const getParticipantAvatar = (participant: any) => {
    try {
      if (participant.metadata) {
        const meta = JSON.parse(participant.metadata);
        return meta.avatar_url || '';
      }
    } catch { /* ignore */ }
    return '';
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] relative">
      {/* CSS for floating reaction animation */}
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          30% { opacity: 1; transform: translateY(-60px) scale(1.2); }
          100% { opacity: 0; transform: translateY(-200px) scale(0.8); }
        }
      `}</style>

      {/* Floating reactions */}
      <ReactionsOverlay reactions={floatingReactions} />

      {/* Join request notifications for hosts */}
      {isHost && <JoinRequestPanel requests={joinRequests} onApprove={handleApproveRequest} onReject={handleRejectRequest} />}

      {/* Reaction picker */}
      {showReactions && <ReactionPicker onSelect={handleReaction} onClose={() => setShowReactions(false)} />}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <SvgIcon src={videoChatIcon} className="w-4 h-4" />
          </div>
          <span className="text-white font-semibold text-sm">Nuru Meeting</span>
          {isHost && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center gap-1">
              <Crown className="w-3 h-3" /> Host
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {joinRequests.length > 0 && isHost && (
            <div className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold animate-pulse">
              {joinRequests.length} waiting
            </div>
          )}
          <div className="px-2.5 py-1 rounded-lg bg-white/8 text-white/70 text-xs font-semibold flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {participants.length}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Video grid */}
        <div className="flex-1 p-2">
          <div className={`h-full grid gap-2 ${
            tracks.length <= 1 ? 'grid-cols-1' :
            tracks.length <= 4 ? 'grid-cols-2' :
            tracks.length <= 9 ? 'grid-cols-3' :
            'grid-cols-4'
          }`}>
            {tracks.map((trackRef) => {
              const participant = trackRef.participant;
              const isLocal = participant.identity === localParticipant?.identity;
              const isMuted = !participant.isMicrophoneEnabled;
              const isSpeaking = participant.isSpeaking;
              const isHandRaised = raisedHands.has(participant.identity);
              const displayName = participant.name || (isLocal ? 'You' : 'Participant');
              const avatarUrl = getParticipantAvatar(participant);

              // Camera is actually publishing a video track
              const hasActiveVideo = trackRef.publication?.track && !trackRef.publication.isMuted;

              return (
                <div
                  key={`${participant.identity}-${trackRef.source}`}
                  className={`relative bg-[#1a1a1a] rounded-xl overflow-hidden flex items-center justify-center ${
                    isSpeaking ? 'ring-2 ring-green-500/60' : ''
                  }`}
                >
                  {hasActiveVideo ? (
                    <VideoTrack
                      trackRef={trackRef as any}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Avatar className="w-20 h-20 border-2 border-white/10">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="bg-primary/15 text-primary text-2xl font-bold">
                          {displayName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-white/50 text-sm">{displayName}</span>
                    </div>
                  )}

                  {/* Speaking indicator */}
                  <SpeakingIndicator isSpeaking={isSpeaking} />

                  {/* Hand raise badge */}
                  <HandRaiseBadge isRaised={isHandRaised} />

                  {/* Name overlay */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 flex items-center gap-1.5">
                    {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                    <span className="text-white text-[11px] font-medium">
                      {isLocal ? 'You' : displayName}
                    </span>
                  </div>

                  {/* Host controls on participant tile */}
                  {isHost && !isLocal && (
                    <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
                      <button
                        className="w-6 h-6 rounded bg-black/60 flex items-center justify-center hover:bg-red-500/50"
                        title="Mute participant"
                      >
                        <MicOff className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Participants sidebar */}
        {showParticipants && (
          <div className="w-72 bg-[#111] border-l border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white font-semibold text-sm">Participants ({participants.length})</span>
              <button onClick={() => setShowParticipants(false)} className="text-white/50 hover:text-white/80">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ScrollArea className="flex-1">
              {participants.map((p) => {
                const isLocal = p.identity === localParticipant?.identity;
                const isMuted = !p.isMicrophoneEnabled;
                const isHandUp = raisedHands.has(p.identity);
                const displayName = p.name || (isLocal ? 'You' : 'Participant');
                const avatarUrl = getParticipantAvatar(p);
                return (
                  <div key={p.identity} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                        {displayName[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-white text-sm flex-1 truncate">
                      {displayName}{isLocal ? ' (You)' : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isHandUp && <span className="text-sm">✋</span>}
                      {p.isSpeaking && <Volume2 className="w-3 h-3 text-green-400" />}
                      {isMuted ? (
                        <MicOff className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 text-green-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        )}

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-72 bg-[#111] border-l border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-white font-semibold text-sm">Chat</span>
              <button onClick={() => setShowChat(false)} className="text-white/50 hover:text-white/80">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ScrollArea className="flex-1 px-3 py-2">
              {chatMessages.length === 0 ? (
                <p className="text-white/30 text-xs text-center mt-8">No messages yet</p>
              ) : (
                chatMessages.map((msg, i) => {
                  const isMe = msg.from?.identity === localParticipant?.identity;
                  return (
                    <div key={i} className="mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-semibold ${isMe ? 'text-primary' : 'text-white/70'}`}>
                          {isMe ? 'You' : (msg.from?.name || 'Unknown')}
                        </span>
                        <span className="text-white/20 text-[10px]">
                          {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-white text-[13px] mt-0.5">{msg.message}</p>
                    </div>
                  );
                })
              )}
            </ScrollArea>
            <div className="p-2 border-t border-white/10 flex gap-1.5">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Type a message..."
                className="bg-white/6 border-none text-white text-sm placeholder:text-white/30 h-9"
              />
              <Button size="icon" onClick={handleSendChat} className="h-9 w-9 shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-[#111] border-t border-white/10 flex-wrap">
        <ControlBtn icon={isMicEnabled ? Mic : MicOff} label={isMicEnabled ? 'Mute' : 'Unmute'} active={isMicEnabled} onClick={toggleMic} />
        <ControlBtn icon={isCamEnabled ? Camera : CameraOff} label="Camera" active={isCamEnabled} onClick={toggleCam} />
        <ControlBtn icon={isScreenSharing ? MonitorOff : Monitor} label="Share" active={isScreenSharing} onClick={toggleScreenShare} />
        <ControlBtn
          icon={Hand}
          label="Hand"
          active={handRaised}
          onClick={toggleHandRaise}
          highlight={handRaised}
        />
        <ControlBtn
          icon={Smile}
          label="React"
          active={showReactions}
          onClick={() => setShowReactions(!showReactions)}
        />
        <ControlBtn
          icon={Users}
          label="People"
          active={showParticipants}
          onClick={() => { setShowParticipants(!showParticipants); if (!showParticipants) setShowChat(false); }}
        />
        <ControlBtn
          icon={MessageSquare}
          label="Chat"
          active={showChat}
          onClick={() => { setShowChat(!showChat); if (!showChat) setShowParticipants(false); }}
          badge={chatMessages.length > 0 ? chatMessages.length : undefined}
        />
        <button onClick={onLeave} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center hover:bg-red-500/25 transition-colors">
            <PhoneOff className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-red-500 text-[10px] font-medium">Leave</span>
        </button>
      </div>

      <RoomAudioRenderer />
    </div>
  );
};

// ── Control button ──
const ControlBtn = ({
  icon: Icon, label, active, onClick, badge, highlight,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  highlight?: boolean;
}) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 relative">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
      highlight ? 'bg-amber-500/20 hover:bg-amber-500/30' :
      active ? 'bg-white/8 hover:bg-white/12' : 'bg-white/4 hover:bg-white/8'
    }`}>
      <Icon className={`w-5 h-5 ${
        highlight ? 'text-amber-400' :
        active ? 'text-white/70' : 'text-white/40'
      }`} />
    </div>
    <span className={`text-[10px] font-medium ${
      highlight ? 'text-amber-400' :
      active ? 'text-white/70' : 'text-white/40'
    }`}>{label}</span>
    {badge !== undefined && badge > 0 && (
      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] text-white font-bold flex items-center justify-center">
        {badge > 9 ? '9+' : badge}
      </div>
    )}
  </button>
);

// ── Main page component ──
const MeetingRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: currentUser, userIsLoggedIn, isLoading: authLoading } = useCurrentUser();

  const [eventId, setEventId] = useState(searchParams.get('eventId') || '');
  const [meetingId, setMeetingId] = useState(searchParams.get('meetingId') || '');
  const [meetingTitle, setMeetingTitle] = useState('');

  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinStatus, setJoinStatus] = useState<string>('');
  const waitingPollRef = useRef<ReturnType<typeof setInterval>>();

  // Auth gate
  useEffect(() => {
    if (authLoading) return;
    if (!userIsLoggedIn) {
      const returnUrl = `/meet/${roomId}`;
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, { replace: true });
    }
  }, [authLoading, userIsLoggedIn, roomId, navigate]);

  // Main init
  useEffect(() => {
    if (!roomId || !userIsLoggedIn || authLoading) return;

    const init = async () => {
      try {
        let eid = eventId;
        let mid = meetingId;

        if (!eid || !mid) {
          const roomRes = await meetingsApi.getByRoom(roomId);
          if (roomRes.success && roomRes.data) {
            const roomData = roomRes.data as any;
            eid = roomData.event?.id || '';
            mid = roomData.id || '';
            setMeetingTitle(roomData.title || '');
            if (eid && mid) {
              setEventId(eid);
              setMeetingId(mid);
            }
          }
        }

        if (!eid || !mid) {
          setError('Could not find meeting details. The meeting may have ended or been removed.');
          setLoading(false);
          return;
        }

        const joinRes = await meetingsApi.join(eid, mid);
        const joinData = joinRes.data as any;
        const status = joinData?.status;

        if (status === 'joined' || status === 'already_joined') {
          await fetchToken(eid, mid);
        } else if (status === 'waiting') {
          setJoinStatus('waiting');
          setLoading(false);
          startWaitingPoll(eid, mid);
        } else if (status === 'rejected') {
          setError('Your request to join was declined by the host.');
          setLoading(false);
        } else {
          setError(joinRes.message || 'Unable to join meeting.');
          setLoading(false);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to connect to meeting.');
        setLoading(false);
      }
    };

    init();
    return () => clearInterval(waitingPollRef.current);
  }, [roomId, userIsLoggedIn, authLoading]);

  const fetchToken = async (eid: string, mid: string) => {
    try {
      const res = await meetingsApi.getToken(eid, mid);
      if (res.success && res.data) {
        const data = res.data as any;
        setToken(data.token);
        setLivekitUrl(data.url);
        setIsHost(data.is_host || false);
        setJoinStatus('joined');
      } else {
        setError('Failed to get meeting access token.');
      }
    } catch {
      setError('Failed to get meeting access token.');
    } finally {
      setLoading(false);
    }
  };

  const startWaitingPoll = (eid: string, mid: string) => {
    waitingPollRef.current = setInterval(async () => {
      try {
        const res = await meetingsApi.checkJoinStatus(eid, mid);
        const status = (res.data as any)?.status;
        if (status === 'approved') {
          clearInterval(waitingPollRef.current);
          setJoinStatus('approved');
          setLoading(true);
          await fetchToken(eid, mid);
        } else if (status === 'rejected') {
          clearInterval(waitingPollRef.current);
          setJoinStatus('rejected');
          setError('Your request to join was declined by the host.');
        }
      } catch { /* keep polling */ }
    }, 3000);
  };

  const handleLeave = useCallback(async () => {
    if (eventId && meetingId) {
      try { await meetingsApi.leave(eventId, meetingId); } catch { /* ignore */ }
    }
    navigate(-1);
  }, [navigate, eventId, meetingId]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <SvgIcon src={videoChatIcon} className="w-8 h-8" />
          </div>
          <p className="text-muted-foreground font-medium">{t('invalid_meeting_link')}</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="rounded-xl">
            <ChevronLeft className="w-4 h-4 mr-1" /> {t('back')}
          </Button>
        </div>
      </div>
    );
  }

  if (joinStatus === 'waiting') {
    return (
      <WaitingRoom
        meetingTitle={meetingTitle || 'Meeting'}
        onAdmitted={() => {}}
        onRejected={() => setError('Your request was declined.')}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-white/70 text-sm font-medium">Connecting to meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !token || !livekitUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3 max-w-md px-4">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <SvgIcon src={videoChatIcon} className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-lg">Unable to join meeting</h3>
          <p className="text-muted-foreground text-sm">{error || 'Connection failed.'}</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="rounded-xl">
            <ChevronLeft className="w-4 h-4 mr-1" /> {t('back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <LiveKitRoom
        serverUrl={livekitUrl}
        token={token}
        connect={true}
        audio={true}
        video={true}
        onDisconnected={handleLeave}
        onError={(err) => {
          console.error('LiveKit error:', err);
          toast.error('Meeting connection error');
        }}
        style={{ height: '100%' }}
      >
        <MeetingUI onLeave={handleLeave} isHost={isHost} eventId={eventId} meetingId={meetingId} />
      </LiveKitRoom>
    </div>
  );
};

export default MeetingRoom;
