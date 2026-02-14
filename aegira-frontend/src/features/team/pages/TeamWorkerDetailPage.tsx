import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { PageLoader } from '@/components/common/PageLoader';
import { MemberInfoCard } from '../components/MemberInfoCard';
import { MemberCheckInTable } from '../components/MemberCheckInTable';
import { MemberMissedCheckInTable } from '../components/MemberMissedCheckInTable';
import { usePerson } from '@/features/person/hooks/usePersons';
import { useAuth } from '@/lib/hooks/use-auth';
import type { Person } from '@/types/person.types';
import type { PaginatedResponse } from '@/types/common.types';

export function TeamWorkerDetailPage() {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState('check-ins');

  // Instant display: route state (from navigation) or cached my-members data
  const stateData = (location.state as { member?: Person } | null)?.member;
  const cachedData = queryClient.getQueryData<PaginatedResponse<Person>>(['team', 'my-members']);
  const cachedMember = cachedData?.items.find((m) => m.id === workerId);
  const placeholder = stateData ?? cachedMember;

  // GET /persons/:id is restricted to ADMIN/SUPERVISOR/WHS
  // TEAM_LEAD relies on route state or cached my-members data
  const canFetchPerson = hasRole(['ADMIN', 'SUPERVISOR', 'WHS']);
  const { data: fetchedPerson, isLoading, error } = usePerson(
    canFetchPerson ? workerId! : ''
  );

  // Fresh API data takes priority, fallback to placeholder
  const person = fetchedPerson ?? placeholder;

  // Show skeleton only when fetching and no placeholder available
  if (isLoading && !placeholder) {
    return <PageLoader isLoading={true} skeleton="detail"><></></PageLoader>;
  }

  if (!person || (error && !placeholder)) {
    return <PageLoader isLoading={false} error={error || new Error('Member not found')}><></></PageLoader>;
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

      {/* Data tabs - lazy render inactive tab */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="check-ins">Check-In Records</TabsTrigger>
          <TabsTrigger value="missed">Missed Check-Ins</TabsTrigger>
        </TabsList>

        <TabsContent value="check-ins">
          <MemberCheckInTable personId={person.id} />
        </TabsContent>

        <TabsContent value="missed">
          {activeTab === 'missed' && (
            <MemberMissedCheckInTable personId={person.id} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
