import { motion } from "framer-motion";
import { useState } from "react";
import { Search, Plus, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FAQs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "How does Nuru help me plan events?",
      answer: "Nuru connects you with verified service providers, helps you manage guest lists, send digital invitations, track RSVPs, and coordinate all aspects of your event from one central location."
    },
    {
      question: "Is Nuru free to use?",
      answer: "Nuru offers both free and premium plans. Our basic plan allows you to create events, send invitations, and track RSVPs at no cost. Premium features include advanced analytics, priority support, and access to exclusive providers."
    },
    {
      question: "What types of events can I plan?",
      answer: "Any type. Weddings, birthday parties, corporate conferences, anniversaries, community gatherings. Our platform scales to accommodate events of any size."
    },
    {
      question: "Can I offer my services on Nuru?",
      answer: "Yes! Sign up, create your service listing, and complete a quick identity check to activate it. Once verified, you can start receiving bookings and payments from event organisers."
    },
    {
      question: "How are service providers verified?",
      answer: "We verify provider identities using national ID or passport to protect both vendors and clients. This ensures trust, prevents fraud, and is required for payment processing through our financial partners."
    },
    {
      question: "Is payment secure?",
      answer: "Security is our priority. We use industry-standard encryption and partner with trusted payment processors. We never store complete payment information on our servers."
    },
    {
      question: "What is the NFC-Ready Nuru Card?",
      answer: "Our NFC-enabled technology allows seamless guest check-ins. Guests tap their phone to automatically check in, view event details, and access digital programs. Modern and contactless."
    },
    {
      question: "How do I track RSVPs?",
      answer: "Real-time tracking with detailed analytics. See who responded, send reminders to non-responders, manage dietary restrictions, export guest lists. Send updates to all or selected guests."
    }
  ];

  const filteredFAQs = faqs.filter(
    faq =>
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useMeta({
    title: "FAQs | Nuru",
    description: "Frequently asked questions about Nuru event planning platform."
  });

  return (
    <Layout>
      <div className="min-h-screen pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16"
          >
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight mb-6">
              Questions?
              <br />
              <span className="text-muted-foreground">Answers.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Everything you need to know about Nuru. Can not find what you are looking for? Reach out to our team.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative mb-12"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-14 text-base rounded-2xl border-border bg-muted/50"
            />
          </motion.div>

          {/* FAQ List */}
          <div className="space-y-4">
            {filteredFAQs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full text-left p-6 bg-muted/50 rounded-2xl hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-lg font-medium text-foreground pr-8">
                      {faq.question}
                    </span>
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center">
                      {openIndex === index ? (
                        <Minus className="w-3.5 h-3.5 text-foreground" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 text-foreground" />
                      )}
                    </div>
                  </div>
                  <motion.div
                    initial={false}
                    animate={{ 
                      height: openIndex === index ? "auto" : 0,
                      opacity: openIndex === index ? 1 : 0,
                      marginTop: openIndex === index ? 16 : 0
                    }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                </button>
              </motion.div>
            ))}
          </div>

          {filteredFAQs.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <p className="text-muted-foreground text-lg mb-2">No results found</p>
              <p className="text-sm text-muted-foreground">Try different search terms</p>
            </motion.div>
          )}

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-20 p-8 bg-foreground text-background rounded-3xl text-center"
          >
            <h3 className="text-2xl font-semibold mb-3">
              Still have questions?
            </h3>
            <p className="text-background/60 mb-6">
              Our team is ready to help you get started.
            </p>
            <Button
              asChild
              className="bg-background text-foreground hover:bg-background/90 rounded-full h-12 px-8"
            >
              <Link to="/contact">Get in touch</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default FAQs;
