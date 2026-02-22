import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Calendar, MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import TicketIcon from "@/assets/icons/ticket-icon.svg";
import PrintIcon from "@/assets/icons/print-icon.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ticketingApi } from "@/lib/api/ticketing";
import { formatPrice } from "@/utils/formatPrice";
import { getEventCountdown } from "@/utils/getEventCountdown";
import { motion } from "framer-motion";
import PrintableTicket from "@/components/PrintableTicket";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

const MyTickets = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [upcomingTickets, setUpcomingTickets] = useState<any[]>([]);
  const [printTicket, setPrintTicket] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ticketingApi.getMyTickets({ page, limit: 20 }),
      ticketingApi.getMyUpcomingTickets(),
    ]).then(([ticketRes, upRes]) => {
      if (ticketRes.success && ticketRes.data) {
        const d = ticketRes.data as any;
        setTickets(d.tickets || []);
        setPagination(d.pagination || null);
      }
      if (upRes.success && upRes.data) {
        setUpcomingTickets((upRes.data as any).tickets || []);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <img src={TicketIcon} alt="Tickets" className="w-5 h-5 dark:invert" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">My Tickets</h1>
          <p className="text-sm text-muted-foreground">All your purchased event tickets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main ticket list */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </CardContent>
                </Card>
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
                return (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="hover:shadow-md hover:border-primary/20 transition-all cursor-pointer" onClick={() => event.id && navigate(`/event/${event.id}`)}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                            {event.cover_image ? (
                              <img src={event.cover_image} alt={event.name} className="w-full h-full object-cover" />
                            ) : (
                              <img src={TicketIcon} alt="" className="w-6 h-6 dark:invert opacity-40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-foreground text-sm truncate">{event.name || ticket.ticket_class_name || "Event"}</h3>
                              <Badge className={`text-[10px] capitalize shrink-0 ${STATUS_STYLES[ticket.status] || STATUS_STYLES.pending}`}>
                                {ticket.status}
                              </Badge>
                            </div>
                            {event.start_date && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(event.start_date)}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono tracking-wide">
                                {ticket.ticket_code}
                              </Badge>
                              {ticket.ticket_class_name && (
                                <span className="text-[10px] text-muted-foreground">{ticket.ticket_class_name}</span>
                              )}
                              {ticket.quantity > 1 && (
                                <span className="text-[10px] text-muted-foreground">×{ticket.quantity}</span>
                              )}
                              <span className="text-[10px] font-medium text-foreground">{formatPrice(ticket.total_amount)}</span>
                            </div>
                            {/* Countdown */}
                            {countdown && (
                              <div className={`mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                                countdown.isPast
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-primary/10 text-primary'
                              }`}>
                                {countdown.text}
                              </div>
                            )}
                          </div>
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
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            title="Print ticket"
                          >
                            <img src={PrintIcon} alt="Print" className="w-4 h-4 dark:invert" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
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
          {upcomingTickets.length > 0 && (
            <Card className="border-primary/10">
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                  Upcoming
                </h3>
                <div className="space-y-3">
                  {upcomingTickets.slice(0, 3).map((ticket) => {
                    const event = ticket.event || {};
                    const countdown = getEventCountdown(event.start_date);
                    return (
                      <div
                        key={ticket.id}
                        className="flex gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => event.id && navigate(`/event/${event.id}`)}
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {event.cover_image ? (
                            <img src={event.cover_image} alt={event.name} className="w-full h-full object-cover" />
                          ) : (
                            <img src={TicketIcon} alt="" className="w-4 h-4 dark:invert opacity-50" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{event.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {event.start_date ? new Date(event.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD"}
                          </p>
                          {countdown && !countdown.isPast && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide uppercase bg-primary/10 text-primary mt-1">{countdown.text}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
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
