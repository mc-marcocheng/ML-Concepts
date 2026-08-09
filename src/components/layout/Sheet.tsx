'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils/cn';

export function Sheet({ open, onOpenChange, side = 'right', title, widthClass, children }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  side?: 'right' | 'bottom' | 'left';
  title: string;
  widthClass?: string;
  children: React.ReactNode;
}) {
  const defaultWidth = side === 'right' ? 'w-[min(560px,100vw)]' : 'w-[min(360px,88vw)]';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(17,21,16,.42)]" />
        <Dialog.Content
          aria-label={title}
          className={cn(
            'fixed z-50 flex flex-col bg-canvas shadow-overlay outline-none',
            side === 'right' && 'right-0 top-0 h-dvh border-l border-line rounded-l-xl',
            side === 'left' && 'left-0 top-0 h-dvh border-r border-line',
            side === 'bottom' && 'inset-x-0 bottom-0 max-h-[92dvh] h-[86dvh] rounded-t-xl border-t border-line pb-[env(safe-area-inset-bottom)]',
            widthClass ?? defaultWidth,
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {side === 'bottom' && <div className="mx-auto mt-2 h-1 w-10 rounded-pill bg-line" aria-hidden="true" />}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
