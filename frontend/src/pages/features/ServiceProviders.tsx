import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Star, Search, MessageCircle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import featureImg from "@/assets/feature-service-providers.jpg";
import { useMeta } from "@/hooks/useMeta";

const ServiceProviders = () => {
  const features = [
    {
      icon: Shield,
      title: "Verified Professionals",
      description: "All service providers are thoroughly vetted and verified for quality and reliability."
    },
    {
      icon: Star,
      title: "Ratings & Reviews",
      description: "Read genuine reviews from past clients to make informed decisions."
    },
    {
      icon: Search,
      title: "Advanced Filtering",
      description: "Find the perfect providers using detailed filters for budget, location, and style."
    },
    {
      icon: MessageCircle,
      title: "Direct Communication",
      description: "Chat directly with providers to discuss your needs and get instant quotes."
    }
  ];

  const providerTypes = [
    "Professional Photographers", "Expert Caterers", "DJ & Entertainment", 
    "Venue Decorators", "Event Coordinators", "Florists & Designers"
  ];

  useMeta({
    title: "Verified Service Providers",
    description: "Browse and book trusted, top-rated service providers for catering, DJs, photographers, and more. Connect with professionals verified for quality and reliability."
  });

  return (
    <Layout>
      <div className="min-h-screen bg-background section-padding">
        {/* Hero Header */}
        <div className="bg-foreground text-background py-20">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto text-center px-4 sm:px-6"
            >
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mb-8 border-background/20 text-background hover:bg-background/10"
              >
                <Link to="/" className="inline-flex items-center">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              </Button>

              <h1 className="text-5xl sm:text-6xl font-bold mb-6">
                Verified Service
                <span className="block text-accent-brand">Providers</span>
              </h1>

              <p className="text-xl text-background/80 max-w-2xl mx-auto mb-8">
                Connect with trusted, top-rated professionals who bring your event vision to life.
              </p>

              <Button asChild size="lg" className="bg-accent-brand hover:bg-accent-brand/90 text-foreground">
                <Link to="/register">Browse Providers</Link>
              </Button>
            </motion.div>
          </div>
        </div>


        {/* Hero Visual Section */}
        <div className="py-20 section-padding">
          <div className="container-custom">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <h2 className="text-4xl font-bold text-foreground">
                    Connect with Elite Event Professionals
                  </h2>
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    Access our curated network of 500+ verified service providers. Every professional is thoroughly vetted, rated by real clients, and committed to delivering exceptional results for your events.
                  </p>
                </div>

                {/* Provider Types Grid (Updated like Features Grid) */}
                <div className="grid md:grid-cols-2 gap-3">
                  {providerTypes.map((type, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex items-center space-x-2 p-3 bg-card rounded-lg border"
                    >
                      <div className="w-2 h-2 bg-accent-brand rounded-full flex-shrink-0"></div>
                      <span className="text-sm font-medium text-foreground">{type}</span>
                    </motion.div>
                  ))}
                </div>

                <Button asChild className="bg-accent-brand hover:bg-accent-brand/90 text-foreground">
                  <Link to="/register">Explore Network</Link>
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="relative"
              >
                <img
                  src={featureImg}
                  alt="Service Providers Network"
                  className="w-full rounded-2xl shadow-2xl"
                />
                <div className="absolute inset-0 bg-accent-brand/10 rounded-2xl"></div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="py-16 bg-card">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Why Choose Our Providers</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Every provider on our platform meets strict quality standards and customer satisfaction requirements.
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className="text-center p-6 bg-background rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-accent-brand/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-accent-brand" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="py-16">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="grid md:grid-cols-3 gap-8 text-center"
            >
              <div>
                <div className="text-4xl font-bold text-accent-brand mb-2">500+</div>
                <div className="text-muted-foreground">Verified Providers</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-accent-brand mb-2">4.9★</div>
                <div className="text-muted-foreground">Average Rating</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-accent-brand mb-2">10K+</div>
                <div className="text-muted-foreground">Events Completed</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-16 bg-card">
          <div className="container-custom text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Find Your Perfect Provider Today</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Browse our extensive network of professionals and book the services you need for your next event.
              </p>
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/register">Start Browsing</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ServiceProviders;