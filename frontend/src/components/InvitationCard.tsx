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
    if (status === 'confirmed') return { label: 'CONFIRMED', bg: '#059669' };
    if (status === 'declined') return { label: 'DECLINED', bg: '#dc2626' };
    return { label: 'PENDING', bg: '#d97706' };
  };

  const themeColor = data?.event?.theme_color || '#C8956C';

  // Get QR code as an Image element from the hidden canvas
  const getQrImage = useCallback((): HTMLCanvasElement | null => {
    if (!qrCanvasRef.current) return null;
    const canvas = qrCanvasRef.current.querySelector('canvas');
    return canvas || null;
  }, []);

  // Draw the entire invitation card to a canvas
  const drawCardToCanvas = useCallback((scale = 3): HTMLCanvasElement => {
    const W = 440 * scale;
    const H = 680 * scale;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const s = scale;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, W * 0.3, H);
    grad.addColorStop(0, '#0f1729');
    grad.addColorStop(0.4, '#1C274C');
    grad.addColorStop(1, '#2a1f3d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Top gold bar
    const topBar = ctx.createLinearGradient(0, 0, W, 0);
    topBar.addColorStop(0, themeColor);
    topBar.addColorStop(0.5, '#f5c87a');
    topBar.addColorStop(1, themeColor);
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, W, 5 * s);

    // Decorative circles
    ctx.beginPath();
    ctx.arc(W + 30 * s, -30 * s, 120 * s, 0, Math.PI * 2);
    ctx.fillStyle = `${themeColor}12`;
    ctx.fill();

    let y = 50 * s;

    // "YOU ARE INVITED"
    ctx.textAlign = 'center';
    ctx.fillStyle = themeColor;
    ctx.font = `600 ${10 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText('YOU ARE INVITED', W / 2, y);
    y += 16 * s;

    // Diamond divider
    ctx.save();
    ctx.translate(W / 2, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = themeColor;
    ctx.fillRect(-4 * s, -4 * s, 8 * s, 8 * s);
    ctx.restore();
    ctx.strokeStyle = `${themeColor}60`;
    ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.moveTo(W / 2 - 60 * s, y); ctx.lineTo(W / 2 - 12 * s, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 12 * s, y); ctx.lineTo(W / 2 + 60 * s, y); ctx.stroke();
    y += 28 * s;

    // Event title (word wrap)
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${28 * s}px Georgia, serif`;
    const title = data?.event?.title || 'Event';
    const maxTitleW = W - 60 * s;
    const words = title.split(' ');
    let line = '';
    const titleLines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxTitleW) { titleLines.push(line); line = word; }
      else line = test;
    }
    if (line) titleLines.push(line);
    for (const tl of titleLines) { ctx.fillText(tl, W / 2, y); y += 34 * s; }

    // Event type badge
    if (data?.event?.event_type) {
      y += 4 * s;
      const badge = data.event.event_type.toUpperCase();
      ctx.font = `600 ${9 * s}px 'Segoe UI', system-ui, sans-serif`;
      const bw = ctx.measureText(badge).width + 28 * s;
      const bx = (W - bw) / 2;
      ctx.fillStyle = `${themeColor}30`;
      ctx.strokeStyle = `${themeColor}50`;
      ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.roundRect(bx, y - 12 * s, bw, 20 * s, 10 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = themeColor;
      ctx.fillText(badge, W / 2, y + 2 * s);
      y += 24 * s;
    }
    y += 10 * s;

    // Details card
    const detailH = 70 * s;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(30 * s, y, W - 60 * s, detailH, 14 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1 * s; ctx.stroke();

    let dy = y + 24 * s;
    ctx.font = `500 ${13 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = '#e2e8f0';
    if (data?.event?.start_date) {
      const dateStr = formatDate(data.event.start_date);
      const timeStr = data.event.start_time ? ` · ${data.event.start_time}` : '';
      ctx.fillText(`📅  ${dateStr}${timeStr}`, W / 2, dy);
      dy += 22 * s;
    }
    if (data?.event?.venue || data?.event?.location) {
      ctx.fillText(`📍  ${data.event.venue || data.event.location}`, W / 2, dy);
    }
    y += detailH + 14 * s;

    if (data?.event?.dress_code) {
      ctx.font = `400 ${11 * s}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Dress Code: ${data.event.dress_code}`, W / 2, y);
      y += 20 * s;
    }
    y += 8 * s;

    // QR Code — draw from the hidden QRCodeCanvas directly
    const qrSize = 96 * s;
    const qrCanvas = getQrImage();
    const qrX = (W - qrSize) / 2;
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, qrX, y, qrSize, qrSize);
    }
    y += qrSize + 10 * s;

    // "Scan to check in"
    ctx.font = `400 ${8 * s}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('SCAN TO CHECK IN', W / 2, y);
    y += 28 * s;

    // Guest name
    ctx.fillStyle = '#ffffff';
    ctx.font = `600 ${22 * s}px Georgia, serif`;
    ctx.fillText(data?.guest?.name || '', W / 2, y);
    y += 14 * s;

    // RSVP badge
    if (data?.guest?.rsvp_status) {
      y += 8 * s;
      const r = rsvpLabel(data.guest.rsvp_status);
      ctx.font = `700 ${9 * s}px 'Segoe UI', system-ui, sans-serif`;
      const rw = ctx.measureText(r.label).width + 30 * s;
      ctx.fillStyle = r.bg;
      ctx.beginPath(); ctx.roundRect((W - rw) / 2, y - 10 * s, rw, 20 * s, 10 * s); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(r.label, W / 2, y + 4 * s);
      y += 24 * s;
    }
    y += 10 * s;

    // Hosted by
    if (data?.organizer?.name) {
      ctx.font = `400 ${10 * s}px 'Segoe UI', system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillText(`Hosted by ${data.organizer.name}`, W / 2, y);
      y += 16 * s;
    }

    // Invitation code
    if (data?.invitation_code) {
      ctx.font = `400 ${8 * s}px 'Courier New', monospace`;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillText(data.invitation_code, W / 2, y);
    }

    // Bottom gold bar
    const bottomBar = ctx.createLinearGradient(0, 0, W, 0);
    bottomBar.addColorStop(0, themeColor);
    bottomBar.addColorStop(0.5, '#f5c87a');
    bottomBar.addColorStop(1, themeColor);
    ctx.fillStyle = bottomBar;
    ctx.fillRect(0, H - 5 * s, W, 5 * s);

    return canvas;
  }, [data, themeColor, getQrImage]);

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      // Small delay to ensure QR canvas is rendered
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
        <style>* { margin: 0; padding: 0; } body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f3ef; } img { max-width: 440px; width: 100%; height: auto; } @media print { body { background: white; } }</style>
        </head><body><img src="${imgData}" /></body></html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    } finally {
      setExporting(false);
    }
  };

  // Visual preview card (inline styles for display)
  const PreviewCard = () => {
    if (!data) return null;
    const tc = themeColor;
    return (
      <div style={{
        width: 440, margin: '0 auto',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: `linear-gradient(160deg, #0f1729 0%, #1C274C 40%, #2a1f3d 100%)`,
        position: 'relative', overflow: 'hidden', borderRadius: 16,
      }}>
        <div style={{ height: 5, background: `linear-gradient(90deg, ${tc}, #f5c87a, ${tc})` }} />
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: `${tc}12` }} />

        <div style={{ textAlign: 'center', padding: '40px 32px 0', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{ width: 50, height: 1, background: `${tc}60` }} />
            <div style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: tc }} />
            <div style={{ width: 50, height: 1, background: `${tc}60` }} />
          </div>

          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 5, color: tc, fontWeight: 600, marginBottom: 18 }}>
            You are invited
          </p>

          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 30, fontWeight: 700, color: '#fff', lineHeight: 1.25, marginBottom: 8, textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            {data.event?.title}
          </h2>

          {data.event?.event_type && (
            <span style={{ display: 'inline-block', marginTop: 8, padding: '5px 18px', borderRadius: 20, fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', background: `${tc}30`, color: tc, border: `1px solid ${tc}50` }}>
              {data.event.event_type}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '24px 40px' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ width: 5, height: 5, transform: 'rotate(45deg)', background: tc }} />
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>

        <div style={{ padding: '0 32px', textAlign: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '18px 20px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {data.event?.start_date && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, color: '#e2e8f0', marginBottom: 10 }}>
                <span>📅</span>
                <span style={{ fontWeight: 500 }}>{formatDate(data.event.start_date)}{data.event.start_time && ` · ${data.event.start_time}`}</span>
              </div>
            )}
            {(data.event?.venue || data.event?.location) && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, color: '#e2e8f0' }}>
                <span>📍</span>
                <span>{data.event.venue || data.event.location}</span>
              </div>
            )}
          </div>
          {data.event?.dress_code && (
            <p style={{ fontSize: 11, marginTop: 14, color: '#94a3b8' }}>
              <span style={{ fontWeight: 600, color: tc }}>Dress Code:</span> {data.event.dress_code}
            </p>
          )}
        </div>

        {/* QR Code - no white bg card around it */}
        <div style={{ textAlign: 'center', margin: '26px auto 0' }}>
          <QRCodeCanvas
            value={buildQrValue()}
            size={96}
            level="H"
            includeMargin={false}
            fgColor="#ffffff"
            bgColor="transparent"
          />
          <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: 8, letterSpacing: 2, textTransform: 'uppercase' }}>
            Scan to check in
          </p>
        </div>

        {/* Hidden QR for PDF export (needs dark fg on white bg for scanning) */}
        <div ref={qrCanvasRef} style={{ position: 'absolute', left: -9999, top: -9999 }}>
          <QRCodeCanvas
            value={buildQrValue()}
            size={288}
            level="H"
            includeMargin={false}
            fgColor="#1C274C"
            bgColor="#ffffff"
          />
        </div>

        <div style={{ textAlign: 'center', margin: '22px 32px 0' }}>
          <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 600, color: '#fff' }}>
            {data.guest?.name}
          </p>
          {data.guest?.rsvp_status && (() => {
            const r = rsvpLabel(data.guest.rsvp_status);
            return (
              <span style={{ display: 'inline-block', marginTop: 10, padding: '4px 20px', borderRadius: 20, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, background: r.bg, color: '#fff' }}>
                {r.label}
              </span>
            );
          })()}
        </div>

        <div style={{ textAlign: 'center', padding: '22px 32px 30px' }}>
          {data.organizer?.name && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              Hosted by <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{data.organizer.name}</span>
            </p>
          )}
          {data.invitation_code && (
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.18)', marginTop: 8, letterSpacing: 4, fontFamily: "'Courier New', monospace" }}>
              {data.invitation_code}
            </p>
          )}
        </div>

        <div style={{ height: 5, background: `linear-gradient(90deg, ${tc}, #f5c87a, ${tc})` }} />
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
