import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import SvgIcon from '@/components/ui/svg-icon';
import TicketIcon from "@/assets/icons/ticket-icon.svg";
import CalendarIcon from "@/assets/icons/calendar-icon.svg";
import PrintIcon from "@/assets/icons/print-icon.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ticketingApi } from "@/lib/api/ticketing";
import { formatPrice } from "@/utils/formatPrice";
import { getEventCountdown } from "@/utils/getEventCountdown";
import { motion } from "framer-motion";
import PrintableTicket from "@/components/PrintableTicket";
import CountdownClock from "@/components/CountdownClock";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

// Module-level cache
let _ticketsCache: any[] = [];
let _ticketsPagination: any = null;
let _upcomingCache: any[] = [];
let _ticketsHasLoaded = false;

const TicketCardSkeleton = () => (
  <div className="relative overflow-hidden rounded-xl border border-border bg-card">
    <div className="absolute left-[72px] top-[-8px] w-4 h-4 rounded-full bg-background border border-border z-10" />
    <div className="absolute left-[72px] bottom-[-8px] w-4 h-4 rounded-full bg-background border border-border z-10" />
    <div className="absolute left-[80px] top-2 bottom-2 border-l border-dashed border-border/60 z-[5]" />
    <div className="flex">
      <div className="flex flex-col items-center justify-center w-[80px] py-4 shrink-0 bg-muted/20">
        <Skeleton className="h-7 w-8 mb-1" />
        <Skeleton className="h-3 w-6 mb-0.5" />
        <Skeleton className="h-2 w-8" />
      </div>
      <div className="flex-1 min-w-0 p-3 pl-5 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-4 w-20 rounded" />
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-32 rounded-full" />
      </div>
      <div className="flex items-center justify-center px-3 border-l border-dashed border-border">
        <Skeleton className="w-4 h-4" />
      </div>
    </div>
  </div>
);

const UpcomingSidebarSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <Card key={i} className="overflow-hidden">
        <Skeleton className="h-24 w-full" />
        <CardContent className="p-2.5 space-y-1.5">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-2.5 w-1/2" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const MyTickets = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>(_ticketsCache);
  const [loading, setLoading] = useState(!_ticketsHasLoaded);
  const initialLoad = useRef(!_ticketsHasLoaded);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(_ticketsPagination);
  const [upcomingTickets, setUpcomingTickets] = useState<any[]>(_upcomingCache);
  const [printTicket, setPrintTicket] = useState<any>(null);

  useEffect(() => {
    if (initialLoad.current) setLoading(true);
    Promise.all([
      ticketingApi.getMyTickets({ page, limit: 20 }),
      ticketingApi.getMyUpcomingTickets(),
    ]).then(([ticketRes, upRes]) => {
      if (ticketRes.success && ticketRes.data) {
        const d = ticketRes.data as any;
        const t = d.tickets || [];
        _ticketsCache = t;
        _ticketsPagination = d.pagination || null;
        _ticketsHasLoaded = true;
        setTickets(t);
        setPagination(d.pagination || null);
      }
      if (upRes.success && upRes.data) {
        const up = (upRes.data as any).tickets || [];
        _upcomingCache = up;
        setUpcomingTickets(up);
      }
    }).catch(() => {}).finally(() => {
      setLoading(false);
      initialLoad.current = false;
    });
  }, [page]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <img src={TicketIcon} alt="Tickets" className="w-5 h-5 dark:invert" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Tickets</h1>
            <p className="text-sm text-muted-foreground">All your purchased event tickets</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main ticket list */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <TicketCardSkeleton key={i} />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
              <img src={TicketIcon} alt="" className="w-12 h-12 mx-auto mb-4 dark:invert opacity-20" />
              <p className="text-muted-foreground font-medium">No tickets yet</p>
              <p className="text-xs text-muted-foreground mt-1">Browse events and purchase tickets to see them here</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/tickets")}>
                Browse Tickets
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket, i) => {
                const event = ticket.event || {};
                const countdown = getEventCountdown(event.start_date);
                const d = event.start_date ? new Date(event.start_date) : null;
                return (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    {/* Ticket-shaped card */}
                    <div
                      className="relative overflow-hidden rounded-xl border border-border bg-card hover:shadow-lg hover:border-primary/20 transition-all cursor-pointer group"
                      onClick={() => event.id && navigate(`/event/${event.id}`)}
                    >
                      {/* Perforated circles */}
                      <div className="absolute left-[72px] top-[-8px] w-4 h-4 rounded-full bg-background border border-border z-10" />
                      <div className="absolute left-[72px] bottom-[-8px] w-4 h-4 rounded-full bg-background border border-border z-10" />
                      
                      {/* Dashed separator line */}
                      <div className="absolute left-[80px] top-2 bottom-2 border-l border-dashed border-border/60 z-[5]" />
                      
                      <div className="flex">
                        {/* Left stub - date block */}
                        {d ? (
                          <div className={`flex flex-col items-center justify-center w-[80px] py-4 shrink-0 ${
                            countdown?.isPast ? 'bg-muted/30' : 'bg-primary/5'
                          }`}>
                            <span className={`text-2xl font-bold leading-none ${countdown?.isPast ? 'text-muted-foreground' : 'text-primary'}`}>
                              {d.getDate()}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${countdown?.isPast ? 'text-muted-foreground' : 'text-primary'}`}>
                              {d.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                            <span className="text-[9px] text-muted-foreground mt-0.5">
                              {d.getFullYear()}
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center w-[80px] py-4 shrink-0 bg-muted/20">
                            <img src={TicketIcon} alt="" className="w-6 h-6 dark:invert opacity-30" />
                          </div>
                        )}
                        
                        {/* Main ticket body */}
                        <div className="flex-1 min-w-0 p-3 pl-5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-foreground text-sm truncate">{event.name || ticket.ticket_class_name || "Event"}</h3>
                            <Badge className={`text-[10px] capitalize shrink-0 border-0 ${STATUS_STYLES[ticket.status] || STATUS_STYLES.pending}`}>
                              {ticket.status}
                            </Badge>
                          </div>
                          {event.location && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 truncate">
                              <MapPin className="w-3 h-3 flex-shrink-0" />
                              {event.location}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono tracking-wide">
                              {ticket.ticket_code}
                            </Badge>
                            {ticket.ticket_class_name && (
                              <span className="text-[9px] text-muted-foreground">{ticket.ticket_class_name}</span>
                            )}
                            {ticket.quantity > 1 && (
                              <span className="text-[9px] text-muted-foreground">×{ticket.quantity}</span>
                            )}
                            <span className="text-[9px] font-semibold text-foreground">{formatPrice(ticket.total_amount)}</span>
                          </div>
                          {/* Digital countdown */}
                          {event.start_date && (
                            <div className="mt-2">
                              <CountdownClock targetDate={event.start_date} compact />
                            </div>
                          )}
                        </div>
                        
                        {/* Print button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrintTicket({
                              ticket_code: ticket.ticket_code,
                              event_title: event.name || "Event",
                              event_date: event.start_date,
                              event_time: event.start_time?.slice(0, 5),
                              event_location: event.location,
                              ticket_class: ticket.ticket_class_name,
                              quantity: ticket.quantity,
                              buyer_name: ticket.buyer_name,
                              total_amount: ticket.total_amount,
                              currency: ticket.currency,
                              status: ticket.status,
                            });
                          }}
                          className="flex items-center justify-center px-3 border-l border-dashed border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Print ticket"
                        >
                          <img src={PrintIcon} alt="Print" className="w-4 h-4 dark:invert" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={!pagination.has_previous} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.total_pages}</span>
              <Button variant="outline" size="sm" disabled={!pagination.has_next} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Right sidebar - upcoming tickets */}
        <div className="space-y-4">
          {loading ? (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Upcoming Events
              </h3>
              <UpcomingSidebarSkeleton />
            </div>
          ) : upcomingTickets.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Upcoming Events
              </h3>
              <div className="space-y-3">
                {upcomingTickets.slice(0, 3).map((ticket) => {
                  const event = ticket.event || {};
                  const d = event.start_date ? new Date(event.start_date) : null;
                  const countdown = getEventCountdown(event.start_date);
                  return (
                    <Card
                      key={ticket.id}
                      className="overflow-hidden hover:shadow-md hover:border-primary/20 cursor-pointer transition-all group"
                      onClick={() => event.id && navigate(`/event/${event.id}`)}
                    >
                      {/* Cover image */}
                      <div className="relative h-24 bg-muted overflow-hidden">
                        {event.cover_image ? (
                          <img src={event.cover_image} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                            <img src={TicketIcon} alt="" className="w-6 h-6 dark:invert opacity-20" />
                          </div>
                        )}
                        {/* Date overlay */}
                        {d && (
                          <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-sm text-center min-w-[40px]">
                            <span className="block text-sm font-bold leading-none text-primary">{d.getDate()}</span>
                            <span className="block text-[8px] font-bold uppercase tracking-wider text-primary mt-0.5">
                              {d.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-2.5">
                        <p className="text-xs font-semibold text-foreground truncate">{event.name}</p>
                        {event.location && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                            {event.location}
                          </p>
                        )}
                        {/* Digital countdown */}
                        {event.start_date && (
                          <div className="mt-1.5">
                            <CountdownClock targetDate={event.start_date} compact />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {printTicket && (
        <PrintableTicket
          ticket={printTicket}
          open={!!printTicket}
          onClose={() => setPrintTicket(null)}
        />
      )}
    </div>
  );
};

export default MyTickets;
