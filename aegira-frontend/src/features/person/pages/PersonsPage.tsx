import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, MoreVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageLoader } from '@/components/common/PageLoader';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { usePersons, Person } from '../hooks/usePersons';
import { ROLE_LABELS } from '@/lib/utils/format.utils';
import { ROUTES } from '@/config/routes.config';
import { buildRoute } from '@/lib/utils/route.utils';
import type { UserRole } from '@/types/auth.types';

const roleVariants: Record<UserRole, 'secondary' | 'default' | 'destructive' | 'outline' | 'info' | 'warning'> = {
  WORKER: 'secondary',
  TEAM_LEAD: 'warning',
  SUPERVISOR: 'default',
  WHS: 'info',
  ADMIN: 'destructive',
};

export function PersonsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = usePersons();

  const persons = data?.items || [];
  const filteredPersons = useMemo(
    () =>
      persons.filter(
        (person: Person) =>
          `${person.first_name} ${person.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
          person.email.toLowerCase().includes(search.toLowerCase())
      ),
    [persons, search]
  );

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Manage employees and their roles"
        action={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Person
          </Button>
        }
      />

      {/* Search */}
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Persons Table */}
      <Card>
        <CardContent className="p-0">
          {filteredPersons.length === 0 ? (
            <EmptyState
              title={search ? 'No people found' : 'No people yet'}
              description={
                search
                  ? 'Try a different search term'
                  : 'Add your first employee to get started'
              }
              icon={<Users className="h-12 w-12" />}
              action={
                !search && (
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Person
                  </Button>
                )
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPersons.map((person: Person) => (
                  <TableRow
                    key={person.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(buildRoute(ROUTES.PERSON_DETAIL, { personId: person.id }))}
                  >
                    <TableCell className="font-medium">
                      {person.first_name} {person.last_name}
                    </TableCell>
                    <TableCell>{person.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleVariants[person.role]}>
                        {ROLE_LABELS[person.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {person.team?.name || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={person.is_active ? 'success' : 'secondary'}>
                        {person.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate(buildRoute(ROUTES.PERSON_DETAIL, { personId: person.id }))}
                          >
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit Person</DropdownMenuItem>
                          <DropdownMenuItem>View Check-Ins</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
    </PageLoader>
  );
}
