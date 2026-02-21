import { 
  Search, 
  HelpCircle, 
  Settings,
  Briefcase,
  User,
  Users,
  UsersRound,
  BookUser,
  AlertTriangle,
  LucideIcon
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NavLink } from 'react-router-dom'
import HomeIcon from '@/assets/icons/home-icon.svg'
import CalendarIcon from '@/assets/icons/calendar-icon.svg'
import ChatIcon from '@/assets/icons/chat-icon.svg'
import BellIcon from '@/assets/icons/bell-icon.svg'
import CardIcon from '@/assets/icons/card-icon.svg'
import TicketIcon from '@/assets/icons/ticket-icon.svg'
import AddSquareIcon from '@/assets/icons/add-square-icon.svg'

interface SidebarProps {
  onNavigate?: () => void;
}

type NavItem = {
  label: string;
  path: string;
} & (
  | { customIcon: string; lucideIcon?: never }
  | { lucideIcon: LucideIcon; customIcon?: never }
);

const Sidebar = ({ onNavigate }: SidebarProps) => {
  const navItems: NavItem[] = [
    { customIcon: HomeIcon, label: 'Home', path: '/' },
    { customIcon: CalendarIcon, label: 'My Events', path: '/my-events' },
    { customIcon: ChatIcon, label: 'Messages', path: '/messages' },
    { customIcon: BellIcon, label: 'Notifications', path: '/notifications' },
  ]

  const secondaryItems: NavItem[] = [
    { lucideIcon: Search, label: 'Find Services', path: '/find-services' },
    { lucideIcon: Briefcase, label: 'My Services', path: '/my-services' },
    { customIcon: CardIcon, label: 'Nuru Cards', path: '/nuru-cards' },
    
    { lucideIcon: Users, label: 'My Circle', path: '/circle' },
    { lucideIcon: BookUser, label: 'Contributors', path: '/my-contributors' },
    { lucideIcon: UsersRound, label: 'Communities', path: '/communities' },
    { lucideIcon: AlertTriangle, label: 'Removed Content', path: '/removed-content' },
    { lucideIcon: HelpCircle, label: 'Help', path: '/help' },
    { lucideIcon: Settings, label: 'Settings', path: '/settings' },
  ]

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-3 lg:px-3 md:px-0 md:justify-center lg:justify-start py-3 md:py-2.5 rounded-lg font-medium transition-colors text-left text-base md:text-base ${
      isActive
        ? 'bg-nuru-yellow/20 text-nuru-yellow'
        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
  }`

  const renderIcon = (item: NavItem) => {
    if (item.customIcon) {
      return <img src={item.customIcon} alt={item.label} className="w-5 h-5 flex-shrink-0" />
    }
    const IconComponent = item.lucideIcon!
    return <IconComponent className="w-5 h-5 flex-shrink-0" />
  }

  return (
    <aside className="w-14 lg:w-64 bg-sidebar-background md:border-r md:border-sidebar-border h-full overflow-y-auto overscroll-y-contain p-1.5 lg:p-4">
      {/* Navigation */}
      <nav className="space-y-1 lg:space-y-2">
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate} title={item.label}>
            {renderIcon(item)}
            <span className="hidden lg:inline">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Create Event Button */}
      <div className="mt-2">
        <NavLink to="/create-event" onClick={onNavigate}>
          <Button className="w-full bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground font-medium lg:px-4 px-0 justify-center">
            <img src={AddSquareIcon} alt="Create Event" className="w-5 h-5 lg:w-4 lg:h-4 lg:mr-2" />
            <span className="hidden lg:inline">Create Event</span>
          </Button>
        </NavLink>
      </div>

      {/* Browse Tickets */}
      <nav className="mt-2 space-y-1 lg:space-y-2">
        <NavLink to="/tickets" className={linkClass} onClick={onNavigate} title="Browse Tickets">
          <img src={TicketIcon} alt="Tickets" className="w-5 h-5 flex-shrink-0 dark:invert" />
          <span className="hidden lg:inline">Browse Tickets</span>
        </NavLink>
      </nav>

      {/* Secondary Navigation */}
      <nav className="mt-2 space-y-1 lg:space-y-2">
        {secondaryItems.map(item => (
          <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate} title={item.label}>
            {renderIcon(item)}
            <span className="hidden lg:inline">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Profile Section */}
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <NavLink to="/profile" className={linkClass} onClick={onNavigate} title="Your Profile">
          <User className="w-5 h-5" />
          <span className="hidden lg:inline">Your Profile</span>
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar
