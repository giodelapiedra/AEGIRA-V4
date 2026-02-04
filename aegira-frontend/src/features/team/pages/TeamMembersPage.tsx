import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { STALE_TIMES } from '@/config/query.config';
import type { Person } from '@/types/person.types';
import type { PaginatedResponse } from '@/types/common.types';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';

export function TeamMembersPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['team', 'my-members'],
    staleTime: STALE_TIMES.STANDARD, // ✅ FIX: Team members change occasionally
    queryFn: () => apiClient.get<PaginatedResponse<Person>>(ENDPOINTS.TEAM_MANAGEMENT.MY_MEMBERS),
  });

  const members = data?.items || [];

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="cards">
      <div className="space-y-6">
        <PageHeader
          title="Team Members"
          description="View and manage your team members"
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <EmptyState
                title="No team members"
                description="This team has no members yet."
                icon={<Users className="h-10 w-10" />}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-10 w-10">
                          {member.profile_picture_url && (
                            <AvatarImage src={member.profile_picture_url} alt={`${member.first_name} ${member.last_name}`} />
                          )}
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h4 className="font-semibold">
                            {member.first_name} {member.last_name}
                          </h4>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline">{member.role}</Badge>
                            <Badge variant={member.is_active ? 'success' : 'destructive'}>
                              {member.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => navigate(buildRoute(ROUTES.TEAM_WORKER_DETAIL, { workerId: member.id }), { state: { member } })}
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
