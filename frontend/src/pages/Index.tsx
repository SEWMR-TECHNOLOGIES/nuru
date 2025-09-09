import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { 
  Calendar, 
  Users, 
  CreditCard, 
  CheckCircle, 
  Star, 
  Heart, 
  MessageCircle,
  Camera,
  Music,
  Utensils,
  Tent,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Layout from "@/components/layout/Layout";
import saraEvent from "@/assets/hero-event.jpg";
import heroImage from "@/assets/plan.png";
import planningIllustration from "@/assets/planning-illustration.jpg";
import corporateEvent from "@/assets/corporate-event.jpg";
import DavidWedding from "@/assets/david-wedding.png";

const Index = () => {
  const features = [
    {
      icon: Calendar,
      title: "Smart Event Planning",
      description: "Plan weddings, parties, and ceremonies with clarity and zero stress."
    },
    {
      icon: Users,
      title: "Verified Service Providers",
      description: "Book trusted vendors for catering, tents, DJs, photographers, and more."
    },
    {
      icon: MessageCircle,
      title: "Interactive Invitations",
      description: "Design beautiful invites and track RSVPs in real time."
    },
    {
      icon: Sparkles,
      title: "NFC-Ready Nuru Card",
      description: "Seamless guest check-ins with our next-gen event access technology."
    },
    {
      icon: CreditCard,
      title: "Secure Payments",
      description: "Book and pay with confidence — fully protected transactions."
    }
  ];

  const mockEvents = [
      {
      id: 1,
      title: "David's Wedding",
      image: DavidWedding,
      likes: 456,
      comments: 76,
      rsvps: 85,
      date: "July 22, 2025"
    },
    {
      id: 2,
      title: "Tech Conference 2024",
      image: corporateEvent,
      likes: 189,
      comments: 32,
      rsvps: 350,
      date: "Jan 20, 2025"
    },
    {
      id: 3,
      title: "Sarah & John's Wedding",
      image: saraEvent,
      likes: 234,
      comments: 45,
      rsvps: 120,
      date: "Dec 15, 2024"
    },
  ];

  const providers = [
    { icon: Camera, name: "Photography" },
    { icon: Music, name: "Entertainment" },
    { icon: Utensils, name: "Catering" },
    { icon: Tent, name: "Venues" }
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-hero">
        <div className="container-custom section-padding">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center lg:text-left"
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-hero-foreground mb-6">
                Plan Smarter.{" "}
                <span className="text-accent-brand">Celebrate Better.</span>
              </h1>
              <p className="text-lg sm:text-xl text-hero-foreground/80 mb-8 max-w-lg mx-auto lg:mx-0">
                Plan, organize and execute events 10x faster with Nuru. Discover trusted service providers, manage bookings, send digital invites, and handle everything in one modern platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button asChild className="btn-hero-primary">
                  <Link to="/register">Join Nuru</Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="border-2 border-foreground/20 text-hero-foreground hover:bg-foreground/5"
                  onClick={() => document.getElementById('feed')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Explore Events
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative overflow-hidden rounded-2xl shadow-2xl">
                <img 
                  src={heroImage} 
                  alt="Beautiful event celebration" 
                  className="w-full h-[400px] sm:h-[500px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute -top-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-full text-sm font-semibold shadow-lg"
              >
                500+ Events
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section-padding bg-background">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything You Need for Perfect Events
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Plan, organize, and execute events faster with verified providers, digital tools, and interactive features designed to make every event unforgettable.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 50, scale: 0.97 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="feature-card h-full bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 transition-transform duration-500 hover:-translate-y-3 hover:shadow-xl group">
                    <CardContent className="p-8 flex flex-col items-start space-y-4">
                      <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-accent/20 transition-all duration-500">
                        <Icon className="w-7 h-7 text-accent drop-shadow-lg group-hover:animate-pulse" />
                      </div>
                      <h3 className="text-xl font-bold text-card-foreground mb-2 group-hover:text-accent transition-colors duration-300">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                      {/* Optional hover underline */}
                      <span className="block w-12 h-1 bg-accent rounded-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>


      {/* Service Providers Preview */}
      <section className="section-padding bg-muted/30">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Trusted Service Providers
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect with verified professionals who make your events extraordinary.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {providers.map((provider, index) => {
              const Icon = provider.icon;
              return (
                <motion.div
                  key={provider.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <div className="relative group">
                    <div className="p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl transition-transform duration-500 hover:-translate-y-2 hover:shadow-lg flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-accent/20 transition-all duration-500">
                        <Icon className="w-8 h-8 text-accent drop-shadow-md group-hover:animate-pulse" />
                      </div>
                      <h3 className="font-semibold text-foreground text-lg group-hover:text-accent transition-colors duration-300">
                        {provider.name}
                      </h3>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>


      {/* Public Feed Preview */}
      <section id="feed" className="section-padding bg-background">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Trending Events on Nuru
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get inspired by amazing events happening in your community.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {mockEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="overflow-hidden hover-lift">
                  <div className="relative h-48">
                    <img 
                      src={event.image} 
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
                      {event.date}
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-card-foreground mb-3">{event.title}</h3>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Heart className="w-4 h-4" />
                        <span>{event.likes}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="w-4 h-4" />
                        <span>{event.comments}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <CheckCircle className="w-4 h-4" />
                        <span>{event.rsvps} RSVPs</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            viewport={{ once: true }}
            className="text-center mt-12"
          >
            <Button asChild variant="outline" size="lg">
              <Link to="/register">See More Events</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Why Nuru Section */}
      <section className="section-padding bg-muted/30">
        <div className="container-custom">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                Events, under control
              </h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CheckCircle className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">One Platform, Everything Included</h3>
                    <p className="text-muted-foreground">No more juggling multiple vendors, contracts, and timelines. Nuru brings everything together.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Star className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Verified Quality</h3>
                    <p className="text-muted-foreground">Every service provider is vetted and rated by real customers, ensuring exceptional quality.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <CreditCard className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">Transparent Pricing</h3>
                    <p className="text-muted-foreground">No hidden fees, no surprises. See exactly what you're paying for before you commit.</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="overflow-hidden">
              <motion.div
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                viewport={{ once: true }}
                className="relative"
              >
                <img 
                  src={planningIllustration} 
                  alt="Event planning made easy"
                  className="w-full h-auto rounded-2xl shadow-lg"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="section-padding bg-foreground text-background">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Your event, done right.
            </h2>
            <p className="text-lg text-background/80 mb-8 max-w-2xl mx-auto">
              Plan, organize, and manage every detail in one place. Nuru brings you closer to the people and services you need.
            </p>
            <Button asChild size="lg" className="btn-hero-secondary">
              <Link to="/register">Join Nuru Now</Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
