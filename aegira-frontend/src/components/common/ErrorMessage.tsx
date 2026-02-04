import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ErrorMessageProps {
  message: string;
  className?: string;
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md bg-destructive/10 p-4 text-destructive',
        className
      )}
    >
      <AlertCircle className="h-5 w-5" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
