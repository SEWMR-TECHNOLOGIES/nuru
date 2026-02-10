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
    { 
      name: "Weddings", 
      desc: "Celebrate love stories",
      image: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80",
      size: "large"
    },
    { 
      name: "Birthdays", 
      desc: "Mark another year",
      image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&q=80",
      size: "small"
    },
    { 
      name: "Memorials", 
      desc: "Honor those we cherish",
      image: "https://images.unsplash.com/photo-1501973801540-537f08ccae7b?w=600&q=80",
      size: "medium"
    },
    { 
      name: "Corporate", 
      desc: "Elevate your brand",
      image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80",
      size: "small"
    },
    { 
      name: "Graduations", 
      desc: "Celebrate achievements",
      image: "https://images.unsplash.com/photo-1627556704290-2b1f5853ff78?w=600&q=80",
      size: "medium"
    },
    { 
      name: "Baby Showers", 
      desc: "Welcome new beginnings",
      image: "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&q=80",
      size: "small"
    },
    { 
      name: "Anniversaries", 
      desc: "Cherish milestones together",
      image: "https://images.unsplash.com/photo-1529636798458-92182e662485?w=600&q=80",
      size: "small"
    },
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

            {/* Creative Bento Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-5xl mx-auto auto-rows-[140px] md:auto-rows-[180px]">
              {eventTypes.map((event, index) => {
                // Define grid spans for bento layout
                const gridClasses = {
                  large: "col-span-2 row-span-2",
                  medium: "col-span-2 md:col-span-1 row-span-2",
                  small: "col-span-1 row-span-1",
                };

                return (
                  <motion.div
                    key={event.name}
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ 
                      duration: 0.6, 
                      delay: 0.6 + index * 0.1,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                    whileHover={{ 
                      scale: 1.02,
                      transition: { duration: 0.3 }
                    }}
                    className={`
                      ${gridClasses[event.size as keyof typeof gridClasses]}
                      relative group cursor-pointer overflow-hidden rounded-2xl
                    `}
                  >
                    {/* Background Image */}
                    <div className="absolute inset-0">
                      <img 
                        src={event.image} 
                        alt={event.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    </div>
                    
                    {/* Content */}
                    <div className="absolute inset-0 p-4 md:p-5 flex flex-col justify-end">
                      <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8 + index * 0.1 }}
                      >
                        <h3 className={`
                          font-semibold text-white mb-1
                          ${event.size === 'large' ? 'text-2xl md:text-3xl' : 
                            event.size === 'medium' ? 'text-xl md:text-2xl' : 'text-lg'}
                        `}>
                          {event.name}
                        </h3>
                        <p className={`
                          text-white/70 leading-relaxed
                          ${event.size === 'small' ? 'hidden md:block text-sm' : 'text-sm md:text-base'}
                        `}>
                          {event.desc}
                        </p>
                      </motion.div>
                    </div>

                    {/* Hover Glow Effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent" />
                    </div>

                    {/* Corner Accent */}
                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white/30 group-hover:bg-white/60 transition-colors duration-300" />
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

            {/* Enhanced Action Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-14 max-w-4xl mx-auto">
              {[
                { action: "Plan", desc: "Organize every detail with precision", gradient: "from-primary/8 to-primary/3" },
                { action: "Invite", desc: "Reach your guests with style", gradient: "from-accent/15 to-accent/5" },
                { action: "Gather", desc: "Bring people together seamlessly", gradient: "from-primary/6 to-accent/8" },
                { action: "Remember", desc: "Preserve the moments forever", gradient: "from-accent/10 to-primary/5" },
              ].map((item, index) => (
                <motion.div
                  key={item.action}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: 0.3 + index * 0.1,
                    ease: [0.22, 1, 0.36, 1]
                  }}
                  viewport={{ once: true }}
                  whileHover={{ 
                    y: -6,
                    transition: { duration: 0.3 }
                  }}
                  className="group"
                >
                  <div className={`relative bg-gradient-to-br ${item.gradient} backdrop-blur-sm border border-border/50 rounded-3xl p-6 md:p-8 text-center overflow-hidden transition-all duration-500 group-hover:border-foreground/15 group-hover:shadow-lg`}>
                    {/* Subtle shine effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
                    </div>
                    
                    <div className="relative">
                      <h4 className="font-bold text-foreground text-xl md:text-2xl mb-2 tracking-tight">{item.action}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
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
