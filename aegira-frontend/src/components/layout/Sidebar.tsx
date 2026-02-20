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

const getNavItems = (role: string): NavItem[] => {
  const common: NavItem[] = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: ROUTES.DASHBOARD,
    },
  ];

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
        href: ROUTES.WHS_INCIDENTS,
      },
      {
        label: 'Cases',
        icon: <FolderOpen className="h-5 w-5" />,
        href: ROUTES.WHS_CASES,
      },
      {
        label: 'Analytics',
        icon: <TrendingUp className="h-5 w-5" />,
        href: ROUTES.WHS_ANALYTICS,
      },
    ];
  }

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

const MOBILE_VISIBLE_COUNT = 3;

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const navItems = getNavItems(user?.role || '');

  const isActive = (href: string) =>
    location.pathname === href ||
    (href !== ROUTES.DASHBOARD && location.pathname.startsWith(href));

  const mobileVisibleItems = navItems.slice(0, MOBILE_VISIBLE_COUNT);
  const mobileOverflowItems = navItems.slice(MOBILE_VISIBLE_COUNT);
  const hasOverflow = mobileOverflowItems.length > 0;
  const isOverflowActive = mobileOverflowItems.some((item) => isActive(item.href));

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex fixed left-0 top-0 z-40 h-screen w-[72px] bg-card/80 backdrop-blur-sm border-r border-border/40 flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center shrink-0">
          <Link
            to={ROUTES.DASHBOARD}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary transition-all duration-200 hover:bg-primary/15 hover:scale-105"
          >
            A
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 pt-2 pb-4" role="navigation" aria-label="Main navigation">
          <div className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center transition-all duration-200',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary" />
                  )}
                  <span className={cn(
                    'flex items-center justify-center rounded-md h-8 w-8 transition-colors duration-200',
                    active && 'bg-primary/10',
                  )}>
                    {item.icon}
                  </span>
                  <span className={cn(
                    'text-[10px] leading-tight transition-colors duration-200',
                    active ? 'font-semibold' : 'font-medium'
                  )}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t border-border/40" />

        {/* Bottom - Settings */}
        <div className="shrink-0 px-2.5 py-4">
          <Link
            to={ROUTES.SETTINGS}
            className={cn(
              'relative flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center transition-all duration-200',
              isActive(ROUTES.SETTINGS)
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            aria-label="Settings"
            aria-current={isActive(ROUTES.SETTINGS) ? 'page' : undefined}
          >
            {isActive(ROUTES.SETTINGS) && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-primary" />
            )}
            <span className={cn(
              'flex items-center justify-center rounded-md h-8 w-8 transition-colors duration-200',
              isActive(ROUTES.SETTINGS) && 'bg-primary/10',
            )}>
              <Settings className="h-5 w-5" />
            </span>
            <span className={cn(
              'text-[10px] leading-tight transition-colors duration-200',
              isActive(ROUTES.SETTINGS) ? 'font-semibold' : 'font-medium'
            )}>
              Settings
            </span>
          </Link>
        </div>
      </aside>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-card/90 backdrop-blur-md safe-area-bottom" role="navigation" aria-label="Mobile navigation">
        <div className="flex justify-around items-end h-16 px-1">
          {mobileVisibleItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px]',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                {/* Active dot indicator */}
                {active && (
                  <span className="absolute top-0.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary" />
                )}
                {item.icon}
                <span className={cn(
                  'text-[10px]',
                  active ? 'font-semibold' : 'font-medium'
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {hasOverflow && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px]',
                    isOverflowActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                  aria-label="More navigation items"
                >
                  {isOverflowActive && (
                    <span className="absolute top-0.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary" />
                  )}
                  <MoreHorizontal className="h-5 w-5" />
                  <span className={cn(
                    'text-[10px]',
                    isOverflowActive ? 'font-semibold' : 'font-medium'
                  )}>
                    More
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="mb-2 w-48">
                {mobileOverflowItems.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      to={item.href}
                      className={cn(
                        'flex items-center gap-2.5',
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

          <Link
            to={ROUTES.SETTINGS}
            className={cn(
              'relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px]',
              isActive(ROUTES.SETTINGS) ? 'text-primary' : 'text-muted-foreground'
            )}
            aria-label="Settings"
            aria-current={isActive(ROUTES.SETTINGS) ? 'page' : undefined}
          >
            {isActive(ROUTES.SETTINGS) && (
              <span className="absolute top-0.5 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full bg-primary" />
            )}
            <Settings className="h-5 w-5" />
            <span className={cn(
              'text-[10px]',
              isActive(ROUTES.SETTINGS) ? 'font-semibold' : 'font-medium'
            )}>
              Settings
            </span>
          </Link>
        </div>
      </nav>
    </>
  );
}
