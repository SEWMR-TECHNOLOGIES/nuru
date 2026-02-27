/**
 * Contributor search input - searches user's address book contributors by name/phone.
 * Matches the same UX pattern as UserSearchInput.
 */
import { useState, useRef, useEffect } from "react";
import { Search, Loader2, BookUser } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useContributorSearch } from "@/hooks/useContributorSearch";
import type { UserContributor } from "@/lib/api/contributors";

interface ContributorSearchInputProps {
  onSelect: (contributor: UserContributor) => void;
  placeholder?: string;
  disabled?: boolean;
}

const ContributorSearchInput = ({ onSelect, placeholder = "Search contributor by name or phone...", disabled }: ContributorSearchInputProps) => {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const { results, loading, search, clear } = useContributorSearch();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    search(query);
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (contributor: UserContributor) => {
    onSelect(contributor);
    setQuery("");
    setShowDropdown(false);
    clear();
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
      : name.charAt(0).toUpperCase();
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder={placeholder}
          className="pl-9"
          disabled={disabled}
        />
        {loading && query.length >= 2 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {showDropdown && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {loading && (
            <div className="p-2 space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && results.map((contributor) => (
            <button
              key={contributor.id}
              type="button"
              onClick={() => handleSelect(contributor)}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50 last:border-0"
            >
              <Avatar className="w-9 h-9">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {getInitials(contributor.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{contributor.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {contributor.phone || contributor.email || "No contact info"}
                </p>
              </div>
              <BookUser className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          ))}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No contributors found. Add them in your <a href="/my-contributors" className="text-primary underline">address book</a> first.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContributorSearchInput;
