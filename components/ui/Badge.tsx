import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'orange' | 'gray';
  className?: string;
}

const variants = {
  default: 'bg-[#2E2E2E] text-[#F5F5F5]',
  success: 'bg-green-900/40 text-green-400 border border-green-800/50',
  warning: 'bg-amber-900/40 text-amber-400 border border-amber-800/50',
  danger: 'bg-red-900/40 text-red-400 border border-red-800/50',
  orange: 'bg-[#FF6B00]/20 text-[#FF6B00] border border-[#FF6B00]/30',
  gray: 'bg-[#242424] text-[#9CA3AF]',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
