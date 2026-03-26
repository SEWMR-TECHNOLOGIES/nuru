import { useState, useEffect } from 'react';
import { Loader2, QrCode, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { eventsApi } from '@/lib/api/events';

interface InvitationQRDialogProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
}

const InvitationQRDialog = ({ eventId, open, onClose }: InvitationQRDialogProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [guestName, setGuestName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');

  useEffect(() => {
    if (!open || !eventId) return;
    setLoading(true);
    setError(null);
    eventsApi.getInvitationCard(eventId)
      .then((res) => {
        if (res.success) {
          const d = res.data;
          setQrValue(d?.guest?.attendee_id || d?.invitation_code || d?.qr_code_data || eventId);
          setEventTitle(d?.event?.title || 'Event');
          setGuestName(d?.guest?.name || '');
          setEventDate(d?.event?.start_date || '');
          setVenue(d?.event?.venue || d?.event?.location || '');
        } else {
          setError(res.message || 'Failed to load QR code');
        }
      })
      .catch(() => setError('Failed to load invitation QR'))
      .finally(() => setLoading(false));
  }, [open, eventId]);

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Invitation QR Code</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12 px-6">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={onClose} className="mt-4">Close</Button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {/* Header */}
            <div className="w-full bg-gradient-to-br from-primary to-primary/80 px-6 pt-8 pb-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-foreground/20 mb-3">
                <QrCode className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold text-primary-foreground">{eventTitle}</h3>
              {guestName && (
                <p className="text-primary-foreground/80 text-sm mt-1">{guestName}</p>
              )}
            </div>

            {/* QR Code */}
            <div className="px-6 -mt-4">
              <div className="bg-card rounded-2xl shadow-lg p-5 border border-border">
                <QRCodeCanvas
                  value={qrValue}
                  size={200}
                  level="H"
                  includeMargin
                  className="mx-auto"
                />
              </div>
            </div>

            {/* Event details */}
            <div className="text-center px-6 pt-4 pb-2 space-y-1">
              {formattedDate && (
                <p className="text-sm text-muted-foreground">{formattedDate}</p>
              )}
              {venue && (
                <p className="text-sm text-muted-foreground">{venue}</p>
              )}
              <p className="text-xs text-muted-foreground/70 pt-2">
                Present this QR code at the event for check-in
              </p>
            </div>

            {/* Actions */}
            <div className="w-full px-6 pb-6 pt-2">
              <Button variant="outline" onClick={onClose} className="w-full">
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InvitationQRDialog;
