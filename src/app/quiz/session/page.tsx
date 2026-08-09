import { Suspense } from 'react';
import { QuizSessionClient } from '@/components/quiz/QuizSessionClient';

export default function QuizSessionPage() {
  return (
    <Suspense fallback={<div className="container-read py-10"><p className="t-eyebrow text-muted">Quiz session</p><p className="mt-4 text-[17px] leading-7 text-body">Loading session…</p></div>}>
      <QuizSessionClient />
    </Suspense>
  );
}
