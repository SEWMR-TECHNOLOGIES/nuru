import Layout from "@/components/layout/Layout";
import FeatureHero from "@/components/features/FeatureHero";
import FeatureGrid from "@/components/features/FeatureGrid";
import FeatureStatement from "@/components/features/FeatureStatement";
import illustrationImg from "@/assets/illustration-event-planning.jpg";
import { useMeta } from "@/hooks/useMeta";

const EventPlanning = () => {
  const capabilities = [
    { title: "Timeline management", description: "Set milestones, track progress, and never miss a deadline" },
    { title: "Budget tracking", description: "Monitor expenses and stay within your planned budget" },
    { title: "Task assignment", description: "Delegate responsibilities and track completion" },
    { title: "Vendor coordination", description: "Communicate seamlessly with all your service providers" },
    { title: "Guest organization", description: "Manage your guest list with ease and precision" },
    { title: "Smart reminders", description: "Automated notifications keep everyone on schedule" }
  ];

  useMeta({
    title: "Smart Event Planning",
    description: "Plan weddings, parties, and ceremonies with clarity using Nuru's intelligent event planning tools."
  });

  return (
    <Layout>
      <FeatureHero
        title="Organize every detail with confidence"
        description="From intimate gatherings to large occasions, our planning tools help you stay on top of timelines, budgets, and tasks."
        imageSrc={illustrationImg}
        imageAlt="Event Planning"
        imagePosition="right"
      />

      <FeatureGrid
        title="Everything you need in one place"
        subtitle="No more scattered spreadsheets or forgotten tasks. Nuru brings all your planning tools together."
        items={capabilities}
        variant="cards"
      />

      <FeatureStatement
        statement="Planning an event should feel like a journey, not a burden. We built these tools to help you focus on what truly matters."
      />
    </Layout>
  );
};

export default EventPlanning;
