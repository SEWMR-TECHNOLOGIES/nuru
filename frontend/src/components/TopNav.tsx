import { NavLink } from 'react-router-dom';
import { Users, Search } from 'lucide-react';
import SvgIcon from '@/components/ui/svg-icon';
import HomeIcon from '@/assets/icons/home-icon.svg';
import CalendarIcon from '@/assets/icons/calendar-icon.svg';
import ChatIcon from '@/assets/icons/chat-icon.svg';
import TicketIcon from '@/assets/icons/ticket-icon.svg';
import { useConversations } from '@/data/useSocial';

const navItems = [
  { icon: HomeIcon, label: 'Home', path: '/', isCustom: true },
  { icon: CalendarIcon, label: 'Events', path: '/my-events', isCustom: true },
  { icon: ChatIcon, label: 'Messages', path: '/messages', isCustom: true },
  { icon: TicketIcon, label: 'Tickets', path: '/tickets', isCustom: true },
  { icon: Search, label: 'Services', path: '/find-services', isCustom: false },
  { icon: Users, label: 'Community', path: '/communities', isCustom: false },
];

const TopNav = () => {
  const { unreadCount } = useConversations();

  return (
    <nav className="md:hidden bg-card/80 backdrop-blur-xl border-b border-border/40">
      <div className="flex items-center justify-around px-2 py-1.5">
        {navItems.map(({ icon: Icon, label, path, isCustom }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              `relative flex items-center justify-center w-12 h-10 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-nuru-yellow/15 text-foreground'
                  : 'text-muted-foreground hover:text-foreground active:scale-90'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  {isCustom ? (
                    <SvgIcon
                      src={Icon as string}
                      alt={label}
                      className={`w-6 h-6 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
                    />
                  ) : (
                    <Icon
                      className={`w-6 h-6 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                  )}
                  {label === 'Messages' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 animate-scale-in">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                {isActive && (
                  <span className="absolute -bottom-1.5 w-5 h-[3px] rounded-full bg-nuru-yellow shadow-[0_0_6px_hsl(var(--nuru-yellow)/0.4)]" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default TopNav;