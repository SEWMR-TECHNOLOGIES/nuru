import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";

const Terms = () => {
  useMeta({
    title: "Terms & Conditions | Nuru",
    description: "Read Nuru Workspace's terms and conditions for using the platform, including bookings, payments, content policies, and social features."
  });

  const sections = [
    {
      title: "Definitions",
      content: "Platform means Nuru Workspace. User means any person who creates an account. Organiser means a User who creates or manages an event. Vendor means a User who offers services for events. Contributor means a User who sends money to support an event. Escrow means funds held temporarily by Nuru before release. Content means any text, images, videos, audio, or documents uploaded or shared on the platform. Moment means short-form content shared on the social feed. Circle means a User's personal network. Community means a group for shared interests. Photo Library means event photos managed by Vendors."
    },
    {
      title: "Eligibility",
      content: "You must be at least 18 years old. You must provide accurate information during registration. You are responsible for maintaining the confidentiality of your account credentials. You may not create multiple accounts for fraudulent purposes."
    },
    {
      title: "Nature of the Platform",
      content: "Nuru is a technology platform that connects Organisers, Vendors, and event attendees. Nuru facilitates payments, bookings, event planning, social engagement, and content sharing between Users. Nuru is not a direct provider of event services. Vendors are independent contractors and are solely responsible for the services they provide."
    },
    {
      title: "Account Responsibilities",
      content: "Users must provide accurate and up-to-date information, use the platform in compliance with applicable laws, not commit fraud or misrepresent their identity, not misuse payment systems or contribution features, not use the platform to harass or harm other Users, and maintain the security of their login credentials. Nuru may suspend or terminate accounts for violations."
    },
    {
      title: "Booking and Payments",
      content: "All payments for vendor bookings must be made through Nuru. Payment is required before booking is confirmed. Funds are held in escrow until the Organiser confirms service delivery or the automatic release period expires. If no dispute is raised within 48 hours after the event date, funds are automatically released to the Vendor. Nuru may charge vendor commission, organiser service fees, ticket processing fees, and contribution processing fees. All fees will be clearly disclosed before payment."
    },
    {
      title: "User-Generated Content",
      content: "Users retain ownership of Content they upload. By uploading Content, you grant Nuru a non-exclusive, worldwide, royalty-free licence to use, display, reproduce, and distribute your Content solely for operating the platform. You are solely responsible for all Content you upload, share, or post. You must have the legal right to share any Content, including images, videos, and audio. You must obtain consent from individuals appearing in your media. Prohibited Content includes illegal, obscene, defamatory, or infringing material. Nuru reserves the right to review, remove, or restrict any Content at its discretion."
    },
    {
      title: "Photo Libraries",
      content: "Vendors who manage Photo Libraries grant Organisers access to event photos based on their chosen privacy settings. Photo Library privacy can be set to public, event creator only, or restricted. Organisers and attendees may download photos they have access to. Nuru is not responsible for the use of photos after they are downloaded from the platform."
    },
    {
      title: "Social Features",
      content: "Users may create posts and moments visible to others based on privacy settings. Users may add others to their Circle, with requests requiring acceptance. Users may create and join Communities for shared interests. Messaging through the platform must comply with content policies. Nuru may monitor messages for safety and compliance but does not guarantee message privacy."
    },
    {
      title: "NFC Cards",
      content: "NFC Cards issued through the platform are for event access and digital identity purposes. Users are responsible for safekeeping their NFC Cards. Lost or stolen cards should be reported immediately. Nuru is not liable for unauthorized use of lost or stolen NFC Cards."
    },
    {
      title: "Media Uploads and Storage",
      content: "The platform supports uploads of images, videos, and audio files with size and format restrictions. Nuru may compress, resize, or optimize media for performance. Media uploaded in connection with events may remain accessible to event participants even after the uploader's account is deleted. Vendors uploading portfolio content represent they have the right to use such media commercially."
    },
    {
      title: "Cancellations and Refunds",
      content: "Cancellation and refund terms are set exclusively by Nuru. Vendors do not create custom cancellation policies. All services operate under one of three standardized tiers (Flexible, Moderate, or Strict) based on service category. No refund is available within 48 hours of the event start time, except when the Vendor cancels. If a Vendor cancels, the Organiser receives a full refund including the booking deposit. Rescheduling is available as an alternative to cancellation. Full details are in the Nuru Cancellation and Refund Framework."
    },
    {
      title: "Event Contributions and Tickets",
      content: "Contributions are voluntary unless otherwise stated. Refund eligibility depends on the event's stated policy. Nuru is not responsible for event quality or outcomes. Tickets may include QR codes for verification and entry management."
    },
    {
      title: "Limitation of Liability",
      content: "Nuru is not liable for vendor service quality, event outcomes, indirect or consequential damages, personal injury at events, loss or corruption of uploaded Content, or unauthorized access due to User negligence. Maximum liability is limited to fees paid to Nuru for the specific transaction."
    },
    {
      title: "Intellectual Property",
      content: "All platform branding, design, software, and proprietary content belongs to Nuru. Users may not copy, reproduce, or exploit platform content without permission. User-generated Content remains the property of the User, subject to the licence granted to Nuru for platform operations."
    },
    {
      title: "Governing Law",
      content: "These Terms are governed by the laws of the United Republic of Tanzania. Disputes shall be resolved in Tanzanian courts unless otherwise required by applicable law."
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
              Last updated: February 2025
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
              Please read these terms carefully before using Nuru Workspace. By accessing or using our platform, you agree to be bound by these terms. These Terms govern your use of the platform, including event planning, bookings, payments, content sharing, social features, and all related services.
            </p>
          </motion.div>

          {/* Sections */}
          <div className="space-y-12">
            {sections.map((section, index) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + index * 0.03 }}
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

          {/* Related Documents */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-20 p-8 bg-muted/50 rounded-3xl"
          >
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Related Documents
            </h2>
            <p className="text-muted-foreground mb-4">
              Review our supplementary agreements and privacy policy for complete information.
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              <Button asChild variant="outline" className="rounded-full h-10 px-6">
                <Link to="/privacy-policy">Privacy Policy</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full h-10 px-6">
                <Link to="/vendor-agreement">Vendor Agreement</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full h-10 px-6">
                <Link to="/organiser-agreement">Organiser Agreement</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full h-10 px-6">
                <Link to="/cancellation-policy">Cancellation Policy</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full h-10 px-6">
                <Link to="/cookie-policy">Cookie Policy</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Questions? Contact our legal team at legal@nuru.tz
            </p>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default Terms;
