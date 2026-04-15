import { cn } from '@/lib/utils';

interface SvgIconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  /** Force white icon (use on dark backgrounds regardless of theme) */
  forceWhite?: boolean;
}

/**
 * Renders an SVG icon as an <img> with automatic dark-mode color adaptation.
 * Black in light mode, white in dark mode. Use forceWhite for dark backgrounds.
 */
const SvgIcon = ({ src, alt = '', className, forceWhite, ...props }: SvgIconProps) => (
  <img
    src={src}
    alt={alt}
    className={cn(
      forceWhite ? 'icon-white' : 'icon-adaptive',
      className
    )}
    {...props}
  />
);

export default SvgIcon;
