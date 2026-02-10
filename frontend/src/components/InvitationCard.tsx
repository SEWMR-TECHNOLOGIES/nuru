import { useState, useEffect, useRef, useCallback } from 'react';
import { Printer, Download, Loader2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { eventsApi } from '@/lib/api/events';
import jsPDF from 'jspdf';

interface InvitationCardProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
}

const InvitationCard = ({ eventId, open, onClose }: InvitationCardProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
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

  const getQrImage = useCallback((): HTMLCanvasElement | null => {
    if (!qrCanvasRef.current) return null;
    return qrCanvasRef.current.querySelector('canvas') || null;
  }, []);

  const drawCardToCanvas = useCallback((scale = 3): HTMLCanvasElement => {
    const W = 420 * scale;
    const H = 620 * scale;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const s = scale;

    // Rich dark background
    const bg = ctx.createLinearGradient(0, 0, W * 0.5, H);
    bg.addColorStop(0, '#0B0F1A');
    bg.addColorStop(0.5, '#111827');
    bg.addColorStop(1, '#0B0F1A');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial glow at top center
    const glow = ctx.createRadialGradient(W / 2, 80 * s, 0, W / 2, 80 * s, 200 * s);
    glow.addColorStop(0, 'rgba(212, 165, 116, 0.08)');
    glow.addColorStop(1, 'rgba(212, 165, 116, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Thin top accent line
    ctx.fillStyle = accentGold;
    ctx.fillRect(W * 0.15, 0, W * 0.7, 2 * s);

    // Corner accents (L-shaped)
    const cornerLen = 30 * s;
    const cornerThick = 1.5 * s;
    const cornerMargin = 20 * s;
    ctx.fillStyle = `${accentGold}40`;
    // Top-left
    ctx.fillRect(cornerMargin, cornerMargin, cornerLen, cornerThick);
    ctx.fillRect(cornerMargin, cornerMargin, cornerThick, cornerLen);
    // Top-right
    ctx.fillRect(W - cornerMargin - cornerLen, cornerMargin, cornerLen, cornerThick);
    ctx.fillRect(W - cornerMargin - cornerThick, cornerMargin, cornerThick, cornerLen);
    // Bottom-left
    ctx.fillRect(cornerMargin, H - cornerMargin - cornerThick, cornerLen, cornerThick);
    ctx.fillRect(cornerMargin, H - cornerMargin - cornerLen, cornerThick, cornerLen);
    // Bottom-right
    ctx.fillRect(W - cornerMargin - cornerLen, H - cornerMargin - cornerThick, cornerLen, cornerThick);
    ctx.fillRect(W - cornerMargin - cornerThick, H - cornerMargin - cornerLen, cornerThick, cornerLen);

    let y = 56 * s;

    // "YOU ARE INVITED TO"
    ctx.textAlign = 'center';
    ctx.fillStyle = `${accentGold}90`;
    ctx.font = `400 ${8 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.letterSpacing = `${6 * s}px`;
    ctx.fillText('Y O U   A R E   I N V I T E D   T O', W / 2, y);
    y += 32 * s;

    // Event title
    ctx.fillStyle = '#F9FAFB';
    ctx.font = `700 ${26 * s}px Georgia, 'Playfair Display', serif`;
    const title = data?.event?.title || 'Event';
    const maxTitleW = W - 80 * s;
    const words = title.split(' ');
    let line = '';
    const titleLines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxTitleW) { titleLines.push(line); line = word; }
      else line = test;
    }
    if (line) titleLines.push(line);
    for (const tl of titleLines) { ctx.fillText(tl, W / 2, y); y += 32 * s; }

    // Minimal divider
    y += 4 * s;
    const divW = 40 * s;
    ctx.fillStyle = accentGold;
    ctx.fillRect((W - divW) / 2, y, divW, 1.5 * s);
    y += 24 * s;

    // Event type
    if (data?.event?.event_type) {
      ctx.font = `500 ${9 * s}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = accentLight;
      ctx.fillText(data.event.event_type.toUpperCase(), W / 2, y);
      y += 28 * s;
    }

    // Date & Time
    if (data?.event?.start_date) {
      ctx.font = `500 ${12 * s}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = '#D1D5DB';
      const dateStr = formatDate(data.event.start_date);
      ctx.fillText(dateStr, W / 2, y);
      y += 18 * s;
      if (data.event.start_time) {
        ctx.font = `400 ${11 * s}px 'Segoe UI', system-ui, sans-serif`;
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText(data.event.start_time, W / 2, y);
        y += 18 * s;
      }
    }

    // Venue
    if (data?.event?.venue || data?.event?.location) {
      ctx.font = `400 ${11 * s}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText(data.event.venue || data.event.location, W / 2, y);
      y += 18 * s;
    }

    // Dress code
    if (data?.event?.dress_code) {
      ctx.font = `400 ${10 * s}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = '#6B7280';
      ctx.fillText(`Dress Code: ${data.event.dress_code}`, W / 2, y);
      y += 18 * s;
    }

    y += 12 * s;

    // QR Code with subtle border
    const qrSize = 80 * s;
    const qrCanvas = getQrImage();
    const qrX = (W - qrSize) / 2;
    if (qrCanvas) {
      // Subtle rounded border around QR
      ctx.strokeStyle = `${accentGold}25`;
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.roundRect(qrX - 8 * s, y - 8 * s, qrSize + 16 * s, qrSize + 16 * s, 8 * s);
      ctx.stroke();
      ctx.drawImage(qrCanvas, qrX, y, qrSize, qrSize);
    }
    y += qrSize + 14 * s;

    ctx.font = `400 ${7 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillText('S C A N   T O   C H E C K   I N', W / 2, y);
    y += 30 * s;

    // Guest name with thin line above
    const nameLineW = 60 * s;
    ctx.fillStyle = `${accentGold}30`;
    ctx.fillRect((W - nameLineW) / 2, y - 10 * s, nameLineW, 1 * s);

    ctx.fillStyle = '#F9FAFB';
    ctx.font = `600 ${20 * s}px Georgia, 'Playfair Display', serif`;
    ctx.fillText(data?.guest?.name || '', W / 2, y + 8 * s);
    y += 24 * s;

    // RSVP status
    if (data?.guest?.rsvp_status) {
      y += 6 * s;
      const r = rsvpLabel(data.guest.rsvp_status);
      ctx.font = `600 ${8 * s}px 'Segoe UI', system-ui, sans-serif`;
      const rw = ctx.measureText(r.label).width + 24 * s;
      // Pill outline style
      ctx.strokeStyle = r.border;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.roundRect((W - rw) / 2, y - 9 * s, rw, 18 * s, 9 * s);
      ctx.stroke();
      ctx.fillStyle = r.color;
      ctx.fillText(r.label, W / 2, y + 3 * s);
      y += 24 * s;
    }

    // Hosted by
    if (data?.organizer?.name) {
      y += 4 * s;
      ctx.font = `400 ${9 * s}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`Hosted by ${data.organizer.name}`, W / 2, y);
      y += 14 * s;
    }

    // Invitation code
    if (data?.invitation_code) {
      ctx.font = `400 ${7 * s}px 'Courier New', monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillText(data.invitation_code, W / 2, y);
    }

    // Bottom accent line
    ctx.fillStyle = accentGold;
    ctx.fillRect(W * 0.15, H - 2 * s, W * 0.7, 2 * s);

    return canvas;
  }, [data, getQrImage]);

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      const canvas = drawCardToCanvas(3);
      const imgData = canvas.toDataURL('image/png');
      const pdfW = canvas.width * 0.264583 / 3;
      const pdfH = canvas.height * 0.264583 / 3;
      const pdf = new jsPDF({ orientation: pdfW > pdfH ? 'l' : 'p', unit: 'mm', format: [pdfW, pdfH] });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      pdf.save(`invitation-${data?.event?.title?.replace(/\s+/g, '-').toLowerCase() || 'card'}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    setExporting(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      const canvas = drawCardToCanvas(3);
      const imgData = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      printWindow.document.write(`
        <!DOCTYPE html><html><head><title>Event Invitation</title>
        <style>* { margin: 0; padding: 0; } body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f3ef; } img { max-width: 420px; width: 100%; height: auto; } @media print { body { background: white; } }</style>
        </head><body><img src="${imgData}" /></body></html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    } finally {
      setExporting(false);
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
