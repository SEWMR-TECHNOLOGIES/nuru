import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ExternalLink, Video } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const JITSI_CONFIG = [
  'config.prejoinConfig.enabled=false',
  'config.prejoinPageEnabled=false',
  'config.startWithAudioMuted=false',
  'config.startWithVideoMuted=false',
  'config.disableDeepLinking=true',
  'config.hideConferenceSubject=false',
  'config.hideConferenceTimer=false',
  'config.lobby.enabled=false',
  'interfaceConfig.SHOW_JITSI_WATERMARK=false',
  'interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false',
  'interfaceConfig.SHOW_BRAND_WATERMARK=false',
  'interfaceConfig.SHOW_POWERED_BY=false',
  'interfaceConfig.SHOW_PROMOTIONAL_CLOSE_PAGE=false',
  'interfaceConfig.HIDE_INVITE_MORE_HEADER=true',
  'interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=false',
  'interfaceConfig.DEFAULT_BACKGROUND="#111827"',
  'interfaceConfig.DEFAULT_REMOTE_DISPLAY_NAME="Participant"',
  'interfaceConfig.DEFAULT_LOCAL_DISPLAY_NAME="You"',
  'interfaceConfig.APP_NAME="Nuru Meetings"',
  'interfaceConfig.PROVIDER_NAME="Nuru"',
  'interfaceConfig.JITSI_WATERMARK_LINK=""',
  'interfaceConfig.BRAND_WATERMARK_LINK=""',
  'interfaceConfig.NATIVE_APP_NAME="Nuru"',
].join('&');

const MeetingRoom = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (!roomId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <Video className="w-8 h-8 text-destructive" />
          </div>
          <p className="text-muted-foreground font-medium">{t('invalid_meeting_link')}</p>
          <Button variant="outline" onClick={() => navigate(-1)} className="rounded-xl">
            <ChevronLeft className="w-4 h-4 mr-1" /> {t('back')}
          </Button>
        </div>
      </div>
    );
  }

  const jitsiUrl = `https://meet.jit.si/${roomId}#${JITSI_CONFIG}`;

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-white/10">
        <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl gap-1.5" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-4 h-4" /> {t('back')}
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
            <Video className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">{t('nuru_meeting')}</span>
        </div>
        <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl" onClick={() => window.open(jitsiUrl, '_blank')}>
          <ExternalLink className="w-4 h-4" />
        </Button>
      </div>
      <iframe
        src={jitsiUrl}
        allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
        className="flex-1 w-full border-0"
        title={t('nuru_meeting')}
      />
    </div>
  );
};

export default MeetingRoom;