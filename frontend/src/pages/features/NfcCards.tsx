import Layout from "@/components/layout/Layout";
import FeatureHero from "@/components/features/FeatureHero";
import FeatureGrid from "@/components/features/FeatureGrid";
import FeatureStatement from "@/components/features/FeatureStatement";
import illustrationImg from "@/assets/illustration-nfc-cards.jpg";
import { useMeta } from "@/hooks/useMeta";
import { useLanguage } from '@/lib/i18n/LanguageContext';

const NfcCards = () => {
  const { t } = useLanguage();
  const useCases = [
    { title: "Event check-ins", description: "No queues. No paper lists. Just tap and walk in." },
    { title: "Contact sharing", description: "Exchange details with a simple tap" },
    { title: "Digital business cards", description: "Professional networking at conferences and corporate events" },
    { title: "Guest book signing", description: "Digital signatures and messages" },
    { title: "Conference networking", description: "Connect attendees instantly" },
    { title: "Info access", description: "Menus, schedules, and venue details on tap" }
  ];

  const benefits = [
    { title: "Instant access", description: "Guests tap their phone to check in or get event info" },
    { title: "No app required", description: "Works with any modern smartphone out of the box" },
    { title: "Secure and private", description: "Encrypted NFC technology protects guest data" },
    { title: "Offline capable", description: "No internet connection needed at the venue" }
  ];

  useMeta({
    title: "NFC Smart Cards",
    description: "No queues. No paper lists. Tap and walk in with Nuru's NFC-enabled smart cards."
  });

  return (
    <Layout>
      <FeatureHero
        title="Tap once, access everything"
        description="Smart cards that eliminate queues and give guests instant access to event information."
        imageSrc={illustrationImg}
        imageAlt="NFC Cards"
        imagePosition="left"
      />

      <FeatureGrid
        title="One card, many uses"
        subtitle="Nuru cards can be programmed for various event needs, from check-ins to networking."
        items={useCases}
        variant="cards"
      />

      <FeatureGrid
        title="Why NFC cards"
        subtitle="Modern technology that makes events smoother for organizers and guests alike."
        items={benefits}
        variant="minimal"
      />

      <FeatureStatement
        statement="The future of events is contactless. Every guest deserves a warm welcome without the wait."
      />
    </Layout>
  );
};

export default NfcCards;
