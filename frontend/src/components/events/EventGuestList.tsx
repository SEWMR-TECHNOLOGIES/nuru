import { useState } from 'react';
import { 
  UserPlus, Send, Search, Filter, CheckCircle, Clock, X,
  QrCode, Mail, Phone, MoreVertical, Edit, Trash, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useEventGuests } from '@/data/useEvents';
import { usePolling } from '@/hooks/usePolling';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import UserSearchInput from './UserSearchInput';
import GuestListSkeletonLoader from './GuestListSkeletonLoader';
import type { EventGuest } from '@/lib/api/types';
import type { SearchedUser } from '@/hooks/useUserSearch';

interface EventGuestListProps {
  eventId: string;
}

const EventGuestList = ({ eventId }: EventGuestListProps) => {
  const { guests, summary, loading, error, refetch, addGuest, deleteGuest, sendInvitation, checkinGuest } = useEventGuests(eventId);
  usePolling(refetch, 15000);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<EventGuest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);

  const [newGuest, setNewGuest] = useState({
    plus_ones: 0,
    dietary_requirements: '',
    notes: ''
  });

  const handleAddGuest = async () => {
    if (!selectedUser) {
      toast.error('Please search and select a user');
      return;
    }

    setIsSubmitting(true);
    try {
      await addGuest({
        user_id: selectedUser.id,
        name: `${selectedUser.first_name} ${selectedUser.last_name}`,
        email: selectedUser.email,
        phone: selectedUser.phone || undefined,
        plus_ones: newGuest.plus_ones,
        dietary_requirements: newGuest.dietary_requirements || undefined,
        notes: newGuest.notes || undefined,
        rsvp_status: 'pending'
      });
      toast.success('Guest added successfully');
      setAddDialogOpen(false);
      setSelectedUser(null);
      setNewGuest({ plus_ones: 0, dietary_requirements: '', notes: '' });
    } catch (err: any) {
      showCaughtError(err, 'Failed to add guest');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendInvitation = async (method: "email" | "sms" | "whatsapp") => {
    if (!selectedGuest) return;
    setIsSubmitting(true);
    try {
      await sendInvitation(selectedGuest.id, method);
      toast.success(`Invitation sent via ${method}`);
      setInviteDialogOpen(false);
      setSelectedGuest(null);
    } catch (err: any) {
      showCaughtError(err, 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckin = async (guestId: string) => {
    try {
      await checkinGuest(guestId);
      toast.success('Guest checked in successfully');
    } catch (err: any) {
      showCaughtError(err, 'Failed to check in guest');
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    const confirmed = await confirm({
      title: 'Remove Guest',
      description: 'Are you sure you want to remove this guest? This action cannot be undone.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteGuest(guestId);
      toast.success('Guest removed');
    } catch (err: any) {
      showCaughtError(err, 'Failed to remove guest');
    }
  };

  const filteredGuests = guests.filter(guest => {
    const name = guest.name || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.phone?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || guest.rsvp_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Confirmed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800"><X className="w-3 h-3 mr-1" />Declined</Badge>;
      case 'maybe':
        return <Badge variant="secondary">Maybe</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) return <GuestListSkeletonLoader />;
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{summary.total}</p><p className="text-sm text-muted-foreground">Total</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{summary.confirmed}</p><p className="text-sm text-muted-foreground">Confirmed</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{summary.pending}</p><p className="text-sm text-muted-foreground">Pending</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{summary.declined}</p><p className="text-sm text-muted-foreground">Declined</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{summary.checked_in}</p><p className="text-sm text-muted-foreground">Checked In</p></CardContent></Card>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search guests..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><Filter className="w-4 h-4 mr-2" /><SelectValue placeholder="Filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="maybe">Maybe</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />Add Guest
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {filteredGuests.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No guests found</div>
            ) : (
              filteredGuests.map((guest) => (
                <div key={guest.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="flex-shrink-0">
                      <AvatarImage src={guest.avatar || undefined} />
                      <AvatarFallback>{(guest.name || 'G').charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{guest.name || 'Unknown'}</p>
                        {guest.plus_ones > 0 && <Badge variant="outline" className="text-xs">+{guest.plus_ones}</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        {guest.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate max-w-[150px]">{guest.email}</span></span>}
                        {guest.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 flex-shrink-0" />{guest.phone}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
                    {getStatusBadge(guest.rsvp_status)}
                    {guest.checked_in && <Badge className="bg-blue-100 text-blue-800 whitespace-nowrap"><QrCode className="w-3 h-3 mr-1" />Checked In</Badge>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!guest.invitation_sent && (
                          <DropdownMenuItem onClick={() => { setSelectedGuest(guest); setInviteDialogOpen(true); }}>
                            <Send className="w-4 h-4 mr-2" />Send Invitation
                          </DropdownMenuItem>
                        )}
                        {!guest.checked_in && guest.rsvp_status === 'confirmed' && (
                          <DropdownMenuItem onClick={() => handleCheckin(guest.id)}><CheckCircle className="w-4 h-4 mr-2" />Check In</DropdownMenuItem>
                        )}
                        <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteGuest(guest.id)}>
                          <Trash className="w-4 h-4 mr-2" />Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Guest Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Guest</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search User *</Label>
              {selectedUser ? (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={selectedUser.avatar || undefined} />
                    <AvatarFallback>{selectedUser.first_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedUser.first_name} {selectedUser.last_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedUser(null)}>Change</Button>
                </div>
              ) : (
                <UserSearchInput onSelect={setSelectedUser} />
              )}
            </div>
            <div className="space-y-2">
              <Label>Plus Ones</Label>
              <Input type="number" min="0" max="10" value={newGuest.plus_ones} onChange={(e) => setNewGuest(prev => ({ ...prev, plus_ones: parseInt(e.target.value) || 0 }))} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label>Dietary Requirements</Label>
              <Input value={newGuest.dietary_requirements} onChange={(e) => setNewGuest(prev => ({ ...prev, dietary_requirements: e.target.value }))} placeholder="Vegetarian, halal, allergies..." />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={newGuest.notes} onChange={(e) => setNewGuest(prev => ({ ...prev, notes: e.target.value }))} placeholder="Additional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddGuest} disabled={isSubmitting}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : 'Add Guest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Invitation Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Invitation</DialogTitle></DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground mb-4">
              How would you like to send the invitation to <strong>{selectedGuest?.name}</strong>?
            </p>
            <div className="grid gap-3">
              {selectedGuest?.email && (
                <Button variant="outline" className="justify-start" onClick={() => handleSendInvitation('email')} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}Send via Email
                </Button>
              )}
              {selectedGuest?.phone && (
                <>
                  <Button variant="outline" className="justify-start" onClick={() => handleSendInvitation('sms')} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Phone className="w-4 h-4 mr-2" />}Send via SMS
                  </Button>
                  <Button variant="outline" className="justify-start" onClick={() => handleSendInvitation('whatsapp')} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}Send via WhatsApp
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventGuestList;
