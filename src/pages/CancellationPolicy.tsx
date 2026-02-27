import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";

const CancellationPolicy = () => {
  useMeta({
    title: "Cancellation & Refund Policy | Nuru",
    description: "Understand Nuru Workspace's cancellation tiers, refund rules, escrow payment structure, and dispute processes for event bookings."
  });

  return (
    <Layout>
      <div className="min-h-screen pt-32 pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-16">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground tracking-tight mb-6">Cancellation & Refund Framework</h1>
            <p className="text-muted-foreground">Effective: February 2025</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mb-16">
            <p className="text-lg text-muted-foreground leading-relaxed">
              This framework applies to all organiser-to-vendor bookings processed through the Nuru escrow system. No custom cancellation policies are permitted. All vendors must operate within this structured system.
            </p>
          </motion.div>

          <div className="space-y-16">
            {/* Core Principles */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">1. Core Principles</h2>
              <ul className="space-y-4">
                {[
                  "No booking is confirmed without payment.",
                  "All refunds are calculated automatically by the platform.",
                  "No refund is available within 48 hours of the event start time, except in cases of vendor cancellation.",
                  "Vendor cancellation always overrides organiser penalties.",
                  "Cancellation and disputes are separate processes. Cancellation is about change of mind. Disputes are about service failure."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2.5 flex-shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Payment Structure */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">2. Payment Structure</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Every booking has two components:</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2.5 flex-shrink-0" />
                  <span className="text-muted-foreground leading-relaxed"><strong className="text-foreground">Booking Deposit (30%)</strong> — An upfront payment to secure the booking and protect vendor preparation costs.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2.5 flex-shrink-0" />
                  <span className="text-muted-foreground leading-relaxed"><strong className="text-foreground">Escrow Balance (70%)</strong> — The remaining amount held in escrow until service delivery.</span>
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">Nuru may adjust these percentages for certain service categories or high-value events.</p>
            </motion.div>

            {/* Cancellation Tiers */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.21 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">3. Cancellation Tiers</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">All vendor services operate under one of three standardised tiers determined by service category.</p>

              {/* Tier cards */}
              <div className="space-y-8">
                <div className="p-6 border border-border rounded-2xl">
                  <h3 className="text-lg font-semibold text-foreground mb-1">Tier 1: Flexible</h3>
                  <p className="text-sm text-muted-foreground mb-4">For low-preparation services (MCs, photographers, makeup artists)</p>
                  <ul className="space-y-2 text-muted-foreground text-sm">
                    <li>• More than 7 days before event → 100% refund</li>
                    <li>• 7 days to 48 hours → Deposit retained, 70% escrow refunded</li>
                    <li>• Within 48 hours → No refund</li>
                  </ul>
                </div>
                <div className="p-6 border border-border rounded-2xl">
                  <h3 className="text-lg font-semibold text-foreground mb-1">Tier 2: Moderate</h3>
                  <p className="text-sm text-muted-foreground mb-4">For medium-cost services (DJs, tent rental, basic decor)</p>
                  <ul className="space-y-2 text-muted-foreground text-sm">
                    <li>• More than 14 days → 100% refund</li>
                    <li>• 14 to 7 days → Deposit retained, 50% escrow refunded</li>
                    <li>• 7 days to 48 hours → Deposit retained, no escrow refund</li>
                    <li>• Within 48 hours → No refund</li>
                  </ul>
                </div>
                <div className="p-6 border border-border rounded-2xl">
                  <h3 className="text-lg font-semibold text-foreground mb-1">Tier 3: Strict</h3>
                  <p className="text-sm text-muted-foreground mb-4">For high-upfront-cost services (catering, large decor, stage construction)</p>
                  <ul className="space-y-2 text-muted-foreground text-sm">
                    <li>• More than 21 days → 100% refund</li>
                    <li>• 21 to 14 days → Deposit retained, 50% escrow refunded</li>
                    <li>• 14 days to 48 hours → Deposit retained, no escrow refund</li>
                    <li>• Within 48 hours → No refund</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* 48-Hour Rule */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.24 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">4. Universal 48-Hour Rule</h2>
              <p className="text-muted-foreground leading-relaxed">
                Across all tiers, if cancellation occurs within 48 hours of the event start time, no refund is available under any circumstances, except in cases of vendor cancellation. This rule prevents event-day abuse.
              </p>
            </motion.div>

            {/* Vendor Cancellation */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.27 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">5. Vendor Cancellation Rules</h2>
              <ul className="space-y-4">
                {[
                  "If a vendor cancels a confirmed booking, the organiser receives a 100% refund including the booking deposit.",
                  "The vendor receives a rating penalty and possible account strike.",
                  "Repeat violations may result in temporary suspension or permanent removal.",
                  "If a vendor cancels within 7 days of the event, Nuru may deduct an additional penalty from the vendor's security deposit."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2.5 flex-shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Force Majeure */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">6. Force Majeure</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">In extraordinary circumstances (natural disasters, government bans, serious medical emergencies with documentation, war or civil unrest), Nuru may at its discretion allow a partial refund, facilitate rescheduling, or override normal cancellation penalties. Decisions are made on a case-by-case basis.</p>
            </motion.div>

            {/* Rescheduling */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.33 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">7. Rescheduling</h2>
              <ul className="space-y-4">
                {[
                  "Instead of cancellation, an organiser may request to reschedule a booking.",
                  "If the vendor agrees, no penalty is applied, funds remain in escrow, and the new date is updated.",
                  "If the vendor declines, normal cancellation rules apply based on the applicable tier."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2.5 flex-shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* High-Value Events */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.36 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">8. High-Value Event Variations</h2>
              <p className="text-muted-foreground leading-relaxed">For events above a defined threshold (e.g., 3,000,000 TZS), Nuru may require a 40% deposit and 60% escrow balance. Refund percentages adjust proportionally, but the tier logic and rules remain the same.</p>
            </motion.div>

            {/* Platform Fees */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.39 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">9. Platform Fee Handling</h2>
              <ul className="space-y-4">
                {[
                  "If a booking is cancelled early and qualifies for a full refund, Nuru may deduct a small non-refundable processing fee.",
                  "If cancellation falls within a penalty window, Nuru retains its commission only on the retained amount.",
                  "All applicable fees are clearly disclosed before payment is processed."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2.5 flex-shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Anti-Abuse */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.42 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">10. Anti-Abuse Controls</h2>
              <ul className="space-y-4">
                {[
                  "Users cannot change an event date after booking to avoid cancellation penalties.",
                  "The cancellation timestamp is determined by the server, not the user's device.",
                  "All cancellation actions are logged permanently.",
                  "An organiser cannot cancel a booking after marking service as delivered."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2.5 flex-shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Automation */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.45 }}>
              <h2 className="text-2xl font-semibold text-foreground mb-6">11. System Automation</h2>
              <ul className="space-y-4">
                {[
                  "All cancellation and refund calculations are performed automatically by the platform.",
                  "Event start times are stored in UTC.",
                  "Cancellation windows are calculated precisely based on server time.",
                  "Refund logic is applied automatically without manual intervention.",
                  "All cancellation timestamps and actions are logged permanently."
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-2.5 flex-shrink-0" />
                    <span className="text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} className="mt-20 p-8 bg-muted/50 rounded-3xl">
            <h2 className="text-xl font-semibold text-foreground mb-3">Related Documents</h2>
            <p className="text-muted-foreground mb-4">Review related agreements and policies.</p>
            <div className="flex flex-wrap gap-3 mb-6">
              <Button asChild variant="outline" className="rounded-full h-10 px-6"><Link to="/terms">Terms of Service</Link></Button>
              <Button asChild variant="outline" className="rounded-full h-10 px-6"><Link to="/vendor-agreement">Vendor Agreement</Link></Button>
              <Button asChild variant="outline" className="rounded-full h-10 px-6"><Link to="/organiser-agreement">Organiser Agreement</Link></Button>
            </div>
            <p className="text-sm text-muted-foreground">Questions? Contact our legal team at legal@nuru.tz</p>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
};

export default CancellationPolicy;
