import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { MemberInfoCard } from '../components/MemberInfoCard';
import { MemberCheckInTable } from '../components/MemberCheckInTable';
import { MemberMissedCheckInTable } from '../components/MemberMissedCheckInTable';
import type { Person } from '@/types/person.types';
import type { PaginatedResponse } from '@/types/common.types';

export function TeamWorkerDetailPage() {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // 1. Try route state (passed from TeamMembersPage)
  const stateData = (location.state as { member?: Person } | null)?.member;

  // 2. Fallback: look in the cached my-members query
  const cachedData = queryClient.getQueryData<PaginatedResponse<Person>>(['team', 'my-members']);
  const cachedMember = cachedData?.items.find((m) => m.id === workerId);

  const person = stateData ?? cachedMember;

  if (!person) {
    return <ErrorMessage message="Member not found. Please go back and try again." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${person.first_name} ${person.last_name}`}
        description="Team member details and check-in history"
        action={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        }
      />

      {/* Profile card - always visible */}
      <MemberInfoCard person={person} />

      {/* Data tabs */}
      <Tabs defaultValue="check-ins">
        <TabsList>
          <TabsTrigger value="check-ins">Check-In Records</TabsTrigger>
          <TabsTrigger value="missed">Missed Check-Ins</TabsTrigger>
        </TabsList>

        <TabsContent value="check-ins">
          <MemberCheckInTable personId={person.id} />
        </TabsContent>

        <TabsContent value="missed">
          <MemberMissedCheckInTable personId={person.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
