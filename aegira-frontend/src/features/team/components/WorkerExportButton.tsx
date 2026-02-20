import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { DateTime } from 'luxon';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { useToast } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { formatDate, formatTime, formatDateTime } from '@/lib/utils/date.utils';
import { ROLE_LABELS, formatScheduleWindow } from '@/lib/utils/format.utils';
import { formatWorkDays } from '@/lib/utils/string.utils';
import { arrayToCSVRow, downloadFile } from '@/lib/utils/export.utils';
import { DAY_NAMES, SEMANTIC_STATUS } from '@/lib/constants';
import type { Person } from '@/types/person.types';
import type { ReadinessCategory } from '@/types/check-in.types';
import type { MissedCheckInsResponse } from '@/types/missed-check-in.types';

interface WorkerExportButtonProps {
  person: Person;
}

type ExportPeriod = '7d' | '30d' | '90d' | 'all';

interface PeriodOption {
  value: ExportPeriod;
  label: string;
  days: number | null;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: 'all', label: 'All time', days: null },
];

/** Raw check-in record shape from /teams/check-in-history */
interface RawCheckInRecord {
  id: string;
  checkInDate: string;
  hoursSlept: number;
  sleepQuality: number;
  stressLevel: number;
  physicalCondition: number;
  painLevel: number | null;
  painLocation: string | null;
  notes: string | null;
  readinessScore: number;
  readinessLevel: string;
  eventTime: string;
  createdAt: string;
  isLate: boolean;
  lateByMinutes: number | null;
}

const CATEGORY_LABELS: Record<ReadinessCategory, string> = {
  ready: SEMANTIC_STATUS.READINESS_CATEGORY.ready.label,
  modified_duty: SEMANTIC_STATUS.READINESS_CATEGORY.modified_duty.label,
  needs_attention: SEMANTIC_STATUS.READINESS_CATEGORY.needs_attention.label,
  not_ready: SEMANTIC_STATUS.READINESS_CATEGORY.not_ready.label,
};

function levelToCategory(level: string): ReadinessCategory {
  switch (level) {
    case 'GREEN': return 'ready';
    case 'YELLOW': return 'modified_duty';
    case 'RED': return 'not_ready';
    default: return 'needs_attention';
  }
}

/** Fetch all pages from a paginated endpoint (max 10 pages = 1000 records). */
async function fetchAllPages<T>(
  baseUrl: string,
  params: Record<string, string>,
): Promise<T[]> {
  const allItems: T[] = [];
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page++) {
    const searchParams = new URLSearchParams({ ...params, page: String(page), limit: '100' });
    const response = await apiClient.get<{ items: T[]; pagination: { totalPages: number } }>(
      `${baseUrl}?${searchParams.toString()}`
    );
    allItems.push(...response.items);
    if (!response.items.length || page >= response.pagination.totalPages) break;
  }

  return allItems;
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

function buildProfileSection(person: Person, timezone: string): string {
  const schedule = person.check_in_start || person.check_in_end
    ? formatScheduleWindow(person.check_in_start ?? person.team?.check_in_start ?? '', person.check_in_end ?? person.team?.check_in_end ?? '')
    : person.team
      ? formatScheduleWindow(person.team.check_in_start, person.team.check_in_end)
      : 'N/A';

  const workDays = formatWorkDays(person.work_days ?? person.team?.work_days) || 'N/A';
  const age = person.date_of_birth ? String(calculateAge(person.date_of_birth, timezone)) : 'N/A';
  const gender = person.gender === 'MALE' ? 'Male' : person.gender === 'FEMALE' ? 'Female' : 'N/A';

  const lines: string[] = [
    'WORKER PROFILE',
    arrayToCSVRow([
      'Name', 'Email', 'Role', 'Team', 'Status', 'Gender', 'Age',
      'Contact', 'Emergency Contact', 'EC Phone', 'EC Relationship',
      'Schedule', 'Work Days',
    ]),
    arrayToCSVRow([
      `${person.first_name} ${person.last_name}`,
      person.email,
      ROLE_LABELS[person.role],
      person.team?.name ?? 'Not assigned',
      person.is_active ? 'Active' : 'Inactive',
      gender,
      age,
      person.contact_number ?? 'N/A',
      person.emergency_contact_name ?? 'N/A',
      person.emergency_contact_phone ?? 'N/A',
      person.emergency_contact_relationship ?? 'N/A',
      schedule,
      workDays,
    ]),
  ];

  return lines.join('\n');
}

