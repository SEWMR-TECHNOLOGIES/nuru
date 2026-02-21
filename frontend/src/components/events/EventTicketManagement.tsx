import { useState, useEffect } from "react";
import { Loader2, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TicketIcon from "@/assets/icons/ticket-icon.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ticketingApi } from "@/lib/api/ticketing";
import { formatPrice } from "@/utils/formatPrice";
import { toast } from "sonner";

interface EventTicketManagementProps {
  eventId: string;
  isCreator: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-muted text-muted-foreground",
};

const EventTicketManagement = ({ eventId, isCreator }: EventTicketManagementProps) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketClasses, setTicketClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadTickets = async (p = 1) => {
    setLoading(true);
    try {
      const res = await ticketingApi.getEventTickets(eventId, { page: p, limit: 20 });
      if (res.success && res.data) {
        const data = res.data as any;
        setTickets(data.tickets || []);
        setPagination(data.pagination || null);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const loadClasses = async () => {
    try {
      const res = await ticketingApi.getMyTicketClasses(eventId);
      if (res.success && res.data) {
        setTicketClasses((res.data as any).ticket_classes || []);
      }
    } catch { /* silent */ }
  };

  useEffect(() => {
    loadTickets(page);
    loadClasses();
  }, [eventId, page]);

  const handleStatusUpdate = async (ticketId: string, status: 'approved' | 'rejected') => {
    setUpdatingId(ticketId);
    try {
      const res = await ticketingApi.updateTicketStatus(ticketId, status);
      if (res.success) {
        toast.success(`Ticket ${status}`);
        loadTickets(page);
        loadClasses();
      } else {
        toast.error((res as any).message || `Failed to ${status} ticket`);
      }
    } catch {
      toast.error(`Failed to ${status} ticket`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Summary
  // Calculate sold from ticket orders (approved/confirmed tickets)
  const soldFromOrders = tickets.reduce((sum: number, t: any) => {
    if (t.status === 'approved' || t.status === 'confirmed') return sum + (t.quantity || 0);
    return sum;
  }, 0);
  const totalSold = ticketClasses.reduce((sum: number, tc: any) => sum + (tc.sold || 0), 0) || soldFromOrders;
  const totalQuantity = ticketClasses.reduce((sum: number, tc: any) => sum + (tc.quantity || 0), 0);
  const totalRevenue = tickets.reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Ticket Classes</p>
            <p className="text-lg font-bold mt-1">{ticketClasses.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Tickets Sold</p>
            <p className="text-lg font-bold mt-1">{totalSold} / {totalQuantity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Orders</p>
            <p className="text-lg font-bold mt-1">{pagination?.total_items || tickets.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="text-lg font-bold text-primary mt-1">{formatPrice(totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ticket classes overview */}
      {ticketClasses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ticketClasses.map((tc: any) => (
            <div key={tc.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-xs">
              <img src={TicketIcon} alt="" className="w-3.5 h-3.5 dark:invert opacity-70" />
              <span className="font-medium">{tc.name}</span>
              <span className="text-muted-foreground">{tc.sold}/{tc.quantity}</span>
              <span className="text-primary font-semibold">{formatPrice(tc.price)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ticket orders list */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Ticket Orders
        </h3>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-10" />
                    <Skeleton className="h-3 w-14" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
            <img src={TicketIcon} alt="" className="w-10 h-10 mx-auto mb-3 dark:invert opacity-30" />
            <p className="text-sm text-muted-foreground">No ticket orders yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket: any) => (
              <div
                key={ticket.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                {/* Buyer info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{ticket.buyer_name || "Unknown"}</p>
                    <Badge variant="outline" className="text-[10px] h-4 font-mono tracking-wide">
                      {ticket.ticket_code}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                    {ticket.ticket_class && <span>{ticket.ticket_class}</span>}
                    <span>×{ticket.quantity}</span>
                    <span className="font-medium text-foreground">{formatPrice(ticket.total_amount)}</span>
                    {ticket.buyer_phone && <span>· {ticket.buyer_phone}</span>}
                  </div>
                </div>

                {/* Status */}
                <Badge className={`text-[10px] capitalize ${STATUS_STYLES[ticket.status] || STATUS_STYLES.pending}`}>
                  {ticket.status}
                </Badge>

                {/* Actions */}
                {isCreator && ticket.status !== 'cancelled' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {ticket.status !== 'approved' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                        disabled={updatingId === ticket.id}
                        onClick={() => handleStatusUpdate(ticket.id, 'approved')}
                        title="Approve"
                      >
                        {updatingId === ticket.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    {ticket.status !== 'rejected' && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        disabled={updatingId === ticket.id}
                        onClick={() => handleStatusUpdate(ticket.id, 'rejected')}
                        title="Reject"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_previous}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_next}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventTicketManagement;
