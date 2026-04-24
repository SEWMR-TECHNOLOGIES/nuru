import { useEffect, useRef } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { RegionConfig } from "@/lib/region/config";

interface Props {
  open: boolean;
  suggestedRegion: RegionConfig;
  switchUrl: string;
  onDismiss: () => void;
}

/**
 * Compact toast — used on authenticated/dashboard pages as a fallback
 * when the user skipped the modal/banner. Non-intrusive, auto-dismisses.
 */
const RegionSwitcherToast = ({ open, suggestedRegion, switchUrl, onDismiss }: Props) => {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!open || firedRef.current) return;
    firedRef.current = true;

    const id = toast(`You're in ${suggestedRegion.name}`, {
      description: `Switch to ${suggestedRegion.brandName} for a more local experience.`,
      icon: <Globe className="h-4 w-4" />,
      duration: 12000,
      action: {
        label: `Switch ${suggestedRegion.flag}`,
        onClick: () => {
          window.location.href = switchUrl;
        },
      },
      onDismiss: () => onDismiss(),
      onAutoClose: () => onDismiss(),
    });

    return () => {
      toast.dismiss(id);
    };
  }, [open, suggestedRegion, switchUrl, onDismiss]);

  return null;
};

export default RegionSwitcherToast;
