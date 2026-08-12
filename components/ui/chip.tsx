import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chipVariants = cva(
  'inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-pill border px-4 text-[13.5px] font-medium transition-colors',
  {
    variants: {
      selected: {
        true: 'border-ink bg-ink text-surface',
        false: 'border-line bg-surface text-ink hover:bg-canvas',
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
);

export interface ChipProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof chipVariants> {}

export function Chip({ className, selected, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected ?? false}
      className={cn(chipVariants({ selected }), className)}
      {...props}
    />
  );
}
