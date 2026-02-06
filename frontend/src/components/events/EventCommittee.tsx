import { useState } from 'react';
import { 
  Users, 
  Plus, 
  Mail, 
  Phone, 
  MoreVertical,
  Shield,
  Crown,
  Edit,
  Trash,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useEventCommittee } from '@/data/useEvents';
import { toast } from 'sonner';
import { showCaughtError } from '@/lib/api';
import type { CommitteeMember } from '@/lib/api/types';

interface EventCommitteeProps {
  eventId: string;
}

const AVAILABLE_ROLES = [
  { id: 'coordinator', name: 'Event Coordinator', description: 'Oversees all event planning and execution' },
  { id: 'finance', name: 'Finance Manager', description: 'Manages budget, contributions and payments' },
  { id: 'guest_manager', name: 'Guest Manager', description: 'Handles guest list and invitations' },
  { id: 'vendor_liaison', name: 'Vendor Liaison', description: 'Coordinates with service providers' },
  { id: 'decorator', name: 'Decor Coordinator', description: 'Manages decorations and setup' },
  { id: 'catering', name: 'Catering Manager', description: 'Handles food and beverages' },
  { id: 'entertainment', name: 'Entertainment Lead', description: 'Manages music, MC and activities' },
  { id: 'logistics', name: 'Logistics Coordinator', description: 'Handles transport and venue setup' },
  { id: 'custom', name: 'Custom Role', description: 'Define a custom role' }
];

const AVAILABLE_PERMISSIONS = [
  { id: 'manage_guests', label: 'Manage Guests', description: 'Add, edit, remove guests' },
  { id: 'send_invitations', label: 'Send Invitations', description: 'Send invitations to guests' },
  { id: 'checkin_guests', label: 'Check-in Guests', description: 'Check in guests at the event' },
  { id: 'view_contributions', label: 'View Contributions', description: 'See contribution details' },
  { id: 'manage_contributions', label: 'Manage Contributions', description: 'Record and edit contributions' },
  { id: 'manage_budget', label: 'Manage Budget', description: 'Edit budget items' },
  { id: 'manage_schedule', label: 'Manage Schedule', description: 'Edit event schedule' },
  { id: 'manage_vendors', label: 'Manage Vendors', description: 'Handle service bookings' },
  { id: 'edit_event', label: 'Edit Event Details', description: 'Change event information' }
];

const EventCommittee = ({ eventId }: EventCommitteeProps) => {
  const { members, loading, error, addMember, updateMember, removeMember, refetch } = useEventCommittee(eventId);
  
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [newMember, setNewMember] = useState({
    name: '',
    email: '',
    phone: '',
    role_description: '',
    permissions: [] as string[],
    send_invitation: true,
    invitation_message: ''
  });

  const handleAddMember = async () => {
    if (!newMember.name.trim()) {
      toast.error('Please enter the member name');
      return;
    }
    if (!selectedRole) {
      toast.error('Please select a role');
      return;
    }

    const roleName = selectedRole === 'custom' 
      ? customRole 
      : AVAILABLE_ROLES.find(r => r.id === selectedRole)?.name || selectedRole;

    setIsSubmitting(true);
    try {
      await addMember({
        name: newMember.name,
        email: newMember.email || undefined,
        phone: newMember.phone || undefined,
        role: roleName,
        role_description: newMember.role_description || undefined,
        permissions: newMember.permissions,
        send_invitation: newMember.send_invitation,
        invitation_message: newMember.invitation_message || undefined
      });
      toast.success('Committee member added');
      setAddDialogOpen(false);
      resetForm();
    } catch (err: any) {
      showCaughtError(err, 'Failed to add member');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this committee member?')) return;
    
    try {
      await removeMember(memberId);
      toast.success('Member removed');
    } catch (err: any) {
      showCaughtError(err, 'Failed to remove member');
    }
  };

  const resetForm = () => {
    setNewMember({
      name: '',
      email: '',
      phone: '',
      role_description: '',
      permissions: [],
      send_invitation: true,
      invitation_message: ''
    });
    setSelectedRole('');
    setCustomRole('');
  };

  const togglePermission = (permissionId: string) => {
    setNewMember(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'invited':
        return <Badge className="bg-yellow-100 text-yellow-800">Invited</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800">Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading committee...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Event Committee</h2>
          <p className="text-muted-foreground">Manage your event planning team</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </div>

      {/* Committee Members */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {members.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No committee members yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Add team members to help you plan and manage your event
              </p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          members.map((member) => (
            <Card key={member.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.name}</p>
                      <p className="text-sm text-primary">{member.role}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="w-4 h-4 mr-2" />Edit
                      </DropdownMenuItem>
                      {member.status === 'invited' && (
                        <DropdownMenuItem>
                          <Send className="w-4 h-4 mr-2" />Resend Invite
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-red-600" onClick={() => handleRemoveMember(member.id)}>
                        <Trash className="w-4 h-4 mr-2" />Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 text-sm">
                  {member.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{member.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  {getStatusBadge(member.status)}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Shield className="w-3 h-3" />
                    <span className="text-xs">{member.permissions.length} permissions</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Committee Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="member-name">Name *</Label>
              <Input
                id="member-name"
                value={newMember.name}
                onChange={(e) => setNewMember(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="member-email">Email</Label>
                <Input
                  id="member-email"
                  type="email"
                  value={newMember.email}
                  onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-phone">Phone</Label>
                <Input
                  id="member-phone"
                  value={newMember.phone}
                  onChange={(e) => setNewMember(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+255..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      <div>
                        <p className="font-medium">{role.name}</p>
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRole === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="custom-role">Custom Role Name</Label>
                <Input
                  id="custom-role"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Enter role name"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                {AVAILABLE_PERMISSIONS.map(perm => (
                  <div key={perm.id} className="flex items-start gap-2">
                    <Checkbox
                      id={perm.id}
                      checked={newMember.permissions.includes(perm.id)}
                      onCheckedChange={() => togglePermission(perm.id)}
                    />
                    <div>
                      <Label htmlFor={perm.id} className="text-sm font-medium cursor-pointer">{perm.label}</Label>
                      <p className="text-xs text-muted-foreground">{perm.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="send-invite"
                checked={newMember.send_invitation}
                onCheckedChange={(checked) => setNewMember(prev => ({ ...prev, send_invitation: !!checked }))}
              />
              <Label htmlFor="send-invite" className="cursor-pointer">Send invitation to join committee</Label>
            </div>

            {newMember.send_invitation && (
              <div className="space-y-2">
                <Label htmlFor="invite-message">Custom Invitation Message (optional)</Label>
                <Textarea
                  id="invite-message"
                  value={newMember.invitation_message}
                  onChange={(e) => setNewMember(prev => ({ ...prev, invitation_message: e.target.value }))}
                  placeholder="Add a personal message..."
                  rows={2}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventCommittee;
