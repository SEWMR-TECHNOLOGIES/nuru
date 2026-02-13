import { useState, useEffect, useRef, useCallback } from 'react';
import { Printer, Download, Loader2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { eventsApi } from '@/lib/api/events';

interface InvitationCardProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
}

const InvitationCard = ({ eventId, open, onClose }: InvitationCardProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting] = useState(false);
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
    if (status === 'confirmed') return { label: 'CONFIRMED', color: '#34d399', border: '#059669' };
    if (status === 'declined') return { label: 'DECLINED', color: '#f87171', border: '#dc2626' };
    return { label: 'PENDING', color: '#fbbf24', border: '#d97706' };
  };

  const accentGold = '#D4A574';
  const accentLight = '#E8C9A0';

  const getQrDataUrl = useCallback((): string => {
    if (!qrCanvasRef.current) return '';
    const canvas = qrCanvasRef.current.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : '';
  }, []);

  const buildInvitationHtml = useCallback(() => {
    const qrImg = getQrDataUrl();
    const rsvp = data?.guest?.rsvp_status ? rsvpLabel(data.guest.rsvp_status) : null;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Event Invitation</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f3ef; font-family: 'Segoe UI', system-ui, sans-serif; }
  .card { width: 420px; background: linear-gradient(180deg, #0B0F1A 0%, #111827 50%, #0B0F1A 100%); border-radius: 12px; position: relative; overflow: hidden; text-align: center; }
  .top-line, .bottom-line { height: 2px; margin: 0 15%; background: ${accentGold}; }
  .content { padding: 44px 36px 0; position: relative; }
  .invite-label { font-size: 9px; letter-spacing: 6px; color: ${accentGold}90; font-weight: 400; margin-bottom: 26px; text-transform: uppercase; }
  .event-title { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; color: #F9FAFB; line-height: 1.3; margin-bottom: 8px; }
  .divider { width: 40px; height: 1.5px; background: ${accentGold}; margin: 16px auto; }
  .event-type { font-size: 10px; letter-spacing: 3px; font-weight: 500; color: ${accentLight}; text-transform: uppercase; margin-top: 8px; }
  .details { padding: 28px 36px 0; }
  .detail-date { font-size: 14px; font-weight: 500; color: #D1D5DB; margin-bottom: 6px; }
  .detail-sub { font-size: 13px; color: #9CA3AF; margin-bottom: 6px; }
  .detail-dress { font-size: 11px; color: #6B7280; margin-top: 8px; }
  .qr-section { margin: 28px auto 0; }
  .qr-border { display: inline-block; padding: 8px; border: 1px solid ${accentGold}20; border-radius: 8px; }
  .qr-border img { width: 80px; height: 80px; }
  .scan-label { font-size: 7px; color: rgba(255,255,255,0.25); margin-top: 10px; letter-spacing: 4px; text-transform: uppercase; }
  .guest-section { margin: 26px 36px 0; }
  .guest-line { width: 50px; height: 1px; background: ${accentGold}28; margin: 0 auto 14px; }
  .guest-name { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; font-weight: 600; color: #F9FAFB; }
  .rsvp-pill { display: inline-block; margin-top: 12px; padding: 4px 18px; border-radius: 20px; font-size: 8px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; background: transparent; }
  .footer { padding: 24px 36px 28px; }
  .hosted-by { font-size: 10px; color: rgba(255,255,255,0.3); }
  .hosted-name { font-weight: 500; color: rgba(255,255,255,0.5); }
  .inv-code { font-size: 7px; color: rgba(255,255,255,0.12); margin-top: 10px; letter-spacing: 4px; font-family: 'Courier New', monospace; }
  @media print { body { background: white; } .card { border-radius: 0; } }
  @page { size: auto; margin: 10mm; }
</style></head><body>
<div class="card">
  <div class="top-line"></div>
  <div class="content">
    <p class="invite-label">You are invited to</p>
    <h2 class="event-title">${data?.event?.title || 'Event'}</h2>
    <div class="divider"></div>
    ${data?.event?.event_type ? `<p class="event-type">${data.event.event_type}</p>` : ''}
  </div>
  <div class="details">
    ${data?.event?.start_date ? `<p class="detail-date">${formatDate(data.event.start_date)}</p>` : ''}
    ${data?.event?.start_time ? `<p class="detail-sub">${data.event.start_time}</p>` : ''}
    ${data?.event?.venue || data?.event?.location ? `<p class="detail-sub">${data.event.venue || data.event.location}</p>` : ''}
    ${data?.event?.dress_code ? `<p class="detail-dress">Dress Code: ${data.event.dress_code}</p>` : ''}
  </div>
  <div class="qr-section">
    ${qrImg ? `<div class="qr-border"><img src="${qrImg}" alt="QR Code" /></div>` : ''}
    <p class="scan-label">Scan to check in</p>
  </div>
  <div class="guest-section">
    <div class="guest-line"></div>
    <p class="guest-name">${data?.guest?.name || ''}</p>
    ${rsvp ? `<span class="rsvp-pill" style="color:${rsvp.color};border:1.5px solid ${rsvp.border}">${rsvp.label}</span>` : ''}
  </div>
  <div class="footer">
    ${data?.organizer?.name ? `<p class="hosted-by">Hosted by <span class="hosted-name">${data.organizer.name}</span></p>` : ''}
    ${data?.invitation_code ? `<p class="inv-code">${data.invitation_code}</p>` : ''}
  </div>
  <div class="bottom-line"></div>
</div>
</body></html>`;
  }, [data, getQrDataUrl]);

  const handleDownloadPdf = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(buildInvitationHtml());
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  };

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

    return (
      <div style={{
        width: 420,
        margin: '0 auto',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: 'linear-gradient(180deg, #0B0F1A 0%, #111827 50%, #0B0F1A 100%)',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
      }}>
        {/* Subtle radial glow */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 400, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,165,116,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Top accent line */}
        <div style={{ height: 2, margin: '0 15%', background: accentGold }} />

        {/* Corner accents */}
        {[
          { top: 16, left: 16 }, { top: 16, right: 16 },
          { bottom: 16, left: 16 }, { bottom: 16, right: 16 },
        ].map((pos, i) => (
          <div key={i} style={{ position: 'absolute', ...pos, width: 24, height: 24, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute',
              [i < 2 ? 'top' : 'bottom']: 0,
              [i % 2 === 0 ? 'left' : 'right']: 0,
              width: 24, height: 1,
              background: `${accentGold}35`,
            }} />
            <div style={{
              position: 'absolute',
              [i < 2 ? 'top' : 'bottom']: 0,
              [i % 2 === 0 ? 'left' : 'right']: 0,
              width: 1, height: 24,
              background: `${accentGold}35`,
            }} />
          </div>
        ))}

        <div style={{ textAlign: 'center', padding: '44px 36px 0', position: 'relative' }}>
          {/* Spaced heading */}
          <p style={{
            fontSize: 9, letterSpacing: 6, color: `${accentGold}90`,
            fontWeight: 400, marginBottom: 26, textTransform: 'uppercase',
          }}>
            You are invited to
          </p>

          {/* Event title */}
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 28, fontWeight: 700, color: '#F9FAFB',
            lineHeight: 1.3, marginBottom: 8,
          }}>
            {data.event?.title}
          </h2>

          {/* Minimal gold divider */}
          <div style={{
            width: 40, height: 1.5, background: accentGold,
            margin: '16px auto',
          }} />

          {/* Event type */}
          {data.event?.event_type && (
            <p style={{
              fontSize: 10, letterSpacing: 3, fontWeight: 500,
              color: accentLight, textTransform: 'uppercase', marginTop: 8,
            }}>
              {data.event.event_type}
            </p>
          )}
        </div>

        {/* Event details — clean typography, no cards or boxes */}
        <div style={{ textAlign: 'center', padding: '28px 36px 0' }}>
          {data.event?.start_date && (
            <p style={{ fontSize: 14, fontWeight: 500, color: '#D1D5DB', marginBottom: 6 }}>
              {formatDate(data.event.start_date)}
            </p>
          )}
          {data.event?.start_time && (
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 6 }}>
              {data.event.start_time}
            </p>
          )}
          {(data.event?.venue || data.event?.location) && (
            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 6 }}>
              {data.event.venue || data.event.location}
            </p>
          )}
          {data.event?.dress_code && (
            <p style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>
              Dress Code: {data.event.dress_code}
            </p>
          )}
        </div>

        {/* QR Code */}
        <div style={{ textAlign: 'center', margin: '28px auto 0' }}>
          <div style={{
            display: 'inline-block', padding: 8,
            border: `1px solid ${accentGold}20`, borderRadius: 8,
          }}>
            <QRCodeCanvas
              value={buildQrValue()}
              size={80}
              level="H"
              includeMargin={false}
              fgColor="#ffffff"
              bgColor="transparent"
            />
          </div>
          <p style={{
            fontSize: 7, color: 'rgba(255,255,255,0.25)', marginTop: 10,
            letterSpacing: 4, textTransform: 'uppercase',
          }}>
            Scan to check in
          </p>
        </div>

        {/* Hidden QR for PDF (dark on white for scanning) */}
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
        <div style={{ textAlign: 'center', margin: '26px 36px 0' }}>
          <div style={{ width: 50, height: 1, background: `${accentGold}28`, margin: '0 auto 14px' }} />
          <p style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 20, fontWeight: 600, color: '#F9FAFB',
          }}>
            {data.guest?.name}
          </p>

          {data.guest?.rsvp_status && (() => {
            const r = rsvpLabel(data.guest.rsvp_status);
            return (
              <span style={{
                display: 'inline-block', marginTop: 12,
                padding: '4px 18px', borderRadius: 20,
                fontSize: 8, fontWeight: 600, letterSpacing: 2,
                textTransform: 'uppercase',
                color: r.color, border: `1.5px solid ${r.border}`,
                background: 'transparent',
              }}>
                {r.label}
              </span>
            );
          })()}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 36px 28px' }}>
          {data.organizer?.name && (
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
              Hosted by{' '}
              <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
                {data.organizer.name}
              </span>
            </p>
          )}
          {data.invitation_code && (
            <p style={{
              fontSize: 7, color: 'rgba(255,255,255,0.12)', marginTop: 10,
              letterSpacing: 4, fontFamily: "'Courier New', monospace",
            }}>
              {data.invitation_code}
            </p>
          )}
        </div>

        {/* Bottom accent line */}
        <div style={{ height: 2, margin: '0 15%', background: accentGold }} />
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
              <Button size="sm" onClick={handleDownloadPdf} disabled={exporting} className="gap-2">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={exporting} className="gap-2">
                <Printer className="w-4 h-4" />
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
