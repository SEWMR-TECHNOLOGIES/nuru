import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { eventsApi } from '@/lib/api/events';
import { getCardComponent, CardTemplateProps } from '@/components/invitation-cards/CardTemplates';

interface InvitationCardProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
  /** When true, the organizer is viewing — allow download for confirmed guests */
  isOrganizer?: boolean;
  /** Optional guest ID for organizers to view a specific guest's card */
  guestId?: string;
}

const normalizeTypeKey = (eventType?: string): string => {
  if (!eventType) return 'wedding';
  const raw = eventType.toLowerCase().replace(/[\s_-]+/g, '');
  const keys = ['wedding', 'birthday', 'corporate', 'memorial', 'anniversary', 'conference', 'graduation', 'sendoff'];
  if (keys.includes(raw)) return raw;
  for (const key of keys) {
    if (raw.includes(key) || key.includes(raw)) return key;
  }
  return 'wedding';
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

const rsvpLabel = (status: string) => {
  if (status === 'confirmed') return { label: 'CONFIRMED', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' };
  if (status === 'declined') return { label: 'DECLINED', bg: '#FEF2F2', color: '#991B1B', border: '#FECACA' };
  return { label: 'PENDING', bg: '#FFFBEB', color: '#92400E', border: '#FDE68A' };
};


const InvitationCard = ({ eventId, open, onClose, isOrganizer = false, guestId }: InvitationCardProps) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !eventId) return;
    setLoading(true);
    setError(null);
    eventsApi.getInvitationCard(eventId, guestId)
      .then((res) => {
        if (res.success) setData(res.data);
        else setError(res.message || 'Failed to load invitation');
      })
      .catch(() => setError('Failed to load invitation card'))
      .finally(() => setLoading(false));
  }, [open, eventId, guestId]);

  const typeKey = normalizeTypeKey(data?.event?.event_type);
  const isConfirmedGuest = (data?.guest?.rsvp_status || '').toLowerCase() === 'confirmed';
  
  // Organizers can download cards for confirmed guests; guests can download their own if confirmed
  const canDownload = isOrganizer ? isConfirmedGuest : isConfirmedGuest;

  const buildQrValue = () => {
    if (data?.guest?.attendee_id)
      return `https://nuru.tz/event/${data.event?.id}/checkin/${data.guest.attendee_id}`;
    if (data?.invitation_code)
      return `https://nuru.tz/event/${data.event?.id}/rsvp/${data.invitation_code}`;
    return `https://nuru.tz/event/${data?.event?.id}`;
  };

  const buildCardProps = (): CardTemplateProps => ({
    title: data?.event?.title || 'Event',
    eventType: data?.event?.event_type || '',
    date: data?.event?.start_date ? formatDate(data.event.start_date) : '',
    time: data?.event?.start_time || '',
    venue: data?.event?.venue || data?.event?.location || '',
    dressCode: data?.event?.dress_code || '',
    guestName: data?.guest?.name || '',
    rsvpStatus: data?.guest?.rsvp_status ? rsvpLabel(data.guest.rsvp_status) : null,
    organizerName: data?.organizer?.name || '',
    invitationCode: data?.invitation_code || '',
    qrValue: buildQrValue(),
  });

  /**
   * PDF Download — uses the same print approach as PrintableTicket:
   * Clone the card HTML, convert QR canvases to images, open in new
   * window and trigger print dialog (Save as PDF).
   */
  const handleDownloadPdf = useCallback(() => {
    if (!cardRef.current) return;

    setDownloading(true);

    try {
      // Clone the card
      const clone = cardRef.current.cloneNode(true) as HTMLElement;

      // Convert all QR canvas elements to <img> tags so they render in the print window
      const canvases = cardRef.current.querySelectorAll('canvas');
      const clonedCanvases = clone.querySelectorAll('canvas');
      canvases.forEach((canvas, i) => {
        try {
          const img = document.createElement('img');
          img.src = canvas.toDataURL('image/png');
          img.width = canvas.width;
          img.height = canvas.height;
          img.style.width = canvas.style.width || `${canvas.width}px`;
          img.style.height = canvas.style.height || `${canvas.height}px`;
          clonedCanvases[i]?.parentNode?.replaceChild(img, clonedCanvases[i]);
        } catch (_) { /* cross-origin canvas — skip */ }
      });

      const cardHtml = clone.outerHTML;
      const title = data?.event?.title || 'Invitation';
      const guestName = data?.guest?.name || '';

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${title}${guestName ? ` - ${guestName}` : ''}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex; justify-content: center; align-items: center;
    min-height: 100vh; background: #f5f5f5;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .card-wrapper {
    width: 420px; margin: 0 auto;
  }
  @media print {
    body { background: white; }
    .card-wrapper { box-shadow: none; }
  }
  @page { size: auto; margin: 10mm; }
</style>
</head><body>
<div class="card-wrapper">${cardHtml}</div>
</body></html>`;

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        setTimeout(() => {
          w.print();
          setDownloading(false);
        }, 600);
      } else {
        setDownloading(false);
      }
    } catch (err) {
      console.error('PDF print failed:', err);
      setDownloading(false);
    }
  }, [data]);

  const CardComponent = data ? getCardComponent(typeKey) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Invitation Card</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-16 bg-card rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-card rounded-2xl px-6">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={onClose} className="mt-4">Close</Button>
          </div>
        ) : data && CardComponent ? (
          <div className="bg-card rounded-2xl overflow-hidden shadow-2xl">
            <div className="max-h-[80vh] overflow-y-auto">
              <div ref={cardRef}>
                <CardComponent {...buildCardProps()} />
              </div>
            </div>
            <div className="flex flex-wrap justify-end items-center gap-2 p-4 border-t border-border bg-muted/30">
              {!canDownload && (
                <span className="text-xs text-muted-foreground mr-auto">
                  {isOrganizer 
                    ? "This guest hasn't confirmed yet. Cards can only be downloaded for confirmed guests."
                    : "Only confirmed guests can download invitation cards."
                  }
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
              <Button size="sm" onClick={handleDownloadPdf} className="gap-2" disabled={!canDownload || downloading}>
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download Card
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default InvitationCard;
