import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smartphone, Eye, Users, BarChart3 } from "lucide-react";
import Layout from "@/components/layout/Layout";
import featureImg from "@/assets/feature-invitations.jpg";
import { useMeta } from "@/hooks/useMeta";

const Invitations = () => {
  const features = [
    {
      icon: Smartphone,
      title: "Digital-First Design",
      description: "Create stunning digital invitations that look perfect on all devices and screens."
    },
    {
      icon: Eye,
      title: "Beautiful Templates",
      description: "Choose from hundreds of professionally designed templates for every occasion."
    },
    {
      icon: Users,
      title: "Guest Management",
      description: "Organize guest lists, send reminders, and manage attendee information effortlessly."
    },
    {
      icon: BarChart3,
      title: "Real-Time Tracking",
      description: "Monitor RSVP responses, dietary preferences, and guest engagement in real-time."
    }
  ];

  const invitationTypes = [
    "Wedding Invitations", "Birthday Parties", "Corporate Events", 
    "Baby Showers", "Graduation Ceremonies", "Holiday Celebrations"
  ];

  useMeta({
    title: "Interactive Invitations",
    description: "Design beautiful digital invitations, manage RSVPs, and track guest engagement in real time with Nuru's powerful invitation management system."
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
                Interactive 
                <span className="block text-accent-brand">Invitations</span>
              </h1>

              <p className="text-xl text-background/80 max-w-2xl mx-auto mb-8">
                Create stunning digital invitations that engage guests and simplify RSVP management.
              </p>

              <Button asChild size="lg" className="bg-accent-brand hover:bg-accent-brand/90 text-foreground">
                <Link to="/register">Create Invitation</Link>
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
                className="space-y-6"
              >
                <h2 className="text-3xl font-bold text-foreground">
                  Invitations That Make an Impression
                </h2>
                <p className="text-lg text-muted-foreground">
                  Say goodbye to paper invitations and hello to interactive, engaging digital invites. Our platform allows you to create beautiful invitations that your guests will love to receive and interact with.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {invitationTypes.map((type, index) => (
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
                <Button asChild className="bg-accent-brand hover:bg-accent-brand/90">
                  <Link to="/register">Create Invitation</Link>
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <img
                  src={featureImg}
                  alt="Digital Invitations"
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
              <h2 className="text-3xl font-bold text-foreground mb-4">Powerful Invitation Features</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to create, send, and manage invitations for any event.
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

        {/* Benefits Section */}
        <div className="py-16">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="grid md:grid-cols-2 gap-12 items-center"
            >
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-6">Why Go Digital?</h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-accent-brand rounded-full mt-2"></div>
                    <div>
                      <h3 className="font-semibold text-foreground">Instant Delivery</h3>
                      <p className="text-muted-foreground">Reach guests immediately via email, SMS, or social media.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-accent-brand rounded-full mt-2"></div>
                    <div>
                      <h3 className="font-semibold text-foreground">Cost Effective</h3>
                      <p className="text-muted-foreground">Save money on printing, postage, and design costs.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-accent-brand rounded-full mt-2"></div>
                    <div>
                      <h3 className="font-semibold text-foreground">Eco-Friendly</h3>
                      <p className="text-muted-foreground">Reduce paper waste with sustainable digital alternatives.</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-accent-brand rounded-full mt-2"></div>
                    <div>
                      <h3 className="font-semibold text-foreground">Interactive Elements</h3>
                      <p className="text-muted-foreground">Add videos, maps, polls, and other engaging content.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-card p-6 rounded-xl">
                  <h3 className="font-semibold text-foreground mb-2">RSVP Response Rate</h3>
                  <div className="text-3xl font-bold text-accent-brand">94%</div>
                  <p className="text-sm text-muted-foreground">Average response rate with digital invites</p>
                </div>
                <div className="bg-card p-6 rounded-xl">
                  <h3 className="font-semibold text-foreground mb-2">Time Saved</h3>
                  <div className="text-3xl font-bold text-accent-brand">75%</div>
                  <p className="text-sm text-muted-foreground">Less time spent on invitation management</p>
                </div>
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
              <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Create Your First Invitation?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Start designing beautiful, interactive invitations that your guests will love.
              </p>
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/register">Get Started</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Invitations;