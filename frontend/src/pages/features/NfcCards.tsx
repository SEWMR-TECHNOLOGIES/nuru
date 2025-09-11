import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smartphone, Zap, Shield, Wifi } from "lucide-react";
import Layout from "@/components/layout/Layout";
import featureImg from "@/assets/feature-nfc-cards.jpg";
import { useMeta } from "@/hooks/useMeta";

const NfcCards = () => {
  const features = [
    {
      icon: Smartphone,
      title: "Tap to Connect",
      description: "Guests simply tap their phone to the card for instant event access and information."
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Instant check-ins and information sharing without apps or downloads required."
    },
    {
      icon: Shield,
      title: "Secure Access",
      description: "Encrypted NFC technology ensures secure and reliable guest verification."
    },
    {
      icon: Wifi,
      title: "Works Everywhere",
      description: "Compatible with all modern smartphones and doesn't require internet connection."
    }
  ];

  const useCases = [
    "Event Check-ins", "Contact Sharing", "Digital Business Cards", 
    "Wedding Guest Books", "Conference Networking", "Menu Access"
  ];

  useMeta({
    title: "NFC-Ready Nuru Cards",
    description: "Seamless guest check-ins and instant event access with Nuru's NFC-enabled smart cards. Order your cards for faster, secure, and modern event management."
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
                className="mb-8 border-background/20 text-black hover:bg-background/10"
              >
                <Link to="/" className="inline-flex items-center">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              </Button>

              <h1 className="text-5xl sm:text-6xl font-bold mb-6">
                NFC-Ready
                <span className="block text-accent-brand">Nuru Cards</span>
              </h1>

              <p className="text-xl text-background/80 max-w-2xl mx-auto mb-8">
                Seamless guest check-ins with our next-generation event access technology powered by NFC.
              </p>

              <Button asChild size="lg" className="bg-accent-brand hover:bg-accent-brand/90 text-foreground">
                <Link to="/register">Order Cards</Link>
              </Button>
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
              >
                <img
                  src={featureImg}
                  alt="NFC Cards Technology"
                  className="w-full rounded-2xl shadow-xl"
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-6"
              >
                <h2 className="text-3xl font-bold text-foreground">
                  The Future of Event Technology
                </h2>
                <p className="text-lg text-muted-foreground">
                  Transform your events with cutting-edge NFC technology. Our smart cards eliminate long queues, reduce check-in time by 90%, and provide guests with instant access to event information, schedules, and networking opportunities.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {useCases.map((useCase, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="flex items-center space-x-2 p-3 bg-card rounded-lg border"
                    >
                      <div className="w-2 h-2 bg-accent-brand rounded-full flex-shrink-0"></div>
                      <span className="text-sm font-medium text-foreground">{useCase}</span>
                    </motion.div>
                  ))}
                </div>
                <Button asChild className="bg-black hover:bg-gray-800 text-white">
                  <Link to="/register">Order Nuru Cards</Link>
                </Button>
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
              transition={{ delay: 0.8 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Revolutionary Technology</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Experience the power of NFC technology designed specifically for modern events.
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 + index * 0.1 }}
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

        {/* How it works */}
        <div className="py-16">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">How It Works</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Simple, fast, and intuitive for both organizers and guests.
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.6 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-accent text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  1
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Setup Event</h3>
                <p className="text-muted-foreground">Configure your event details and order customized NFC cards for your guests.</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.8 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-accent text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  2
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Distribute Cards</h3>
                <p className="text-muted-foreground">Give guests their personalized NFC cards upon arrival or mail them in advance.</p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2 }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-accent text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Tap & Go</h3>
                <p className="text-muted-foreground">Guests tap their phone to the card for instant access to all event information.</p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-16 bg-card">
          <div className="container-custom text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.2 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Revolutionize Your Events?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join the future of event technology with Nuru's NFC-enabled smart cards.
              </p>
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/register">Get Your Cards</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NfcCards;