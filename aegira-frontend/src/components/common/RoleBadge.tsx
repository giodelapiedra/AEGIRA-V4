import { Badge } from '@/components/ui/badge';
import { ROLE_LABELS } from '@/lib/utils/format.utils';
import type { UserRole } from '@/types/auth.types';

const ROLE_VARIANTS: Record<UserRole, 'destructive' | 'info' | 'warning' | 'outline' | 'secondary'> = {
  ADMIN: 'destructive',
  WHS: 'secondary',
  SUPERVISOR: 'info',
  TEAM_LEAD: 'warning',
  WORKER: 'outline',
};

interface RoleBadgeProps {
  role: UserRole;
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const variant = ROLE_VARIANTS[role];
  const label = ROLE_LABELS[role];

  return <Badge variant={variant}>{label}</Badge>;
}
