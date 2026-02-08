import { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, Clock, QrCode, Printer, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; padding: 20px; }
          .card { background: white; border-radius: 16px; padding: 40px; max-width: 500px; width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center; }
          .title { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
          .type { font-size: 14px; color: #666; margin-bottom: 24px; }
          .detail { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 0; font-size: 15px; color: #333; }
          .label { font-weight: 600; }
          .qr { margin: 24px auto; width: 160px; height: 160px; background: #f0f0f0; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #999; }
          .guest-name { font-size: 18px; font-weight: 600; margin-top: 20px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; margin-top: 8px; background: #e8f5e9; color: #2e7d32; }
          .organizer { font-size: 13px; color: #888; margin-top: 20px; }
          .code { font-size: 12px; color: #aaa; margin-top: 8px; letter-spacing: 1px; }
          @media print { body { background: white; } .card { box-shadow: none; } }
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Digital Invitation Card</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive">{error}</p>
          </div>
        ) : data ? (
          <>
            <div ref={cardRef}>
              <div className="card" style={{ borderTop: `4px solid ${themeColor}` }}>
                <div className="text-center">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">You are invited to</p>
                  <h2 className="title text-2xl font-bold text-foreground">{data.event?.title}</h2>
                  {data.event?.event_type && (
                    <p className="type text-sm text-muted-foreground mt-1">{data.event.event_type}</p>
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  {data.event?.start_date && (
                    <div className="detail flex items-center justify-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {new Date(data.event.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        {data.event.start_time && ` at ${data.event.start_time}`}
                      </span>
                    </div>
                  )}
                  {(data.event?.venue || data.event?.location) && (
                    <div className="detail flex items-center justify-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{data.event.venue || data.event.location}</span>
                    </div>
                  )}
                  {data.event?.venue_address && data.event.venue_address !== data.event.venue && (
                    <p className="text-xs text-muted-foreground text-center">{data.event.venue_address}</p>
                  )}
                </div>

                {data.event?.dress_code && (
                  <p className="text-sm text-center mt-4">
                    <span className="font-medium">Dress Code:</span> {data.event.dress_code}
                  </p>
                )}

                <div className="qr mt-6 mx-auto w-40 h-40 bg-muted/20 rounded-xl flex items-center justify-center border border-border">
                  <div className="text-center">
                    <QrCode className="w-16 h-16 mx-auto text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground mt-1">Scan for check-in</p>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <p className="guest-name text-lg font-semibold">{data.guest?.name}</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                    data.guest?.rsvp_status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    data.guest?.rsvp_status === 'declined' ? 'bg-destructive/10 text-destructive' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    RSVP: {data.guest?.rsvp_status?.charAt(0).toUpperCase() + data.guest?.rsvp_status?.slice(1)}
                  </span>
                </div>

                {data.organizer?.name && (
                  <p className="organizer text-xs text-muted-foreground text-center mt-6">
                    Hosted by {data.organizer.name}
                  </p>
                )}

                {data.invitation_code && (
                  <p className="code text-[10px] text-muted-foreground text-center mt-2 tracking-widest">
                    Code: {data.invitation_code}
                  </p>
                )}

                {data.event?.special_instructions && (
                  <p className="text-xs text-muted-foreground text-center mt-4 italic">
                    {data.event.special_instructions}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print Card
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default InvitationCard;
