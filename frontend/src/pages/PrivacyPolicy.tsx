import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, Eye, Lock, UserCheck, Database, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";

const PrivacyPolicy = () => {
  const tableOfContents = [
    { id: "information-collection", title: "Information We Collect" },
    { id: "information-use", title: "How We Use Your Information" },
    { id: "information-sharing", title: "Information Sharing" },
    { id: "data-security", title: "Data Security" },
    { id: "your-rights", title: "Your Rights" },
    { id: "cookies", title: "Cookies and Tracking" },
    { id: "children", title: "Children's Privacy" },
    { id: "changes", title: "Changes to This Policy" },
    { id: "contact", title: "Contact Us" }
  ];

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  useMeta({
    title: "Privacy Policy",
    description: "Learn how Nuru collects, uses, and protects your personal information."
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
              <Shield className="w-12 h-12 text-primary mr-3" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Your privacy is important to us. This policy explains how Nuru collects, 
              uses, and protects your personal information.
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
              {/* Introduction */}
              <section>
                <div className="prose prose-gray max-w-none">
                  <p className="text-muted-foreground leading-relaxed">
                    At Nuru, we are committed to protecting your privacy and ensuring the security of your personal information. 
                    This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use 
                    our event management platform and services.
                  </p>
                </div>
              </section>

              {/* Information We Collect */}
              <section id="information-collection" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <Database className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">1. Information We Collect</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Personal Information</h3>
                        <p className="text-muted-foreground mb-2">
                          We collect personal information that you voluntarily provide when you:
                        </p>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                          <li>Create an account on our platform</li>
                          <li>Plan or manage events</li>
                          <li>Book services through our platform</li>
                          <li>Contact our customer support</li>
                          <li>Subscribe to our newsletters or marketing communications</li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Types of Personal Information</h3>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                          <li>Name and contact information (email, phone number, address)</li>
                          <li>Account credentials and profile information</li>
                          <li>Payment and billing information</li>
                          <li>Event details and guest information</li>
                          <li>Communication preferences</li>
                          <li>Photos and content you upload to our platform</li>
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Automatically Collected Information</h3>
                        <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                          <li>Device information (IP address, browser type, operating system)</li>
                          <li>Usage data (pages visited, features used, time spent)</li>
                          <li>Location information (with your permission)</li>
                          <li>Cookies and similar tracking technologies</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* How We Use Your Information */}
              <section id="information-use" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <Eye className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">2. How We Use Your Information</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        We use your personal information for the following purposes:
                      </p>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium text-foreground">Service Provision</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                            <li>Create and manage your account</li>
                            <li>Process event planning requests</li>
                            <li>Connect you with service providers</li>
                            <li>Handle payments and billing</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-foreground">Communication</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                            <li>Send event updates and reminders</li>
                            <li>Provide customer support</li>
                            <li>Send marketing communications</li>
                            <li>Notify about platform changes</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-foreground">Platform Improvement</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                            <li>Analyze usage patterns</li>
                            <li>Improve our services</li>
                            <li>Develop new features</li>
                            <li>Ensure platform security</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium text-foreground">Legal Compliance</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                            <li>Comply with legal obligations</li>
                            <li>Protect against fraud</li>
                            <li>Enforce our terms of service</li>
                            <li>Resolve disputes</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Information Sharing */}
              <section id="information-sharing" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <UserCheck className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">3. Information Sharing</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        We do not sell your personal information. We may share your information in the following circumstances:
                      </p>
                      
                      <div className="space-y-3">
                        <div className="border-l-4 border-primary pl-4">
                          <h4 className="font-medium text-foreground">Service Providers</h4>
                          <p className="text-sm text-muted-foreground">
                            We share relevant information with event service providers (caterers, photographers, venues) 
                            to facilitate your event planning and booking process.
                          </p>
                        </div>
                        
                        <div className="border-l-4 border-primary pl-4">
                          <h4 className="font-medium text-foreground">Business Partners</h4>
                          <p className="text-sm text-muted-foreground">
                            We may share aggregated, de-identified information with trusted partners to improve 
                            our services and develop new offerings.
                          </p>
                        </div>
                        
                        <div className="border-l-4 border-primary pl-4">
                          <h4 className="font-medium text-foreground">Legal Requirements</h4>
                          <p className="text-sm text-muted-foreground">
                            We may disclose your information when required by law, court order, or to protect 
                            our rights, property, or safety.
                          </p>
                        </div>
                        
                        <div className="border-l-4 border-primary pl-4">
                          <h4 className="font-medium text-foreground">Business Transfers</h4>
                          <p className="text-sm text-muted-foreground">
                            In the event of a merger, acquisition, or sale of assets, your information may be 
                            transferred as part of the business transaction.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Data Security */}
              <section id="data-security" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <Lock className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">4. Data Security</h2>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-muted-foreground">
                        We implement comprehensive security measures to protect your personal information:
                      </p>
                      
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="bg-primary/5 rounded-lg p-4">
                          <h4 className="font-medium text-foreground mb-2">Technical Safeguards</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• SSL/TLS encryption for data transmission</li>
                            <li>• Encrypted data storage</li>
                            <li>• Regular security audits and updates</li>
                            <li>• Secure payment processing</li>
                          </ul>
                        </div>
                        
                        <div className="bg-primary/5 rounded-lg p-4">
                          <h4 className="font-medium text-foreground mb-2">Administrative Safeguards</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Limited access to personal information</li>
                            <li>• Employee training on data protection</li>
                            <li>• Regular security policy reviews</li>
                            <li>• Incident response procedures</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                        <p className="text-sm text-foreground">
                          <strong>Important:</strong> While we implement robust security measures, no method of 
                          transmission over the internet or electronic storage is 100% secure. We cannot guarantee 
                          absolute security of your information.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Continue with remaining sections... */}
              <section id="your-rights" className="scroll-snap-start">
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-2xl font-bold text-foreground mb-4">5. Your Rights</h2>
                    <p className="text-muted-foreground mb-4">
                      You have the following rights regarding your personal information:
                    </p>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• <strong>Access:</strong> Request a copy of your personal information</li>
                      <li>• <strong>Correction:</strong> Update or correct inaccurate information</li>
                      <li>• <strong>Deletion:</strong> Request deletion of your personal information</li>
                      <li>• <strong>Portability:</strong> Receive your data in a portable format</li>
                      <li>• <strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
                    </ul>
                  </CardContent>
                </Card>
              </section>

              {/* Contact Section */}
              <section id="contact" className="scroll-snap-start">
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      <Phone className="w-6 h-6 text-primary mr-3" />
                      <h2 className="text-2xl font-bold text-foreground">Contact Us</h2>
                    </div>
                    <p className="text-muted-foreground mb-4">
                      If you have any questions about this Privacy Policy or our data practices, please contact us:
                    </p>
                    <div className="space-y-2 text-muted-foreground">
                      <p><strong>Email:</strong> privacy@nuru.com</p>
                      <p><strong>Phone:</strong> +1 (555) 123-4567</p>
                      <p><strong>Address:</strong> 123 Event Street, Planning City, PC 12345</p>
                    </div>
                    <div className="mt-6">
                      <Link 
                        to="/contact" 
                        className="inline-flex items-center btn-hero-primary"
                      >
                        Contact Our Privacy Team
                      </Link>
                    </div>
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

export default PrivacyPolicy;