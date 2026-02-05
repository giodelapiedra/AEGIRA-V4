import { useAuthStore } from '@/stores/auth.store';
import { WorkerDashboard } from './WorkerDashboard';
import { TeamLeadDashboard } from './TeamLeaderDashboard';
import { SupervisorDashboard } from './SupervisorDashboard';
import { AdminDashboard } from './AdminDashboard';
import { WhsDashboard } from './WhsDashboard';

/**
 * Smart Dashboard - Shows different dashboard based on user role
 * Role hierarchy: ADMIN > SUPERVISOR > TEAM_LEAD > WORKER
 */
export function Dashboard() {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return null;
  }

  switch (user.role) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'WHS':
      return <WhsDashboard />;
    case 'SUPERVISOR':
      return <SupervisorDashboard />;
    case 'TEAM_LEAD':
      return <TeamLeadDashboard />;
    case 'WORKER':
    default:
      return <WorkerDashboard />;
  }
}
