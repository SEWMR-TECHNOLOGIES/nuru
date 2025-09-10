import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Star, Search, MessageCircle } from "lucide-react";
import Layout from "@/components/layout/Layout";
import corporateImg from "@/assets/corporate-event.jpg";
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
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-hero py-16">
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
                className="mb-6 border-foreground/20 text-hero-foreground hover:bg-foreground/5"
              >
                <Link to="/" className="inline-flex items-center">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              </Button>

              <h1 className="text-4xl sm:text-5xl font-bold mb-6 text-hero-foreground">
                Verified Service Providers
              </h1>

              <p className="text-xl text-hero-foreground/80 max-w-2xl mx-auto">
                Book trusted vendors for catering, tents, DJs, photographers, and more with confidence and ease.
              </p>
            </motion.div>
          </div>
        </div>


        {/* Hero Section */}
        <div className="py-16">
          <div className="container-custom">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <h2 className="text-3xl font-bold text-foreground">
                  Connect with Top-Rated Professionals
                </h2>
                <p className="text-lg text-muted-foreground">
                  Our network of verified service providers ensures you get the best talent for your events. From intimate dinners to large corporate gatherings, find professionals who understand your vision and deliver exceptional results.
                </p>
                <div className="space-y-2">
                  {providerTypes.map((type, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex items-center space-x-2"
                    >
                      <div className="w-2 h-2 bg-accent-brand rounded-full"></div>
                      <span className="text-foreground">{type}</span>
                    </motion.div>
                  ))}
                </div>
                <Button asChild className="bg-accent-brand hover:bg-accent-brand/90">
                  <Link to="/register">Browse Providers</Link>
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <img
                  src={corporateImg}
                  alt="Service Providers"
                  className="w-full rounded-2xl shadow-xl"
                />
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