import { Mail, Shield, Users, CheckCircle, XCircle, User as UserIcon, Cake } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import type { Person } from '@/types/person.types';
import { ROLE_LABELS } from '@/lib/utils/format.utils';

interface MemberInfoCardProps {
  person: Person;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

const genderLabels: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
};

interface InfoItemProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

function InfoItem({ label, value, icon }: InfoItemProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

export function MemberInfoCard({ person }: MemberInfoCardProps) {
  const initials = getInitials(person.first_name, person.last_name);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row">
        {/* Left side - Avatar & Identity */}
        <div className="flex flex-col items-center justify-center gap-3 border-b md:border-b-0 md:border-r p-8 md:w-64 shrink-0 bg-muted/30">
          <Avatar className="h-24 w-24 text-2xl">
            {person.profile_picture_url && (
              <AvatarImage src={person.profile_picture_url} alt={`${person.first_name} ${person.last_name}`} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {person.first_name} {person.last_name}
            </h3>
            <Badge variant={person.is_active ? 'success' : 'destructive'} className="mt-1.5 gap-1">
              {person.is_active ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {person.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Right side - Info sections */}
        <div className="flex-1 p-6 space-y-0">
          {/* Account Information */}
          <div className="py-4 first:pt-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Account Information
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <InfoItem
                label="Email"
                value={person.email}
                icon={<Mail className="h-3.5 w-3.5 text-muted-foreground" />}
              />
              <InfoItem
                label="Role"
                value={ROLE_LABELS[person.role]}
                icon={<Shield className="h-3.5 w-3.5 text-muted-foreground" />}
              />
            </div>
          </div>

          <Separator />

          {/* Personal Information */}
          <div className="py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Personal Information
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <InfoItem
                label="Gender"
                value={person.gender ? genderLabels[person.gender] : 'Not set'}
                icon={<UserIcon className="h-3.5 w-3.5 text-muted-foreground" />}
              />
              <InfoItem
                label="Age"
                value={person.date_of_birth ? `${calculateAge(person.date_of_birth)} years old` : 'Not set'}
                icon={<Cake className="h-3.5 w-3.5 text-muted-foreground" />}
              />
            </div>
          </div>

          <Separator />

          {/* Team Information */}
          <div className="py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Team Information
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <InfoItem
                label="Team"
                value={person.team?.name || 'Not assigned'}
                icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
