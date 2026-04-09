import Layout from "@/components/layout/Layout";
import FeatureHero from "@/components/features/FeatureHero";
import FeatureGrid from "@/components/features/FeatureGrid";
import FeatureStatement from "@/components/features/FeatureStatement";
import illustrationImg from "@/assets/illustration-event-planning.jpg";
import { useMeta } from "@/hooks/useMeta";
import { useLanguage } from '@/lib/i18n/LanguageContext';

const EventPlanning = () => {
  const { t } = useLanguage();
  const capabilities = [
    { title: "Timeline management", description: "Set milestones, track progress, and never miss a deadline" },
    { title: "Budget tracking", description: "Monitor expenses and stay within your planned budget" },
    { title: "Task assignment", description: "Delegate responsibilities and track completion" },
    { title: "Vendor coordination", description: "Keep all your vendors connected to your event in one place" },
    { title: "Guest organization", description: "See who is coming, who has not responded, and who still needs a reminder" },
    { title: "Reminders", description: "Stay on top of your event without manual follow-ups" }
  ];

  useMeta({
    title: "Event Planning Tools",
    description: "Keep every important detail in one place. Timelines, budgets, guests, and vendors organized clearly."
  });

  return (
    <Layout>
      <FeatureHero
        title="Keep every detail in one place"
        description="From intimate gatherings to large occasions, stay on top of timelines, budgets, and tasks without confusion."
        imageSrc={illustrationImg}
        imageAlt="Event Planning"
        imagePosition="right"
      />

      <FeatureGrid
        title="Everything you need, nothing you don't"
        subtitle="No more scattered spreadsheets or forgotten tasks. Nuru brings your planning tools together."
        items={capabilities}
        variant="cards"
      />

      <FeatureStatement
        statement="Planning an event should feel like a journey, not a burden. Tools built for the moments that matter."
      />
    </Layout>
  );
};

export default EventPlanning;
