import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Loader2, ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { eventsApi } from '@/lib/api/events';
import NuruInvitationCard, { NuruCardData, NuruCardVariant } from '@/components/invitation-cards/NuruInvitationCard';
import SvgCardRenderer from '@/components/invitation-cards/SvgCardRenderer';
import { getTemplateById } from '@/components/invitation-cards/SvgTemplateRegistry';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

interface InvitationCardProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
  isOrganizer?: boolean;
  guestId?: string;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr)
      .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      .toUpperCase();
  } catch {
    return dateStr;
  }
};

const formatTime = (start?: string, end?: string) => {
  if (!start) return '';
  return end ? `${start} – ${end}` : start;
};

const InvitationCard = ({ eventId, open, onClose, isOrganizer = false, guestId }: InvitationCardProps) => {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [variant, setVariant] = useState<NuruCardVariant>('classic');

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

  const isConfirmedGuest = (data?.guest?.rsvp_status || '').toLowerCase() === 'confirmed';
  const canDownload = isOrganizer || isConfirmedGuest;

  const buildQrValue = () =>
    data?.guest?.attendee_id || data?.invitation_code || data?.qr_code_data || data?.event?.id || eventId;

  const buildCardData = (): NuruCardData => ({
    guestName: data?.guest?.name || '',
    eventTitle: data?.event?.title || 'Event',
    date: formatDate(data?.event?.start_date),
    time: formatTime(data?.event?.start_time, data?.event?.end_time),
    venue: (data?.event?.venue || data?.event?.location || '').toUpperCase(),
    organizer: data?.event?.organizer_name || data?.event?.host_name || data?.event?.organization || '',
    description: data?.event?.description || data?.event?.invitation_message ||
      'Join us for an unforgettable event filled with meaningful moments, great company and lasting memories.',
    dressCode: data?.event?.dress_code || 'As you feel comfortable',
    admits: data?.guest?.admits ? `${data.guest.admits} Guest${data.guest.admits > 1 ? 's' : ''}` : '1 Guest',
    qrValue: buildQrValue(),
    qrUrl: data?.invitation_url
      || (data?.invitation_code ? `nuru.tz/rsvp/${data.invitation_code}` : 'nuru.tz/rsvp'),
  });

  const captureCanvas = async () => {
    if (!cardRef.current) return null;
    return await html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
  };

  const handleDownloadPng = useCallback(async () => {
    setDownloading(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${data?.event?.title || 'invitation'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }, [data]);

  const handleDownloadPdf = useCallback(async () => {
    setDownloading(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let w = pageW - 20;
      let h = w / ratio;
      if (h > pageH - 20) { h = pageH - 20; w = h * ratio; }
      const x = (pageW - w) / 2;
      const y = (pageH - h) / 2;
      pdf.addImage(imgData, 'PNG', x, y, w, h, undefined, 'FAST');
      pdf.save(`${data?.event?.title || 'invitation'}.pdf`);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-0 bg-transparent shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('invitation_card') || 'Invitation Card'}</DialogTitle>
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
        ) : data ? (
          <div className="bg-card rounded-2xl overflow-hidden shadow-2xl">
            {/* Variant picker */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground mr-1">Design:</span>
                {(['classic', 'editorial'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVariant(v)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border transition',
                      variant === v
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                    )}
                  >
                    {v === 'classic' ? 'Classic' : 'Editorial'}
                  </button>
                ))}
              </div>
            </div>

            {/* Card preview */}
            <div className="max-h-[75vh] overflow-auto bg-neutral-100 p-4 flex justify-center">
              {(() => {
                const tplId = data?.event?.invitation_template_id as string | undefined;
                const tpl = tplId ? getTemplateById(tplId) : null;
                if (tpl) {
                  const cd = buildCardData();
                  return (
                    <div ref={cardRef} className="origin-top w-[480px] max-w-full">
                      <SvgCardRenderer
                        template={tpl}
                        data={{
                          guestName: cd.guestName,
                          eventTitle: cd.eventTitle,
                          date: cd.date,
                          time: cd.time,
                          venue: cd.venue,
                          address: data?.event?.venue_address,
                          qrValue: cd.qrValue,
                        }}
                        contentOverrides={data?.event?.invitation_content || null}
                      />
                    </div>
                  );
                }
                return (
                  <div className="origin-top scale-[0.55] xs:scale-[0.65] sm:scale-[0.85] md:scale-100">
                    <NuruInvitationCard ref={cardRef} variant={variant} data={buildCardData()} />
                  </div>
                );
              })()}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-end items-center gap-2 p-4 border-t border-border bg-muted/30">
              {!canDownload && (
                <span className="text-xs text-muted-foreground mr-auto">
                  {isOrganizer
                    ? "This guest hasn't confirmed yet."
                    : 'Only confirmed guests can download invitation cards.'}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadPng}
                disabled={!canDownload || downloading}
                className="gap-2"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                PNG
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadPdf}
                disabled={!canDownload || downloading}
                className="gap-2"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PDF
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default InvitationCard;
