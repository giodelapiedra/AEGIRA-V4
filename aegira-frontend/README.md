# AEGIRA Frontend

React + TypeScript frontend for the AEGIRA daily readiness tracking system.

## Quick Start

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev
```

Open http://localhost:5173

## Tech Stack

- **React 18** - UI framework
- **TypeScript 5** - Type safety
- **Vite** - Build tool
- **TanStack Query v5** - Server state management
- **Zustand** - Client state (auth, UI)
- **React Router v6** - Routing
- **React Hook Form + Zod** - Form handling
- **shadcn/ui** - UI components
- **Tailwind CSS** - Styling
- **Luxon** - Date/time handling

## Folder Structure

```
src/
├── config/          # Configuration (API, routes, query)
├── lib/
│   ├── api/         # API client, endpoints
│   ├── utils/       # Utility functions
│   └── hooks/       # Shared custom hooks
├── types/           # TypeScript type definitions
├── stores/          # Zustand stores
├── features/        # Feature modules
│   ├── auth/
│   ├── check-in/
│   ├── dashboard/
│   ├── team/
│   ├── person/
│   └── notifications/
├── components/
│   ├── ui/          # shadcn/ui components
│   ├── layout/      # Layout components
│   └── common/      # Shared components
├── routes/          # Route configuration
└── styles/          # Global styles
```

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run test     # Run tests
npm run lint     # Lint code
npm run format   # Format code
```

## Environment Variables

```
VITE_API_URL=http://localhost:3000/api/v1
```

## Development Guidelines

See `../.cursor/rules/frontend.mdc` for detailed development rules.

### Key Principles

1. **Feature-based structure** - Each feature is self-contained
2. **React Query for server state** - Never put API data in Zustand
3. **Zod validation** - All forms validated with Zod schemas
4. **TypeScript strict mode** - No 'any' types
5. **Mobile-first** - Responsive design with Tailwind
