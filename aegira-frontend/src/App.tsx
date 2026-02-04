import { AppRoutes } from './routes';
import { Toaster } from './components/ui/toaster';
import { ToastProvider } from './lib/hooks/use-toast';

function App() {
  return (
    <ToastProvider>
      <AppRoutes />
      <Toaster />
    </ToastProvider>
  );
}

export default App;
