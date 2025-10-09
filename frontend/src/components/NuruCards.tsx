import { useState, useEffect } from 'react';
import { CreditCard, Check, Sparkles, Zap, Shield, Gift, QrCode, Users, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import { useToast } from '@/hooks/use-toast';

const NuruCards = () => {
  useWorkspaceMeta({
    title: 'Nuru Cards',
    description: 'Get your Nuru Card for seamless event check-ins and exclusive benefits.'
  });

  const { toast } = useToast();
  const [userCard, setUserCard] = useState<'none' | 'regular' | 'premium'>('none');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [eventsAttended, setEventsAttended] = useState<number>(0);

  // Load card data from localStorage on mount
  useEffect(() => {
    const savedCard = localStorage.getItem('nuruCard');
    if (savedCard) {
      const cardData = JSON.parse(savedCard);
      setUserCard(cardData.type || 'none');
      setCardNumber(cardData.cardNumber || '');
      setEventsAttended(cardData.eventsAttended || 0);
    }
  }, []);

  // Save card data to localStorage whenever it changes
  const saveCardData = (type: 'none' | 'regular' | 'premium', cardNum?: string) => {
    const cardData = {
      type,
      cardNumber: cardNum || cardNumber || `NURU-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      eventsAttended: eventsAttended,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('nuruCard', JSON.stringify(cardData));
    setUserCard(type);
    if (cardNum || !cardNumber) {
      setCardNumber(cardData.cardNumber);
    }
  };

  const regularFeatures = [
    { icon: QrCode, text: 'QR Code Check-in' },
    { icon: Users, text: 'Access to Events' },
    { icon: Clock, text: 'Event History' },
    { icon: Shield, text: 'Verified Identity' }
  ];

  const premiumFeatures = [
    { icon: QrCode, text: 'Priority QR Check-in' },
    { icon: Users, text: 'VIP Event Access' },
    { icon: Clock, text: 'Full Event History' },
    { icon: Shield, text: 'Verified Identity' },
    { icon: Star, text: 'Priority Support' },
    { icon: Gift, text: 'Exclusive Perks' },
    { icon: Zap, text: 'Early Bird Invites' },
    { icon: Sparkles, text: 'Premium Badge' }
  ];

  const handleRequestCard = (type: 'regular' | 'premium') => {
    const newCardNumber = `NURU-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    saveCardData(type, newCardNumber);
    toast({
      title: "Card Created!",
      description: `Your ${type} Nuru Card has been created successfully!`,
    });
  };

  const handleUpgrade = () => {
    saveCardData('premium');
    toast({
      title: "Upgraded to Premium!",
      description: "You now have access to all premium features and benefits.",
    });
  };

  if (userCard === 'none') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Nuru Cards</h1>
          <p className="text-muted-foreground">Get your Nuru Card for seamless event check-ins</p>
        </div>

        {/* Hero Section */}
        <Card className="bg-gradient-to-br from-nuru-yellow/10 to-primary/5 border-nuru-yellow/20">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-nuru-yellow/20 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Experience Seamless Event Check-ins</h2>
            <p className="text-muted-foreground mb-6">
              Skip the queues and check in instantly with your Nuru Card. Just scan and go!
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Instant Check-in</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Secure & Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>Digital Convenience</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Regular Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle>Regular Card</CardTitle>
                <Badge variant="outline">FREE</Badge>
              </div>
              <CardDescription>Perfect for event attendees</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-3xl font-bold">TZS 0</div>
              
              <ul className="space-y-3">
                {regularFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm">{feature.text}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full mt-4" 
                onClick={() => handleRequestCard('regular')}
              >
                Request Regular Card
              </Button>
            </CardContent>
          </Card>

          {/* Premium Card */}
          <Card className="hover:shadow-lg transition-shadow border-primary/50 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <Badge className="bg-gradient-to-r from-nuru-yellow to-primary text-foreground">
                POPULAR
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Premium Card
                <Sparkles className="w-5 h-5 text-primary" />
              </CardTitle>
              <CardDescription>Exclusive benefits and VIP access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">TZS 50,000</span>
                <span className="text-muted-foreground">/year</span>
              </div>
              
              <ul className="space-y-3">
                {premiumFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nuru-yellow/20 to-primary/20 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm">{feature.text}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full mt-4 bg-gradient-to-r from-nuru-yellow to-primary hover:opacity-90" 
                onClick={() => handleRequestCard('premium')}
              >
                Request Premium Card
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How Nuru Cards Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold mb-2">Request Your Card</h3>
                <p className="text-sm text-muted-foreground">
                  Choose between Regular or Premium card based on your needs
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold mb-2">Receive & Activate</h3>
                <p className="text-sm text-muted-foreground">
                  Get your digital card in the app and activate it instantly
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold mb-2">Scan & Enjoy</h3>
                <p className="text-sm text-muted-foreground">
                  Check in to events instantly by scanning your unique QR code
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user has a card
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">My Nuru Card</h1>
        <p className="text-muted-foreground">Your {userCard} card details</p>
      </div>

      {/* Card Display */}
      <Card className={`${userCard === 'premium' ? 'bg-gradient-to-br from-nuru-yellow/10 to-primary/10 border-primary/50' : ''}`}>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* QR Code */}
            <div className="w-48 h-48 bg-white rounded-xl p-4 border-2 border-border">
              <div className="w-full h-full bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center">
                <QrCode className="w-24 h-24 text-white" />
              </div>
            </div>

            {/* Card Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold">
                  {userCard === 'premium' ? 'Premium' : 'Regular'} Nuru Card
                </h2>
                {userCard === 'premium' && (
                  <Badge className="bg-gradient-to-r from-nuru-yellow to-primary text-foreground">
                    <Sparkles className="w-3 h-3 mr-1" />
                    PREMIUM
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mb-6">
                Use this QR code to check in to any Nuru event
              </p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Card Number</p>
                  <p className="font-mono font-semibold">{cardNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Events Attended</p>
                  <p className="font-semibold">{eventsAttended}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valid Until</p>
                  <p className="font-semibold">Dec 2025</p>
                </div>
              </div>

              {userCard === 'regular' && (
                <Button 
                  onClick={handleUpgrade}
                  className="bg-gradient-to-r from-nuru-yellow to-primary hover:opacity-90"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Upgrade to Premium
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Your Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {(userCard === 'premium' ? premiumFeatures : regularFeatures).map((feature, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium">{feature.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NuruCards;
