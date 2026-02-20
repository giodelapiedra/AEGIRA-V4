import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface TableSearchProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  className?: string;
}

export function TableSearch({
  placeholder = 'Search...',
  value,
  onChange,
  onSearch,
  className,
}: TableSearchProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className={cn('flex w-full flex-col gap-2 sm:flex-row sm:items-center', className)}>
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-10 sm:max-w-sm"
        aria-label="Search"
      />
      <Button onClick={onSearch} variant="secondary" size="sm" className="h-10 sm:w-auto">
        <Search className="h-4 w-4 mr-1" />
        Search
      </Button>
    </div>
  );
}
