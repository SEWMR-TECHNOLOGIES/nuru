import { useState } from 'react';
import { Check, X, Clock, Users, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useEventGuests } from '@/data/useEvents';
import { showApiErrors, showCaughtError } from '@/lib/api';

const EventRSVP = ({ eventId }: { eventId: string }) => {
  const { toast } = useToast();
  const { guests, summary, loading, addGuest, sendInvitation } = useEventGuests(eventId || null);

  const [showAddGuest, setShowAddGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ name: '', email: '', phone: '' });

  const stats = {
    attending: summary?.confirmed || 0,
    declined: summary?.declined || 0,
    pending: summary?.pending || 0,
    total: summary?.total || 0,
  };

  const handleAddGuest = async () => {
    if (!newGuest.name || !newGuest.email) {
      toast({
        title: "Missing Information",
        description: "Please provide at least name and email.",
        variant: "destructive"
      });
      return;
    }

    try {
      await addGuest({
        name: newGuest.name,
        email: newGuest.email,
        phone: newGuest.phone || undefined,
      });
      toast({ title: "Guest Added", description: "Guest has been added successfully." });
      setNewGuest({ name: '', email: '', phone: '' });
      setShowAddGuest(false);
    } catch (err: any) {
      showCaughtError(err, "Failed to add guest");
    }
  };

  const handleResendInvite = async (guestId: string) => {
    try {
      await sendInvitation(guestId, "email");
      toast({ title: "Invitation Sent", description: "Invitation has been resent." });
    } catch (err: any) {
      showCaughtError(err, "Failed to send invitation");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><Check className="w-3 h-3 mr-1" />Confirmed</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><X className="w-3 h-3 mr-1" />Declined</Badge>;
      case 'maybe':
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100"><Clock className="w-3 h-3 mr-1" />Maybe</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground">Loading guests...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.attending}</div>
            <p className="text-sm text-muted-foreground">Confirmed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
            <p className="text-sm text-muted-foreground">Declined</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Invited</p>
          </CardContent>
        </Card>
      </div>

      {/* Guest List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Guest List</CardTitle>
          <Button onClick={() => setShowAddGuest(!showAddGuest)}>
            {showAddGuest ? 'Cancel' : 'Add Guest'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddGuest && (
            <Card className="bg-muted/50">
              <CardContent className="p-4 space-y-3">
                <Input
                  placeholder="Guest Name *"
                  value={newGuest.name}
                  onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                />
                <Input
                  type="email"
                  placeholder="Email Address *"
                  value={newGuest.email}
                  onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                />
                <Input
                  placeholder="Phone Number"
                  value={newGuest.phone}
                  onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                />
                <Button onClick={handleAddGuest} className="w-full">
                  Add Guest
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {guests.map((guest) => (
              <Card key={guest.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{guest.name}</h3>
                        {getStatusBadge(guest.rsvp_status)}
                        {guest.plus_ones > 0 && (
                          <Badge variant="outline" className="text-xs">+{guest.plus_ones}</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {guest.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{guest.email}</span>
                          </div>
                        )}
                        {guest.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <span>{guest.phone}</span>
                          </div>
                        )}
                        {guest.dietary_requirements && (
                          <p className="text-xs">
                            <span className="font-medium">Dietary:</span> {guest.dietary_requirements}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {guest.rsvp_status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => handleResendInvite(guest.id)}>
                          Resend Invite
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {guests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No guests added yet. Click "Add Guest" to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventRSVP;
