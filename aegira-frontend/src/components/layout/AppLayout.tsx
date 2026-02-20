import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background bg-dot-pattern">
      <Sidebar />
      {/* Desktop: left padding for sidebar, Mobile: bottom padding for bottom nav */}
      <div className="md:pl-[72px] pb-20 md:pb-0">
        <Header />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
