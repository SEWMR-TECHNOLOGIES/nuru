import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, Loader2, Mic, MicOff, Camera, CameraOff, Monitor, MonitorOff, Users, MessageSquare, PhoneOff, Send, X } from 'lucide-react';
import SvgIcon from '@/components/ui/svg-icon';
import videoChatIcon from '@/assets/video-chat-icon.svg';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { meetingsApi } from '@/lib/api/meetings';
import { toast } from 'sonner';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
  useLocalParticipant,
  useChat,
  useTracks,
  VideoTrack,
  TrackToggle,
  DisconnectButton,
  ChatEntry,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import '@livekit/components-styles';

// ── Chat message type ──
interface ChatMessage {
  sender: string;
  text: string;
  time: Date;
  isMe: boolean;
}

// ── Custom Meeting UI (rendered inside LiveKitRoom) ──
const MeetingUI = ({ onLeave }: { onLeave: () => void }) => {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const { chatMessages, send: sendChat } = useChat();

  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');

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

  const toggleMic = useCallback(async () => {
    await localParticipant?.setMicrophoneEnabled(!isMicEnabled);
  }, [localParticipant, isMicEnabled]);

  const toggleCam = useCallback(async () => {
    await localParticipant?.setCameraEnabled(!isCamEnabled);
  }, [localParticipant, isCamEnabled]);

  const toggleScreenShare = useCallback(async () => {
    await localParticipant?.setScreenShareEnabled(!isScreenSharing);
  }, [localParticipant, isScreenSharing]);

  const handleSendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  }, [chatInput, sendChat]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <SvgIcon src={videoChatIcon} className="w-4 h-4" />
          </div>
          <span className="text-white font-semibold text-sm">Nuru Meeting</span>
        </div>
        <div className="flex items-center gap-2">
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

              return (
                <div
                  key={`${participant.identity}-${trackRef.source}`}
                  className="relative bg-[#1a1a1a] rounded-xl overflow-hidden flex items-center justify-center"
                >
                  {trackRef.publication?.track ? (
                    <VideoTrack
                      trackRef={trackRef as any}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
                        <Users className="w-8 h-8 text-primary" />
                      </div>
                      <span className="text-white/50 text-sm">{participant.name || 'Participant'}</span>
                    </div>
                  )}
                  {/* Name overlay */}
                  <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 flex items-center gap-1.5">
                    {isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                    <span className="text-white text-[11px] font-medium">
                      {isLocal ? 'You' : (participant.name || 'Participant')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Participants sidebar */}
        {showParticipants && (
          <div className="w-64 bg-[#111] border-l border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
              <span className="text-white font-semibold text-sm">Participants ({participants.length})</span>
              <button onClick={() => setShowParticipants(false)} className="text-white/50 hover:text-white/80">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ScrollArea className="flex-1">
              {participants.map((p) => {
                const isLocal = p.identity === localParticipant?.identity;
                const isMuted = !p.isMicrophoneEnabled;
                return (
                  <div key={p.identity} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/5">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-semibold">
                      {(p.name || '?')[0].toUpperCase()}
                    </div>
                    <span className="text-white text-sm flex-1 truncate">
                      {p.name || 'Participant'}{isLocal ? ' (You)' : ''}
                    </span>
                    {isMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-green-400" />
                    )}
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        )}

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-72 bg-[#111] border-l border-white/10 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
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
      <div className="flex items-center justify-center gap-3 px-6 py-3 bg-[#111] border-t border-white/10">
        <ControlBtn
          icon={isMicEnabled ? Mic : MicOff}
          label={isMicEnabled ? 'Mute' : 'Unmute'}
          active={isMicEnabled}
          onClick={toggleMic}
        />
        <ControlBtn
          icon={isCamEnabled ? Camera : CameraOff}
          label="Camera"
          active={isCamEnabled}
          onClick={toggleCam}
        />
        <ControlBtn
          icon={isScreenSharing ? MonitorOff : Monitor}
          label="Share"
          active={isScreenSharing}
          onClick={toggleScreenShare}
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
        <button
          onClick={onLeave}
          className="flex flex-col items-center gap-1"
        >
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

// ── Control button component ──
const ControlBtn = ({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 relative">
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
      active ? 'bg-white/8 hover:bg-white/12' : 'bg-white/4 hover:bg-white/8'
    }`}>
      <Icon className={`w-5 h-5 ${active ? 'text-white/70' : 'text-white/40'}`} />
    </div>
    <span className={`text-[10px] font-medium ${active ? 'text-white/70' : 'text-white/40'}`}>{label}</span>
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

  const eventId = searchParams.get('eventId') || '';
  const meetingId = searchParams.get('meetingId') || '';

  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !meetingId) {
      setError('Missing event or meeting information.');
      setLoading(false);
      return;
    }

    const fetchToken = async () => {
      try {
        const res = await meetingsApi.getToken(eventId, meetingId);
        if (res.success && res.data) {
          const data = res.data as { token: string; url: string };
          setToken(data.token);
          setLivekitUrl(data.url);
        } else {
          setError('Failed to get meeting access token.');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to connect to meeting.');
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [eventId, meetingId]);

  const handleLeave = useCallback(() => {
    navigate(-1);
  }, [navigate]);

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
        <MeetingUI onLeave={handleLeave} />
      </LiveKitRoom>
    </div>
  );
};

export default MeetingRoom;
