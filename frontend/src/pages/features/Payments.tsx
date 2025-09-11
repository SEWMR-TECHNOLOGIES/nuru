import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Shield, Smartphone, Globe } from "lucide-react";
import Layout from "@/components/layout/Layout";
import featureImg from "@/assets/feature-payments.jpg";
import { useMeta } from "@/hooks/useMeta";

const Payments = () => {
  const features = [
    {
      icon: CreditCard,
      title: "Multiple Payment Options",
      description: "Accept credit cards, digital wallets, bank transfers, and mobile money payments."
    },
    {
      icon: Shield,
      title: "Bank-Level Security",
      description: "PCI DSS compliant with end-to-end encryption and fraud protection."
    },
    {
      icon: Smartphone,
      title: "Mobile Optimized",
      description: "Seamless payment experience across all devices and platforms."
    },
    {
      icon: Globe,
      title: "Global Reach",
      description: "Support for multiple currencies and international payment methods."
    }
  ];

  const paymentMethods = [
    "Visa & Mastercard", "Apple Pay & Google Pay", "Bank Transfers", 
    "Mobile Money", "PayPal", "Cryptocurrency"
  ];

  const benefits = [
    { title: "Instant Confirmations", description: "Immediate booking confirmations and receipts" },
    { title: "Automated Invoicing", description: "Generate and send invoices automatically" },
    { title: "Split Payments", description: "Allow multiple people to pay for one booking" },
    { title: "Refund Management", description: "Easy refunds and cancellation handling" }
  ];

  useMeta({
    title: "Secure Payments",
    description: "Book and pay with confidence using Nuru's fully protected payment system. Multiple payment options and bank-level security for all your event transactions."
  });

  return (
    <Layout>
      <div className="min-h-screen bg-background section-padding">
        {/* Hero Header */}
        <div className="bg-foreground text-background py-20">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl mx-auto text-center px-4 sm:px-6"
            >
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mb-8 border-background/20 text-black hover:bg-background/10"
              >
                <Link to="/" className="inline-flex items-center">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Link>
              </Button>

              <h1 className="text-5xl sm:text-6xl font-bold mb-6">
                Secure
                <span className="block text-accent-brand">Payments</span>
              </h1>

              <p className="text-xl text-background/80 max-w-2xl mx-auto mb-8">
                Book and pay with confidence using our fully protected transaction system with multiple payment options.
              </p>

              <Button asChild size="lg" className="bg-accent-brand hover:bg-accent-brand/90 text-foreground">
                <Link to="/register">Setup Payments</Link>
              </Button>
            </motion.div>
          </div>
        </div>


        {/* Hero Section */}
        <div className="py-16">
          <div className="container-custom">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-6"
              >
                <h2 className="text-3xl font-bold text-foreground">
                  Payment Processing Made Simple
                </h2>
                <p className="text-lg text-muted-foreground">
                  Nuru's payment system provides a seamless, secure way to handle all financial transactions for your events. From service provider bookings to guest payments, everything is protected and streamlined.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {paymentMethods.map((method, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex items-center space-x-2 p-3 bg-card rounded-lg border"
                    >
                      <div className="w-2 h-2 bg-accent-brand rounded-full flex-shrink-0"></div>
                      <span className="text-sm font-medium text-foreground">{method}</span>
                    </motion.div>
                  ))}
                </div>
                <Button asChild className="bg-black hover:bg-gray-800 text-white">
                  <Link to="/register">Start Processing</Link>
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <img
                  src={featureImg}
                  alt="Secure Payments"
                  className="w-full rounded-2xl shadow-xl"
                />
              </motion.div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="py-16 bg-card">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Enterprise-Grade Security</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Your financial data and transactions are protected by industry-leading security measures.
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className="text-center p-6 bg-background rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-accent-brand/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-accent-brand" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="py-16">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Smart Payment Features</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Advanced payment capabilities designed for modern event management.
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-2 gap-8">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.4 + index * 0.1 }}
                  className="flex items-start space-x-4 p-6 bg-card rounded-xl"
                >
                  <div className="w-2 h-2 bg-accent-brand rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{benefit.title}</h3>
                    <p className="text-muted-foreground">{benefit.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Security Stats */}
        <div className="py-16 bg-card">
          <div className="container-custom">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              className="grid md:grid-cols-4 gap-8 text-center"
            >
              <div>
                <div className="text-4xl font-bold text-accent-brand mb-2">99.9%</div>
                <div className="text-muted-foreground">Uptime Guarantee</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-accent-brand mb-2">256-bit</div>
                <div className="text-muted-foreground">SSL Encryption</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-accent-brand mb-2">PCI DSS</div>
                <div className="text-muted-foreground">Compliance Level 1</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-accent-brand mb-2">24/7</div>
                <div className="text-muted-foreground">Fraud Monitoring</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-16">
          <div className="container-custom text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-3xl font-bold text-foreground mb-4">Ready for Secure Payments?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Start accepting payments safely and efficiently with Nuru's payment platform.
              </p>
              <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/register">Set Up Payments</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Payments;