function buildCheckInSection(records: RawCheckInRecord[], periodLabel: string): string {
  const header = `CHECK-IN RECORDS (${periodLabel})`;
  const columns = arrayToCSVRow([
    'Date', 'Time', 'Submission', 'Late By (min)',
    'Sleep Hours', 'Sleep Quality', 'Stress Level', 'Energy Level', 'Pain Level',
    'Readiness Score', 'Status', 'Notes',
  ]);

  if (records.length === 0) {
    return [header, columns, 'No records found'].join('\n');
  }

  const rows = records.map((r) => {
    const category = levelToCategory(r.readinessLevel);
    return arrayToCSVRow([
      formatDate(r.checkInDate.slice(0, 10)),
      formatTime(r.eventTime || r.createdAt),
      r.isLate ? 'Late' : 'On Time',
      r.lateByMinutes != null ? r.lateByMinutes : '',
      r.hoursSlept,
      `${r.sleepQuality}/10`,
      `${r.stressLevel}/10`,
      `${r.physicalCondition}/10`,
      r.painLevel != null ? `${r.painLevel}/10` : '',
      `${r.readinessScore}%`,
      CATEGORY_LABELS[category],
      r.notes ?? '',
    ]);
  });

  return [header, columns, ...rows].join('\n');
}

function buildMissedCheckInSection(
  records: MissedCheckInsResponse['items'],
  periodLabel: string,
): string {
  const header = `MISSED CHECK-INS (${periodLabel})`;
  const columns = arrayToCSVRow([
    'Date', 'Schedule', 'Status', 'Resolved At', 'Team Leader', 'Day',
    'Streak Before', 'Avg Readiness', 'Days Since Check-In', 'Days Since Miss',
    'Misses (30d)', 'Misses (60d)', 'Misses (90d)',
  ]);

  if (records.length === 0) {
    return [header, columns, 'No records found'].join('\n');
  }

  const rows = records.map((r) => {
    const snap = r.stateSnapshot;
    return arrayToCSVRow([
      formatDate(r.date, 'MMM d, yyyy'),
      r.scheduleWindow,
      r.resolvedAt ? 'Resolved' : 'Unresolved',
      r.resolvedAt ? formatDateTime(r.resolvedAt) : '',
      r.teamLeaderName ?? 'Not assigned',
      snap?.dayOfWeek != null ? DAY_NAMES[snap.dayOfWeek] : '',
      snap?.checkInStreakBefore ?? '',
      snap?.recentReadinessAvg != null ? `${snap.recentReadinessAvg.toFixed(1)}%` : '',
      snap?.daysSinceLastCheckIn ?? '',
      snap?.daysSinceLastMiss ?? '',
      snap?.missesInLast30d ?? '',
      snap?.missesInLast60d ?? '',
      snap?.missesInLast90d ?? '',
    ]);
  });

  return [header, columns, ...rows].join('\n');
}

export function WorkerExportButton({ person }: WorkerExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const timezone = user?.companyTimezone ?? 'Asia/Manila';

  const handleExport = async (period: PeriodOption) => {
    setIsExporting(true);
    try {
      // 1. Fetch all check-in pages
      const rawCheckIns = await fetchAllPages<RawCheckInRecord>(
        ENDPOINTS.TEAM_MANAGEMENT.CHECK_IN_HISTORY,
        { workerId: person.id },
      );

      // 2. Fetch all missed check-in pages
      const rawMissed = await fetchAllPages<MissedCheckInsResponse['items'][number]>(
        ENDPOINTS.TEAM_MANAGEMENT.MISSED_CHECK_INS,
        { workerId: person.id },
      );

      // 3. Filter by date cutoff if not "All time"
      let filteredCheckIns = rawCheckIns;
      let filteredMissed = rawMissed;

      if (period.days !== null) {
        const cutoff = DateTime.now().minus({ days: period.days }).startOf('day');
        filteredCheckIns = rawCheckIns.filter(
          (r) => DateTime.fromISO(r.checkInDate.slice(0, 10)) >= cutoff
        );
        filteredMissed = rawMissed.filter(
          (r) => DateTime.fromISO(r.date) >= cutoff
        );
      }

      // 4. Build CSV sections
      const profileSection = buildProfileSection(person, timezone);
      const checkInSection = buildCheckInSection(filteredCheckIns, period.label);
      const missedSection = buildMissedCheckInSection(filteredMissed, period.label);

      // 5. Combine with blank-line separators
      const csv = [profileSection, '', checkInSection, '', missedSection].join('\n');

      // 6. Download
      const safeName = `${person.first_name}-${person.last_name}`.toLowerCase().replace(/\s+/g, '-');
      const dateStamp = DateTime.now().toFormat('yyyy-MM-dd');
      const filename = `${safeName}-export-${period.value}-${dateStamp}.csv`;

      downloadFile(csv, filename);

      toast({
        title: 'Export complete',
        description: `Downloaded ${filteredCheckIns.length} check-ins and ${filteredMissed.length} missed check-ins.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Could not export worker data. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {PERIOD_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={() => handleExport(opt)}>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
