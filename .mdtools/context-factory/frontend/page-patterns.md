---
description: Page Layout Patterns for AEGIRA Frontend
globs: ["aegira-frontend/src/**/pages/**/*.tsx"]
alwaysApply: false
---
# Page Patterns

Standard page layouts used across AEGIRA frontend. All pages use the `PageLoader` wrapper for loading/error states.

## PageLoader Wrapper (MANDATORY)

Every page wraps its content in `PageLoader`. Never use manual `if (isLoading)` / `if (error)` checks.

```typescript
import { PageLoader } from '@/components/common/PageLoader';

// PageLoader handles loading skeletons and error display automatically
<PageLoader isLoading={isLoading} error={error} skeleton="table">
  <YourContent />
</PageLoader>
```

### Skeleton Types

```typescript
type SkeletonType = 'page' | 'dashboard' | 'table' | 'form' | 'detail' | 'check-in' | 'stats';
```

Choose the skeleton type that matches the page content for the best loading UX.

## 1. List Page (Table View)

```typescript
export function CheckInHistoryPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const { data, isLoading, error } = useCheckInHistory({
    page: pagination.pageIndex + 1,  // API is 1-indexed
    pageSize: pagination.pageSize,
  });

  const checkIns = data?.items || [];
  const pageCount = data?.totalPages || 0;

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="table">
      <div className="space-y-6">
        <PageHeader
          title="Check-In History"
          description="View your past check-in records"
        />

        <Card>
          <CardHeader>
            <CardTitle>Your Check-Ins ({data?.total || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={checkIns}
              pageCount={pageCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              isLoading={isLoading}
              emptyMessage="No check-ins yet."
            />
          </CardContent>
        </Card>
      </div>
    </PageLoader>
  );
}
```

## 2. Detail/Profile Page

```typescript
export function PersonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: person, isLoading, error } = usePerson(id!);

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="detail">
      <div className="space-y-6">
        {/* 1. Page header with back button */}
        <PageHeader
          title={person.full_name}
          description={person.email}
          action={
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />

        {/* 2. Info card - ALWAYS visible (never inside a tab) */}
        <PersonInfoCard person={person} />

        {/* 3. Data tabs below */}
        <Tabs defaultValue="check-ins">
          <TabsList>
            <TabsTrigger value="check-ins">Check-Ins</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="check-ins">
            <CheckInsTable personId={person.id} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTable personId={person.id} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLoader>
  );
}
```

## 3. Dashboard Page (Role-Based)

```typescript
export function Dashboard() {
  const user = useAuthStore((state) => state.user);

  // Route to role-specific dashboard
  switch (user?.role) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'SUPERVISOR':
      return <SupervisorDashboard />;
    case 'TEAM_LEAD':
      return <TeamLeadDashboard />;
    default:
      return <WorkerDashboard />;
  }
}

// Each sub-dashboard uses PageLoader
function WorkerDashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();

  return (
    <PageLoader isLoading={isLoading} error={error} skeleton="dashboard">
      {/* Dashboard content */}
    </PageLoader>
  );
}
```

## 4. Info Card Pattern (Side-by-Side)

```typescript
<Card className="overflow-hidden">
  <div className="flex flex-col md:flex-row">
    {/* Left - Identity */}
    <div className="flex flex-col items-center justify-center gap-3 border-b md:border-b-0 md:border-r p-8 md:w-64 shrink-0 bg-muted/30">
      <Avatar className="h-24 w-24">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <h3 className="font-semibold text-lg">{name}</h3>
      <Badge>{role}</Badge>
    </div>

    {/* Right - Info sections */}
    <div className="flex-1 p-6">
      <InfoSection title="Contact">
        <InfoItem label="Email" value={person.email} />
        <InfoItem label="Phone" value={person.phone} />
      </InfoSection>
      <Separator className="my-4" />
      <InfoSection title="Team">
        <InfoItem label="Team" value={person.team?.name} />
        <InfoItem label="Role" value={person.role} />
      </InfoSection>
    </div>
  </div>
</Card>
```

## 5. Form Page (Create/Edit)

```typescript
export function CreatePersonPage() {
  const navigate = useNavigate();
  const mutation = useCreatePerson();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Worker"
        action={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <PersonForm
            onSubmit={(data) =>
              mutation.mutate(data, {
                onSuccess: () => navigate('/persons'),
              })
            }
            isSubmitting={mutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

## Rules

- ALWAYS wrap page content in `<PageLoader>` with the appropriate `skeleton` type
- ALWAYS use `PageHeader` for page titles
- ALWAYS use `space-y-6` for vertical page sections
- Info card is ALWAYS visible above tabs (never inside a tab)
- List pages ALWAYS use `DataTable` for server-side paginated tables
- Dashboard pages route to role-specific components
- Mobile-first responsive design on all layouts
- API calls: `apiClient` + `ENDPOINTS` constants (dynamic endpoints are functions: `ENDPOINTS.PERSON.BY_ID(id)`)
- Query hooks: `useQuery` + `STALE_TIMES` (REALTIME 30s, STANDARD 2m, STATIC 10m, IMMUTABLE 30m)
- Mutations: `useMutation` + invalidate ALL affected query keys in `onSuccess`
- Pages: wrap in `<PageLoader isLoading error skeleton="type">` — never manual if/else
- Tables: `DataTable` from `@/components/ui/data-table` — never custom pagination
- Forms: React Hook Form + Zod (`zodResolver`) — never manual useState for form fields
- State: TanStack Query (server), Zustand (auth only), React Hook Form (forms)
- Page index: 0-indexed in frontend (`pageIndex`), 1-indexed in API (`page`)
- Types: import from `@/types/`, re-export from hooks
