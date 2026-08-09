'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'quiet' | 'icon';
type Size = 'md' | 'sm';

const base = 'inline-flex items-center justify-center gap-2 font-bold select-none transition-[background-color,color,transform,border-color] duration-[160ms] ease-[cubic-bezier(.2,.8,.2,1)] disabled:pointer-events-none disabled:opacity-55';

const variants: Record<Variant, string> = {
  primary: 'rounded-pill bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active hover:-translate-y-px',
  secondary: 'rounded-pill bg-ink text-canvas border border-ink hover:-translate-y-px dark:bg-card dark:text-ink dark:border-line-strong',
  tertiary: 'rounded-pill bg-card text-ink border-2 border-line-strong hover:bg-ink hover:text-canvas dark:hover:bg-primary dark:hover:text-on-primary',
  quiet: 'rounded-pill bg-transparent text-ink hover:bg-primary-pale',
  icon: 'rounded-pill bg-card text-ink border border-line hover:bg-primary-pale hover:text-ink',
};

const sizes: Record<Size, string> = {
  md: 'min-h-12 px-5 text-[15px]',
  sm: 'min-h-11 px-4 text-[14px]',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], variant === 'icon' ? 'min-h-11 min-w-11 p-0' : sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
