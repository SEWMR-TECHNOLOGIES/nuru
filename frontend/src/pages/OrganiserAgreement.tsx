import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";

const OrganiserAgreement = () => {
  useMeta({
    title: "Organiser Agreement | Nuru",
    description: "Read the Nuru Workspace Organiser Agreement covering event creation, payment, contributions, ticketing, disputes, and platform conduct for organisers."
  });

  const sections = [
    {
      title: "Accurate Event Information",
      content: [
        "Provide correct and complete event details: name, description, date, time, location, service requirements, and guest capacity.",
        "Include ticket pricing and contribution goals if applicable.",
        "Providing false or misleading event information may result in account suspension."
      ]
    },
    {
      title: "Event Media and Content",
      content: [
        "You may upload event cover images, gallery photos, and digital invitation designs.",
        "You must have the legal right to use all images and media you upload.",
        "Guests and attendees may share photos, videos, and posts related to your event on the platform.",
        "You are responsible for communicating any media restrictions to your guests directly.",
        "Access to Vendor Photo Libraries depends on the privacy settings chosen by the Vendor.",
        "Commercial use of Vendor-created photos requires separate agreement with the Vendor."
      ]
    },
    {
      title: "Payment Commitment",
      content: [
        "Bookings are confirmed only after full payment is made through the platform's escrow system.",
        "You may not expect service delivery without completing escrow payment.",
        "All payments must be made through the platform. Off-platform payment arrangements are prohibited."
      ]
    },
    {
      title: "Contributions",
      content: [
        "You may enable contributions for your events, allowing others to contribute financially.",
        "Clearly communicate contribution purposes and goals.",
        "Contributors' personal information must be treated confidentially.",
        "Nuru processes contribution payments and may charge a processing fee."
      ]
    },
    {
      title: "Ticketing",
      content: [
        "You may create and sell tickets for your events through the platform.",
        "Set accurate ticket pricing and quantities.",
        "Ticket buyers are entitled to event access as described in the ticket listing.",
        "You must honour all valid tickets presented at your event.",
        "QR code verification is provided for ticket validation.",
        "Refund policies for tickets must be clearly stated at the time of listing."
      ]
    },
    {
      title: "Event Committee",
      content: [
        "You may appoint committee members to help manage your event on the platform.",
        "You are responsible for the actions of your committee members within the platform.",
        "Committee permissions and access levels are managed by you.",
        "Committee members must comply with all platform Terms and Conditions."
      ]
    },
    {
      title: "Guest List and RSVP",
      content: [
        "Manage guest lists and RSVP tracking through the platform.",
        "Guest information must be used only for event management purposes.",
        "You must not share guest personal information with third parties without consent.",
        "You must not use guest contact information for unsolicited marketing."
      ]
    },
    {
      title: "Event Schedule and Checklist",
      content: [
        "Use scheduling and checklist tools to plan your event.",
        "Keep event schedules shared with vendors and committee members accurate and up to date.",
        "Communicate changes promptly to all affected parties."
      ]
    },
    {
      title: "Dispute Integrity",
      content: [
        "Submit disputes only when you have a legitimate grievance.",
        "Provide truthful and accurate evidence when raising disputes.",
        "Respond to dispute inquiries within the specified timeframe.",
        "Accept Nuru's final decision on disputes.",
        "Filing false or fraudulent disputes may result in rejection, financial penalties, or account termination."
      ]
    },
    {
      title: "Event Responsibility",
      content: [
        "You are responsible for the safety and wellbeing of attendees at your event.",
        "Comply with all applicable local laws and regulations.",
        "Obtain necessary permits and licences for your event.",
        "Manage contributors, guests, and attendees appropriately.",
        "Ensure your event does not promote illegal activities.",
        "Nuru is not liable for any incidents, injuries, or damages that occur at your events."
      ]
    },
    {
      title: "Budget and Expense Tracking",
      content: [
        "You may use the platform's budget and expense tracking tools for event planning.",
        "Financial data entered is for your planning purposes.",
        "Nuru does not provide financial advice and is not responsible for budget decisions."
      ]
    },
    {
      title: "Cancellation",
      content: [
        "If you cancel an event, notify all affected Vendors and attendees through the platform.",
        "Refunds for cancelled events are subject to the Nuru Cancellation and Refund Framework.",
        "Ticket refunds for cancelled events are your responsibility.",
        "Contribution refunds are handled on a case-by-case basis."
      ]
    },
    {
      title: "Prohibited Conduct",
      content: [
        "Creating events for fraudulent or illegal purposes.",
        "Misrepresenting event details to attract Vendors, contributors, or attendees.",
        "Soliciting off-platform payments from Vendors or attendees.",
        "Collecting personal information for purposes unrelated to event management.",
        "Submitting false disputes to obtain unwarranted refunds.",
        "Using contribution features for purposes other than stated event goals."
      ]
    },
    {
      title: "Suspension and Termination",
      content: [
        "Nuru may suspend or terminate your Organiser privileges for fraudulent event management, repeated false disputes, policy violations, or failure to honour bookings and ticket commitments."
      ]
    },
    {
      title: "Liability",
      content: [
        "You are solely responsible for the planning, execution, and outcomes of your events.",
        "You agree to indemnify Nuru against any claims arising from your events.",
        "Nuru is not liable for any damages resulting from event cancellations, changes, or outcomes."
      ]
    }
  ];

  return (
    <Layout>
      <div className="min-h-screen pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-16">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight mb-6">Organiser Agreement</h1>
            <p className="text-muted-foreground">Effective: February 2025</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mb-16">
            <p className="text-lg text-muted-foreground leading-relaxed">
              This Organiser Agreement supplements the Nuru Workspace Terms and Conditions. By registering as an Organiser and creating events on the platform, you agree to the following terms in addition to the general Terms and Conditions.
            </p>
          </motion.div>

          <div className="space-y-16">
            {sections.map((section, index) => (
              <motion.div key={section.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 + index * 0.03 }}>
                <h2 className="text-2xl font-semibold text-foreground mb-6">{index + 1}. {section.title}</h2>
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

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="mt-20 p-8 bg-muted/50 rounded-3xl">
            <h2 className="text-xl font-semibold text-foreground mb-3">Related Documents</h2>
            <p className="text-muted-foreground mb-4">Review related agreements and policies.</p>
            <div className="flex flex-wrap gap-3 mb-6">
              <Button asChild variant="outline" className="rounded-full h-10 px-6"><Link to="/terms">Terms of Service</Link></Button>
              <Button asChild variant="outline" className="rounded-full h-10 px-6"><Link to="/vendor-agreement">Vendor Agreement</Link></Button>
              <Button asChild variant="outline" className="rounded-full h-10 px-6"><Link to="/cancellation-policy">Cancellation Policy</Link></Button>
            </div>
            <p className="text-sm text-muted-foreground">Questions? Contact our legal team at legal@nuru.tz</p>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default OrganiserAgreement;
