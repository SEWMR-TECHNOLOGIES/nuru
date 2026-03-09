import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import TrendingMoments from "@/components/TrendingMoments";

const Index = () => {
  useMeta({
    title: "Nuru | Event Planning Platform",
    description: "Plan, organize, and manage events with verified providers in one platform."
  });

  const features = [
    { 
      label: "Planning Tools", 
      href: "/features/event-planning", 
      desc: "Timelines, budgets, and task management",
      number: "01",
      detail: "Stay on top of every detail with smart checklists, budget tracking, and collaborative task boards"
    },
    { 
      label: "Verified Vendors", 
      href: "/features/service-providers", 
      desc: "Trusted professionals for every need",
      number: "02",
      detail: "Browse rated vendors, compare packages, and book directly through the platform"
    },
    { 
      label: "Digital Invitations", 
      href: "/features/invitations", 
      desc: "Beautiful invites with RSVP tracking",
      number: "03",
      detail: "Send stunning invitations via SMS, email, or link. Track opens and responses in real time"
    },
    { 
      label: "NFC Guest Access", 
      href: "/features/nfc-cards", 
      desc: "Tap-to-check-in technology",
      number: "04",
      detail: "Issue smart cards for seamless check-in, cashless payments, and VIP access control"
    },
    { 
      label: "Secure Payments", 
      href: "/features/payments", 
      desc: "Safe transactions, multiple options",
      number: "05",
      detail: "Collect contributions, sell tickets, and pay vendors through M-Pesa, cards, and bank transfers"
    },
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

      {/* Features Section - Redesigned */}
      <section className="py-28 lg:py-40 px-6 lg:px-16 relative overflow-hidden">
        {/* Subtle background texture */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/[0.04] rounded-full blur-[80px]" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          {/* Header */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-20 mb-20 lg:mb-28">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <span className="text-sm tracking-[0.2em] uppercase text-muted-foreground mb-4 block font-medium">
                Platform features
              </span>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-[1.05] tracking-tight">
                Everything you need,
                <br />
                <span className="text-muted-foreground">nothing you don't</span>
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              viewport={{ once: true }}
              className="flex items-end"
            >
              <p className="text-muted-foreground text-lg lg:text-xl leading-relaxed max-w-md">
                Five powerful tools designed to take your event from concept to celebration. Each one built with real organizers in mind.
              </p>
            </motion.div>
          </div>

          {/* Feature Cards - Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {features.map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.6, 
                  delay: index * 0.1,
                  ease: [0.22, 1, 0.36, 1]
                }}
                viewport={{ once: true }}
                className={`group ${index === 0 ? 'lg:row-span-2' : ''} ${index === 4 ? 'md:col-span-2 lg:col-span-1' : ''}`}
              >
                <Link
                  to={item.href}
                  className={`relative block h-full rounded-3xl border border-border/60 bg-gradient-to-br from-muted/30 via-transparent to-transparent overflow-hidden transition-all duration-500 hover:border-foreground/15 hover:shadow-xl hover:shadow-primary/[0.03] ${index === 0 ? 'p-10 lg:p-12' : 'p-8 lg:p-10'}`}
                >
                  {/* Large faded number */}
                  <span className={`absolute top-6 right-6 font-bold text-foreground/[0.04] group-hover:text-foreground/[0.08] transition-colors duration-700 ${index === 0 ? 'text-[120px] lg:text-[160px]' : 'text-[100px]'}`}>
                    {item.number}
                  </span>

                  {/* Hover glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-accent/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                  <div className="relative flex flex-col h-full justify-between gap-6">
                    <div>
                      <h3 className={`font-bold text-foreground tracking-tight mb-3 ${index === 0 ? 'text-2xl lg:text-3xl' : 'text-xl lg:text-2xl'}`}>
                        {item.label}
                      </h3>
                      <p className={`text-muted-foreground leading-relaxed ${index === 0 ? 'text-base lg:text-lg' : 'text-sm lg:text-base'}`}>
                        {item.detail}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                      <span>Learn more</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>

                  {/* Bottom accent line */}
                  <div className="absolute bottom-0 left-0 right-0 h-[2px]">
                    <div className="h-full bg-gradient-to-r from-primary/50 via-accent/40 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
                  </div>
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

      {/* Final CTA - Immersive Journey Section */}
      <section className="relative overflow-hidden">
        {/* Dark cinematic background */}
        <div className="bg-foreground text-background relative">
          {/* Animated grain texture overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />
          
          {/* Radial glow accents */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-accent/8 rounded-full blur-[100px] pointer-events-none" />

          {/* Top section - Statement */}
          <div className="pt-32 lg:pt-40 pb-20 px-6 lg:px-16">
            <div className="max-w-6xl mx-auto">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1 }}
                viewport={{ once: true }}
                className="text-center mb-6"
              >
                <span className="inline-block text-sm tracking-[0.3em] uppercase text-background/40 mb-8 font-medium">
                  Your journey starts here
                </span>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                viewport={{ once: true }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-center leading-[0.95] tracking-tight mb-8"
              >
                <span className="block text-background">From idea</span>
                <span className="block bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  to unforgettable
                </span>
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="text-background/50 text-lg md:text-xl max-w-xl mx-auto text-center leading-relaxed"
              >
                Every great celebration follows a path. Nuru walks it with you, from the first spark to the last goodbye.
              </motion.p>
            </div>
          </div>

          {/* Journey Steps - Horizontal timeline on desktop, vertical on mobile */}
          <div className="px-6 lg:px-16 pb-12">
            <div className="max-w-6xl mx-auto">
              {/* Connecting line */}
              <div className="hidden md:block relative mb-0">
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  transition={{ duration: 1.5, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  viewport={{ once: true }}
                  className="absolute top-[60px] left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-background/20 to-transparent origin-left"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4">
                {[
                  { 
                    step: "01", 
                    action: "Dream", 
                    swahili: "Ota",
                    desc: "Envision your perfect event. We'll help shape it into reality",
                  },
                  { 
                    step: "02", 
                    action: "Plan", 
                    swahili: "Panga",
                    desc: "Organize budgets, timelines, and vendors in one clear dashboard",
                  },
                  { 
                    step: "03", 
                    action: "Gather", 
                    swahili: "Kusanya",
                    desc: "Send stunning invites, manage RSVPs, collect contributions seamlessly",
                  },
                  { 
                    step: "04", 
                    action: "Celebrate", 
                    swahili: "Sherehekea",
                    desc: "Check-in guests, capture moments, and create memories that last",
                  }
                ].map((item, index) => (
                  <motion.div
                    key={item.action}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.7, 
                      delay: 0.4 + index * 0.15,
                      ease: [0.22, 1, 0.36, 1]
                    }}
                    viewport={{ once: true }}
                    className="group relative"
                  >
                    <div className="relative p-8 rounded-3xl border border-background/[0.06] bg-background/[0.03] backdrop-blur-sm hover:bg-background/[0.07] hover:border-background/[0.12] transition-all duration-700 h-full">
                      {/* Step number with glow */}
                      <div className="relative mb-6">
                        <div className="absolute -inset-2 bg-primary/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <span className="text-5xl font-bold text-background/[0.08] group-hover:text-background/[0.15] transition-colors duration-500">
                          {item.step}
                        </span>
                      </div>

                      {/* Content */}
                      <div>
                        <div className="flex items-baseline gap-3 mb-3">
                          <h4 className="text-2xl md:text-3xl font-bold text-background tracking-tight">
                            {item.action}
                          </h4>
                          <span className="text-sm text-primary/60 italic font-medium">
                            {item.swahili}
                          </span>
                        </div>
                        <p className="text-background/40 text-sm leading-relaxed group-hover:text-background/60 transition-colors duration-500">
                          {item.desc}
                        </p>
                      </div>

                      {/* Bottom accent line */}
                      <div className="absolute bottom-0 left-8 right-8 h-px">
                        <div className="h-full bg-gradient-to-r from-primary/40 via-accent/30 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>
    </Layout>
  );
};

export default Index;
