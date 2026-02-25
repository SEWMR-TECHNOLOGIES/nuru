import { useState, useEffect } from 'react'
import { 
  Search, 
  HelpCircle, 
  Briefcase,
  User,
  Users,
  UsersRound,
  BookUser,
  AlertTriangle,
  LucideIcon,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NavLink } from 'react-router-dom'
import SvgIcon from '@/components/ui/svg-icon'
import HomeIcon from '@/assets/icons/home-icon.svg'
import CalendarIcon from '@/assets/icons/calendar-icon.svg'
import ChatIcon from '@/assets/icons/chat-icon.svg'
import BellIcon from '@/assets/icons/bell-icon.svg'
import CardIcon from '@/assets/icons/card-icon.svg'
import TicketIcon from '@/assets/icons/ticket-icon.svg'
import AddSquareIcon from '@/assets/icons/add-square-icon.svg'
import IssueIcon from '@/assets/icons/issue-icon.svg'
import SettingsIcon from '@/assets/icons/settings-icon.svg'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

interface SidebarProps {
  onNavigate?: () => void;
  onReplayTour?: () => void;
}

type NavItem = {
  label: string;
  path: string;
  hint?: string;
} & (
  | { customIcon: string; lucideIcon?: never }
  | { lucideIcon: LucideIcon; customIcon?: never }
);

const HINTS_KEY = 'nuru_sidebar_hints';

