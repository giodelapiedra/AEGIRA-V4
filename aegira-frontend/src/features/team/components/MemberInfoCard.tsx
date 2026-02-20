import { DateTime } from 'luxon';
import { CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Person } from '@/types/person.types';
import { ROLE_LABELS, formatGender, formatScheduleWindow } from '@/lib/utils/format.utils';
import { formatWorkDays } from '@/lib/utils/string.utils';
import { useAuth } from '@/lib/hooks/use-auth';

interface MemberInfoCardProps {
  person: Person;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function calculateAge(dateOfBirth: string, timezone: string): number {
  const dob = DateTime.fromISO(dateOfBirth, { zone: timezone });
  const today = DateTime.now().setZone(timezone);
  let age = today.year - dob.year;
  if (today.month < dob.month || (today.month === dob.month && today.day < dob.day)) {
    age--;
  }
  return age;
}

const DASH = <span className="text-muted-foreground font-normal">&mdash;</span>;

interface DetailItemProps {
  label: string;
  value?: React.ReactNode;
  note?: string;
}

function DetailItem({ label, value, note }: DetailItemProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        {note && (
          <Badge variant="amber" className="text-[9px] px-1 py-0 h-3.5 font-medium leading-none">
            {note}
          </Badge>
        )}
      </div>
      <p className="text-sm font-medium mt-1">{value || DASH}</p>
    </div>
  );
}

export function MemberInfoCard({ person }: MemberInfoCardProps) {
  const { user } = useAuth();
  const timezone = user?.companyTimezone ?? 'Asia/Manila';
  const initials = getInitials(person.first_name, person.last_name);
  const hasScheduleOverride = !!(person.check_in_start || person.check_in_end);
  const hasWorkDaysOverride = !!(person.work_days && person.work_days !== person.team?.work_days);

  return (
    <div className="space-y-6">
      {/* Identity */}
      <div className="flex items-start gap-4">
        <Avatar className="h-14 w-14 shrink-0">
          {person.profile_picture_url && (
            <AvatarImage
              src={person.profile_picture_url}
              alt={`${person.first_name} ${person.last_name}`}
            />
          )}
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {person.first_name} {person.last_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{person.email}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={person.is_active ? 'success' : 'destructive'} className="gap-1">
              {person.is_active ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {person.is_active ? 'Active' : 'Inactive'}
            </Badge>
            <span className="text-muted-foreground text-xs">&middot;</span>
            <span className="text-sm text-muted-foreground">{ROLE_LABELS[person.role]}</span>
            {person.team && (
              <>
                <span className="text-muted-foreground text-xs">&middot;</span>
                <span className="text-sm text-muted-foreground">{person.team.name}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Details grid */}
      <Card>
        <div className="p-5 md:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5">
            {person.team && (
              <>
                <DetailItem
                  label="Check-In Window"
                  value={formatScheduleWindow(
                    person.check_in_start ?? person.team.check_in_start,
                    person.check_in_end ?? person.team.check_in_end
                  )}
                  note={hasScheduleOverride ? 'Override' : undefined}
                />
                <DetailItem
                  label="Work Days"
                  value={formatWorkDays(person.work_days ?? person.team.work_days)}
                  note={hasWorkDaysOverride ? 'Override' : undefined}
                />
              </>
            )}
            <DetailItem
              label="Gender"
              value={person.gender ? formatGender(person.gender) : undefined}
            />
            <DetailItem
              label="Age"
              value={person.date_of_birth ? `${calculateAge(person.date_of_birth, timezone)} years` : undefined}
            />
            <DetailItem label="Contact" value={person.contact_number} />
            <DetailItem label="Emergency Contact Name" value={person.emergency_contact_name} />
            <DetailItem label="Emergency Contact Phone" value={person.emergency_contact_phone} />
            <DetailItem label="Emergency Contact Relationship" value={person.emergency_contact_relationship} />
          </div>
        </div>
      </Card>
    </div>
  );
}
