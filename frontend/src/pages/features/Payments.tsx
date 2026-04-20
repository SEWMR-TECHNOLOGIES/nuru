import Layout from "@/components/layout/Layout";
import FeatureHero from "@/components/features/FeatureHero";
import FeatureGrid from "@/components/features/FeatureGrid";
import FeatureStatement from "@/components/features/FeatureStatement";
import illustrationImg from "@/assets/illustration-payments.jpg";
import { useMeta } from "@/hooks/useMeta";
import { useLanguage } from '@/lib/i18n/LanguageContext';

const Payments = () => {
  const { t } = useLanguage();
  const paymentMethods = [
    { title: "Cards accepted", description: "Visa, Mastercard, and all major credit cards" },
    { title: "Mobile money", description: "M-Pesa, Mixx by Yas, Airtel Money, HaloPesa" },
    { title: "Bank transfers", description: "Direct deposits for larger transactions" },
    { title: "Digital wallets", description: "Apple Pay, Google Pay, and more" },
    { title: "PayPal", description: "International payments made simple" },
    { title: "Cash tracking", description: "Record offline payments and keep everything in one place" }
  ];

  const features = [
    { title: "Instant confirmations", description: "Automatic receipts and booking confirmations" },
    { title: "Split payments", description: "Let multiple people contribute to one booking" },
    { title: "Refund management", description: "Easy handling of cancellations and refunds" },
    { title: "Financial reports", description: "Track all transactions in one clear view" }
  ];

  useMeta({
    title: "Secure Payments",
    description: "Pay and get paid with confidence. Multiple payment options with escrow protection."
  });

  return (
    <Layout>
      <FeatureHero
        title="Pay and get paid with confidence"
        description="Secure transactions for bookings, contributions, and vendor payments."
        imageSrc={illustrationImg}
        imageAlt="Secure Payments"
        imagePosition="right"
      />

      <FeatureGrid
        title="Multiple ways to pay"
        subtitle="Accept payments through the methods your guests and vendors prefer."
        items={paymentMethods}
        variant="cards"
      />

      <FeatureGrid
        title="Clear payment features"
        subtitle="Tools designed to make financial tracking simple for event organizers."
        items={features}
        variant="minimal"
      />

      <FeatureStatement
        statement="Trust is the foundation of every transaction. Funds are held securely until service delivery is confirmed."
      />
    </Layout>
  );
};

export default Payments;
