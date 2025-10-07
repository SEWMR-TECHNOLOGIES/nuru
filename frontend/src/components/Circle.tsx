import { useState, useEffect } from 'react';
import { Plus, UserMinus, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface CircleMember {
  id: string;
  name: string;
  avatar: string;
  mutualFriends: number;
  addedDate: string;
}

const Circle = () => {
  const [circleMembers, setCircleMembers] = useState<CircleMember[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('circleMembers');
    if (stored) {
      setCircleMembers(JSON.parse(stored));
    }
  }, []);

  const saveToLocalStorage = (members: CircleMember[]) => {
    localStorage.setItem('circleMembers', JSON.stringify(members));
    setCircleMembers(members);
  };

  const suggestedPeople = [
    {
      id: '1',
      name: 'Sarah Johnson',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
      mutualFriends: 5
    },
    {
      id: '2',
      name: 'Mark Wilson',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face',
      mutualFriends: 8
    },
    {
      id: '3',
      name: 'Lisa Chen',
      avatar: 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=100&h=100&fit=crop&crop=face',
      mutualFriends: 3
    },
    {
      id: '4',
      name: 'James Brown',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      mutualFriends: 12
    }
  ];

  const addToCircle = (person: typeof suggestedPeople[0]) => {
    if (circleMembers.find(m => m.id === person.id)) {
      toast.error('Already in your circle');
      return;
    }

    const newMember: CircleMember = {
      ...person,
      addedDate: new Date().toISOString()
    };

    saveToLocalStorage([...circleMembers, newMember]);
    toast.success(`${person.name} added to your circle`);
    setIsAddDialogOpen(false);
  };

  const removeFromCircle = (id: string) => {
    const member = circleMembers.find(m => m.id === id);
    saveToLocalStorage(circleMembers.filter(m => m.id !== id));
    toast.success(`${member?.name} removed from your circle`);
  };

  const filteredMembers = circleMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add to Circle
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add People to Your Circle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {suggestedPeople
                .filter(p => !circleMembers.find(m => m.id === p.id))
                .map((person) => (
                  <div key={person.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={person.avatar} />
                      <AvatarFallback>{person.name[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">{person.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {person.mutualFriends} mutual friends
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addToCircle(person)}
                      className="bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground"
                    >
                      Add
                    </Button>
                  </div>
                ))}
              {suggestedPeople.filter(p => !circleMembers.find(m => m.id === p.id)).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  All suggested people are already in your circle
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
          {filteredMembers.map((member) => (
            <Card key={member.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-xl">{member.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">{member.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {member.mutualFriends} mutual friends
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added {new Date(member.addedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeFromCircle(member.id)}
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
