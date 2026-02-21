import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import PrintIcon from '@/assets/icons/print-icon.svg';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { eventsApi } from '@/lib/api/events';

interface InvitationCardProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
}

// Event type theme configurations
const EVENT_THEMES: Record<string, {
  accent: string; accentLight: string; bg: string; gradient: string;
  ornament: string; label: string; font: string;
}> = {
  wedding: {
    accent: '#C9A96E', accentLight: '#F5ECD7', bg: '#FFFDF8',
    gradient: 'linear-gradient(135deg, #C9A96E 0%, #E8D5A3 50%, #C9A96E 100%)',
    ornament: '❦', label: 'You are cordially invited', font: "'Cormorant Garamond', Georgia, serif",
  },
  birthday: {
    accent: '#E85D75', accentLight: '#FDE8EC', bg: '#FFFBFC',
    gradient: 'linear-gradient(135deg, #E85D75 0%, #FF8FA3 50%, #E85D75 100%)',
    ornament: '✦', label: 'You\'re invited to celebrate', font: "'Nunito', sans-serif",
  },
  corporate: {
    accent: '#2563EB', accentLight: '#DBEAFE', bg: '#F8FAFF',
    gradient: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 50%, #1E3A5F 100%)',
    ornament: '◆', label: 'You are invited', font: "'Inter', sans-serif",
  },
  memorial: {
    accent: '#6B7280', accentLight: '#F3F4F6', bg: '#FAFAFA',
    gradient: 'linear-gradient(135deg, #374151 0%, #6B7280 50%, #374151 100%)',
    ornament: '✟', label: 'In loving memory', font: "'Cormorant Garamond', Georgia, serif",
  },
  anniversary: {
    accent: '#D97706', accentLight: '#FEF3C7', bg: '#FFFCF0',
    gradient: 'linear-gradient(135deg, #B45309 0%, #F59E0B 50%, #B45309 100%)',
    ornament: '❧', label: 'Join us in celebrating', font: "'Cormorant Garamond', Georgia, serif",
  },
  conference: {
    accent: '#7C3AED', accentLight: '#EDE9FE', bg: '#FAF5FF',
    gradient: 'linear-gradient(135deg, #5B21B6 0%, #7C3AED 50%, #5B21B6 100%)',
    ornament: '⬥', label: 'You are invited to attend', font: "'Inter', sans-serif",
  },
  graduation: {
    accent: '#059669', accentLight: '#D1FAE5', bg: '#F0FDF4',
    gradient: 'linear-gradient(135deg, #047857 0%, #10B981 50%, #047857 100%)',
    ornament: '🎓', label: 'You are invited to celebrate', font: "'Nunito', sans-serif",
  },
};

const DEFAULT_THEME = EVENT_THEMES.wedding;

const getTheme = (eventType?: string) => {
  if (!eventType) return DEFAULT_THEME;
  const key = eventType.toLowerCase().replace(/\s+/g, '');
  return EVENT_THEMES[key] || DEFAULT_THEME;
};

