'use client';

import { useEffect } from 'react';
import { recordReading } from '@/lib/persistence/reading';

export function ReadingTracker({ conceptId }: { conceptId: string }) {
  useEffect(() => {
    recordReading(conceptId);
  }, [conceptId]);

  return null;
}
