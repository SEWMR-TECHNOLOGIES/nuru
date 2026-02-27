import { Link } from "react-router-dom";
import nuruLogo from "@/assets/nuru-logo.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 md:gap-8 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <img 
              src={nuruLogo} 
              alt="Nuru" 
              className="h-8 w-auto brightness-0 invert mb-6"
            />
            <p className="text-background/60 text-sm leading-relaxed">
              Plan smarter.
              <br />
              Celebrate better.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-medium text-sm tracking-wide mb-6">Product</h3>
            <ul className="space-y-4">
              <li>
                <Link to="/#features" className="text-sm text-background/60 hover:text-background transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/faqs" className="text-sm text-background/60 hover:text-background transition-colors">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-medium text-sm tracking-wide mb-6">Company</h3>
            <ul className="space-y-4">
              <li>
                <Link to="/contact" className="text-sm text-background/60 hover:text-background transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-medium text-sm tracking-wide mb-6">Legal</h3>
            <ul className="space-y-4">
              <li>
                <Link to="/privacy-policy" className="text-sm text-background/60 hover:text-background transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-background/60 hover:text-background transition-colors">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-background/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm text-background/40">
            © {currentYear} Nuru | SEWMR TECHNOLOGIES
          </p>
          <div className="flex items-center gap-8">
            <a 
              href="mailto:hello@nuru.tz" 
              className="text-sm text-background/60 hover:text-background transition-colors"
            >
              hello@nuru.tz
            </a>
            <a 
              href="tel:+255653750805" 
              className="text-sm text-background/60 hover:text-background transition-colors"
            >
              +255 653 750 805
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
