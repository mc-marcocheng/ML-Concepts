import { BarChart3, BookOpen, CircleHelp, MessageSquare, RefreshCw, Settings, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  tab?: boolean;
  prefix?: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Concepts', icon: BookOpen, tab: true, prefix: '/learn' },
  { href: '/quiz', label: 'Quiz', icon: CircleHelp, tab: true },
  { href: '/review', label: 'Review', icon: RefreshCw, tab: true },
  { href: '/progress', label: 'Progress', icon: BarChart3, tab: true },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

export const ASK_ITEM = { label: 'Ask', icon: MessageSquare };

export function isActive(pathname: string, item: NavItem) {
  if (item.href === '/') return pathname === '/' || pathname.startsWith('/learn');
  return pathname === item.href || pathname.startsWith(item.href + '/');
}