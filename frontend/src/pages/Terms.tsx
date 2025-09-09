import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FileText, Scale, AlertTriangle, Gavel, CreditCard, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";

const Terms = () => {
  const tableOfContents = [
    { id: "acceptance", title: "Acceptance of Terms" },
    { id: "platform-description", title: "Platform Description" },
    { id: "user-accounts", title: "User Accounts" },
    { id: "user-conduct", title: "User Conduct" },
    { id: "service-providers", title: "Service Providers" },
    { id: "payments", title: "Payments and Billing" },
    { id: "intellectual-property", title: "Intellectual Property" },
    { id: "privacy", title: "Privacy and Data" },
    { id: "limitation-liability", title: "Limitation of Liability" },
    { id: "termination", title: "Termination" },
    { id: "governing-law", title: "Governing Law" },
    { id: "changes", title: "Changes to Terms" },
    { id: "contact", title: "Contact Information" }
  ];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  useMeta({
    title: "Terms and Conditions",
    description: "Read Nuru's terms and conditions for using the platform and services."
  });

  return (
    <Layout>
      <div className="section-padding bg-background">
        <div className="container-custom max-w-6xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center mb-4">
              <Scale className="w-12 h-12 text-primary mr-3" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Terms & Conditions
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Please read these terms carefully before using Nuru's event management platform. 
              By using our services, you agree to be bound by these terms.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Last updated: December 2024
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Table of Contents - Sidebar */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:col-span-1"
            >
              <Card className="sticky top-24">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-foreground mb-4">Table of Contents</h3>
                  <nav className="space-y-2">
                    {tableOfContents.map((item, index) => (
                      <button
                        key={item.id}
                        onClick={() => scrollToSection(item.id)}
                        className="block w-full text-left text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                      >
                        {index + 1}. {item.title}
                      </button>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </motion.div>

            {/* Main Content */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="lg:col-span-3 space-y-8"
            >
              {/* Acceptance of Terms */}
              <section id="acceptance" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <Gavel className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">1. Acceptance of Terms</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-muted-foreground leading-relaxed">
                        Welcome to Nuru! These Terms and Conditions ("Terms") govern your use of the Nuru platform, 
                        website, and services (collectively, the "Service") operated by Nuru Inc. ("we," "us," or "our").
                      </p>
                      
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                        <p className="text-foreground font-medium mb-2">By using our Service, you agree to:</p>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• Be bound by these Terms and our Privacy Policy</li>
                          <li>• Comply with all applicable laws and regulations</li>
                          <li>• Accept responsibility for your use of the platform</li>
                          <li>• Acknowledge that you have read and understood these Terms</li>
                        </ul>
                      </div>
                      
                      <p className="text-muted-foreground">
                        If you do not agree to these Terms, please do not use our Service. We reserve the right to 
                        update these Terms at any time, and your continued use of the Service constitutes acceptance 
                        of any changes.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Platform Description */}
              <section id="platform-description" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <FileText className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">2. Platform Description</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        Nuru is an event management platform that connects event planners with service providers 
                        and offers tools for event planning, guest management, and coordination.
                      </p>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium text-foreground">Services We Provide</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Event planning and management tools</li>
                            <li>• Service provider marketplace</li>
                            <li>• Digital invitation system</li>
                            <li>• RSVP tracking and guest management</li>
                            <li>• Payment processing for bookings</li>
                            <li>• NFC-enabled event access technology</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-foreground">Service Limitations</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• We are a platform facilitator, not a service provider</li>
                            <li>• Service quality depends on third-party providers</li>
                            <li>• Platform availability may vary</li>
                            <li>• Some features require premium subscription</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* User Accounts */}
              <section id="user-accounts" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <Users className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">3. User Accounts</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Account Registration</h3>
                        <p className="text-muted-foreground mb-2">
                          To use certain features of our Service, you must create an account. You agree to:
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                          <li>Provide accurate, current, and complete information</li>
                          <li>Maintain and update your account information</li>
                          <li>Keep your password secure and confidential</li>
                          <li>Accept responsibility for all activities under your account</li>
                          <li>Notify us immediately of any unauthorized access</li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Account Responsibilities</h3>
                        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                          <p className="text-foreground">
                            <strong>Important:</strong> You are solely responsible for maintaining the confidentiality 
                            of your account credentials and for all activities that occur under your account, whether 
                            authorized by you or not.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* User Conduct */}
              <section id="user-conduct" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <AlertTriangle className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">4. User Conduct</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        You agree to use our Service responsibly and in accordance with these Terms. 
                        You may not use our Service to:
                      </p>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="border-l-4 border-destructive pl-4">
                          <h4 className="font-medium text-foreground mb-2">Prohibited Activities</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Violate any applicable laws or regulations</li>
                            <li>• Infringe on intellectual property rights</li>
                            <li>• Upload malicious code or viruses</li>
                            <li>• Engage in fraudulent activities</li>
                            <li>• Harass or harm other users</li>
                            <li>• Spam or send unsolicited communications</li>
                          </ul>
                        </div>
                        
                        <div className="border-l-4 border-primary pl-4">
                          <h4 className="font-medium text-foreground mb-2">Acceptable Use</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Plan legitimate events and gatherings</li>
                            <li>• Provide accurate event information</li>
                            <li>• Respect other users' privacy and rights</li>
                            <li>• Follow platform community guidelines</li>
                            <li>• Report inappropriate behavior</li>
                            <li>• Use the platform for its intended purpose</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Payments */}
              <section id="payments" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <CreditCard className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">6. Payments and Billing</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Payment Terms</h3>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                          <li>All payments are processed securely through our payment partners</li>
                          <li>Prices are displayed in USD unless otherwise specified</li>
                          <li>Payment is due at the time of booking or subscription</li>
                          <li>We may offer payment plans for certain services</li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Refund Policy</h3>
                        <div className="bg-primary/5 rounded-lg p-4">
                          <p className="text-muted-foreground text-sm">
                            Refunds are handled on a case-by-case basis and depend on the specific 
                            service provider's policies. Platform fees may be non-refundable. 
                            Contact our support team for refund requests.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Limitation of Liability */}
              <section id="limitation-liability" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold text-foreground mb-4">9. Limitation of Liability</h2>
                    
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
                      <p className="text-foreground font-medium mb-2">Important Legal Notice</p>
                      <p className="text-sm text-muted-foreground">
                        This section limits our liability and is important for understanding your rights and our responsibilities.
                      </p>
                    </div>
                    
                    <div className="space-y-4 text-muted-foreground">
                      <p>
                        To the fullest extent permitted by law, Nuru and its affiliates, officers, directors, 
                        employees, and agents shall not be liable for any indirect, incidental, special, 
                        consequential, or punitive damages, including but not limited to loss of profits, 
                        data, use, goodwill, or other intangible losses.
                      </p>
                      
                      <p>
                        Our total liability for any claims related to the Service shall not exceed the 
                        amount you paid to us in the twelve months preceding the claim.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Contact Section */}
              <section id="contact" className="scroll-snap-start">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold text-foreground mb-4">13. Contact Information</h2>
                    <p className="text-muted-foreground mb-4">
                      If you have questions about these Terms or need legal assistance, please contact us:
                    </p>
                    <div className="space-y-2 text-muted-foreground mb-6">
                      <p><strong>Legal Department:</strong> legal@nuru.com</p>
                      <p><strong>General Support:</strong> support@nuru.com</p>
                      <p><strong>Phone:</strong> +1 (555) 123-4567</p>
                      <p><strong>Address:</strong> 123 Event Street, Planning City, PC 12345</p>
                    </div>
                    <Link 
                      to="/contact" 
                      className="inline-flex items-center btn-hero-primary"
                    >
                      Contact Our Legal Team
                    </Link>
                  </CardContent>
                </Card>
              </section>
            </motion.div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Terms;