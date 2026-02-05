import { 
  Home, 
  Calendar, 
  MessageCircle, 
  Bell, 
  Plus, 
  Search, 
  HelpCircle, 
  Settings,
  Briefcase,
  User,
  Users,
  UsersRound,
  ClipboardList,
  CreditCard
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NavLink } from 'react-router-dom'

interface SidebarProps {
  onNavigate?: () => void;
}

const Sidebar = ({ onNavigate }: SidebarProps) => {
  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Calendar, label: 'My Events', path: '/my-events' },
    { icon: MessageCircle, label: 'Messages', path: '/messages' },
    { icon: Bell, label: 'Notifications', path: '/notifications' },
  ]

  const secondaryItems = [
    { icon: Search, label: 'Find Services', path: '/find-services' },
    { icon: Briefcase, label: 'My Services', path: '/my-services' },
    { icon: ClipboardList, label: 'Bookings', path: '/bookings' },
    { icon: CreditCard, label: 'Nuru Cards', path: '/nuru-cards' },
    { icon: Users, label: 'My Circle', path: '/circle' },
    { icon: UsersRound, label: 'Communities', path: '/communities' },
    { icon: HelpCircle, label: 'Help', path: '/help' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ]

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors text-left ${
      isActive
        ? 'bg-nuru-yellow/20 text-nuru-yellow' // changed to match Create Event with opacity
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`


  return (
    <aside className="w-64 bg-sidebar-bg border-r border-border h-full overflow-y-auto overscroll-y-contain p-4">
      {/* Navigation */}
      <nav className="space-y-2">
        {navItems.map(item => (
          <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate}>
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Create Event Button */}
      <div className="mt-6">
        <NavLink to="/create-event" onClick={onNavigate}>
          <Button className="w-full bg-nuru-yellow hover:bg-nuru-yellow/90 text-foreground font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Create Event
          </Button>
        </NavLink>
      </div>

      {/* Secondary Navigation */}
      <nav className="mt-8 space-y-2">
        {secondaryItems.map(item => (
          <NavLink key={item.path} to={item.path} className={linkClass} onClick={onNavigate}>
            <item.icon className="w-5 h-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Profile Section */}
      <div className="mt-auto pt-4 border-t border-border">
        <NavLink to="/profile" className={linkClass} onClick={onNavigate}>
          <User className="w-5 h-5" />
          Your Profile
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar
