'use client';

import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function DialogRoot(props: React.ComponentProps<typeof Dialog.Root>) {
  return <Dialog.Root {...props} />;
}

export function DialogTrigger(props: React.ComponentProps<typeof Dialog.Trigger>) {
  return <Dialog.Trigger {...props} />;
}

export function DialogContent({ className, title, children, ...props }: React.ComponentProps<typeof Dialog.Content> & { title: string; children: React.ReactNode }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgba(17,21,16,.42)]" />
      <Dialog.Content
        {...props}
        className={cn('fixed left-1/2 top-1/2 z-50 w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-canvas p-6 shadow-overlay outline-none', className)}
      >
        <Dialog.Title className="text-[18px] font-extrabold text-ink">{title}</Dialog.Title>
        <Dialog.Close aria-label="Close dialog" className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-pill text-ink hover:bg-primary-pale">
          <X size={18} aria-hidden="true" />
        </Dialog.Close>
        <div className="mt-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
