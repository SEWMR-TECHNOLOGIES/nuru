/**
 * Overlay shown on items being deleted - consistent across the app.
 */
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteOverlayProps {
  visible: boolean;
  className?: string;
}

const DeleteOverlay = ({ visible, className }: DeleteOverlayProps) => {
  if (!visible) return null;

  return (
    <div className={cn(
      "absolute inset-0 z-10 flex items-center justify-center rounded-lg",
      "bg-background/70 backdrop-blur-[2px] transition-opacity duration-200",
      className
    )}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin text-destructive" />
        <span>Deleting…</span>
      </div>
    </div>
  );
};

export default DeleteOverlay;
