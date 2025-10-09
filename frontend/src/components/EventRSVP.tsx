import { useState } from 'react';
import { Check, X, Clock, Users, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface Guest {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'attending' | 'declined' | 'pending';
  plusOne: boolean;
  dietaryRestrictions?: string;
}

const EventRSVP = ({ eventId }: { eventId: string }) => {
  const { toast } = useToast();
  const [guests, setGuests] = useState<Guest[]>([
    {
      id: '1',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      phone: '+255 712 345 678',
      status: 'attending',
      plusOne: true,
      dietaryRestrictions: 'Vegetarian'
    },
    {
      id: '2',
      name: 'Michael Brown',
      email: 'michael@example.com',
      phone: '+255 713 456 789',
      status: 'pending',
      plusOne: false
    },
    {
      id: '3',
      name: 'Emily Davis',
      email: 'emily@example.com',
      phone: '+255 714 567 890',
      status: 'declined',
      plusOne: false
    }
  ]);

  const [showAddGuest, setShowAddGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({
    name: '',
    email: '',
    phone: ''
  });

  const stats = {
    attending: guests.filter(g => g.status === 'attending').length,
    declined: guests.filter(g => g.status === 'declined').length,
    pending: guests.filter(g => g.status === 'pending').length,
    total: guests.length
  };

  const handleAddGuest = () => {
    if (!newGuest.name || !newGuest.email) {
      toast({
        title: "Missing Information",
        description: "Please provide at least name and email.",
        variant: "destructive"
      });
      return;
    }

    const guest: Guest = {
      id: Date.now().toString(),
      name: newGuest.name,
      email: newGuest.email,
      phone: newGuest.phone,
      status: 'pending',
      plusOne: false
    };

    setGuests([...guests, guest]);
    setNewGuest({ name: '', email: '', phone: '' });
    setShowAddGuest(false);
    
    toast({
      title: "Guest Added",
      description: "Invitation has been sent to the guest.",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'attending':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><Check className="w-3 h-3 mr-1" />Attending</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><X className="w-3 h-3 mr-1" />Declined</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.attending}</div>
            <p className="text-sm text-muted-foreground">Attending</p>
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
          {/* Add Guest Form */}
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
                  Send Invitation
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Guest Items */}
          <div className="space-y-3">
            {guests.map((guest) => (
              <Card key={guest.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{guest.name}</h3>
                        {getStatusBadge(guest.status)}
                        {guest.plusOne && (
                          <Badge variant="outline" className="text-xs">+1</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{guest.email}</span>
                        </div>
                        {guest.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            <span>{guest.phone}</span>
                          </div>
                        )}
                        {guest.dietaryRestrictions && (
                          <p className="text-xs">
                            <span className="font-medium">Dietary:</span> {guest.dietaryRestrictions}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {guest.status === 'pending' && (
                        <Button size="sm" variant="outline">
                          Resend Invite
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EventRSVP;
