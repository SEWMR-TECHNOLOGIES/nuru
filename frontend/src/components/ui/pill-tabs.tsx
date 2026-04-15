import * as React from "react";
import { cn } from "@/lib/utils";

interface PillTab {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface PillTabsNavProps {
  tabs: PillTab[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
}

/**
 * Horizontal scrollable pill-style tab navigation.
 * Matches the event management dashboard design.
 */
const PillTabsNav = ({ tabs, activeTab, onTabChange, className }: PillTabsNavProps) => {
  return (
    <div className={cn("mb-6 -mx-1 px-1", className)}>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            data-tab={tab.value}
            onClick={(e) => {
              onTabChange(tab.value);
              (e.currentTarget as HTMLElement).scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "center",
              });
            }}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all flex-shrink-0 flex items-center gap-1.5",
              activeTab === tab.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export { PillTabsNav };
export type { PillTab };
