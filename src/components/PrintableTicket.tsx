import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import PrintIcon from '@/assets/icons/print-icon.svg';
import NuruLogo from '@/assets/nuru-logo.png';

interface TicketData {
  ticket_code: string;
  event_title: string;
  event_date?: string;
  event_time?: string;
  event_location?: string;
  ticket_class?: string;
  quantity?: number;
  buyer_name?: string;
  total_amount?: number;
  currency?: string;
  status?: string;
}

interface PrintableTicketProps {
  ticket: TicketData;
  open: boolean;
  onClose: () => void;
}

const PrintableTicket = ({ ticket, open, onClose }: PrintableTicketProps) => {
  const qrRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

  const getQrDataUrl = (): string => {
    const canvas = qrRef.current?.querySelector('canvas');
    return canvas ? canvas.toDataURL('image/png') : '';
  };

  const handlePrint = () => {
    const qrImg = getQrDataUrl();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ticket - ${ticket.event_title}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; font-family: 'Inter', sans-serif; }
  .ticket { width: 480px; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); position: relative; }
  .ticket-header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 28px 32px; color: #fff; }
  .ticket-header h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; line-height: 1.3; }
  .ticket-header .class { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #C9A96E; font-weight: 600; }
  .divider { height: 0; border: none; border-top: 2px dashed #e5e5e5; margin: 0 20px; position: relative; }
  .divider::before, .divider::after { content: ''; position: absolute; top: -13px; width: 26px; height: 26px; background: #f5f5f5; border-radius: 50%; }
  .divider::before { left: -33px; }
  .divider::after { right: -33px; }
  .ticket-body { padding: 24px 32px; display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start; }
  .details { display: grid; gap: 14px; }
  .detail-item label { display: block; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #999; font-weight: 500; margin-bottom: 3px; }
  .detail-item span { font-size: 14px; font-weight: 600; color: #1a1a1a; }
  .qr-area { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .qr-area img { width: 100px; height: 100px; border-radius: 8px; }
  .qr-area .code { font-family: 'Space Mono', monospace; font-size: 11px; color: #666; letter-spacing: 2px; }
  .ticket-footer { padding: 16px 32px; background: #fafafa; border-top: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
  .ticket-footer .status { padding: 4px 14px; border-radius: 100px; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .status-confirmed { background: #ECFDF5; color: #065F46; }
  .status-approved { background: #EFF6FF; color: #1E40AF; }
  .status-pending { background: #FFFBEB; color: #92400E; }
  .ticket-footer .amount { font-size: 16px; font-weight: 700; color: #1a1a1a; }
  .ticket-footer .logo { height: 20px; opacity: 0.6; }
  @media print { body { background: white; } .ticket { box-shadow: none; } .divider::before, .divider::after { background: white; } }
  @page { size: auto; margin: 15mm; }
</style></head><body>
<div class="ticket">
  <div class="ticket-header">
    <h1>${ticket.event_title}</h1>
    ${ticket.ticket_class ? `<p class="class">${ticket.ticket_class}</p>` : ''}
  </div>
  <div class="divider"></div>
  <div class="ticket-body">
    <div class="details">
      ${ticket.event_date ? `<div class="detail-item"><label>Date</label><span>${formatDate(ticket.event_date)}</span></div>` : ''}
      ${ticket.event_time ? `<div class="detail-item"><label>Time</label><span>${ticket.event_time}</span></div>` : ''}
      ${ticket.event_location ? `<div class="detail-item"><label>Venue</label><span>${ticket.event_location}</span></div>` : ''}
      ${ticket.buyer_name ? `<div class="detail-item"><label>Attendee</label><span>${ticket.buyer_name}</span></div>` : ''}
      ${ticket.quantity && ticket.quantity > 1 ? `<div class="detail-item"><label>Quantity</label><span>${ticket.quantity} tickets</span></div>` : ''}
    </div>
    <div class="qr-area">
      ${qrImg ? `<img src="${qrImg}" alt="QR" />` : ''}
      <span class="code">${ticket.ticket_code}</span>
    </div>
  </div>
  <div class="ticket-footer">
    <span class="status status-${ticket.status || 'confirmed'}">${ticket.status || 'Confirmed'}</span>
    ${ticket.total_amount ? `<span class="amount">${ticket.currency || 'TZS'} ${ticket.total_amount.toLocaleString()}</span>` : ''}
    <img src="https://nuru.lovable.app/logo.png" alt="Nuru" class="logo" />
  </div>
</div>
</body></html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  };

  const statusColor = (s: string) => {
    if (s === 'confirmed') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (s === 'approved') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] p-7 text-white">
          <h2 className="text-xl font-bold mb-1">{ticket.event_title}</h2>
          {ticket.ticket_class && (
            <p className="text-[11px] tracking-[3px] uppercase text-amber-300 font-semibold">{ticket.ticket_class}</p>
          )}
        </div>

        <div className="p-6 grid grid-cols-[1fr_auto] gap-6 items-start">
          <div className="space-y-4">
            {ticket.event_date && (
              <div>
                <p className="text-[9px] tracking-[2px] uppercase text-muted-foreground font-medium">Date</p>
                <p className="text-sm font-semibold text-foreground">{formatDate(ticket.event_date)}</p>
              </div>
            )}
            {ticket.event_time && (
              <div>
                <p className="text-[9px] tracking-[2px] uppercase text-muted-foreground font-medium">Time</p>
                <p className="text-sm font-semibold text-foreground">{ticket.event_time}</p>
              </div>
            )}
            {ticket.event_location && (
              <div>
                <p className="text-[9px] tracking-[2px] uppercase text-muted-foreground font-medium">Venue</p>
                <p className="text-sm font-semibold text-foreground">{ticket.event_location}</p>
              </div>
            )}
            {ticket.buyer_name && (
              <div>
                <p className="text-[9px] tracking-[2px] uppercase text-muted-foreground font-medium">Attendee</p>
                <p className="text-sm font-semibold text-foreground">{ticket.buyer_name}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <div ref={qrRef} className="p-2 bg-muted/30 rounded-xl border border-border">
              <QRCodeCanvas
                value={`https://nuru.lovable.app/ticket/${ticket.ticket_code}`}
                size={90}
                level="H"
                fgColor="#1a1a2e"
                bgColor="transparent"
              />
            </div>
            <span className="text-[11px] font-mono text-muted-foreground tracking-wider">{ticket.ticket_code}</span>
          </div>
        </div>

        <div className="px-6 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase ${statusColor(ticket.status || 'confirmed')}`}>
              {ticket.status || 'Confirmed'}
            </span>
            {ticket.total_amount && (
              <span className="text-base font-bold text-foreground">
                {ticket.currency || 'TZS'} {ticket.total_amount.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <img src={NuruLogo} alt="Nuru" className="h-5 opacity-50" />
            <Button size="sm" onClick={handlePrint} className="gap-2">
              <img src={PrintIcon} alt="Print" className="w-4 h-4 invert" /> Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrintableTicket;
