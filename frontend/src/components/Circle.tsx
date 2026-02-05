import { useState } from 'react';
import { Plus, UserMinus, Users, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useCircles, useFollowSuggestions } from '@/data/useSocial';

const Circle = () => {
  const { 
    circles, 
    loading, 
    createCircle, 
    deleteCircle,
    addMember,
    removeMember 
  } = useCircles();
  const { suggestions, loading: suggestionsLoading } = useFollowSuggestions(10);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPeopleSearch, setNewPeopleSearch] = useState('');
  const [isAdding, setIsAdding] = useState<string | null>(null);

  useWorkspaceMeta({
    title: 'My Circle',
    description: 'Manage your circle of friends and connections on Nuru.'
  });

  // Get circle members from the first circle (or create a default circle concept)
  const mainCircle = circles[0];
  const circleMembers = mainCircle?.members || [];

  const handleAddToCircle = async (userId: string, userName: string) => {
    setIsAdding(userId);
    try {
      if (mainCircle) {
        await addMember(mainCircle.id, userId);
      } else {
        // Create a default circle first
        const newCircle = await createCircle({ name: 'My Circle', description: 'My close friends' });
        if (newCircle) {
          await addMember(newCircle.id, userId);
        }
      }
      toast.success(`${userName} added to your circle`);
      setIsAddDialogOpen(false);
    } catch (err) {
      toast.error('Failed to add to circle');
    } finally {
      setIsAdding(null);
    }
  };

  const handleRemoveFromCircle = async (userId: string, userName: string) => {
    if (!mainCircle) return;
    try {
      await removeMember(mainCircle.id, userId);
      toast.success(`${userName} removed from your circle`);
    } catch (err) {
      toast.error('Failed to remove from circle');
    }
  };

  const filteredMembers = circleMembers.filter((member: any) =>
    `${member.first_name} ${member.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSuggestions = suggestions
    .filter(p => !circleMembers.find((m: any) => m.id === p.id))
    .filter(p => 
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(newPeopleSearch.toLowerCase())
    );

  // Loading state
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-7 h-7 md:w-8 md:h-8" />
              My Circle
            </h1>
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Skeleton className="w-20 h-20 rounded-full" />
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-5 w-3/4 mx-auto" />
                    <Skeleton className="h-4 w-1/2 mx-auto" />
                  </div>
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-7 h-7 md:w-8 md:h-8" />
            My Circle
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {circleMembers.length} {circleMembers.length === 1 ? 'person' : 'people'} in your circle
          </p>
        </div>

        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground w-full md:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add to Circle
        </Button>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add People to Your Circle</DialogTitle>
            </DialogHeader>
            
            {/* Search for new people */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search for people..."
                value={newPeopleSearch}
                onChange={(e) => setNewPeopleSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-3 overflow-y-auto flex-1">
              {suggestionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))
              ) : filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((person) => (
                  <div key={person.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={person.avatar} />
                      <AvatarFallback>{person.first_name?.[0]}{person.last_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">{person.first_name} {person.last_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {(person as any).mutual_count || 0} mutual friends
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddToCircle(person.id, `${person.first_name} ${person.last_name}`)}
                      className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground"
                      disabled={isAdding === person.id}
                    >
                      {isAdding === person.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Add'
                      )}
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  {newPeopleSearch 
                    ? 'No people found matching your search'
                    : 'No suggestions available'
                  }
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

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

      {/* Circle Members */}
      {filteredMembers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member: any) => (
            <Card key={member.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-xl">{member.first_name?.[0]}{member.last_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">
                      {member.first_name} {member.last_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {member.mutual_count || 0} mutual friends
                    </p>
                    {member.added_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Added {new Date(member.added_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveFromCircle(member.id, `${member.first_name} ${member.last_name}`)}
                    className="w-full"
                  >
                    <UserMinus className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 md:p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {searchQuery ? 'No matches found' : 'Your circle is empty'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery 
              ? 'Try a different search term'
              : 'Start adding people to your circle to stay connected'
            }
          </p>
          {!searchQuery && (
            <Button
              onClick={() => setIsAddDialogOpen(true)}
              className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add People
            </Button>
          )}
        </Card>
      )}
    </div>
  );
};

export default Circle;
