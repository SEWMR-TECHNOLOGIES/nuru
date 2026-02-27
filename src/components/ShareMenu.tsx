import WhatsAppIcon from '@/assets/icons/whatsapp-icon.svg';
import FacebookIcon from '@/assets/icons/facebook-icon.svg';
import XIcon from '@/assets/icons/x-icon.svg';
import CopyIcon from '@/assets/icons/copy-icon.svg';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareMenuProps {
  shareUrl: string;
  shareTitle: string;
  onClose?: () => void;
}

const platforms = [
  { key: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon },
  { key: 'facebook', label: 'Facebook', icon: FacebookIcon },
  { key: 'x', label: 'X', icon: XIcon },
  { key: 'copy', label: 'Copy Link', icon: CopyIcon },
] as const;

const ShareMenu = ({ shareUrl, shareTitle, onClose }: ShareMenuProps) => {
  const handleShare = (platform: string) => {
    let url = '';
    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'x':
        url = `https://x.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied!');
        onClose?.();
        return;
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      onClose?.();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      {platforms.map((p) => (
        <Button
          key={p.key}
          variant="ghost"
          className="justify-start gap-2 text-sm"
          onClick={() => handleShare(p.key)}
        >
          <img src={p.icon} alt="" className="w-4 h-4 dark:invert opacity-80" />
          {p.label}
        </Button>
      ))}
    </div>
  );
};

export default ShareMenu;
