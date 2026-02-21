import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, MapPin, Calendar, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import TicketIcon from "@/assets/icons/ticket-icon.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ticketingApi, TicketClass } from "@/lib/api/ticketing";
import { formatPrice } from "@/utils/formatPrice";
import { toast } from "sonner";
import { motion } from "framer-motion";

const BrowseTickets = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Purchase flow
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [ticketClasses, setTicketClasses] = useState<TicketClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClass, setSelectedClass] = useState<TicketClass | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<any>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");

  const loadEvents = async (p = 1, search = "") => {
    setLoading(true);
    try {
      const res = await ticketingApi.getTicketedEvents({ page: p, limit: 12, search: search || undefined });
      if (res.success && res.data) {
        const data = res.data as any;
        setEvents(data.events || []);
        setPagination(data.pagination || null);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadEvents(page, debouncedSearch); }, [page, debouncedSearch]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const openEventTickets = async (event: any) => {
    setSelectedEvent(event);
    setSelectedClass(null);
    setQuantity(1);
    setPurchaseResult(null);
    setLoadingClasses(true);
    try {
      const res = await ticketingApi.getTicketClasses(event.id);
      if (res.success && res.data) {
        setTicketClasses((res.data as any).ticket_classes || []);
      }
    } catch {}
    finally { setLoadingClasses(false); }
  };

  const handlePurchase = async () => {
    if (!selectedClass) return;
    setPurchasing(true);
    try {
      const res = await ticketingApi.purchaseTicket({ ticket_class_id: selectedClass.id, quantity });
      if (res.success && res.data) {
        const data = res.data as any;
        setPurchaseResult({ ticket_code: data.ticket_code, total_amount: data.total_amount });
        toast.success("Ticket request sent! Awaiting organizer approval.");
      } else {
        toast.error((res as any).message || "Purchase failed");
      }
    } catch { toast.error("Failed to purchase ticket"); }
    finally { setPurchasing(false); }
  };

  // Events are already filtered server-side
  const filteredEvents = events;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <img src={TicketIcon} alt="Tickets" className="w-5 h-5 dark:invert" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Browse Tickets</h1>
            <p className="text-sm text-muted-foreground">Find events and purchase tickets</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search events by name or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="h-40 bg-muted" />
              <CardContent className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl">
          <img src={TicketIcon} alt="" className="w-12 h-12 mx-auto mb-4 dark:invert opacity-20" />
          <p className="text-muted-foreground font-medium">No ticketed events found</p>
          <p className="text-xs text-muted-foreground mt-1">Check back later for upcoming events</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className="overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
                onClick={() => openEventTickets(event)}
              >
                <div className="relative h-40 bg-muted overflow-hidden">
                  {event.cover_image ? (
                    <img src={event.cover_image} alt={event.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <img src={TicketIcon} alt="" className="w-10 h-10 dark:invert opacity-20" />
                    </div>
                  )}
                  {/* Price badge */}
                  <div className="absolute bottom-3 left-3">
                    <Badge className="bg-primary text-primary-foreground shadow-lg text-xs font-bold px-2.5 py-1">
                      From {formatPrice(event.min_price)}
                    </Badge>
                  </div>
                  {event.total_available <= 0 && (
                    <div className="absolute top-3 right-3">
                      <Badge variant="destructive" className="text-xs font-bold">Sold Out</Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-foreground text-sm line-clamp-2 mb-2">{event.name}</h3>
                  <div className="space-y-1">
                    {event.start_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                    {event.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {event.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="outline" className="text-[10px]">
                      {event.ticket_class_count} class{event.ticket_class_count !== 1 ? 'es' : ''}
                    </Badge>
                    {event.total_available > 0 && (
                      <span className="text-[10px] text-muted-foreground">{event.total_available} tickets left</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={!pagination.has_previous} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {pagination.page} of {pagination.total_pages}</span>
          <Button variant="outline" size="sm" disabled={!pagination.has_next} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Purchase Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) { setSelectedEvent(null); setPurchaseResult(null); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          {selectedEvent && (
            <>
              {/* Event cover */}
              {selectedEvent.cover_image && (
                <div className="h-36 overflow-hidden">
                  <img src={selectedEvent.cover_image} alt={selectedEvent.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="font-bold text-foreground text-lg">{selectedEvent.name}</h2>
                  {selectedEvent.start_date && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(selectedEvent.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {selectedEvent.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {selectedEvent.location}
                    </p>
                  )}
                </div>

                {purchaseResult ? (
                  <div className="text-center space-y-3 py-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                      <img src={TicketIcon} alt="" className="w-7 h-7 dark:invert" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">Ticket Request Sent!</p>
                      <p className="text-xs text-muted-foreground">Awaiting organizer approval</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Ticket Code</p>
                      <p className="text-lg font-mono font-bold text-foreground tracking-wider">{purchaseResult.ticket_code}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total: <span className="font-semibold text-foreground">{formatPrice(purchaseResult.total_amount)}</span>
                    </p>
                    <Button className="w-full" onClick={() => { setSelectedEvent(null); setPurchaseResult(null); }}>Done</Button>
                  </div>
                ) : loadingClasses ? (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading tickets...</span>
                  </div>
                ) : ticketClasses.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">No ticket classes available</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {ticketClasses.map((tc) => {
                        const isSoldOut = tc.available <= 0;
                        return (
                          <div
                            key={tc.id}
                            onClick={() => !isSoldOut && setSelectedClass(tc)}
                            className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                              isSoldOut
                                ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                                : selectedClass?.id === tc.id
                                  ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-md"
                                  : "border-border hover:border-primary/40"
                            }`}
                          >
                            {selectedClass?.id === tc.id && <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-primary" />}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-foreground text-sm">{tc.name}</h3>
                                  {isSoldOut && <Badge variant="destructive" className="text-[10px]">Sold Out</Badge>}
                                </div>
                                {tc.description && <p className="text-xs text-muted-foreground mb-1">{tc.description}</p>}
                                <p className="text-[11px] text-muted-foreground">{tc.available} of {tc.quantity} available</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-lg font-bold text-primary">{formatPrice(tc.price)}</p>
                                <p className="text-[10px] text-muted-foreground">per ticket</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedClass && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pt-3 border-t border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Quantity</span>
                          <div className="flex items-center gap-3">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="text-lg font-semibold w-8 text-center">{quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQuantity(Math.min(selectedClass.available, quantity + 1))} disabled={quantity >= selectedClass.available}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{selectedClass.name} × {quantity}</span>
                          <span className="font-bold">{formatPrice(selectedClass.price * quantity)}</span>
                        </div>
                        <Button className="w-full gap-2" size="lg" onClick={handlePurchase} disabled={purchasing}>
                          {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src={TicketIcon} alt="" className="w-4 h-4 invert" />}
                          Purchase Ticket{quantity > 1 ? 's' : ''}
                        </Button>
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrowseTickets;