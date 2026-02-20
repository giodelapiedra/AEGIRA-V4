// Shared Team Context - Used by team and missed-check-in controllers
import { prisma } from '../config/database';

interface TeamContext {
  timezone: string;
  teamIds: string[] | null; // null = no filter (ADMIN sees all), [] = no teams assigned, ["id",...] = specific teams
}

/**
 * Get team context for the current user.
 * Timezone is passed from the Hono context (set by tenantMiddleware) — no extra DB query needed.
 * - For TEAM_LEAD: returns the team they lead (array of 1)
 * - For SUPERVISOR: returns teams assigned to them via supervisor_id
 * - For ADMIN: returns null (no filter, sees all)
 */
export async function getTeamContext(
  companyId: string,
  userId: string,
  userRole: string,
  timezone: string
): Promise<TeamContext> {
  // ADMIN: no filter needed, skip DB query entirely
  if (userRole !== 'TEAM_LEAD' && userRole !== 'SUPERVISOR') {
    return { timezone, teamIds: null };
  }

  const teams = await prisma.team.findMany({
    where: {
      company_id: companyId,
      ...(userRole === 'TEAM_LEAD' ? { leader_id: userId } : { supervisor_id: userId }),
      is_active: true,
    },
    select: { id: true },
  });

  return { timezone, teamIds: teams.map((t) => t.id) };
}
