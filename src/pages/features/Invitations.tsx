import Layout from "@/components/layout/Layout";
import FeatureHero from "@/components/features/FeatureHero";
import FeatureGrid from "@/components/features/FeatureGrid";
import FeatureStatement from "@/components/features/FeatureStatement";
import illustrationImg from "@/assets/illustration-invitations.jpg";
import { useMeta } from "@/hooks/useMeta";
import { useLanguage } from '@/lib/i18n/LanguageContext';

const Invitations = () => {
  const { t } = useLanguage();
  const features = [
    { title: "Beautiful templates", description: "Customizable designs that match your event's style" },
    { title: "RSVP tracking", description: "See who responded, who hasn't, and send reminders" },
    { title: "Guest preferences", description: "Collect dietary requirements and special requests" },
    { title: "Multi-channel delivery", description: "Send via email, SMS, or shareable links" },
    { title: "Live analytics", description: "See who viewed, opened, and responded" },
    { title: "Easy exports", description: "Download guest data anytime in any format" }
  ];

  useMeta({
    title: "Digital Invitations",
    description: "Invite people and keep responses in one place. Know who is coming and who still needs a reminder."
  });

  return (
    <Layout>
      <FeatureHero
        title="Invite people and keep responses in one place"
        description="Know who is coming, who has not responded, and who still needs a reminder."
        imageSrc={illustrationImg}
        imageAlt="Digital Invitations"
        imagePosition="right"
      />

      <FeatureGrid
        title="More than just invitations"
        subtitle="From design to delivery to response tracking, everything your guest list needs."
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
