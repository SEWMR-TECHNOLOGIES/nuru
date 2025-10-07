import { Button } from '@/components/ui/button';

interface AdCardProps {
  title: string;
  description: string;
  image: string;
  cta: string;
}

const AdCard = ({ title, description, image, cta }: AdCardProps) => {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-border bg-gradient-to-r from-nuru-yellow/20 to-transparent">
        <span className="text-xs font-medium text-muted-foreground">Sponsored</span>
        <span className="text-xs text-muted-foreground">Nuru Ad</span>
      </div>

      {/* Body */}
      <div className="p-3 md:p-5">
        <div className="flex flex-col sm:flex-row gap-3 md:gap-5 items-center sm:items-start">
          {/* Image with subtle highlight */}
          <div className="relative w-full sm:w-20 md:w-24 h-32 sm:h-20 md:h-24 flex-shrink-0 rounded-lg overflow-hidden">
            <img
              src={image}
              alt={title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-nuru-yellow/30 to-transparent pointer-events-none"></div>
          </div>

          {/* Text */}
          <div className="flex-1 text-center sm:text-left w-full">
            <h3 className="text-base md:text-lg font-bold text-foreground mb-1 leading-tight">
              {title}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4 line-clamp-2 md:line-clamp-3">
              {description}
            </p>
            <Button
              size="sm"
              className="px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-nuru-yellow text-black font-medium hover:bg-nuru-yellow/95 text-sm w-full sm:w-auto"
            >
              {cta}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdCard;
