import { useState } from 'react';
import { Search, MessageCircle, Phone, Mail, BookOpen, Users, Settings, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const helpCategories = [
  {
    icon: BookOpen,
    title: 'Getting Started',
    description: 'Learn the basics of using Nuru'
  },
  {
    icon: Users,
    title: 'Event Management',
    description: 'Managing events, committees, and services'
  },
  {
    icon: Settings,
    title: 'Account Settings',
    description: 'Profile, notifications, and preferences'
  },
  {
    icon: Shield,
    title: 'Safety & Privacy',
    description: 'Security features and privacy controls'
  }
];

const faqs = [
  {
    question: 'How do I create my first event?',
    answer: 'To create an event, click the "Create Event" button in the sidebar, fill out the event details form including date, location, and expected guests. Our system will automatically suggest relevant services for your event type.'
  },
  {
    question: 'How do I find service providers?',
    answer: 'Visit the "Find Services" section to browse verified service providers. You can filter by category, location, and price range. All providers show ratings and reviews from previous clients.'
  },
  {
    question: 'Can I manage multiple events at once?',
    answer: 'Yes! The "My Events" section shows all your events. You can switch between different events and manage their individual committees, services, and invitations.'
  },
  {
    question: 'How do I track contributions and pledges?',
    answer: 'Each event has a dedicated contributions section where you can record monetary pledges, service contributions, and physical items. You can track who has contributed what and their payment status.'
  },
  {
    question: 'Is my data secure on Nuru?',
    answer: 'We take security seriously. All your data is encrypted and stored locally on your device. We recommend regular backups of important event information.'
  },
  {
    question: 'How do I verify my account?',
    answer: 'Account verification helps build trust in the community. Upload a valid ID and phone number verification to get your verified badge, which increases your credibility as a service provider.'
  }
];

const Help = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Help Center</h1>
        <p className="text-muted-foreground">Get help and find answers to common questions</p>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <MessageCircle className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Live Chat</h3>
            <p className="text-sm text-muted-foreground mb-4">Chat with our support team</p>
            <Button size="sm" className="w-full">Start Chat</Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Phone className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Call Support</h3>
            <p className="text-sm text-muted-foreground mb-4">Speak directly with our team</p>
            <Button size="sm" variant="outline" className="w-full">+255 (0) 653 750 805</Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Mail className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">Email Us</h3>
            <p className="text-sm text-muted-foreground mb-4">Send us your questions</p>
            <Button size="sm" variant="outline" className="w-full">support@nuru.tz</Button>
          </CardContent>
        </Card>
      </div>

      {/* Help Categories */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Browse by Category</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {helpCategories.map((category, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <category.icon className="w-8 h-8 text-primary flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold mb-2">{category.title}</h3>
                    <p className="text-muted-foreground">{category.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {filteredFaqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {filteredFaqs.length === 0 && searchTerm && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No help articles found matching your search.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Help
