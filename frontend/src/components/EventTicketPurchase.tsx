import { useState, useEffect } from "react";
import { Loader2, AlertCircle, Minus, Plus } from "lucide-react";
import SvgIcon from '@/components/ui/svg-icon';
import TicketIcon from "@/assets/icons/ticket-icon.svg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ticketingApi, TicketClass } from "@/lib/api/ticketing";
import { formatPrice } from "@/utils/formatPrice";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface EventTicketPurchaseProps {
  eventId: string;
  eventName?: string;
}

const EventTicketPurchase = ({ eventId, eventName }: EventTicketPurchaseProps) => {
  const [classes, setClasses] = useState<TicketClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<TicketClass | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<{ ticket_code: string; total_amount: number } | null>(null);

  useEffect(() => {
    ticketingApi.getTicketClasses(eventId).then((res) => {
      if (res.success && res.data) {
        setClasses((res.data as any).ticket_classes || []);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [eventId]);

  const handlePurchase = async () => {
    if (!selectedClass) return;
    setPurchasing(true);
    try {
      const res = await ticketingApi.purchaseTicket({
        ticket_class_id: selectedClass.id,
        quantity,
      });
      if (res.success && res.data) {
        const data = res.data as any;
        setPurchaseResult({ ticket_code: data.ticket_code, total_amount: data.total_amount });
        toast.success("Ticket request sent! Awaiting organizer approval.");
        // Refresh classes
        const refresh = await ticketingApi.getTicketClasses(eventId);
        if (refresh.success && refresh.data) setClasses((refresh.data as any).ticket_classes || []);
      } else {
        toast.error(res.message || "Purchase failed");
      }
    } catch {
      toast.error("Failed to purchase ticket");
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="p-4 rounded-xl border-2 border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="text-right space-y-1">
                    <Skeleton className="h-6 w-20 ml-auto" />
                    <Skeleton className="h-3 w-14 ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (classes.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <Card className="border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <img src={TicketIcon} alt="Ticket" className="w-5 h-5 dark:invert" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Tickets</h2>
              <p className="text-xs text-muted-foreground">Select a ticket class to purchase</p>
            </div>
          </div>

          <div className="space-y-3">
            {classes.map((tc) => {
              const isSoldOut = tc.available <= 0;
              return (
                <div
                  key={tc.id}
                  onClick={() => !isSoldOut && setSelectedClass(tc)}
                  className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isSoldOut
                      ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                      : selectedClass?.id === tc.id
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30 shadow-md"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{tc.name}</h3>
                        {isSoldOut && (
                          <Badge variant="destructive" className="text-[10px]">Sold Out</Badge>
                        )}
                      </div>
                      {tc.description && (
                        <p className="text-sm text-muted-foreground mb-2">{tc.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{tc.available} of {tc.quantity} available</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-primary">{formatPrice(tc.price)}</p>
                      <p className="text-[10px] text-muted-foreground">per ticket</p>
                    </div>
                  </div>

                  {/* Selected indicator - subtle left accent bar */}
                  {selectedClass?.id === tc.id && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 rounded-full bg-primary" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Purchase action */}
          {selectedClass && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 pt-4 border-t border-border space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Quantity</span>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="text-lg font-semibold w-8 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQuantity(Math.min(selectedClass.available, quantity + 1))}
                    disabled={quantity >= selectedClass.available}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{selectedClass.name} × {quantity}</span>
                <span className="font-bold text-foreground">{formatPrice(selectedClass.price * quantity)}</span>
              </div>

              <Button
                className="w-full gap-2"
                size="lg"
                onClick={handlePurchase}
                disabled={purchasing}
              >
                {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src={TicketIcon} alt="Ticket" className="w-4 h-4 invert" />}
                Purchase Ticket{quantity > 1 ? "s" : ""}
              </Button>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Success dialog */}
      <Dialog open={!!purchaseResult} onOpenChange={() => { setPurchaseResult(null); setSelectedClass(null); setQuantity(1); }}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Ticket Request Sent!
            </DialogTitle>
            <DialogDescription>Your ticket is pending approval by the event organizer</DialogDescription>
          </DialogHeader>
          {purchaseResult && (
            <div className="space-y-3 py-2">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground mb-1">Ticket Code</p>
                <p className="text-xl font-mono font-bold text-foreground tracking-wider">{purchaseResult.ticket_code}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{formatPrice(purchaseResult.total_amount)}</span>
              </p>
            </div>
          )}
          <Button className="w-full" onClick={() => { setPurchaseResult(null); setSelectedClass(null); setQuantity(1); }}>
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default EventTicketPurchase;
