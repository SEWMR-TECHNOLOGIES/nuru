import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  useMeta({
    title: "Privacy Policy | Nuru",
    description: "Learn how Nuru collects, uses, and protects your personal information."
  });

  const sections = [
    {
      title: "Information We Collect",
      content: [
        "Personal information you provide when creating an account: name, email, phone number, address",
        "Event details and guest information you manage through our platform",
        "Payment and billing information processed securely through our payment partners",
        "Photos and content you upload",
        "Device information and usage data collected automatically"
      ]
    },
    {
      title: "How We Use Your Information",
      content: [
        "Create and manage your account",
        "Process event planning requests and connect you with service providers",
        "Handle payments and billing securely",
        "Send event updates, reminders, and support communications",
        "Improve our services and develop new features",
        "Comply with legal obligations"
      ]
    },
    {
      title: "Information Sharing",
      content: [
        "We do not sell your personal information",
        "We share relevant information with service providers to facilitate your bookings",
        "We may share aggregated, de-identified data with partners to improve services",
        "We may disclose information when required by law or to protect our rights"
      ]
    },
    {
      title: "Data Security",
      content: [
        "SSL/TLS encryption for all data transmission",
        "Encrypted data storage with limited access",
        "Regular security audits and updates",
        "Secure payment processing through trusted partners",
        "Employee training on data protection"
      ]
    },
    {
      title: "Your Rights",
      content: [
        "Access: Request a copy of your personal information",
        "Correction: Update or correct inaccurate data",
        "Deletion: Request deletion of your personal information",
        "Portability: Receive your data in a portable format",
        "Opt-out: Unsubscribe from marketing communications at any time"
      ]
    }
  ];

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
              Privacy Policy
            </h1>
            <p className="text-muted-foreground">
              Last updated: December 2024
            </p>
          </motion.div>

          {/* Intro */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-16"
          >
            <p className="text-lg text-muted-foreground leading-relaxed">
              Your privacy matters to us. This policy explains how Nuru collects, uses, and protects your personal information when you use our event management platform and services.
            </p>
          </motion.div>

          {/* Sections */}
          <div className="space-y-16">
            {sections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + index * 0.05 }}
              >
                <h2 className="text-2xl font-semibold text-foreground mb-6">
                  {section.title}
                </h2>
                <ul className="space-y-4">
                  {section.content.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2.5 flex-shrink-0" />
                      <span className="text-muted-foreground leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Contact */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-20 p-8 bg-muted/50 rounded-3xl"
          >
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Questions about privacy?
            </h2>
            <p className="text-muted-foreground mb-6">
              Contact us at privacy@nuru.tz or reach out to our support team.
            </p>
            <Button
              asChild
              variant="outline"
              className="rounded-full h-10 px-6"
            >
              <Link to="/contact">Contact us</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;
