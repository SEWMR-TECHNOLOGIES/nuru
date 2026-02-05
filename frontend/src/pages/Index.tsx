import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";

const Index = () => {
  useMeta({
    title: "Nuru | Event Planning Platform",
    description: "Plan, organize, and manage events with verified providers in one platform."
  });

  const features = [
    { label: "Planning Tools", href: "/features/event-planning", desc: "Timelines, budgets, and task management" },
    { label: "Verified Vendors", href: "/features/service-providers", desc: "Trusted professionals for every need" },
    { label: "Digital Invitations", href: "/features/invitations", desc: "Beautiful invites with RSVP tracking" },
    { label: "NFC Guest Access", href: "/features/nfc-cards", desc: "Tap-to-check-in technology" },
    { label: "Secure Payments", href: "/features/payments", desc: "Safe transactions, multiple options" },
  ];

  const eventTypes = [
    { name: "Weddings", icon: "💒", color: "from-pink-500/20 to-rose-500/10" },
    { name: "Birthdays", icon: "🎂", color: "from-amber-500/20 to-orange-500/10" },
    { name: "Memorials", icon: "🕯️", color: "from-slate-500/20 to-gray-500/10" },
    { name: "Corporate", icon: "🏢", color: "from-blue-500/20 to-indigo-500/10" },
    { name: "Graduations", icon: "🎓", color: "from-purple-500/20 to-violet-500/10" },
    { name: "Baby Showers", icon: "👶", color: "from-cyan-500/20 to-teal-500/10" },
  ];

  return (
    <Layout>
      {/* Full-page SVG Background */}
      <div className="fixed inset-0 -z-10">
        <svg
          viewBox="0 0 1440 1200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="hsl(var(--background))" />
            </linearGradient>
            <linearGradient id="blob1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.12" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="blob2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.03" />
            </linearGradient>
            <linearGradient id="blob3" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.06" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          
          <rect width="100%" height="100%" fill="url(#bgGradient)" />
          
          <motion.path
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            d="M-100 700 Q200 500 500 600 T900 400 T1300 550 T1600 300 L1600 1200 L-100 1200 Z"
            fill="url(#blob1)"
          />
          <motion.path
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.8, delay: 0.2, ease: "easeOut" }}
            d="M1440 -50 Q1200 150 1100 50 T800 200 T500 100 T200 250 T-100 150 L-100 -50 Z"
            fill="url(#blob2)"
          />
          <motion.ellipse
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2, delay: 0.4, ease: "easeOut" }}
            cx="1100"
            cy="500"
            rx="450"
            ry="400"
            fill="url(#blob3)"
          />
          <motion.ellipse
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 2, delay: 0.6, ease: "easeOut" }}
            cx="200"
            cy="900"
            rx="350"
            ry="300"
            fill="url(#blob3)"
          />
          
          <motion.line
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 0.8 }}
            x1="900"
            y1="100"
            x2="1300"
            y2="400"
            stroke="hsl(var(--border))"
            strokeWidth="1"
            strokeOpacity="0.2"
          />
          <motion.line
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: 1 }}
            x1="1000"
            y1="150"
            x2="1350"
            y2="350"
            stroke="hsl(var(--border))"
            strokeWidth="1"
            strokeOpacity="0.15"
          />
        </svg>
      </div>

      {/* Hero Section - Redesigned */}
      <section className="min-h-screen relative flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-6xl mx-auto px-6 lg:px-16 pt-20 pb-20">
          {/* Centered Content */}
          <div className="text-center">
            {/* Main Headline */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mb-6"
            >
              <h1 className="text-[clamp(3rem,10vw,7rem)] font-bold leading-[0.95] tracking-tight text-foreground">
                Every moment
              </h1>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-[clamp(3rem,10vw,7rem)] font-bold leading-[0.95] tracking-tight text-muted-foreground/60 block"
              >
                deserves care.
              </motion.span>
            </motion.div>

            {/* Subtle Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-lg md:text-xl text-muted-foreground max-w-md mx-auto mb-24"
            >
              Plan with clarity. Organize with ease. For every occasion life brings.
            </motion.p>

            {/* Futuristic Typography Constellation */}
            <div className="relative h-[200px] md:h-[260px] max-w-5xl mx-auto">
              {eventTypes.map((event, index) => {
                // Constellation positioning - scattered but balanced
                const positions = [
                  { left: "5%", top: "20%", size: "xl", opacity: 0.9, rotate: -3 },
                  { left: "28%", top: "65%", size: "lg", opacity: 0.7, rotate: 2 },
                  { left: "42%", top: "10%", size: "md", opacity: 0.5, rotate: -1 },
                  { left: "58%", top: "70%", size: "xl", opacity: 0.85, rotate: 1 },
                  { left: "75%", top: "25%", size: "lg", opacity: 0.6, rotate: -2 },
                  { left: "88%", top: "55%", size: "md", opacity: 0.75, rotate: 3 },
                ];
                const pos = positions[index];
                
                const sizeClasses = {
                  xl: "text-2xl md:text-4xl font-semibold",
                  lg: "text-xl md:text-2xl font-medium",
                  md: "text-base md:text-lg font-normal",
                };

                return (
                  <motion.div
                    key={event.name}
                    initial={{ opacity: 0, filter: "blur(10px)" }}
                    animate={{ 
                      opacity: pos.opacity, 
                      filter: "blur(0px)",
                      rotate: pos.rotate
                    }}
                    transition={{ 
                      duration: 0.8, 
                      delay: 0.8 + index * 0.12,
                      ease: "easeOut"
                    }}
                    className="absolute"
                    style={{ left: pos.left, top: pos.top }}
                  >
                    <motion.span
                      animate={{ 
                        y: [0, -6, 0],
                      }}
                      transition={{
                        duration: 5 + index * 0.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: index * 0.4
                      }}
                      whileHover={{ 
                        scale: 1.1, 
                        opacity: 1,
                        transition: { duration: 0.2 }
                      }}
                      className={`
                        ${sizeClasses[pos.size as keyof typeof sizeClasses]}
                        text-foreground cursor-default
                        transition-all duration-300
                        hover:text-foreground
                        block
                      `}
                      style={{ opacity: pos.opacity }}
                    >
                      {event.name}
                    </motion.span>
                  </motion.div>
                );
              })}
              
            </div>
          </div>
        </div>

        {/* Ambient floating particles */}
        <motion.div
          animate={{ y: [0, -15, 0], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-[8%] w-1 h-1 rounded-full bg-foreground/30 hidden lg:block"
        />
        <motion.div
          animate={{ y: [0, 12, 0], opacity: [0.15, 0.3, 0.15] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-1/3 right-[12%] w-1.5 h-1.5 rounded-full bg-foreground/20 hidden lg:block"
        />
      </section>

      {/* Features Section */}
      <section className="py-24 lg:py-32 px-6 lg:px-16">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-4">
              What we offer
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground max-w-lg">
              Tools built for the moments that matter
            </h2>
          </motion.div>

          <div className="space-y-1">
            {features.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                viewport={{ once: true }}
              >
                <Link
                  to={item.href}
                  className="group flex items-center justify-between py-6 border-b border-border hover:border-foreground transition-colors"
                >
                  <div>
                    <span className="text-xl font-medium text-foreground block mb-1">{item.label}</span>
                    <span className="text-sm text-muted-foreground">{item.desc}</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Statement Section */}
      <section className="py-24 lg:py-32 px-6 lg:px-16 bg-foreground text-background">
        <div className="max-w-4xl mx-auto">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl md:text-4xl font-medium leading-relaxed"
          >
            Life is made of moments. Some we look forward to, others we prepare for quietly. 
            Nuru is here to help you organize them all with dignity and care.
          </motion.p>
        </div>
      </section>

      {/* Final CTA - Enhanced */}
      <section className="py-32 lg:py-40 px-6 lg:px-16 relative overflow-hidden">
        {/* Decorative background elements */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          viewport={{ once: true }}
          className="absolute inset-0 pointer-events-none"
        >
          <svg viewBox="0 0 1000 600" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="ctaGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ctaGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <circle cx="150" cy="100" r="200" fill="url(#ctaGrad1)" />
            <circle cx="850" cy="500" r="250" fill="url(#ctaGrad2)" />
          </svg>
        </motion.div>

        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center"
          >
            
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6">
              Ready to bring your
              <br />
              <span className="text-muted-foreground">event to life?</span>
            </h2>
            
            <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-12">
              Join thousands of organizers who trust Nuru to create meaningful moments.
            </p>

            {/* Animated event pills */}
            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {["Plan", "Invite", "Celebrate", "Remember"].map((action, index) => (
                <motion.span
                  key={action}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.4 + index * 0.1 }}
                  viewport={{ once: true }}
                  className="px-6 py-3 rounded-full border border-border text-foreground font-medium"
                >
                  {action}
                </motion.span>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              viewport={{ once: true }}
            >
              <Link
                to="/register"
                className="inline-flex items-center gap-3 bg-foreground text-background px-10 py-4 rounded-full font-medium text-lg hover:bg-foreground/90 transition-colors group"
              >
                Start planning
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
