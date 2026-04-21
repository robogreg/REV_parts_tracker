import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-[#1A1A1A] border border-[#2E2E2E] flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-[#9CA3AF]" />
        </div>
      )}
      <h3 className="font-display text-lg text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-[#9CA3AF] max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