const InvitationCard = ({ eventId, open, onClose }: InvitationCardProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !eventId) return;
    setLoading(true);
    setError(null);
    eventsApi.getInvitationCard(eventId)
      .then((res) => {
        if (res.success) setData(res.data);
        else setError(res.message || 'Failed to load invitation');
      })
      .catch(() => setError('Failed to load invitation card'))
      .finally(() => setLoading(false));
  }, [open, eventId]);

  const buildQrValue = () => {
    if (data?.guest?.attendee_id)
      return `https://nuru.tz/event/${data.event?.id}/checkin/${data.guest.attendee_id}`;
    if (data?.invitation_code)
      return `https://nuru.tz/event/${data.event?.id}/rsvp/${data.invitation_code}`;
    return `https://nuru.tz/event/${data?.event?.id}`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

  const rsvpLabel = (status: string) => {
    if (status === 'confirmed') return { label: 'CONFIRMED', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' };
    if (status === 'declined') return { label: 'DECLINED', bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' };
    return { label: 'PENDING', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' };
  };

  const getQrDataUrl = useCallback((): string => {
    if (!qrCanvasRef.current) return '';
    const canvas = qrCanvasRef.current.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : '';
  }, []);

  const theme = getTheme(data?.event?.event_type);

  const buildInvitationHtml = useCallback(() => {
    const t = getTheme(data?.event?.event_type);
    const qrImg = getQrDataUrl();
    const rsvp = data?.guest?.rsvp_status ? rsvpLabel(data.guest.rsvp_status) : null;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Event Invitation</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600&family=Nunito:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #F8F7F4; font-family: 'Inter', system-ui, sans-serif; }
  .card { width: 420px; background: ${t.bg}; border-radius: 16px; position: relative; overflow: hidden; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .top-accent { height: 4px; background: ${t.gradient}; }
  .ornament { width: 60px; height: 1px; background: ${t.accentLight}; margin: 0 auto; position: relative; }
  .ornament::before { content: '${t.ornament}'; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 12px; color: ${t.accent}; background: ${t.bg}; padding: 0 8px; }
  .content { padding: 40px 40px 0; }
  .invite-label { font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 5px; color: ${t.accent}; font-weight: 500; margin-bottom: 20px; text-transform: uppercase; opacity: 0.8; }
  .event-title { font-family: ${t.font}; font-size: 32px; font-weight: 700; color: #1A1A1A; line-height: 1.2; margin-bottom: 16px; }
  .event-type { font-size: 10px; letter-spacing: 4px; font-weight: 500; color: ${t.accent}; text-transform: uppercase; margin-bottom: 24px; }
  .details { padding: 0 40px; }
  .detail-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; }
  .detail-icon { font-size: 13px; color: ${t.accent}; }
  .detail-text { font-size: 13px; font-weight: 400; color: #4A4A4A; }
  .detail-text.primary { font-weight: 500; color: #2A2A2A; font-size: 14px; }
  .dress-code { display: inline-block; margin-top: 12px; padding: 6px 20px; border-radius: 100px; font-size: 10px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: ${t.accent}; background: ${t.accentLight}; border: 1px solid ${t.accent}22; }
  .qr-section { margin: 28px auto 0; }
  .qr-wrap { display: inline-block; padding: 12px; background: #FAFAF8; border-radius: 12px; border: 1px solid #F0EDE8; }
  .qr-wrap img { width: 80px; height: 80px; }
  .scan-label { font-size: 8px; color: ${t.accent}; margin-top: 10px; letter-spacing: 3px; text-transform: uppercase; font-weight: 500; opacity: 0.7; }
  .guest-section { margin: 28px 40px 0; padding-top: 24px; border-top: 1px solid ${t.accentLight}; }
  .guest-name { font-family: ${t.font}; font-size: 22px; font-weight: 600; color: #1A1A1A; font-style: italic; }
  .rsvp-pill { display: inline-block; margin-top: 12px; padding: 5px 20px; border-radius: 100px; font-size: 9px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
  .footer { padding: 24px 40px 28px; }
  .hosted-by { font-size: 11px; color: #ABABAB; font-weight: 300; }
  .hosted-name { font-weight: 500; color: #8A8A8A; }
  .inv-code { font-size: 8px; color: #D4D0CA; margin-top: 10px; letter-spacing: 4px; font-family: 'Courier New', monospace; }
  @media print { body { background: white; } .card { box-shadow: none; border-radius: 0; } }
  @page { size: auto; margin: 10mm; }
</style></head><body>
<div class="card">
  <div class="top-accent"></div>
  <div class="content">
    <p class="invite-label">${t.label}</p>
    <h2 class="event-title">${data?.event?.title || 'Event'}</h2>
    ${data?.event?.event_type ? `<p class="event-type">${data.event.event_type}</p>` : ''}
    <div class="ornament"></div>
  </div>
  <div class="details" style="margin-top:24px">
    ${data?.event?.start_date ? `<div class="detail-row"><span class="detail-icon">◈</span><span class="detail-text primary">${formatDate(data.event.start_date)}</span></div>` : ''}
    ${data?.event?.start_time ? `<div class="detail-row"><span class="detail-icon">◈</span><span class="detail-text">${data.event.start_time}</span></div>` : ''}
    ${data?.event?.venue || data?.event?.location ? `<div class="detail-row"><span class="detail-icon">◈</span><span class="detail-text">${data.event.venue || data.event.location}</span></div>` : ''}
    ${data?.event?.dress_code ? `<span class="dress-code">${data.event.dress_code}</span>` : ''}
  </div>
  <div class="qr-section">
    ${qrImg ? `<div class="qr-wrap"><img src="${qrImg}" alt="QR" /></div>` : ''}
    <p class="scan-label">Scan to check in</p>
  </div>
  <div class="guest-section">
    <p class="guest-name">${data?.guest?.name || ''}</p>
    ${rsvp ? `<span class="rsvp-pill" style="color:${rsvp.color};background:${rsvp.bg};border:1px solid ${rsvp.border}">${rsvp.label}</span>` : ''}
  </div>
  <div class="footer">
    ${data?.organizer?.name ? `<p class="hosted-by">Hosted by <span class="hosted-name">${data.organizer.name}</span></p>` : ''}
    ${data?.invitation_code ? `<p class="inv-code">${data.invitation_code}</p>` : ''}
  </div>
</div>
</body></html>`;
  }, [data, getQrDataUrl]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(buildInvitationHtml());
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  const PreviewCard = () => {
    if (!data) return null;
    const t = theme;

    return (
      <div style={{
        width: 420,
        margin: '0 auto',
        fontFamily: "'Inter', system-ui, sans-serif",
        background: t.bg,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
      }}>
        {/* Top gradient accent */}
        <div style={{ height: 4, background: t.gradient }} />

        <div style={{ textAlign: 'center', padding: '40px 40px 0' }}>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10, letterSpacing: 5, color: t.accent,
            fontWeight: 500, marginBottom: 20, textTransform: 'uppercase',
            opacity: 0.8,
          }}>
            {t.label}
          </p>

          <h2 style={{
            fontFamily: t.font,
            fontSize: 32, fontWeight: 700, color: '#1A1A1A',
            lineHeight: 1.2, marginBottom: 16,
          }}>
            {data.event?.title}
          </h2>

          {data.event?.event_type && (
            <p style={{
              fontSize: 10, letterSpacing: 4, fontWeight: 500,
              color: t.accent, textTransform: 'uppercase', marginBottom: 24,
            }}>
              {data.event.event_type}
            </p>
          )}

          {/* Ornamental divider */}
          <div style={{ position: 'relative', margin: '0 auto', width: 60, height: 1, background: t.accentLight }}>
            <span style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              fontSize: 12, color: t.accent, background: t.bg, padding: '0 8px',
            }}>{t.ornament}</span>
          </div>
        </div>

        {/* Details */}
        <div style={{ textAlign: 'center', padding: '24px 40px 0' }}>
          {data.event?.start_date && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: t.accent }}>◈</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#2A2A2A' }}>
                {formatDate(data.event.start_date)}
              </span>
            </div>
          )}
          {data.event?.start_time && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: t.accent }}>◈</span>
              <span style={{ fontSize: 13, color: '#4A4A4A' }}>{data.event.start_time}</span>
            </div>
          )}
          {(data.event?.venue || data.event?.location) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: t.accent }}>◈</span>
              <span style={{ fontSize: 13, color: '#4A4A4A' }}>{data.event.venue || data.event.location}</span>
            </div>
          )}
          {data.event?.dress_code && (
            <span style={{
              display: 'inline-block', marginTop: 12,
              padding: '6px 20px', borderRadius: 100,
              fontSize: 10, fontWeight: 500, letterSpacing: 2,
              textTransform: 'uppercase', color: t.accent,
              background: t.accentLight, border: `1px solid ${t.accent}22`,
            }}>
              {data.event.dress_code}
            </span>
          )}
        </div>

        {/* QR Code */}
        <div style={{ textAlign: 'center', margin: '28px auto 0' }}>
          <div style={{
            display: 'inline-block', padding: 12,
            background: '#FAFAF8', borderRadius: 12,
            border: '1px solid #F0EDE8',
          }}>
            <QRCodeCanvas
              value={buildQrValue()}
              size={80}
              level="H"
              includeMargin={false}
              fgColor="#1A1A1A"
              bgColor="transparent"
            />
          </div>
          <p style={{
            fontSize: 8, color: t.accent, marginTop: 10,
            letterSpacing: 3, textTransform: 'uppercase', fontWeight: 500,
            opacity: 0.7,
          }}>
            Scan to check in
          </p>
        </div>

        {/* Hidden QR for PDF */}
        <div ref={qrCanvasRef} style={{ position: 'absolute', left: -9999, top: -9999 }}>
          <QRCodeCanvas
            value={buildQrValue()}
            size={240}
            level="H"
            includeMargin={false}
            fgColor="#1a1a2e"
            bgColor="#ffffff"
          />
        </div>

        {/* Guest section */}
        <div style={{ textAlign: 'center', margin: '28px 40px 0', paddingTop: 24, borderTop: `1px solid ${t.accentLight}` }}>
          <p style={{
            fontFamily: t.font,
            fontSize: 22, fontWeight: 600, color: '#1A1A1A', fontStyle: 'italic',
          }}>
            {data.guest?.name}
          </p>

          {data.guest?.rsvp_status && (() => {
            const r = rsvpLabel(data.guest.rsvp_status);
            return (
              <span style={{
                display: 'inline-block', marginTop: 12,
                padding: '5px 20px', borderRadius: 100,
                fontSize: 9, fontWeight: 600, letterSpacing: 2,
                textTransform: 'uppercase',
                color: r.color, background: r.bg, border: `1px solid ${r.border}`,
              }}>
                {r.label}
              </span>
            );
          })()}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 40px 28px' }}>
          {data.organizer?.name && (
            <p style={{ fontSize: 11, color: '#ABABAB', fontWeight: 300 }}>
              Hosted by{' '}
              <span style={{ fontWeight: 500, color: '#8A8A8A' }}>
                {data.organizer.name}
              </span>
            </p>
          )}
          {data.invitation_code && (
            <p style={{
              fontSize: 8, color: '#D4D0CA', marginTop: 10,
              letterSpacing: 4, fontFamily: "'Courier New', monospace",
            }}>
              {data.invitation_code}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-none">
        {loading ? (
          <div className="flex items-center justify-center py-16 bg-card rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-card rounded-2xl px-6">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={onClose} className="mt-4">Close</Button>
          </div>
        ) : data ? (
          <div className="bg-card rounded-2xl overflow-hidden shadow-2xl">
            <PreviewCard />
            <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
              <Button size="sm" onClick={handlePrint} className="gap-2">
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                <img src={PrintIcon} alt="Print" className="w-4 h-4 dark:invert" />
                Print
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default InvitationCard;
