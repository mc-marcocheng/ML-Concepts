'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <p role="status" className="flex items-center justify-center gap-2 bg-warning-pale px-4 py-2 text-[13px] font-semibold text-warning-content">
      <WifiOff size={14} aria-hidden="true" /> Offline — remote model calls will fail; notes and quizzes still work.
    </p>
  );
}