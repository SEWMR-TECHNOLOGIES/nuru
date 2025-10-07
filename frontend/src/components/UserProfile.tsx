import { useState } from 'react';
import { MapPin, Calendar, CheckCircle, Star, Edit, Settings, User, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface UserData {
  name: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  avatar: string;
  coverPhoto: string;
  joinDate: string;
  isVerified: boolean;
  verificationLevel: 'Basic' | 'Premium' | 'Pro';
  servicesOffered: number;
  eventsAttended: number;
  eventsHosted: number;
  rating: number;
  reviewCount: number;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedDate?: string;
}

const UserProfile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState<UserData>({
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '+1 (555) 123-4567',
    location: 'New York, NY',
    bio: 'Passionate event planner and photographer with over 5 years of experience creating memorable celebrations. I specialize in weddings, birthdays, and corporate events.',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b5c5?w=200&h=200&fit=crop&crop=face',
    coverPhoto: 'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200&h=400&fit=crop',
    joinDate: '2019-03-15',
    isVerified: true,
    verificationLevel: 'Premium',
    servicesOffered: 2,
    eventsAttended: 45,
    eventsHosted: 18,
    rating: 4.9,
    reviewCount: 78
  });

  const [achievements, setAchievements] = useState<Achievement[]>([
    {
      id: '1',
      title: 'First Event',
      description: 'Successfully hosted your first event',
      icon: '🎉',
      earned: true,
      earnedDate: '2019-04-20'
    },
    {
      id: '2',
      title: 'Photography Pro',
      description: 'Completed 25 photography gigs',
      icon: '📸',
      earned: true,
      earnedDate: '2023-08-15'
    },
    {
      id: '3',
      title: 'Event Master',
      description: 'Hosted 15+ successful events',
      icon: '👑',
      earned: true,
      earnedDate: '2024-01-10'
    },
    {
      id: '4',
      title: 'Community Helper',
      description: 'Helped organize 50+ community events',
      icon: '🤝',
      earned: false
    },
    {
      id: '5',
      title: 'Five Star Host',
      description: 'Maintain 5-star rating for 6 months',
      icon: '⭐',
      earned: false
    }
  ]);

  const [editData, setEditData] = useState(userData);

  const handleSave = () => {
    setUserData(editData);
    setIsEditing(false);
    // Save to localStorage
    localStorage.setItem('userProfile', JSON.stringify(editData));
  };

  const handleCancel = () => {
    setEditData(userData);
    setIsEditing(false);
  };

  const getYearsOnPlatform = () => {
    const joinYear = new Date(userData.joinDate).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - joinYear;
  };

  const getVerificationColor = (level: string) => {
    switch (level) {
      case 'Basic': return 'bg-gray-100 text-gray-800';
      case 'Premium': return 'bg-blue-100 text-blue-800';
      case 'Pro': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating)
            ? 'text-yellow-400 fill-current'
            : i < rating
            ? 'text-yellow-400 fill-current opacity-50'
            : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div>
      {/* Cover Photo & Profile Header */}
      <Card className="overflow-hidden">
        <div 
          className="h-48 bg-gradient-to-r from-primary to-primary/80 relative"
          style={{
            backgroundImage: `url(${userData.coverPhoto})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-black/20" />
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-4 right-4"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <Settings className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </Button>
        </div>

        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row gap-6 -mt-16 relative z-10">
            <div className="relative">
              <Avatar className="w-32 h-32 border-4 border-background">
                <AvatarImage src={userData.avatar} />
                <AvatarFallback className="text-2xl">{userData.name.charAt(0)}</AvatarFallback>
              </Avatar>
              {isEditing && (
                <Button size="sm" variant="secondary" className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0">
                  <Camera className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex-1 mt-16 md:mt-4">
              {isEditing ? (
                <div className="space-y-4">
                  <Input
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="text-xl font-bold"
                  />
                  <Textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    rows={3}
                  />
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input
                      placeholder="Email"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    />
                    <Input
                      placeholder="Phone"
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    />
                  </div>
                  <Input
                    placeholder="Location"
                    value={editData.location}
                    onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                  />
                  <div className="flex gap-3">
                    <Button onClick={handleSave}>Save Changes</Button>
                    <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-2xl font-bold">{userData.name}</h1>
                    {userData.isVerified && (
                      <CheckCircle className="w-6 h-6 text-blue-500" />
                    )}
                    <Badge className={getVerificationColor(userData.verificationLevel)}>
                      {userData.verificationLevel} Member
                    </Badge>
                  </div>
                  
                  <p className="text-muted-foreground mb-4">{userData.bio}</p>
                  
                  <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {userData.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {getYearsOnPlatform()} years on Nuru
                    </span>
                    <div className="flex items-center gap-1">
                      {renderStars(userData.rating)}
                      <span className="ml-1">{userData.rating} ({userData.reviewCount} reviews)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{userData.servicesOffered}</div>
            <div className="text-sm text-muted-foreground">Services Offered</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{userData.eventsHosted}</div>
            <div className="text-sm text-muted-foreground">Events Hosted</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{userData.eventsAttended}</div>
            <div className="text-sm text-muted-foreground">Events Attended</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{getYearsOnPlatform()}</div>
            <div className="text-sm text-muted-foreground">Years Active</div>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle>Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                  achievement.earned 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
              >
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <h4 className="font-medium">{achievement.title}</h4>
                  <p className="text-sm text-muted-foreground">{achievement.description}</p>
                  {achievement.earned && achievement.earnedDate && (
                    <p className="text-xs text-green-600 mt-1">
                      Earned {new Date(achievement.earnedDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {achievement.earned && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      {!isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Email</h4>
                <p className="text-muted-foreground">{userData.email}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Phone</h4>
                <p className="text-muted-foreground">{userData.phone}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserProfile;