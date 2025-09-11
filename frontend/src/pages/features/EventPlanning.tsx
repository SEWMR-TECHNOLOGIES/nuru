import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, Users, CheckCircle, Clock } from "lucide-react";
import Layout from "@/components/layout/Layout";
import planningImg from "@/assets/planning-illustration.jpg";
import { useMeta } from "@/hooks/useMeta";

const EventPlanning = () => {
  const features = [
    {
      icon: Calendar,
      title: "Smart Timeline Management",
      description: "Create detailed event timelines with automated reminders and milestone tracking."
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Invite team members and assign tasks with real-time progress updates."
    },
    {
      icon: CheckCircle,
      title: "Task Automation",
      description: "Automated workflows that handle repetitive planning tasks and send notifications."
    },
    {
      icon: Clock,
      title: "Timeline Optimization",
      description: "AI-powered suggestions to optimize your event planning timeline for maximum efficiency."
    }
  ];

  useMeta({
    title: "Smart Event Planning",
    description: "Plan weddings, parties, and ceremonies with clarity and zero stress using Nuru's intelligent event planning tools."
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
                Smart Event
                <span className="block text-accent-brand">Planning</span>
              </h1>

              <p className="text-xl text-background/80 max-w-2xl mx-auto mb-8">
                Plan weddings, parties, and ceremonies with clarity and zero stress using our intelligent planning tools.
              </p>

              <Button asChild size="lg" className="bg-accent-brand hover:bg-accent-brand/90 text-foreground">
                <Link to="/register">Start Planning</Link>
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
                  src={planningImg}
                  alt="Event Planning"
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
                  Transform Your Planning Process
                </h2>
                <p className="text-lg text-muted-foreground">
                  From intimate gatherings to grand celebrations, our smart planning tools help you organize every detail with precision. Create timelines, manage vendors, track budgets, and coordinate teams all in one powerful platform.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {[
                    "Wedding Ceremonies", "Birthday Celebrations", "Corporate Events", 
                    "Baby Showers", "Graduation Parties", "Holiday Gatherings"
                  ].map((type, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="flex items-center space-x-2 p-3 bg-card rounded-lg border"
                    >
                      <div className="w-2 h-2 bg-accent-brand rounded-full flex-shrink-0"></div>
                      <span className="text-sm font-medium text-foreground">{type}</span>
                    </motion.div>
                  ))}
                </div>
                
                <Button asChild className="bg-accent-brand hover:bg-accent-brand/90">
                  <Link to="/register">Start Planning Now</Link>
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
              transition={{ delay: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Planning Made Simple</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Everything you need to plan successful events, from conception to celebration.
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

        {/* CTA Section */}
        <div className="py-16">
          <div className="container-custom text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Plan Your Next Event?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join thousands of event planners who trust Nuru to make their events unforgettable.
              </p>
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/register">Plan Your Event</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default EventPlanning;