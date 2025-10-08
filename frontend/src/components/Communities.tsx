import { useState, useEffect } from 'react';
import { Plus, Users, Search, LogOut, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';

interface Community {
  id: string;
  name: string;
  description: string;
  members: number;
  creator: string;
  image: string;
  joined: boolean;
  createdAt: string;
}

const Communities = () => {
  useWorkspaceMeta({
    title: 'Communities',
    description: 'Join communities and connect with like-minded people for events, weddings, and celebrations.'
  });

  const [communities, setCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCommunity, setNewCommunity] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    const stored = localStorage.getItem('communities');
    if (stored) {
      setCommunities(JSON.parse(stored));
    } else {
      // Initial sample communities
      const initial: Community[] = [
        {
          id: '1',
          name: 'Wedding Planners Kenya',
          description: 'A community for wedding planners and couples planning their special day',
          members: 245,
          creator: 'John Doe',
          image: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=300&h=200&fit=crop',
          joined: false,
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Corporate Event Organizers',
          description: 'Professional network for corporate event planning and management',
          members: 189,
          creator: 'Sarah Smith',
          image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop',
          joined: false,
          createdAt: new Date().toISOString()
        }
      ];
      setCommunities(initial);
      localStorage.setItem('communities', JSON.stringify(initial));
    }
  }, []);

  const saveToLocalStorage = (comms: Community[]) => {
    localStorage.setItem('communities', JSON.stringify(comms));
    setCommunities(comms);
  };

  const createCommunity = () => {
    if (!newCommunity.name.trim() || !newCommunity.description.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const community: Community = {
      id: Date.now().toString(),
      name: newCommunity.name,
      description: newCommunity.description,
      members: 1,
      creator: 'You',
      image: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=300&h=200&fit=crop',
      joined: true,
      createdAt: new Date().toISOString()
    };

    saveToLocalStorage([community, ...communities]);
    toast.success('Community created successfully!');
    setNewCommunity({ name: '', description: '' });
    setIsCreateDialogOpen(false);
  };

  const joinCommunity = (id: string) => {
    const updated = communities.map(c =>
      c.id === id
        ? { ...c, joined: true, members: c.members + 1 }
        : c
    );
    saveToLocalStorage(updated);
    toast.success('Joined community successfully!');
  };

  const leaveCommunity = (id: string) => {
    const updated = communities.map(c =>
      c.id === id
        ? { ...c, joined: false, members: Math.max(1, c.members - 1) }
        : c
    );
    saveToLocalStorage(updated);
    toast.success('Left community');
  };

  const filteredCommunities = communities.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myCommunities = filteredCommunities.filter(c => c.joined);
  const otherCommunities = filteredCommunities.filter(c => !c.joined);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-7 h-7 md:w-8 md:h-8" />
            Communities
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Join communities and connect with like-minded people
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Create Community
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Community</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Community Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Wedding Planners"
                  value={newCommunity.name}
                  onChange={(e) => setNewCommunity({ ...newCommunity, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your community..."
                  value={newCommunity.description}
                  onChange={(e) => setNewCommunity({ ...newCommunity, description: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={createCommunity}
                className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground w-full"
              >
                Create Community
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search communities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* My Communities */}
      {myCommunities.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">My Communities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myCommunities.map((community) => (
              <Card key={community.id} className="hover:shadow-md transition-shadow">
                <div className="relative h-32 w-full overflow-hidden rounded-t-lg">
                  <img
                    src={community.image}
                    alt={community.name}
                    className="w-full h-full object-cover"
                  />
                  {community.creator === 'You' && (
                    <Badge className="absolute top-2 right-2 bg-nuru-yellow text-foreground">
                      <Crown className="w-3 h-3 mr-1" />
                      Creator
                    </Badge>
                  )}
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{community.name}</CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {community.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {community.members} members
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => leaveCommunity(community.id)}
                    className="w-full"
                    disabled={community.creator === 'You'}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {community.creator === 'You' ? 'You own this' : 'Leave'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Discover Communities */}
      {otherCommunities.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Discover Communities</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherCommunities.map((community) => (
              <Card key={community.id} className="hover:shadow-md transition-shadow">
                <div className="relative h-32 w-full overflow-hidden rounded-t-lg">
                  <img
                    src={community.image}
                    alt={community.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{community.name}</CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {community.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {community.members} members
                    </span>
                  </div>
                  <Button
                    onClick={() => joinCommunity(community.id)}
                    className="w-full bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Join Community
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredCommunities.length === 0 && (
        <Card className="p-8 md:p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {searchQuery ? 'No communities found' : 'No communities yet'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery
              ? 'Try a different search term'
              : 'Create the first community and invite others to join'
            }
          </p>
          {!searchQuery && (
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Community
            </Button>
          )}
        </Card>
      )}
    </div>
  );
};

export default Communities;
