import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardCheck,
  History,
  Users,
  UserCircle,
  Settings,
  Calendar,
  AlertTriangle,
  FileText,
  TrendingUp,
  Search,
  Building2,
  ShieldAlert,
  FolderOpen,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/hooks/use-auth';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/config/routes.config';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
}

// Simplified nav items - grouped by role
const getNavItems = (role: string): NavItem[] => {
  // Common for all
  const common: NavItem[] = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: ROUTES.DASHBOARD,
    },
  ];

  // Worker items
  if (role === 'WORKER') {
    return [
      ...common,
      {
        label: 'Check-In',
        icon: <ClipboardCheck className="h-5 w-5" />,
        href: ROUTES.CHECK_IN,
      },
      {
        label: 'History',
        icon: <History className="h-5 w-5" />,
        href: ROUTES.CHECK_IN_HISTORY,
      },
      {
        label: 'Incidents',
        icon: <ShieldAlert className="h-5 w-5" />,
        href: ROUTES.MY_INCIDENTS,
      },
    ];
  }

  // Team Lead items
  if (role === 'TEAM_LEAD') {
    return [
      ...common,
      {
        label: 'Missed',
        icon: <AlertTriangle className="h-5 w-5" />,
        href: ROUTES.TEAM_MISSED_CHECKINS,
      },
      {
        label: 'Members',
        icon: <UserCircle className="h-5 w-5" />,
        href: ROUTES.TEAM_MEMBERS,
      },
      {
        label: 'History',
        icon: <History className="h-5 w-5" />,
        href: ROUTES.TEAM_CHECK_IN_HISTORY,
      },
      {
        label: 'Analytics',
        icon: <TrendingUp className="h-5 w-5" />,
        href: ROUTES.TEAM_ANALYTICS,
      },
    ];
  }

  // Supervisor items
  if (role === 'SUPERVISOR') {
    return [
      ...common,
      {
        label: 'Teams',
        icon: <Users className="h-5 w-5" />,
        href: ROUTES.TEAM_DASHBOARD,
      },
      {
        label: 'Missed',
        icon: <AlertTriangle className="h-5 w-5" />,
        href: ROUTES.TEAM_MISSED_CHECKINS,
      },
      {
        label: 'Analytics',
        icon: <TrendingUp className="h-5 w-5" />,
        href: ROUTES.TEAM_ANALYTICS,
      },
      {
        label: 'Reports',
        icon: <FileText className="h-5 w-5" />,
        href: ROUTES.TEAM_REPORTS,
      },
    ];
  }

  // WHS items — incident & case management + worker lookup
  if (role === 'WHS') {
    return [
      ...common,
      {
        label: 'Workers',
        icon: <UserCircle className="h-5 w-5" />,
        href: ROUTES.WHS_WORKERS,
      },
      {
        label: 'Incidents',
        icon: <ShieldAlert className="h-5 w-5" />,
        href: ROUTES.ADMIN_INCIDENTS,
      },
      {
        label: 'Cases',
        icon: <FolderOpen className="h-5 w-5" />,
        href: ROUTES.ADMIN_CASES,
      },
      {
        label: 'Analytics',
        icon: <TrendingUp className="h-5 w-5" />,
        href: ROUTES.WHS_ANALYTICS,
      },
    ];
  }

  // Admin items
  if (role === 'ADMIN') {
    return [
      ...common,
      {
        label: 'Teams',
        icon: <Users className="h-5 w-5" />,
        href: ROUTES.ADMIN_TEAMS,
      },
      {
        label: 'Workers',
        icon: <UserCircle className="h-5 w-5" />,
        href: ROUTES.ADMIN_WORKERS,
      },
      {
        label: 'Incidents',
        icon: <ShieldAlert className="h-5 w-5" />,
        href: ROUTES.ADMIN_INCIDENTS,
      },
      {
        label: 'Cases',
        icon: <FolderOpen className="h-5 w-5" />,
        href: ROUTES.ADMIN_CASES,
      },
      {
        label: 'Holidays',
        icon: <Calendar className="h-5 w-5" />,
        href: ROUTES.ADMIN_HOLIDAYS,
      },
      {
        label: 'Logs',
        icon: <Search className="h-5 w-5" />,
        href: ROUTES.ADMIN_AUDIT_LOGS,
      },
      {
        label: 'Company',
        icon: <Building2 className="h-5 w-5" />,
        href: ROUTES.ADMIN_SETTINGS,
      },
    ];
  }

  return common;
};

// Max visible items in mobile bottom nav (excluding "More" and "Settings")
const MOBILE_VISIBLE_COUNT = 3;

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = getNavItems(user?.role || '');

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== ROUTES.DASHBOARD && location.pathname.startsWith(href));

  // Mobile: split items into visible and overflow
  const mobileVisibleItems = navItems.slice(0, MOBILE_VISIBLE_COUNT);
  const mobileOverflowItems = navItems.slice(MOBILE_VISIBLE_COUNT);
  const hasOverflow = mobileOverflowItems.length > 0;
  const isOverflowActive = mobileOverflowItems.some((item) => isActive(item.href));

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-20 bg-card border-r border-border/50 flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center">
          <Link to={ROUTES.DASHBOARD} className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-lg font-bold text-primary-foreground transition-transform hover:scale-105">
            A
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3" role="navigation" aria-label="Main navigation">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md px-2 py-3 text-center transition-all duration-200 ease-in-out',
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                aria-label={item.label}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.icon}
                <span className="text-xs font-medium leading-tight">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Bottom - Settings */}
        <div className="shrink-0 p-3 pb-6">
          <Link
            to={ROUTES.SETTINGS}
            className={cn(
              'flex flex-col items-center gap-1 rounded-md px-2 py-3 text-center transition-all duration-200 ease-in-out',
              isActive(ROUTES.SETTINGS)
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            aria-label="Settings"
            aria-current={isActive(ROUTES.SETTINGS) ? 'page' : undefined}
          >
            <Settings className="h-5 w-5" />
            <span className="text-xs font-medium leading-tight">Settings</span>
          </Link>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card safe-area-bottom" role="navigation" aria-label="Mobile navigation">
        <div className="flex justify-around items-center h-16 px-2">
          {/* Visible nav items */}
          {mobileVisibleItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                isActive(item.href)
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
              aria-label={item.label}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              {item.icon}
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}

          {/* More menu for overflow items */}
          {hasOverflow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                    isOverflowActive
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )}
                  aria-label="More navigation items"
                >
                  <MoreHorizontal className="h-5 w-5" />
                  <span className="text-xs font-medium">More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="mb-2 w-48">
                {mobileOverflowItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      to={item.href}
                      className={cn(
                        'flex items-center gap-2',
                        isActive(item.href) && 'text-primary font-medium'
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Settings - always visible */}
          <Link
            to={ROUTES.SETTINGS}
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
              isActive(ROUTES.SETTINGS)
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
            aria-label="Settings"
            aria-current={isActive(ROUTES.SETTINGS) ? 'page' : undefined}
          >
            <Settings className="h-5 w-5" />
            <span className="text-xs font-medium">Settings</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
