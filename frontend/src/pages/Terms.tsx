import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";

const Terms = () => {
  useMeta({
    title: "Terms & Conditions | Nuru",
    description: "Read Nuru's terms and conditions for using the platform."
  });

  const sections = [
    {
      title: "Acceptance of Terms",
      content: "By using Nuru, you agree to these Terms and our Privacy Policy. If you do not agree, please do not use our services. We may update these Terms at any time, and continued use constitutes acceptance of changes."
    },
    {
      title: "Platform Description",
      content: "Nuru is an event management platform connecting event planners with service providers. We offer event planning tools, a service provider marketplace, digital invitations, RSVP tracking, payment processing, and NFC-enabled event access. We are a platform facilitator, not a direct service provider."
    },
    {
      title: "User Accounts",
      content: "To access certain features, you must create an account with accurate information. You are responsible for maintaining account security, keeping your password confidential, and all activities under your account. Notify us immediately of unauthorized access."
    },
    {
      title: "User Conduct",
      content: "Use our platform responsibly. Do not violate laws, infringe intellectual property, upload malicious code, engage in fraud, harass users, or send spam. Plan legitimate events, provide accurate information, respect others, and report inappropriate behavior."
    },
    {
      title: "Service Providers",
      content: "Service providers must complete verification and maintain accurate profiles. They are responsible for service quality and compliance with laws. Nuru facilitates connections but is not responsible for individual provider performance."
    },
    {
      title: "Payments",
      content: "Payments are processed securely through our partners. Payment is due at booking or subscription. Refunds are handled case-by-case based on provider policies. Platform fees may be non-refundable."
    },
    {
      title: "Limitation of Liability",
      content: "To the fullest extent permitted by law, Nuru is not liable for indirect, incidental, special, or consequential damages. Our total liability shall not exceed the amount you paid us in the twelve months preceding any claim."
    },
    {
      title: "Termination",
      content: "We may suspend or terminate accounts that violate these Terms. You may close your account at any time. Upon termination, your right to use the platform ends, but these Terms continue to apply to prior use."
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
              Terms of Service
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
              Please read these terms carefully before using Nuru. By accessing or using our platform, you agree to be bound by these terms.
            </p>
          </motion.div>

          {/* Sections */}
          <div className="space-y-12">
            {sections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + index * 0.05 }}
              >
                <h2 className="text-xl font-semibold text-foreground mb-4">
                  {index + 1}. {section.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  {section.content}
                </p>
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
              Questions about these terms?
            </h2>
            <p className="text-muted-foreground mb-6">
              Contact our legal team at legal@nuru.tz
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

export default Terms;
