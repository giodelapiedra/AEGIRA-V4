import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageLoader } from '@/components/common/PageLoader';
import { MemberInfoCard } from '../components/MemberInfoCard';
import { MemberCheckInTable } from '../components/MemberCheckInTable';
import { MemberMissedCheckInTable } from '../components/MemberMissedCheckInTable';
import { WorkerExportButton } from '../components/WorkerExportButton';
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

  const stateData = (location.state as { member?: Person } | null)?.member;
  const cachedData = queryClient.getQueryData<PaginatedResponse<Person>>(['team', 'my-members']);
  const cachedMember = cachedData?.items.find((m) => m.id === workerId);
  const placeholder = stateData ?? cachedMember;

  const canFetchPerson = hasRole(['ADMIN', 'SUPERVISOR', 'WHS']);
  const { data: fetchedPerson, isLoading, error } = usePerson(
    canFetchPerson ? workerId! : ''
  );

  const person = fetchedPerson ?? placeholder;

  if (isLoading && !placeholder) {
    return <PageLoader isLoading={true} skeleton="detail"><></></PageLoader>;
  }

  if (!person || (error && !placeholder)) {
    return <PageLoader isLoading={false} error={error || new Error('Member not found')}><></></PageLoader>;
  }

  return (
    <div className="space-y-8">
      {/* Minimal nav bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <WorkerExportButton person={person} />
      </div>

      {/* Profile */}
      <MemberInfoCard person={person} />

      {/* History */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="check-ins">Check-In Records</TabsTrigger>
          <TabsTrigger value="missed">Missed Check-Ins</TabsTrigger>
        </TabsList>

        <TabsContent value="check-ins" className="mt-4">
          <MemberCheckInTable personId={person.id} />
        </TabsContent>

        <TabsContent value="missed" className="mt-4">
          {activeTab === 'missed' && (
            <MemberMissedCheckInTable personId={person.id} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
