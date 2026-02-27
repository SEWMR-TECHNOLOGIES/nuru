import { useState, useEffect, useCallback } from 'react';
import { Plus, UserMinus, Users, Search, Loader2, Check, X, ExternalLink } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { PillTabsNav } from '@/components/ui/pill-tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useCircles } from '@/data/useSocial';
import { socialApi } from '@/lib/api/social';
import UserSearchInput from './events/UserSearchInput';
import type { SearchedUser } from '@/hooks/useUserSearch';

const Circle = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    circles, 
    loading, 
    createCircle, 
    deleteCircle,
    addMember,
    removeMember,
    refetch,
  } = useCircles();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('members');
  
  // Circle requests state
  const [requests, setRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  useWorkspaceMeta({
    title: 'My Circle',
    description: 'Manage your circle of friends and connections on Nuru.'
  });

  // If URL has ?request=<id>, switch to requests tab
  useEffect(() => {
    if (searchParams.get('request') || searchParams.get('tab') === 'requests') {
      setActiveTab('requests');
    }
  }, [searchParams]);

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await socialApi.getCircleRequests();
      if (res.success) {
        const data = res.data as any;
        setRequests(data?.requests || []);
      }
    } catch { /* silent */ }
    finally { setRequestsLoading(false); }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const mainCircle = circles[0];
  const circleMembers = mainCircle?.members || [];

  const handleUserSelected = async (user: SearchedUser) => {
    setIsAdding(true);
    try {
      if (mainCircle) {
        await addMember(mainCircle.id, user.id);
      } else {
        const newCircle = await createCircle({ name: 'My Circle', description: 'My close friends' });
        if (newCircle) {
          await addMember(newCircle.id, user.id);
        }
      }
      toast.success(`Circle request sent to ${user.first_name} ${user.last_name}`);
      setIsAddDialogOpen(false);
    } catch (err) {
      toast.error('Failed to send circle request');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFromCircle = async (userId: string, userName: string) => {
    if (!mainCircle) return;
    setRemovingId(userId);
    try {
      await removeMember(mainCircle.id, userId);
      toast.success(`${userName} removed from your circle`);
    } catch (err) {
      toast.error('Failed to remove from circle');
    } finally {
      setRemovingId(null);
    }
  };

  const handleAcceptRequest = async (requestId: string, name: string) => {
    setProcessingRequestId(requestId);
    try {
      const res = await socialApi.acceptCircleRequest(requestId);
      if (res.success) {
        toast.success(`${name} is now in your circle!`);
        setRequests(prev => prev.filter(r => r.request_id !== requestId));
        refetch(); // refresh circle members
      } else {
        toast.error('Failed to accept request');
      }
    } catch {
      toast.error('Failed to accept request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId: string, name: string) => {
    setProcessingRequestId(requestId);
    try {
      const res = await socialApi.rejectCircleRequest(requestId);
      if (res.success) {
        toast.success(`Request from ${name} declined`);
        setRequests(prev => prev.filter(r => r.request_id !== requestId));
      } else {
        toast.error('Failed to decline request');
      }
    } catch {
      toast.error('Failed to decline request');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const filteredMembers = circleMembers.filter((member: any) =>
    `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" />
            My Circle
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {circleMembers.length} {circleMembers.length === 1 ? 'person' : 'people'} in your circle
          </p>
        </div>

        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground w-full sm:w-auto"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add to Circle
        </Button>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add People to Your Circle</DialogTitle>
              <DialogDescription>Search for a Nuru user by name, email, or phone. They'll receive a request to join your circle.</DialogDescription>
            </DialogHeader>
            <UserSearchInput onSelect={handleUserSelected} placeholder="Search by name, email or phone..." disabled={isAdding} />
            {isAdding && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending circle request...
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs: Members / Requests */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <PillTabsNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={[
            { value: 'members', label: 'Members' },
            { value: 'requests', label: `Requests${requests.length > 0 ? ` (${requests.length})` : ''}` },
          ]}
        />

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4 space-y-3">
          {/* Search */}
          {circleMembers.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search in your circle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {filteredMembers.length > 0 ? (
            <div className="space-y-2">
              {filteredMembers.map((member: any) => (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                  <Avatar 
                    className="w-10 h-10 flex-shrink-0 cursor-pointer" 
                    onClick={() => member.username && navigate(`/u/${member.username}`)}
                  >
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-sm bg-primary/10 text-primary">
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer" 
                    onClick={() => member.username && navigate(`/u/${member.username}`)}
                  >
                    <h3 className="font-medium text-sm text-foreground truncate">
                      {member.first_name} {member.last_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {member.added_at ? `Added ${new Date(member.added_at).toLocaleDateString()}` : 'Circle member'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFromCircle(member.id, `${member.first_name} ${member.last_name}`)}
                    disabled={removingId === member.id}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                  >
                    {removingId === member.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserMinus className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border border-border rounded-lg bg-card">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {searchQuery ? 'No matches found' : 'Your circle is empty'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery 
                  ? 'Try a different search term'
                  : 'Start adding people to your circle to stay connected'
                }
              </p>
              {!searchQuery && (
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add People
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="mt-4 space-y-3">
          {requestsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </div>
          ) : requests.length > 0 ? (
            <div className="space-y-2">
              {requests.map((req: any) => (
                <div key={req.request_id} className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card">
                  <Avatar 
                    className="w-12 h-12 flex-shrink-0 cursor-pointer"
                    onClick={() => req.username && navigate(`/u/${req.username}`)}
                  >
                    <AvatarImage src={req.avatar} />
                    <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                      {req.first_name?.[0]}{req.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 
                      className="font-semibold text-sm text-foreground truncate cursor-pointer hover:underline"
                      onClick={() => req.username && navigate(`/u/${req.username}`)}
                    >
                      {req.first_name} {req.last_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Wants to add you to their circle
                    </p>
                    {req.requested_at && (
                      <p className="text-[10px] text-muted-foreground/70">
                        {new Date(req.requested_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptRequest(req.request_id, `${req.first_name} ${req.last_name}`)}
                      disabled={processingRequestId === req.request_id}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                    >
                      {processingRequestId === req.request_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRejectRequest(req.request_id, `${req.first_name} ${req.last_name}`)}
                      disabled={processingRequestId === req.request_id}
                      className="gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border border-border rounded-lg bg-card">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No pending requests</h3>
              <p className="text-sm text-muted-foreground">
                When someone wants to add you to their circle, you'll see it here
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
export default Circle;
