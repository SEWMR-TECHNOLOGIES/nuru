/**
 * Enhanced User search input - searches Nuru users by name, email, or phone.
 * If no user found, shows option to register a new user.
 */
import { useState, useRef, useEffect } from "react";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserSearch, type SearchedUser } from "@/hooks/useUserSearch";
import { authApi } from "@/lib/api/auth";
import { toast } from "sonner";

interface UserSearchInputProps {
  onSelect: (user: SearchedUser) => void;
  placeholder?: string;
  disabled?: boolean;
  allowRegister?: boolean;
}

const UserSearchInput = ({ onSelect, placeholder = "Search by email or phone...", disabled, allowRegister = true }: UserSearchInputProps) => {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerData, setRegisterData] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const { results, loading, search, clear } = useUserSearch();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    search(query);
  }, [query, search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setShowRegisterForm(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (user: SearchedUser) => {
    onSelect(user);
    setQuery("");
    setShowDropdown(false);
    setShowRegisterForm(false);
    clear();
  };

  const handleRegister = async () => {
    if (!registerData.first_name || !registerData.last_name || !registerData.email || !registerData.phone) {
      toast.error("Please fill all fields");
      return;
    }
    setRegistering(true);
    try {
      const username = `${registerData.first_name.toLowerCase()}.${registerData.last_name.toLowerCase()}.${Date.now().toString(36)}`;
      const response = await authApi.signup({
        first_name: registerData.first_name,
        last_name: registerData.last_name,
        username,
        email: registerData.email,
        phone: registerData.phone,
        password: "Nuru@2026"
      });
      if (response.success) {
        toast.success("User registered successfully");
        const newUser: SearchedUser = {
          id: (response.data as any)?.id || "",
          first_name: registerData.first_name,
          last_name: registerData.last_name,
          username,
          email: registerData.email,
          phone: registerData.phone,
        };
        handleSelect(newUser);
        setShowRegisterForm(false);
        setRegisterData({ first_name: "", last_name: "", email: "", phone: "" });
      } else {
        toast.error(response.message || "Registration failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const noResults = !loading && query.length >= 2 && results.length === 0;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
            setShowRegisterForm(false);
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
          {/* Loading skeleton */}
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

          {/* Results */}
          {!loading && results.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelect(user)}
              className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50 last:border-0"
            >
              <Avatar className="w-9 h-9">
                <AvatarImage src={user.avatar || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.first_name} {user.last_name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}{user.phone ? ` · ${user.phone}` : ""}
                </p>
              </div>
            </button>
          ))}

          {/* No results — register option */}
          {noResults && allowRegister && !showRegisterForm && (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">No users found for "{query}"</p>
              <Button size="sm" variant="outline" onClick={() => setShowRegisterForm(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Register New User
              </Button>
            </div>
          )}

          {noResults && !allowRegister && (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No users found
            </div>
          )}

          {/* Register form inline */}
          {showRegisterForm && (
            <div className="p-4 border-t border-border space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Register New User
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="First name *"
                  value={registerData.first_name}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, first_name: e.target.value }))}
                />
                <Input
                  placeholder="Last name *"
                  value={registerData.last_name}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
              <Input
                type="email"
                placeholder="Email *"
                value={registerData.email}
                onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
              />
              <Input
                placeholder="Phone *"
                value={registerData.phone}
                onChange={(e) => setRegisterData(prev => ({ ...prev, phone: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={handleRegister} disabled={registering}>
                  {registering ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Registering...</> : "Register & Select"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowRegisterForm(false)}>Cancel</Button>
              </div>
              <p className="text-xs text-muted-foreground">Default password: Nuru@2026</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSearchInput;
