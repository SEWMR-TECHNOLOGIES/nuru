import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";
import Layout from "@/components/layout/Layout";
import notFoundImg from "@/assets/404-illustration.jpg";
import { useMeta } from "@/hooks/useMeta";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const NotFound = () => {
  const { t } = useLanguage();
  useMeta({
    title: t('page_not_found') + " - Nuru",
    description: "The page you're looking for doesn't exist."
  });

  return (
    <Layout>
      <div className="min-h-screen bg-background flex items-center justify-center section-padding">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center lg:text-left space-y-8"
            >
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="text-8xl font-bold text-accent-brand"
                >
                  404
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="text-4xl font-bold text-foreground"
                >
                  {t('oops_not_found')}
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="text-lg text-muted-foreground max-w-md mx-auto lg:mx-0"
                >
                  {t('page_wandered')}
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Button 
                  asChild 
                  size="lg"
                  className="bg-foreground hover:bg-foreground/90 text-background"
                >
                  <Link to="/" className="inline-flex items-center">
                    <Home className="w-5 h-5 mr-2" />
                    {t('back_to_home')}
                  </Link>
                </Button>

                <Button 
                  asChild 
                  variant="outline" 
                  size="lg"
                  className="border-border hover:bg-muted"
                >
                  <Link to="/contact" className="inline-flex items-center">
                    <Search className="w-5 h-5 mr-2" />
                    {t('need_help')}
                  </Link>
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                className="pt-8"
              >
                <p className="text-sm text-muted-foreground mb-4">
                  {t('popular_pages')}
                </p>
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  <Link to="/features/event-planning" className="text-sm text-accent-brand hover:text-accent-brand/80 hover:underline transition-colors">
                    {t('event_planning')}
                  </Link>
                  <span className="text-muted-foreground">•</span>
                  <Link to="/features/service-providers" className="text-sm text-accent-brand hover:text-accent-brand/80 hover:underline transition-colors">
                    {t('service_providers')}
                  </Link>
                  <span className="text-muted-foreground">•</span>
                  <Link to="/faqs" className="text-sm text-accent-brand hover:text-accent-brand/80 hover:underline transition-colors">
                    {t('faq')}
                  </Link>
                  <span className="text-muted-foreground">•</span>
                  <Link to="/contact" className="text-sm text-accent-brand hover:text-accent-brand/80 hover:underline transition-colors">
                    {t('contact_us')}
                  </Link>
                </div>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="relative"
            >
              <img src={notFoundImg} alt="Page not found illustration" className="w-full max-w-lg mx-auto rounded-2xl shadow-lg" />
              <div className="absolute inset-0 bg-accent-brand/5 rounded-2xl"></div>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
