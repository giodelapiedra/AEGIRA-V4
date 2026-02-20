import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-dot-pattern">
      <Sidebar />
      <div className="pb-20 md:pb-0 md:pl-[84px]">
        <Header />
        <main className="content-shell py-6 md:py-8">
          <div className="section-stack">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
