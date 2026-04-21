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
        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-card)] border border-[var(--bg-hover)] flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-[var(--tx-muted)]" />
        </div>
      )}
      <h3 className="font-display text-lg text-[var(--tx-primary)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--tx-muted)] max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
