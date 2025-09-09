import { motion } from "framer-motion";
import { ChevronDown, Search, HelpCircle } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { Link } from "react-router-dom";

const FAQs = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const faqs = [
    {
      category: "Getting Started",
      questions: [
        {
          question: "How does Nuru help me plan events?",
          answer: "Nuru is a comprehensive event management platform that connects you with verified service providers, helps you manage guest lists, send digital invitations, track RSVPs, and coordinate all aspects of your event from one central location. Our platform streamlines the entire planning process from initial concept to final celebration."
        },
        {
          question: "Is Nuru free to use?",
          answer: "Nuru offers both free and premium plans. Our basic plan allows you to create events, send invitations, and track RSVPs at no cost. Premium features include advanced analytics, priority support, custom branding, and access to exclusive service providers."
        },
        {
          question: "What types of events can I plan with Nuru?",
          answer: "You can plan any type of event with Nuru! From intimate birthday parties and anniversary celebrations to large weddings, corporate conferences, and community gatherings. Our platform is flexible and scales to accommodate events of any size."
        }
      ]
    },
    {
      category: "Service Providers",
      questions: [
        {
          question: "Can I offer my services on Nuru?",
          answer: "Absolutely! We welcome qualified service providers to join our platform. You'll need to complete our verification process, which includes providing business credentials, insurance information, and customer references. Once verified, you can create your profile and start connecting with event planners."
        },
        {
          question: "How are service providers verified?",
          answer: "All service providers undergo a rigorous verification process. We check business licenses, insurance coverage, review past work samples, and verify customer references. We also continuously monitor reviews and ratings to ensure quality standards are maintained."
        },
        {
          question: "What services are available on Nuru?",
          answer: "Our platform features a wide range of services including catering, photography, videography, entertainment (DJs, bands, performers), venue rentals, decorations, floral arrangements, transportation, security, and event coordination services."
        }
      ]
    },
    {
      category: "Payments & Security",
      questions: [
        {
          question: "Is payment secure on Nuru?",
          answer: "Yes, security is our top priority. We use industry-standard encryption and partner with trusted payment processors to ensure all transactions are secure. We never store your complete payment information on our servers, and all financial data is encrypted and protected."
        },
        {
          question: "How does payment work with service providers?",
          answer: "Payments are handled securely through our platform. You can pay deposits or full amounts directly through Nuru, and funds are held in escrow until services are completed satisfactorily. This protects both event planners and service providers."
        },
        {
          question: "What if I'm not satisfied with a service?",
          answer: "We have a comprehensive dispute resolution process. If you're not satisfied with a service, you can file a complaint through our platform. We'll mediate between you and the service provider to reach a fair resolution, which may include partial or full refunds depending on the circumstances."
        }
      ]
    },
    {
      category: "Technology & Features",
      questions: [
        {
          question: "What is the NFC-Ready Nuru Card?",
          answer: "The Nuru Card is our innovative NFC-enabled technology that allows seamless guest check-ins at your events. Guests can simply tap their phone to the card to automatically check in, view event details, and access digital programs. It's a modern, contactless solution that enhances the guest experience."
        },
        {
          question: "Can I customize my event invitations?",
          answer: "Yes! Nuru offers a variety of beautiful invitation templates that you can customize with your event details, colors, and branding. You can also upload your own images and create completely custom designs. All invitations are mobile-optimized and include RSVP tracking."
        },
        {
          question: "How do I track RSVPs and manage guest lists?",
          answer: "Our platform provides real-time RSVP tracking with detailed analytics. You can see who has responded, send reminder messages to non-responders, manage dietary restrictions and special requests, and export guest lists for your vendors. You can also send updates and announcements to all or selected guests."
        }
      ]
    }
  ];

  const filteredFAQs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter(
      faq =>
        faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  useMeta({
    title: "FAQs",
    description: "Frequently asked questions about using Nuru for event planning."
  });

  return (
    <Layout>
      <div className="section-padding bg-background">
        <div className="container-custom max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Find answers to common questions about Nuru and event planning. 
              Can't find what you're looking for? Contact our support team.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative mb-12"
          >
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search FAQs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </motion.div>

          {/* FAQs */}
          {filteredFAQs.length > 0 ? (
            <div className="space-y-8">
              {filteredFAQs.map((category, categoryIndex) => (
                <motion.div
                  key={category.category}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 + categoryIndex * 0.1 }}
                >
                  <Card>
                    <CardContent className="p-6">
                      <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center">
                        <HelpCircle className="w-5 h-5 mr-2 text-primary" />
                        {category.category}
                      </h2>
                      
                      <Accordion type="single" collapsible className="space-y-4">
                        {category.questions.map((faq, questionIndex) => (
                          <AccordionItem
                            key={questionIndex}
                            value={`${categoryIndex}-${questionIndex}`}
                            className="border border-border rounded-lg px-4"
                          >
                            <AccordionTrigger className="text-left hover:no-underline py-4">
                              <span className="font-medium text-foreground pr-4">
                                {faq.question}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4 text-muted-foreground leading-relaxed">
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center py-12"
            >
              <HelpCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No results found
              </h3>
              <p className="text-muted-foreground">
                Try adjusting your search terms or browse our categories above.
              </p>
            </motion.div>
          )}

          {/* Contact CTA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16 text-center"
          >
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-8">
                <h3 className="text-2xl font-semibold text-foreground mb-4">
                  Still have questions?
                </h3>
                <p className="text-muted-foreground mb-6">
                  Our support team is here to help you plan the perfect event.
                </p>
                <Link to="/contact" className="inline-flex items-center justify-center btn-hero-primary">
                  Contact Support
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default FAQs;