const Sidebar = ({ onNavigate, onReplayTour }: SidebarProps) => {
  const [hintsEnabled, setHintsEnabled] = useState(() => {
    const stored = localStorage.getItem(HINTS_KEY);
    return stored !== 'false'; // enabled by default
  });

  useEffect(() => {
    const handler = () => {
      setHintsEnabled(localStorage.getItem(HINTS_KEY) !== 'false');
    };
    window.addEventListener('sidebar-hints-changed', handler);
    return () => window.removeEventListener('sidebar-hints-changed', handler);
  }, []);

  const navItems: NavItem[] = [
    { customIcon: HomeIcon, label: 'Home', path: '/', hint: 'View your feed with posts, trending moments, and updates from people and events you follow.' },
    { customIcon: CalendarIcon, label: 'My Events', path: '/my-events', hint: 'View and manage events you\'ve created, events you\'ve been invited to, and committees you\'re part of.' },
    { customIcon: ChatIcon, label: 'Messages', path: '/messages', hint: 'Send and receive private messages with event organizers, service providers, and your circle.' },
    { customIcon: BellIcon, label: 'Notifications', path: '/notifications', hint: 'See all your notifications including RSVPs, follows, bookings, contributions, and content updates.' },
  ]

  const secondaryItems: NavItem[] = [
    { lucideIcon: Search, label: 'Find Services', path: '/find-services', hint: 'Search and browse verified service providers like DJs, caterers, photographers, and decorators for your events.' },
    { lucideIcon: Briefcase, label: 'My Services', path: '/my-services', hint: 'Manage your listed services, view bookings, track ratings, and respond to client reviews.' },
    { customIcon: CardIcon, label: 'Nuru Pass', path: '/nuru-cards', hint: 'Order your Nuru Pass for seamless tap-to-check-in at events, with QR code backup and NFC support.' },
    { lucideIcon: Users, label: 'My Circle', path: '/circle', hint: 'View and manage the people you follow, your followers, and pending connection requests.' },
    { lucideIcon: BookUser, label: 'Contributors', path: '/my-contributors', hint: 'See a list of people who have contributed to your events and track their contributions.' },
    { lucideIcon: UsersRound, label: 'Communities', path: '/communities', hint: 'Browse, join, and participate in community groups based on shared interests or professions.' },
    { customIcon: IssueIcon, label: 'My Issues', path: '/my-issues', hint: 'Submit new issues and track the status of previously reported problems or disputes.' },
    { lucideIcon: AlertTriangle, label: 'Removed Content', path: '/removed-content', hint: 'View posts or moments that were removed, check the reason, and submit an appeal if needed.' },
    { lucideIcon: HelpCircle, label: 'Help', path: '/help', hint: 'Browse help categories, read FAQs, or contact support for assistance.' },
    { customIcon: SettingsIcon, label: 'Settings', path: '/settings', hint: 'Manage your notification preferences, privacy controls, theme, and account settings.' },
  ]

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-3 lg:px-3 md:px-0 md:justify-center lg:justify-start py-3 md:py-2.5 rounded-lg font-medium transition-colors text-left text-base md:text-base ${
      isActive
        ? 'bg-nuru-yellow/20 text-nuru-yellow'
        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
  }`

  const renderIcon = (item: NavItem) => {
    if (item.customIcon) {
      return <SvgIcon src={item.customIcon} alt={item.label} className="w-5 h-5 flex-shrink-0" />
    }
    const IconComponent = item.lucideIcon!
    return <IconComponent className="w-5 h-5 flex-shrink-0" />
  }

  const renderNavItem = (item: NavItem) => {
    const link = (
      <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate} title={item.label}>
        {renderIcon(item)}
        <span className="md:hidden lg:inline">{item.label}</span>
      </NavLink>
    );

    if (!hintsEnabled || !item.hint) return <div key={item.path}>{link}</div>;

    return (
      <HoverCard key={item.path} openDelay={400} closeDelay={100}>
        <HoverCardTrigger asChild>
          <div>{link}</div>
        </HoverCardTrigger>
        <HoverCardContent side="right" align="start" className="hidden lg:block w-72 bg-popover border border-border shadow-lg rounded-xl p-4">
          <p className="text-sm font-semibold text-foreground mb-1">{item.label}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.hint}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              localStorage.setItem(HINTS_KEY, 'false');
              setHintsEnabled(false);
              window.dispatchEvent(new Event('sidebar-hints-changed'));
            }}
            className="mt-2 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Don't show again
          </button>
        </HoverCardContent>
      </HoverCard>
    );
  };

  return (
    <aside className="w-full md:w-14 lg:w-64 bg-sidebar-background md:border-r md:border-sidebar-border h-full overflow-y-auto overscroll-y-contain p-1.5 lg:p-4">
      {/* Navigation */}
      <nav className="space-y-1 lg:space-y-2">
        {navItems.map(renderNavItem)}
      </nav>

      {/* Create Event Button */}
      <div className="mt-2">
        {hintsEnabled ? (
          <HoverCard openDelay={400} closeDelay={100}>
            <HoverCardTrigger asChild>
              <NavLink to="/create-event" onClick={onNavigate}>
                <Button className="w-full bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground font-medium lg:px-4 md:px-0 px-4 justify-center">
                  <SvgIcon src={AddSquareIcon} alt="Create Event" className="w-5 h-5 lg:w-4 lg:h-4 lg:mr-2" />
                  <span className="md:hidden lg:inline">Create Event</span>
                </Button>
              </NavLink>
            </HoverCardTrigger>
            <HoverCardContent side="right" align="start" className="hidden lg:block w-72 bg-popover border border-border shadow-lg rounded-xl p-4">
              <p className="text-sm font-semibold text-foreground mb-1">Create Event</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Set up a new event with details like title, date, location, budget, guest count, and ticket classes.</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  localStorage.setItem(HINTS_KEY, 'false');
                  setHintsEnabled(false);
                  window.dispatchEvent(new Event('sidebar-hints-changed'));
                }}
                className="mt-2 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Don't show again
              </button>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <NavLink to="/create-event" onClick={onNavigate}>
            <Button className="w-full bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground font-medium lg:px-4 md:px-0 px-4 justify-center">
              <SvgIcon src={AddSquareIcon} alt="Create Event" className="w-5 h-5 lg:w-4 lg:h-4 lg:mr-2" />
              <span className="md:hidden lg:inline">Create Event</span>
            </Button>
          </NavLink>
        )}
      </div>

      {/* Browse Tickets */}
      <nav className="mt-2 space-y-1 lg:space-y-2">
        {hintsEnabled ? (
          <HoverCard openDelay={400} closeDelay={100}>
            <HoverCardTrigger asChild>
              <NavLink to="/tickets" className={linkClass} onClick={onNavigate} title="Browse Tickets">
                <SvgIcon src={TicketIcon} alt="Tickets" className="w-5 h-5 flex-shrink-0" />
                <span className="md:hidden lg:inline">Browse Tickets</span>
              </NavLink>
            </HoverCardTrigger>
            <HoverCardContent side="right" align="start" className="hidden lg:block w-72 bg-popover border border-border shadow-lg rounded-xl p-4">
              <p className="text-sm font-semibold text-foreground mb-1">Browse Tickets</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Discover upcoming events near you and purchase tickets directly.</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  localStorage.setItem(HINTS_KEY, 'false');
                  setHintsEnabled(false);
                  window.dispatchEvent(new Event('sidebar-hints-changed'));
                }}
                className="mt-2 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                Don't show again
              </button>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <NavLink to="/tickets" className={linkClass} onClick={onNavigate} title="Browse Tickets">
            <SvgIcon src={TicketIcon} alt="Tickets" className="w-5 h-5 flex-shrink-0" />
            <span className="md:hidden lg:inline">Browse Tickets</span>
          </NavLink>
        )}
      </nav>

      {/* Secondary Navigation */}
      <nav className="mt-2 space-y-1 lg:space-y-2">
        {secondaryItems.map(renderNavItem)}
      </nav>

      {/* Replay Tour */}
      {onReplayTour && (
        <div className="mt-2">
          <button
            onClick={onReplayTour}
            className="w-full flex items-center gap-3 px-3 lg:px-3 md:px-0 md:justify-center lg:justify-start py-3 md:py-2.5 rounded-lg font-medium text-base md:text-base text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            <span className="md:hidden lg:inline">Replay Tour</span>
          </button>
        </div>
      )}

      {/* Profile Section */}
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <NavLink to="/profile" className={linkClass} onClick={onNavigate} title="Your Profile">
          <User className="w-5 h-5" />
          <span className="md:hidden lg:inline">Your Profile</span>
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar