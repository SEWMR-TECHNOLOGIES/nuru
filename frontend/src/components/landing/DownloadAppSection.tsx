import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import AppStoreIcon from "@/assets/icons/app-store.svg";
import GooglePlayIcon from "@/assets/icons/google-play.svg";

export const APP_STORE_URL = "https://apps.apple.com/app/id6775049397";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=tz.nuru.app";

interface StoreButtonProps {
  href: string;
  icon: string;
  label: string;
  store: string;
}

const StoreButton = ({ href, icon, label, store }: StoreButtonProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="group flex items-center gap-4 bg-background text-foreground border border-border/70 rounded-2xl px-5 py-3.5 hover:border-foreground transition-all hover:-translate-y-0.5 min-w-[200px]"
  >
    <img src={icon} alt="" className="icon-original w-9 h-9 shrink-0" />
    <div className="flex flex-col text-left leading-tight">
      <span className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-mono">
        {label}
      </span>
      <span className="font-heading font-medium text-base text-foreground">
        {store}
      </span>
    </div>
  </a>
);

const DownloadAppSection = () => {
  return (
    <section
      id="download"
      className="relative border-t border-border/70 bg-muted/30 scroll-mt-24"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-24 lg:py-32">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-3 text-[10px] tracking-[0.28em] uppercase text-muted-foreground font-mono">
            § 07 — Mobile
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-9"
          >
            <h2 className="font-heading font-semibold tracking-[-0.035em] leading-[0.95] text-[clamp(2.25rem,5vw,4rem)] text-foreground">
              Carry the workspace
              <br />
              <span className="text-muted-foreground">in your pocket.</span>
            </h2>
            <p className="mt-8 max-w-2xl text-muted-foreground text-base lg:text-lg leading-relaxed">
              The Nuru app puts your events, contributions, tickets, vendors and
              messages one tap away, designed for how planning actually happens,
              on the move.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <StoreButton
                href={APP_STORE_URL}
                icon={AppStoreIcon}
                label="Download on the"
                store="App Store"
              />
              <StoreButton
                href={PLAY_STORE_URL}
                icon={GooglePlayIcon}
                label="Get it on"
                store="Google Play"
              />
            </div>

            <Link
              to="/download"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-foreground border-b border-foreground/30 hover:border-foreground transition-colors pb-0.5"
            >
              See full download guide
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default DownloadAppSection;
