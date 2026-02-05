import Layout from "@/components/layout/Layout";
import FeatureHero from "@/components/features/FeatureHero";
import FeatureGrid from "@/components/features/FeatureGrid";
import FeatureStatement from "@/components/features/FeatureStatement";
import illustrationImg from "@/assets/illustration-payments.jpg";
import { useMeta } from "@/hooks/useMeta";

const Payments = () => {
  const paymentMethods = [
    { title: "Cards accepted", description: "Visa, Mastercard, and all major credit cards" },
    { title: "Mobile money", description: "M-Pesa, Tigo Pesa, and local providers" },
    { title: "Bank transfers", description: "Direct deposits for larger transactions" },
    { title: "Digital wallets", description: "Apple Pay, Google Pay, and more" },
    { title: "PayPal", description: "International payments made simple" },
    { title: "Cash tracking", description: "Record offline payments seamlessly" }
  ];

  const features = [
    { title: "Instant confirmations", description: "Automatic receipts and booking confirmations" },
    { title: "Split payments", description: "Let multiple people contribute to one booking" },
    { title: "Refund management", description: "Easy handling of cancellations and refunds" },
    { title: "Financial reports", description: "Track all transactions in one dashboard" }
  ];

  useMeta({
    title: "Secure Payments",
    description: "Book and pay with confidence using Nuru's protected payment system with multiple options."
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
        title="Smart payment features"
        subtitle="Tools designed to make financial management simple for event organizers."
        items={features}
        variant="minimal"
      />

      <FeatureStatement
        statement="Trust is the foundation of every transaction. Our secure payment system protects both organizers and guests."
      />
    </Layout>
  );
};

export default Payments;
