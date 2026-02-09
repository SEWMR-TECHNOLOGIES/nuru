import { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, QrCode, Printer, Download, Loader2, Sparkles } from 'lucide-react';
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
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !eventId) return;
    setLoading(true);
    setError(null);
    eventsApi.getInvitationCard(eventId)
      .then((res) => {
        if (res.success) {
          setData(res.data);
        } else {
          setError(res.message || 'Failed to load invitation');
        }
      })
      .catch(() => setError('Failed to load invitation card'))
      .finally(() => setLoading(false));
  }, [open, eventId]);

  const handlePrint = () => {
    if (!cardRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Event Invitation</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8f6f3; padding: 20px; }
          .invitation-card { background: white; border-radius: 24px; max-width: 440px; width: 100%; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.08); }
          .card-accent { height: 6px; }
          .card-body { padding: 40px 32px; text-align: center; }
          .invited-label { font-size: 11px; text-transform: uppercase; letter-spacing: 4px; color: #9ca3af; margin-bottom: 16px; font-weight: 500; }
          .event-title { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: #1a1a1a; line-height: 1.2; }
          .event-type { font-size: 13px; color: #6b7280; margin-top: 6px; }
          .divider { width: 40px; height: 2px; background: #e5e7eb; margin: 24px auto; border-radius: 1px; }
          .detail-row { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 6px 0; font-size: 14px; color: #374151; }
          .detail-icon { width: 16px; height: 16px; color: #9ca3af; }
          .qr-section { margin: 28px auto; padding: 16px; background: #fafaf9; border-radius: 16px; display: inline-block; }
          .guest-section { margin-top: 24px; }
          .guest-name { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 600; color: #1a1a1a; }
          .rsvp-badge { display: inline-block; padding: 4px 16px; border-radius: 24px; font-size: 12px; font-weight: 600; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; }
          .rsvp-confirmed { background: #ecfdf5; color: #059669; }
          .organizer { font-size: 12px; color: #9ca3af; margin-top: 24px; }
          .invite-code { font-size: 11px; color: #d1d5db; margin-top: 8px; letter-spacing: 2px; font-family: monospace; }
          .footer-note { font-size: 11px; color: #9ca3af; margin-top: 20px; font-style: italic; padding: 0 16px; line-height: 1.5; }
          @media print { body { background: white; } .invitation-card { box-shadow: none; } }
        </style>
      </head>
      <body>
        ${cardRef.current.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const themeColor = data?.event?.theme_color || '#F5A623';

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
            <div ref={cardRef}>
              <div className="invitation-card">
                {/* Accent bar */}
                <div className="card-accent" style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}99)` }} />

                {/* Card body */}
                <div className="card-body" style={{ padding: '40px 32px', textAlign: 'center' }}>
                  {/* Sparkle decoration */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                    <Sparkles className="w-5 h-5" style={{ color: themeColor, opacity: 0.6 }} />
                  </div>

                  <p className="invited-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '4px', color: '#9ca3af', marginBottom: '16px', fontWeight: 500 }}>
                    You are cordially invited to
                  </p>

                  <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>
                    {data.event?.title}
                  </h2>

                  {data.event?.event_type && (
                    <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>
                      {data.event.event_type}
                    </p>
                  )}

                  <div style={{ width: '40px', height: '2px', background: '#e5e7eb', margin: '24px auto', borderRadius: '1px' }} />

                  {/* Event details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {data.event?.start_date && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', color: 'var(--foreground)' }}>
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {new Date(data.event.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          {data.event.start_time && ` · ${data.event.start_time}`}
                        </span>
                      </div>
                    )}
                    {(data.event?.venue || data.event?.location) && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', color: 'var(--foreground)' }}>
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{data.event.venue || data.event.location}</span>
                      </div>
                    )}
                    {data.event?.venue_address && data.event.venue_address !== data.event.venue && (
                      <p className="text-xs text-muted-foreground">{data.event.venue_address}</p>
                    )}
                  </div>

                  {data.event?.dress_code && (
                    <p className="text-sm mt-5 text-foreground/80">
                      <span className="font-medium">Dress Code:</span> {data.event.dress_code}
                    </p>
                  )}

                  {/* QR Code section */}
                  <div style={{ margin: '28px auto 0', padding: '16px', background: 'var(--muted)', borderRadius: '16px', display: 'inline-block' }}>
                    <QrCode className="w-20 h-20 mx-auto" style={{ color: themeColor }} />
                    <p className="text-[10px] text-muted-foreground mt-2">Scan for check-in</p>
                  </div>

                  {/* Guest info */}
                  <div style={{ marginTop: '24px' }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 600, color: 'var(--foreground)' }}>
                      {data.guest?.name}
                    </p>
                    <span className={`inline-block mt-2 px-4 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      data.guest?.rsvp_status === 'confirmed' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' :
                      data.guest?.rsvp_status === 'declined' ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/20' :
                      'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    }`}>
                      {data.guest?.rsvp_status?.charAt(0).toUpperCase() + data.guest?.rsvp_status?.slice(1)}
                    </span>
                  </div>

                  {data.organizer?.name && (
                    <p className="text-xs text-muted-foreground mt-6">
                      Hosted by <span className="font-medium">{data.organizer.name}</span>
                    </p>
                  )}

                  {data.invitation_code && (
                    <p className="text-[10px] text-muted-foreground/60 mt-2 tracking-[3px] font-mono">
                      {data.invitation_code}
                    </p>
                  )}

                  {data.event?.special_instructions && (
                    <p className="text-xs text-muted-foreground mt-5 italic leading-relaxed px-4">
                      {data.event.special_instructions}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
              <Button size="sm" onClick={handlePrint} className="gap-2">
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
