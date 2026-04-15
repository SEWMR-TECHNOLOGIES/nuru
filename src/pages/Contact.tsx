import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const Contact = () => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsSubmitting(false);
    setIsSubmitted(true);
    toast({ title: t('message_sent'), description: t('we_get_back') });
  };

  useMeta({ title: t('contact_us') + " | Nuru", description: "Get in touch with the Nuru team." });
  
  return (
    <Layout>
      <div className="min-h-screen pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-16">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight mb-6">{t('lets_talk')}</h1>
            <p className="text-lg text-muted-foreground max-w-xl">{t('contact_subtitle')}</p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-16">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="space-y-6">
              <div className="p-6 bg-muted/50 rounded-2xl border border-border">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-background" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{t('email_us')}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{t('send_email_anytime')}</p>
                    <a href="mailto:hello@nuru.tz" className="text-foreground font-medium hover:underline">hello@nuru.tz</a>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-muted/50 rounded-2xl border border-border">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-background" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{t('call_us')}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{t('mon_fri')}</p>
                    <a href="tel:+255653750805" className="text-foreground font-medium hover:underline">+255 653 750 805</a>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-muted/50 rounded-2xl border border-border">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-background" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{t('visit_us')}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{t('come_say_hello')}</p>
                    <p className="text-foreground font-medium">Arusha, Tanzania</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
              {!isSubmitted ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">{t('first_name')}</label>
                      <Input id="firstName" type="text" required placeholder={t('your_first_name')} className="h-12 rounded-xl border-border bg-muted/50" />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">{t('last_name')}</label>
                      <Input id="lastName" type="text" required placeholder={t('your_last_name')} className="h-12 rounded-xl border-border bg-muted/50" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">{t('email')}</label>
                    <Input id="email" type="email" required placeholder="you@example.com" className="h-12 rounded-xl border-border bg-muted/50" />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">{t('message')}</label>
                    <Textarea id="message" required placeholder={t('tell_us_about')} rows={6} className="rounded-xl border-border bg-muted/50 resize-none" />
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-foreground text-background hover:bg-foreground/90 rounded-full h-12 px-8">
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-background border-t-transparent rounded-full" />
                        {t('sending')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {t('send_message')}
                        <Send className="w-4 h-4" />
                      </span>
                    )}
                  </Button>
                </form>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16 px-8 bg-muted/50 rounded-3xl border border-border">
                  <div className="w-16 h-16 rounded-full bg-foreground flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-background" />
                  </div>
                  <h3 className="text-2xl font-semibold text-foreground mb-2">{t('message_sent')}</h3>
                  <p className="text-muted-foreground mb-8">{t('we_get_back')}</p>
                  <Button onClick={() => setIsSubmitted(false)} variant="outline" className="rounded-full h-10 px-6">
                    {t('send_another')}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Contact;
