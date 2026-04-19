/**
 * SearchHeader — collapsible search control.
 * Renders a Search icon button by default; expands into a debounced text
 * input when activated. Designed to sit in page headers next to titles.
 */
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchHeaderProps {
  /** Current value (controlled). */
  value: string;
  /** Debounced change handler. */
  onChange: (v: string) => void;
  placeholder?: string;
  /** Debounce in ms. Defaults to 300. */
  debounceMs?: number;
  /** Optional class on the container. */
  className?: string;
  /** Force-open the input (skip the icon-only state). */
  alwaysOpen?: boolean;
}

const SearchHeader = ({
  value,
  onChange,
  placeholder = "Search…",
  debounceMs = 300,
  className,
  alwaysOpen = false,
}: SearchHeaderProps) => {
  const [open, setOpen] = useState<boolean>(alwaysOpen || !!value);
  const [local, setLocal] = useState<string>(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  // Keep local in sync if parent resets value externally.
  useEffect(() => {
    setLocal(value);
  }, [value]);

  // Debounce upward changes.
  useEffect(() => {
    if (local === value) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => onChange(local), debounceMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, debounceMs]);

  const expand = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const collapse = () => {
    setLocal("");
    onChange("");
    if (!alwaysOpen) setOpen(false);
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("rounded-full", className)}
        onClick={expand}
        aria-label="Open search"
      >
        <Search className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center w-full max-w-xs sm:max-w-sm transition-all",
        className,
      )}
    >
      <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-9 h-9 rounded-full bg-muted/40 border-border focus-visible:ring-1"
        onKeyDown={(e) => {
          if (e.key === "Escape") collapse();
        }}
      />
      {(local || alwaysOpen === false) && (
        <button
          type="button"
          onClick={collapse}
          aria-label="Clear search"
          className="absolute right-2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default SearchHeader;
