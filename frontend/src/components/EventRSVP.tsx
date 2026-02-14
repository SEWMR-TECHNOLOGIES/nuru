import { useState } from 'react';
import { Check, X, Clock, Users, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useEventGuests } from '@/data/useEvents';
import { usePolling } from '@/hooks/usePolling';
import { showCaughtError } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import UserSearchInput from './events/UserSearchInput';
import RSVPSkeletonLoader from './events/RSVPSkeletonLoader';
import type { SearchedUser } from '@/hooks/useUserSearch';
import type { EventPermissions } from '@/hooks/useEventPermissions';

interface EventRSVPProps {
  eventId: string;
  permissions?: EventPermissions;
}

const EventRSVP = ({ eventId, permissions }: EventRSVPProps) => {
  const canManageGuests = permissions?.can_manage_guests || permissions?.is_creator;
  const { toast } = useToast();
  const { guests, summary, loading, addGuest, sendInvitation, refetch } = useEventGuests(eventId || null);
  usePolling(refetch, 15000);

  const [showAddGuest, setShowAddGuest] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

  const stats = {
    attending: summary?.confirmed || 0,
    declined: summary?.declined || 0,
    pending: summary?.pending || 0,
    total: summary?.total || 0,
  };

  const handleUserSelected = async (user: SearchedUser) => {
    setIsSubmitting(true);
    try {
      await addGuest({
        user_id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        phone: user.phone || undefined,
      });
      toast({ title: "Guest Added", description: `${user.first_name} ${user.last_name} has been added.` });
      setShowAddGuest(false);
    } catch (err: any) {
      showCaughtError(err, "Failed to add guest");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvite = async (guestId: string) => {
    setSendingInvite(guestId);
    try {
      await sendInvitation(guestId, "email");
      toast({ title: "Invitation Sent", description: "Invitation has been resent." });
    } catch (err: any) {
      showCaughtError(err, "Failed to send invitation");
    } finally {
      setSendingInvite(null);
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

  if (loading) return <RSVPSkeletonLoader />;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">{stats.attending}</div><p className="text-sm text-muted-foreground">Confirmed</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-orange-600">{stats.pending}</div><p className="text-sm text-muted-foreground">Pending</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-red-600">{stats.declined}</div><p className="text-sm text-muted-foreground">Declined</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><p className="text-sm text-muted-foreground">Total Invited</p></CardContent></Card>
      </div>

      {/* Guest List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Guest List</CardTitle>
          {canManageGuests && (
            <Button onClick={() => setShowAddGuest(!showAddGuest)} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : (showAddGuest ? 'Cancel' : 'Add Guest')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddGuest && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-2">Search for a Nuru user to add as guest</p>
                <UserSearchInput onSelect={handleUserSelected} placeholder="Search by email or phone..." />
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {guests.map((guest) => (
              <Card key={guest.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar>
                        <AvatarImage src={guest.avatar || undefined} />
                        <AvatarFallback>{(guest.name || 'G').charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{guest.name}</h3>
                          {getStatusBadge(guest.rsvp_status)}
                          {guest.plus_ones > 0 && <Badge variant="outline" className="text-xs">+{guest.plus_ones}</Badge>}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {guest.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3" /><span className="truncate">{guest.email}</span></div>}
                          {guest.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" /><span>{guest.phone}</span></div>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {guest.rsvp_status === 'pending' && (
                        <Button size="sm" variant="outline" onClick={() => handleResendInvite(guest.id)} disabled={sendingInvite === guest.id}>
                          {sendingInvite === guest.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resend Invite'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {guests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No guests added yet. Click "Add Guest" to search and add users.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventRSVP;
