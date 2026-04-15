import React from "react";

// ── SVG icon imports for event types with custom artwork ──
import weddingIcon from "@/assets/icons/event-wedding.svg";
import birthdayIcon from "@/assets/icons/event-birthday.svg";
import corporateIcon from "@/assets/icons/event-corporate.svg";
import memorialIcon from "@/assets/icons/event-memorial.svg";
import anniversaryIcon from "@/assets/icons/event-anniversary.svg";
import conferenceIcon from "@/assets/icons/event-conference.svg";
import graduationIcon from "@/assets/icons/event-graduation.svg";

/* ---------- SVG-based icon map ---------- */

/**
 * Maps event type icon names (from the API) to imported SVG files.
 * For event types without a custom SVG, we fall back to a simple inline SVG.
 */
const svgIconMap: Record<string, string> = {
  Ring: weddingIcon,
  Cake: birthdayIcon,
  Briefcase: corporateIcon,
  Cross: memorialIcon,
  Heart: anniversaryIcon,
  Chalkboard: conferenceIcon,
  GraduationCap: graduationIcon,
};

/* ---------- Fallback inline SVG for unknown types ---------- */
const UnknownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    {...props}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 5 0c0 1.5-1 2-1 3" />
    <path d="M12 17v.01" />
  </svg>
);

/* ---------- EventIcon component ---------- */

export interface EventIconProps {
  iconName?: string | null;
  size?: number | string;
  className?: string;
}

/**
 * EventIcon: renders an event-type icon by its API icon name.
 * Uses custom SVG files for known types, falls back to an inline question-mark icon.
 */
export const EventIcon: React.FC<EventIconProps> = ({
  iconName,
  size = 20,
  className,
}) => {
  const svgSrc = iconName ? svgIconMap[iconName] : undefined;

  if (svgSrc) {
    return (
      <img
        src={svgSrc}
        alt=""
        width={typeof size === "number" ? size : undefined}
        height={typeof size === "number" ? size : undefined}
        className={`dark:invert ${className || ""}`}
        style={typeof size === "string" ? { width: size, height: size } : undefined}
        aria-hidden
      />
    );
  }

  return (
    <UnknownIcon
      width={typeof size === "number" ? size : 20}
      height={typeof size === "number" ? size : 20}
      className={className}
    />
  );
};

export default EventIcon;
