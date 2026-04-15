import { useState } from 'react';
import { Search, MessageCircle, Phone, Mail, BookOpen, Users, Settings, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useWorkspaceMeta } from '@/hooks/useWorkspaceMeta';
import NuruChatbot from './NuruChatbot';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const Help = () => {
  const { t } = useLanguage();
  useWorkspaceMeta({
    title: t('help_center'),
    description: t('help_subtitle'),
  });

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const helpCategories = [
    { icon: BookOpen, title: t('getting_started'), description: t('learn_basics') },
    { icon: Users, title: t('event_management'), description: t('managing_events_desc') },
    { icon: Settings, title: t('account_settings'), description: t('profile_notif_prefs') },
    { icon: Shield, title: t('safety_privacy'), description: t('security_features_desc') },
  ];

  const faqs = [
    {
      question: 'How do I create my first event?',
      answer: `To create an event, click the "${t('create_event')}" button in the sidebar, fill out the event details form including date, location, and expected guests. Our system will automatically suggest relevant services for your event type.`
    },
    {
      question: 'How do I find service providers?',
      answer: `Visit the "${t('find_services')}" section to browse verified service providers. You can filter by category, location, and price range. All providers show ratings and reviews from previous clients.`
    },
    {
      question: 'Can I manage multiple events at once?',
      answer: `Yes! The "${t('my_events')}" section shows all your events. You can switch between different events and manage their individual committees, services, and invitations.`
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

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">{t('help_center')}</h1>
        <p className="text-muted-foreground">{t('help_subtitle')}</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('search_for_help')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/live-chat')}>
          <CardContent className="p-6 text-center">
            <MessageCircle className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">{t('live_chat')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('chat_with_support')}</p>
            <Button size="sm" className="w-full">{t('start_chat')}</Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Phone className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">{t('call_support')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('speak_with_team')}</p>
            <Button size="sm" variant="outline" className="w-full">+255 (0) 653 750 805</Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6 text-center">
            <Mail className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-semibold mb-2">{t('email_us')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('send_us_questions')}</p>
            <Button size="sm" variant="outline" className="w-full">support@nuru.tz</Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">{t('browse_by_category')}</h2>
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

      <Card>
        <CardHeader>
          <CardTitle>{t('frequently_asked')}</CardTitle>
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
            <p className="text-muted-foreground">{t('no_help_articles')}</p>
          </CardContent>
        </Card>
      )}

      <NuruChatbot />
    </div>
  );
};

export default Help;
