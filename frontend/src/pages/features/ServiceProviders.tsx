import Layout from "@/components/layout/Layout";
import FeatureHero from "@/components/features/FeatureHero";
import FeatureGrid from "@/components/features/FeatureGrid";
import FeatureStatement from "@/components/features/FeatureStatement";
import illustrationImg from "@/assets/illustration-service-providers.jpg";
import { useMeta } from "@/hooks/useMeta";
import { useLanguage } from '@/lib/i18n/LanguageContext';

const ServiceProviders = () => {
  const { t } = useLanguage();
  const providerTypes = [
    { title: "Photographers", description: "Capture every precious moment beautifully" },
    { title: "Caterers", description: "Culinary experiences for every palate" },
    { title: "DJs and Entertainment", description: "Set the mood and keep guests engaged" },
    { title: "Venue Decorators", description: "Transform spaces into stunning settings" },
    { title: "Event Coordinators", description: "Expert guidance from start to finish" },
    { title: "Florists", description: "Fresh arrangements that elevate any occasion" }
  ];

  const benefits = [
    { title: "Verified profiles", description: "Every vendor is vetted for quality and reliability" },
    { title: "Genuine reviews", description: "Read feedback from past clients to make informed decisions" },
    { title: "Direct messaging", description: "Chat with vendors to discuss needs and get quotes" },
    { title: "Secure bookings", description: "Book with confidence through our protected payment system" }
  ];

  useMeta({
    title: "Trusted Vendors",
    description: "Find verified vendors people already trust. Browse portfolios, read reviews, and book with confidence."
  });

  return (
    <Layout>
      <FeatureHero
        title="Work with vendors you can trust"
        description="Find verified vendors, see real activity, and keep bookings connected to your event."
        imageSrc={illustrationImg}
        imageAlt="Trusted Vendors"
        imagePosition="left"
      />

      <FeatureGrid
        title="Professionals for every need"
        subtitle="Our curated network includes specialists across all event service categories."
        items={providerTypes}
        variant="cards"
      />

      <FeatureGrid
        title="Why choose our network"
        subtitle="Every vendor meets our quality standards for professionalism and service."
        items={benefits}
        variant="minimal"
      />

      <FeatureStatement
        statement="Great events are made by great people. Find vendors people already trust and book with more confidence."
      />
    </Layout>
  );
};

export default ServiceProviders;
