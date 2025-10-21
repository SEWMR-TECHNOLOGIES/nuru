import React from "react";

const IconStyleProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as any;

/* ---------- Icon Components ---------- */
export const RingIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <path d="M21 12c0 4.418-6 9-9 9s-9-4.582-9-9 3.582-9 8-9 10 4.582 10 9z" />
    <path d="M7 10l3-3 3 3" />
  </svg>
);

export const BriefcaseIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <rect x="2" y="7" width="20" height="13" rx="2" />
    <path d="M16 7V5a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v2" />
  </svg>
);

export const CakeIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <path d="M3 13h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6z" />
    <path d="M5 13V7a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v6" />
    <path d="M8 6c1-1 2-1 2-2s1 1 2 2 1 0 2-1" />
  </svg>
);

export const CrossIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <path d="M3 12h18" />
    <path d="M12 3v18" />
  </svg>
);

export const HeartIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export const BullhornIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <path d="M3 11v2a1 1 0 0 0 1 1h3l7 4V6L7 9H4a1 1 0 0 0-1 1z" />
    <path d="M21 8v8" />
  </svg>
);

export const ChalkboardIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M8 19v2" />
    <path d="M16 19v2" />
  </svg>
);

export const FireworksIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="M4.5 4.5l3 3" />
    <path d="M16.5 16.5l3 3" />
    <path d="M4.5 19.5l3-3" />
    <path d="M16.5 7.5l3-3" />
  </svg>
);

export const GraduationCapIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <path d="M12 2L1 7l11 5 9-4.09V17" />
    <path d="M3 9v5a9 9 0 0 0 18 0V9" />
  </svg>
);

export const BabyCarriageIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <path d="M3 7h4l2 4h8" />
    <circle cx="7" cy="19" r="1.5" />
    <circle cx="19" cy="19" r="1.5" />
  </svg>
);

export const LandmarkIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <path d="M3 21h18" />
    <path d="M12 3l7 6H5l7-6z" />
    <path d="M9 21V10" />
    <path d="M15 21V10" />
  </svg>
);

export const UnknownIcon: React.FC<any> = (props) => (
  <svg {...IconStyleProps} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 5 0c0 1.5-1 2-1 3" />
    <path d="M12 17v.01" />
  </svg>
);

/* ---------- iconMap and EventIcon ---------- */

export const iconMap: Record<string, React.FC<any>> = {
  Ring: RingIcon,
  Briefcase: BriefcaseIcon,
  Cake: CakeIcon,
  Cross: CrossIcon,
  Heart: HeartIcon,
  Bullhorn: BullhornIcon,
  Chalkboard: ChalkboardIcon,
  Fireworks: FireworksIcon,
  GraduationCap: GraduationCapIcon,
  BabyCarriage: BabyCarriageIcon,
  Landmark: LandmarkIcon,
};

export interface EventIconProps extends React.SVGProps<SVGSVGElement> {
  iconName?: string | null;
  size?: number | string;
  className?: string;
}

/**
 * EventIcon: render icon by name (falls back to UnknownIcon)
 * forwards className / style / width / height
 */
export const EventIcon: React.FC<EventIconProps> = ({
  iconName,
  size = 20,
  className,
  ...rest
}) => {
  const IconComponent = (iconName && iconMap[iconName]) ? iconMap[iconName] : UnknownIcon;
  const styleProps = {
    width: size,
    height: size,
    className,
    ...rest,
  };
  return <IconComponent {...styleProps} />;
};

export default EventIcon;
