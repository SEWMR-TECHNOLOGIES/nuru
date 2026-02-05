import Layout from "@/components/layout/Layout";
import FeatureHero from "@/components/features/FeatureHero";
import FeatureGrid from "@/components/features/FeatureGrid";
import FeatureStatement from "@/components/features/FeatureStatement";
import illustrationImg from "@/assets/illustration-invitations.jpg";
import { useMeta } from "@/hooks/useMeta";

const Invitations = () => {
  const features = [
    { title: "Beautiful templates", description: "Customizable designs that match your event's style" },
    { title: "RSVP tracking", description: "Real-time response monitoring with automatic reminders" },
    { title: "Guest preferences", description: "Collect dietary requirements and special requests" },
    { title: "Multi-channel delivery", description: "Send via email, SMS, or shareable links" },
    { title: "Live analytics", description: "See who viewed, opened, and responded" },
    { title: "Easy exports", description: "Download guest data anytime in any format" }
  ];

  useMeta({
    title: "Digital Invitations",
    description: "Design beautiful digital invitations, manage RSVPs, and track guest engagement in real time."
  });

  return (
    <Layout>
      <FeatureHero
        title="Invites that make responding easy"
        description="Create digital invitations that look great on any device and make RSVP management simple."
        imageSrc={illustrationImg}
        imageAlt="Digital Invitations"
        imagePosition="right"
      />

      <FeatureGrid
        title="More than just invitations"
        subtitle="Our invitation system handles everything from design to delivery to response tracking."
        items={features}
        variant="cards"
      />

      <FeatureStatement
        statement="Every guest deserves a warm welcome. Beautiful invitations set the tone for memorable gatherings."
      />
    </Layout>
  );
};

export default Invitations;
