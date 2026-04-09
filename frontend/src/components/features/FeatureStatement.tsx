import { motion } from "framer-motion";
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface FeatureStatementProps {
  statement: string;
}

const FeatureStatement = ({ statement }: FeatureStatementProps) => {
  const { t } = useLanguage();
  return (
    <section className="py-24 lg:py-32 px-6 lg:px-16 bg-foreground text-background">
      <div className="max-w-4xl mx-auto">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-2xl sm:text-3xl md:text-4xl font-medium leading-relaxed"
        >
          {statement}
        </motion.p>
      </div>
    </section>
  );
};

export default FeatureStatement;
