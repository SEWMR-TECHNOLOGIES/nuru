import { useState } from "react";
import { Plus, Trash2, Edit2, Ticket, DollarSign, Users, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export interface TicketClass {
  id?: string;
  name: string;
  description: string;
  price: string;
  quantity: string;
  sold?: number;
}

interface EventTicketingProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  ticketClasses: TicketClass[];
  onTicketClassesChange: (classes: TicketClass[]) => void;
  isPublicEvent: boolean;
  onPublicChange: (isPublic: boolean) => void;
}

const EventTicketing = ({
  enabled,
  onEnabledChange,
  ticketClasses,
  onTicketClassesChange,
  isPublicEvent,
  onPublicChange,
}: EventTicketingProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<TicketClass>({
    name: "",
    description: "",
    price: "",
    quantity: "",
  });

  const openAddDialog = () => {
    setEditingIndex(null);
    setForm({ name: "", description: "", price: "", quantity: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    setEditingIndex(index);
    setForm({ ...ticketClasses[index] });
    setDialogOpen(true);
  };

  const saveTicketClass = () => {
    if (!form.name.trim()) {
      toast.error("Ticket class name is required");
      return;
    }
    if (!form.price || parseFloat(form.price.replace(/,/g, "")) <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }
    if (!form.quantity || parseInt(form.quantity.replace(/,/g, "")) <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }

    const updated = [...ticketClasses];
    if (editingIndex !== null) {
      updated[editingIndex] = form;
    } else {
      updated.push(form);
    }
    onTicketClassesChange(updated);
    setDialogOpen(false);
    toast.success(editingIndex !== null ? "Ticket class updated" : "Ticket class added");
  };

  const removeTicketClass = (index: number) => {
    const updated = ticketClasses.filter((_, i) => i !== index);
    onTicketClassesChange(updated);
    toast.success("Ticket class removed");
  };

  const formatPrice = (value: string) => {
    const numbers = value.replace(/[^\d]/g, "");
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Event Ticketing</CardTitle>
          </div>
          <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-4">
          {/* Public event toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Public Event</Label>
              <p className="text-xs text-muted-foreground">Allow anyone to discover and purchase tickets</p>
            </div>
            <Switch checked={isPublicEvent} onCheckedChange={onPublicChange} />
          </div>

          {/* Warning if no ticket classes */}
          {ticketClasses.length === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                You must add at least one ticket class with pricing to sell tickets.
              </p>
            </div>
          )}

          {/* Ticket classes list */}
          {ticketClasses.length > 0 && (
            <div className="space-y-2">
              {ticketClasses.map((tc, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground">{tc.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        TZS {tc.price}
                      </Badge>
                    </div>
                    {tc.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{tc.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {tc.sold || 0}/{tc.quantity} sold
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(index)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTicketClass(index)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" className="w-full gap-2" onClick={openAddDialog}>
            <Plus className="w-4 h-4" />
            Add Ticket Class
          </Button>

          {/* Add/Edit Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{editingIndex !== null ? "Edit" : "Add"} Ticket Class</DialogTitle>
                <DialogDescription>Set the name, price, and availability</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Class Name *</Label>
                  <Input
                    placeholder="e.g., VIP, Regular, Early Bird"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="What's included in this ticket?"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price (TZS) *</Label>
                    <Input
                      placeholder="50,000"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: formatPrice(e.target.value) })}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Available Qty *</Label>
                    <Input
                      placeholder="100"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: formatPrice(e.target.value) })}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={saveTicketClass}>
                  {editingIndex !== null ? "Update" : "Add"} Class
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      )}
    </Card>
  );
};

export default EventTicketing;
