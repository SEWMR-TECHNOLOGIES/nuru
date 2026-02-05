import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FeatureGridItem {
  title: string;
  description?: string;
  icon?: ReactNode;
}

interface FeatureGridProps {
  title: string;
  subtitle?: string;
  items: FeatureGridItem[];
  variant?: "cards" | "minimal" | "numbered";
}

const FeatureGrid = ({ title, subtitle, items, variant = "cards" }: FeatureGridProps) => {
  return (
    <section className="py-24 lg:py-32 px-6 lg:px-16">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {title}
          </h2>
          {subtitle && (
            <p className="text-muted-foreground max-w-lg text-lg">
              {subtitle}
            </p>
          )}
        </motion.div>

        {variant === "cards" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                viewport={{ once: true }}
                className="group relative p-8 rounded-2xl bg-gradient-to-br from-muted/50 to-transparent border border-border hover:border-foreground/20 transition-all duration-300"
              >
                {/* Number indicator */}
                <span className="absolute top-6 right-6 text-5xl font-bold text-foreground/5 group-hover:text-foreground/10 transition-colors">
                  {String(index + 1).padStart(2, '0')}
                </span>
                
                <div className="relative z-10">
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Hover accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-accent/50 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </div>
        )}

        {variant === "minimal" && (
          <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
            {items.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="flex gap-5"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center">
                  <span className="text-lg font-semibold text-foreground/40">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {variant === "numbered" && (
          <div className="space-y-0">
            {items.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.08 }}
                viewport={{ once: true }}
                className="group flex items-start gap-8 py-8 border-b border-border last:border-0"
              >
                <span className="text-4xl sm:text-5xl font-bold text-foreground/10 group-hover:text-foreground/20 transition-colors w-16 flex-shrink-0">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="pt-2">
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeatureGrid;
