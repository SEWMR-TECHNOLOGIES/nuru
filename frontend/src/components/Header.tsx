import { useState } from 'react';
import { Search, Bell, MessageCircle, X, Menu, PanelRight, User, Settings, LogOut, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NavLink, useNavigate } from 'react-router-dom';
import nuruLogo from '@/assets/nuru-logo.png';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from '@/components/ui/separator';
import { useLogout } from '@/api/useLogout';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface HeaderProps {
  onMenuToggle?: () => void;
  onRightPanelToggle?: () => void;
}

const Header = ({ onMenuToggle, onRightPanelToggle }: HeaderProps) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();
  const { logout } = useLogout();
  const { data: currentUser } = useCurrentUser();

  const notifications = [
    { id: 1, text: "John liked your event", time: "2 minutes ago", unread: true },
    { id: 2, text: "New message from Sarah", time: "1 hour ago", unread: true },
    { id: 3, text: "Event reminder: Wedding ceremony", time: "3 hours ago", unread: false },
    { id: 4, text: "Someone commented on your post", time: "1 day ago", unread: false },
  ];

  const renderAvatar = () => {
    if (currentUser?.avatar) {
      return (
        <img
          src={currentUser.avatar}
          alt="Profile"
          className="w-full h-full object-cover"
        />
      );
    } else if (currentUser) {
      // Generate initials
      const initials = `${currentUser.first_name[0]}${currentUser.last_name[0]}`.toUpperCase();
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-300 text-white font-semibold">
          {initials}
        </div>
      );
    } else {
      // Default placeholder
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-300 text-white font-semibold">
          ?
        </div>
      );
    }
  };

  return (
    <header className="bg-card border-b border-border h-16 flex items-center justify-between px-4 md:px-6 w-full relative">
      {/* Left side - Menu & Logo */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <img src={nuruLogo} alt="Nuru" className="h-6 md:h-8 w-auto" />
      </div>

      {/* Search Bar */}
      <div className="hidden lg:flex flex-1 max-w-3xl mx-8 relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search for events, people, service providers..."
          className="px-12 py-3 bg-slate-50/50 border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-lg"
        />
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Messages */}
        <NavLink to="/messages">
          <Button variant="ghost" size="icon" className="relative">
            <MessageCircle className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center text-[10px] md:text-xs">
              2
            </span>
          </Button>
        </NavLink>

        {/* Notifications */}
        <NavLink to="/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center text-[10px] md:text-xs">
              3
            </span>
          </Button>
        </NavLink>

        {/* Mobile Right Panel Toggle */}
        <Button 
          variant="ghost" 
          size="icon"
          className="lg:hidden"
          onClick={onRightPanelToggle}
        >
          <PanelRight className="w-5 h-5" />
        </Button>

        {/* Profile */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="focus:outline-none">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition">
                {renderAvatar()}
              </div>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-4" align="end">
            {currentUser && (
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                  {renderAvatar()}
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground">
                    {`${currentUser.first_name.charAt(0).toUpperCase()}${currentUser.first_name.slice(1)} ${currentUser.last_name.charAt(0).toUpperCase()}${currentUser.last_name.slice(1)}`}
                  </span>
                  <span className="text-sm text-muted-foreground">@{currentUser.username}</span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                className="justify-start gap-2"
                onClick={() => navigate('/profile')}
              >
                <User className="w-4 h-4" />
                Profile
              </Button>
              <Button
                variant="ghost"
                className="justify-start gap-2"
                onClick={() => navigate('/settings')}
              >
                <Settings className="w-4 h-4" />
                Settings
              </Button>
              <Button
                variant="ghost"
                className="justify-start gap-2"
                onClick={() => navigate('/my-posts')}
              >
                <Sparkles className="w-4 h-4" />
                Moments
              </Button>
              <Separator className="my-1" />
              <Button
                variant="ghost"
                className="justify-start gap-2 text-red-600 hover:text-red-600 hover:bg-red-50"
                onClick={logout}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};

export default Header;
