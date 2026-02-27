import Layout from "@/components/layout/Layout";
import FeatureHero from "@/components/features/FeatureHero";
import FeatureGrid from "@/components/features/FeatureGrid";
import FeatureStatement from "@/components/features/FeatureStatement";
import illustrationImg from "@/assets/illustration-service-providers.jpg";
import { useMeta } from "@/hooks/useMeta";

const ServiceProviders = () => {
  const providerTypes = [
    { title: "Photographers", description: "Capture every precious moment beautifully" },
    { title: "Caterers", description: "Culinary experiences for every palate" },
    { title: "DJs and Entertainment", description: "Set the mood and keep guests engaged" },
    { title: "Venue Decorators", description: "Transform spaces into stunning settings" },
    { title: "Event Coordinators", description: "Expert guidance from start to finish" },
    { title: "Florists", description: "Fresh arrangements that elevate any occasion" }
  ];

  const benefits = [
    { title: "Verified profiles", description: "Every provider is vetted for quality and reliability" },
    { title: "Genuine reviews", description: "Read feedback from past clients to make informed decisions" },
    { title: "Direct messaging", description: "Chat with providers to discuss your needs and get quotes" },
    { title: "Secure bookings", description: "Book with confidence through our protected platform" }
  ];

  useMeta({
    title: "Verified Service Providers",
    description: "Browse and book trusted, top-rated service providers for catering, DJs, photographers, and more."
  });

  return (
    <Layout>
      <FeatureHero
        title="Find the right people for your event"
        description="Connect with trusted, verified professionals who bring your vision to life."
        imageSrc={illustrationImg}
        imageAlt="Service Providers"
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
        subtitle="Every provider meets our quality standards for professionalism and service."
        items={benefits}
        variant="minimal"
      />

      <FeatureStatement
        statement="Great events are made by great people. We connect you with the professionals who make visions reality."
      />
    </Layout>
  );
};

export default ServiceProviders;
