import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, XCircle, Calendar, MapPin, Clock, User, Ticket, Phone, Mail, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import NuruLogo from '@/assets/nuru-logo.png';
import { get, put } from '@/lib/api/helpers';
import { motion, AnimatePresence } from 'framer-motion';

interface TicketInfo {
  ticket_code: string;
  event_title: string;
  event_date?: string;
  event_time?: string;
  event_location?: string;
  event_cover?: string;
  ticket_class?: string;
  ticket_class_price?: number;
  quantity: number;
  buyer_name?: string;
  buyer_phone?: string;
  buyer_email?: string;
  buyer_avatar?: string;
  total_amount?: number;
  currency?: string;
  status: string;
  checked_in: boolean;
  checked_in_at?: string;
  event_id?: string;
  purchased_at?: string;
}

const TicketVerification = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInResult, setCheckInResult] = useState<'success' | 'already' | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    get<{ ticket: TicketInfo }>(`/ticketing/verify/${code}`)
      .then((res) => {
        if (res.success && res.data) {
          setTicket((res.data as any).ticket);
        } else {
          setError(res.message || 'Ticket not found');
        }
      })
      .catch(() => setError('Failed to verify ticket'))
      .finally(() => setLoading(false));
  }, [code]);

  const handleCheckIn = async () => {
    if (!code || !ticket) return;
    setCheckingIn(true);
    try {
      const res = await put<any>(`/ticketing/verify/${code}/check-in`, {});
      if (res.success) {
        setCheckInResult('success');
        setTicket(prev => prev ? { ...prev, checked_in: true, checked_in_at: (res.data as any)?.checked_in_at || new Date().toISOString() } : prev);
      } else {
        if (res.message?.includes('already')) {
          setCheckInResult('already');
        } else {
          setError(res.message || 'Check-in failed');
        }
      }
    } catch {
      setError('Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

  const formatTime = (timeStr: string) => {
    try {
      const [h, m] = timeStr.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      return `${hour % 12 || 12}:${m} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const isValid = ticket ? ['confirmed', 'approved'].includes(ticket.status) : false;
  const canCheckIn = isValid && !ticket?.checked_in;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#111827] to-[#0f172a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <img src={NuruLogo} alt="Nuru" className="h-8 mx-auto opacity-60" />
          <Loader2 className="w-8 h-8 animate-spin text-white/50 mx-auto" />
          <p className="text-white/40 text-sm">Verifying ticket...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#111827] to-[#0f172a] flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
          <Card className="border-red-500/20 bg-card/95 backdrop-blur-xl shadow-2xl">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Invalid Ticket</h1>
              <p className="text-muted-foreground text-sm">{error || 'This ticket code is invalid or does not exist.'}</p>
              <Button onClick={() => navigate('/')} variant="outline" size="sm">Go Home</Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#111827] to-[#0f172a] flex items-center justify-center p-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-4"
      >
        {/* Logo */}
        <div className="text-center">
          <img src={NuruLogo} alt="Nuru" className="h-7 mx-auto opacity-60" />
        </div>

        {/* Main Card */}
        <Card className="overflow-hidden border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl">
          {/* Status Banner */}
          <div className={`relative px-6 py-5 text-center ${
            ticket.checked_in || checkInResult === 'success'
              ? 'bg-gradient-to-r from-amber-500/20 via-amber-600/20 to-amber-500/20'
              : isValid
                ? 'bg-gradient-to-r from-emerald-500/20 via-emerald-600/20 to-emerald-500/20'
                : 'bg-gradient-to-r from-red-500/20 via-red-600/20 to-red-500/20'
          }`}>
            <AnimatePresence mode="wait">
              {(ticket.checked_in || checkInResult === 'success') ? (
                <motion.div key="used" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-1">
                  <ShieldCheck className="w-10 h-10 mx-auto text-amber-500" />
                  <p className="text-amber-400 font-bold text-lg">ALREADY USED</p>
                  <p className="text-amber-300/70 text-xs">
                    Checked in {ticket.checked_in_at ? `at ${new Date(ticket.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'recently'}
                  </p>
                </motion.div>
              ) : isValid ? (
                <motion.div key="valid" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-1">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
                  <p className="text-emerald-400 font-bold text-lg">VALID TICKET</p>
                  <p className="text-emerald-300/70 text-xs">Ready for check-in</p>
                </motion.div>
              ) : (
                <motion.div key="invalid" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-1">
                  <AlertTriangle className="w-10 h-10 mx-auto text-red-500" />
                  <p className="text-red-400 font-bold text-lg">
                    {ticket.status === 'pending' ? 'PENDING APPROVAL' : ticket.status === 'rejected' ? 'REJECTED' : ticket.status.toUpperCase()}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <CardContent className="p-0">
            {/* Buyer Profile Section */}
            <div className="px-6 py-5 flex items-center gap-4 border-b border-white/5">
              <Avatar className="w-16 h-16 ring-2 ring-white/10">
                {ticket.buyer_avatar ? (
                  <AvatarImage src={ticket.buyer_avatar} alt={ticket.buyer_name || 'Buyer'} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-foreground text-lg font-bold">
                  {getInitials(ticket.buyer_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">{ticket.buyer_name || 'Unknown'}</h2>
                {ticket.buyer_phone && (
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-0.5">
                    <Phone className="w-3 h-3" />
                    <span>{ticket.buyer_phone}</span>
                  </div>
                )}
                {ticket.buyer_email && (
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-0.5">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{ticket.buyer_email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Event Info */}
            <div className="px-6 py-4 border-b border-white/5 space-y-3">
              <h3 className="text-base font-bold text-foreground">{ticket.event_title}</h3>
              {ticket.ticket_class && (
                <Badge variant="secondary" className="text-[10px] tracking-[2px] uppercase font-semibold">
                  {ticket.ticket_class}
                </Badge>
              )}
              <div className="space-y-2 mt-2">
                {ticket.event_date && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{formatDate(ticket.event_date)}</span>
                  </div>
                )}
                {ticket.event_time && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{formatTime(ticket.event_time)}</span>
                  </div>
                )}
                {ticket.event_location && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{ticket.event_location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ticket Details Grid */}
            <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-white/5">
              <div className="space-y-0.5">
                <p className="text-[9px] tracking-[2px] uppercase text-muted-foreground font-medium">Ticket Code</p>
                <p className="font-mono text-sm font-bold tracking-wider text-foreground">{ticket.ticket_code}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-[9px] tracking-[2px] uppercase text-muted-foreground font-medium">Quantity</p>
                <p className="text-sm font-bold text-foreground">{ticket.quantity} {ticket.quantity > 1 ? 'tickets' : 'ticket'}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] tracking-[2px] uppercase text-muted-foreground font-medium">Total Paid</p>
                <p className="text-sm font-bold text-foreground">{ticket.currency || 'TZS'} {ticket.total_amount?.toLocaleString()}</p>
              </div>
              <div className="space-y-0.5 text-right">
                <p className="text-[9px] tracking-[2px] uppercase text-muted-foreground font-medium">Status</p>
                <Badge className={`text-[10px] border-0 ${
                  ticket.checked_in ? 'bg-amber-500/20 text-amber-400' :
                  isValid ? 'bg-emerald-500/20 text-emerald-400' :
                  ticket.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {ticket.checked_in ? 'Used' : ticket.status}
                </Badge>
              </div>
              {ticket.purchased_at && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-[9px] tracking-[2px] uppercase text-muted-foreground font-medium">Purchased</p>
                  <p className="text-xs text-muted-foreground">{formatDate(ticket.purchased_at)}</p>
                </div>
              )}
            </div>

            {/* Check-in Action */}
            <div className="px-6 py-5">
              <AnimatePresence mode="wait">
                {checkInResult === 'success' ? (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center space-y-2 py-2"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <p className="text-emerald-400 font-bold">Checked In Successfully!</p>
                    <p className="text-muted-foreground text-xs">Guest may now enter the event</p>
                  </motion.div>
                ) : canCheckIn ? (
                  <motion.div key="action" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Button
                      onClick={handleCheckIn}
                      disabled={checkingIn}
                      className="w-full h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-base rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
                    >
                      {checkingIn ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 mr-2" />
                      )}
                      {checkingIn ? 'Checking In...' : 'Check In Attendee'}
                    </Button>
                  </motion.div>
                ) : ticket.checked_in ? (
                  <motion.div key="already" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-2">
                    <p className="text-amber-400/80 text-sm font-medium">This ticket has already been used</p>
                    {ticket.checked_in_at && (
                      <p className="text-muted-foreground text-xs mt-1">
                        Checked in at {new Date(ticket.checked_in_at).toLocaleString()}
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <div className="text-center py-2">
                    <p className="text-red-400/80 text-sm font-medium">
                      Ticket is {ticket.status} — cannot check in
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 opacity-40">
          <img src={NuruLogo} alt="Nuru" className="h-4" />
          <span className="text-[10px] text-white/60 tracking-wider uppercase">Powered by Nuru</span>
        </div>
      </motion.div>
    </div>
  );
};

export default TicketVerification;
