'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { addAttempt, loadAttempts, type AttemptRecord } from '@/lib/persistence/progress';
import { buildSession, type QuizEntry, type SessionParams } from '@/lib/quiz/load';
import { CodeCloze } from './CodeCloze';
import { gradeAnswer, rubricFor, type GradeResult } from '@/lib/grading/pipeline';
import { VerdictCard } from './VerdictCard';
import { saveSession, type SessionItemRecord } from '@/lib/persistence/sessions';
import type { AskContext } from '@/lib/llm/types';

type SessionOutcome = SessionItemRecord;

export function QuizSessionClient() {
  const params = useSearchParams();
  const sessionParams = useMemo<SessionParams>(() => ({
    scope: (params.get('scope') ?? 'concept') as SessionParams['scope'],
    id: params.get('id') ?? undefined,
    size: Number(params.get('size') ?? 10),
  }), [params]);

  const [entries, setEntries] = useState<QuizEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [codeValues, setCodeValues] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [grading, setGrading] = useState(false);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [sessionLog, setSessionLog] = useState<SessionOutcome[]>([]);
  const [hintIndex, setHintIndex] = useState(0);
  const [sessionSaved, setSessionSaved] = useState(false);
  const [startedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const refreshAttempts = () => setAttempts(loadAttempts());
    refreshAttempts();
    window.addEventListener('storage', refreshAttempts);
    setLoading(true);
    buildSession(sessionParams)
      .then(next => { if (!cancelled) setEntries(next); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      window.removeEventListener('storage', refreshAttempts);
    };
  }, [sessionParams]);

  const current = entries[index];
  const currentAskContext: AskContext = useMemo(() => ({
    conceptId: current?.conceptId ?? null,
    conceptTitle: current?.conceptTitle,
    summary: current?.conceptSummary,
  }), [current?.conceptId, current?.conceptTitle, current?.conceptSummary]);

  useEffect(() => {
    if (!done || sessionSaved || !entries.length) return;
    saveSession({
      id: `s_${startedAt.toString(36)}`,
      startedAt,
      completedAt: Date.now(),
      params: sessionParams,
      items: sessionLog,
    });
    setSessionSaved(true);
  }, [done, entries.length, sessionLog, sessionParams, sessionSaved, startedAt]);
  const modeLabel = useMemo(() => {
    if (sessionParams.scope === 'concept') return current?.conceptTitle ?? sessionParams.id ?? 'Concept session';
    if (sessionParams.scope === 'category') return `${sessionParams.id ?? 'Category'} session`;
    if (sessionParams.scope === 'weak') return 'Weak spots session';
    if (sessionParams.scope === 'due') return 'Due review session';
    if (sessionParams.scope === 'interview') return 'Interview sim';
    return 'Mixed session';
  }, [current?.conceptTitle, sessionParams.id, sessionParams.scope]);

  const answerText = current?.item.type === 'code'
    ? Object.entries(codeValues).map(([blankId, value]) => `#${blankId}: ${value}`).join('\n')
    : answer;

  const currentHints = current?.item.hints ?? [];
  const visibleHints = currentHints.slice(0, hintIndex);

  const recordOutcome = (outcome: SessionOutcome) => {
    setSessionLog(previous => {
      const next = [...previous];
      next[index] = outcome;
      return next;
    });
  };

  const advance = () => {
    const next = index + 1;
    if (next >= entries.length) {
      setDone(true);
      return;
    }
    setIndex(next);
    setAnswer('');
    setCodeValues({});
    setRevealed(false);
    setResult(null);
    setHintIndex(0);
    setGrading(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitCurrent = async () => {
    if (!current || grading || revealed) return;
    setGrading(true);
    setRevealed(true);
    try {
      const targetAnswer = answerText;
      const graded = await gradeAnswer(current.item, targetAnswer);
      setResult(graded);

      const outcome: SessionOutcome = {
        conceptId: current.conceptId,
        conceptTitle: current.conceptTitle,
        itemId: current.item.id,
        prompt: current.item.prompt,
        answer: targetAnswer,
        verdict: graded.verdict,
        score: graded.score,
        gradedBy: graded.gradedBy,
        note: graded.note,
        ts: Date.now(),
      };

      if (!graded.needsSelfGrade) {
        addAttempt({
          conceptId: current.conceptId,
          itemId: current.item.id,
          prompt: current.item.prompt,
          answer: targetAnswer,
          verdict: graded.verdict,
          score: graded.score,
          ts: outcome.ts,
        });
        setAttempts(loadAttempts());
      }

      recordOutcome(outcome);
    } catch (error) {
      const message = (error as Error | undefined)?.message?.trim() || 'Grader unavailable';
      console.error('[quiz] grading failed', { itemId: current.item.id, error });
      const fallback: GradeResult = {
        verdict: 'skipped',
        score: 0,
        explanation: message,
        gradedBy: 'pending',
        checks: [],
        note: message,
        rubric: rubricFor(current.item),
        needsSelfGrade: true,
      };
      setResult(fallback);
      recordOutcome({
        conceptId: current.conceptId,
        conceptTitle: current.conceptTitle,
        itemId: current.item.id,
        prompt: current.item.prompt,
        answer: answerText,
        verdict: fallback.verdict,
        score: fallback.score,
        gradedBy: fallback.gradedBy,
        note: fallback.note,
        ts: Date.now(),
      });
    } finally {
      setGrading(false);
    }
  };

  const skipCurrent = () => {
    if (!current || grading || revealed) return;
    const skippedAt = Date.now();
    const targetAnswer = answerText;
    addAttempt({
      conceptId: current.conceptId,
      itemId: current.item.id,
      prompt: current.item.prompt,
      answer: targetAnswer,
      verdict: 'skipped',
      score: 0,
      ts: skippedAt,
    });
    setAttempts(loadAttempts());
    setResult({
      verdict: 'skipped',
      score: 0,
      explanation: 'Skipped by learner',
      gradedBy: 'pending',
      checks: [],
      note: 'Skipped by learner',
      rubric: current.item.rubric,
    });
    recordOutcome({
      conceptId: current.conceptId,
      conceptTitle: current.conceptTitle,
      itemId: current.item.id,
      prompt: current.item.prompt,
      answer: targetAnswer,
      verdict: 'skipped',
      score: 0,
      gradedBy: 'pending',
      note: 'Skipped by learner',
      ts: skippedAt,
    });
    setRevealed(true);
    advance();
  };

  const selfGrade = (verdict: 'correct' | 'partial' | 'incorrect', score: number) => {
    if (!current || !result) return;
    const now = Date.now();
    addAttempt({
      conceptId: current.conceptId,
      itemId: current.item.id,
      prompt: current.item.prompt,
      answer: answerText,
      verdict,
      score,
      ts: now,
    });
    setAttempts(loadAttempts());
    const nextResult = { ...result, verdict, score, gradedBy: 'self' as const, needsSelfGrade: false, explanation: 'Self-graded answer' };
    setResult(nextResult);
    recordOutcome({
      conceptId: current.conceptId,
      conceptTitle: current.conceptTitle,
      itemId: current.item.id,
      prompt: current.item.prompt,
      answer: answerText,
      verdict,
      score,
      gradedBy: 'self',
      note: 'Self-graded answer',
      ts: now,
    });
  };

  const handleNext = () => {
    if (result?.needsSelfGrade || grading) return;
    advance();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

      if (grading || !current) return;

      if (current.item.type === 'mcq' && event.key >= '1' && event.key <= '9') {
        const optionIndex = Number(event.key) - 1;
        if (current.item.options?.[optionIndex]) {
          event.preventDefault();
          setAnswer(String(optionIndex));
        }
        return;
      }

      if (event.key.toLowerCase() === 'n' && !typing) {
        if (result && !result.needsSelfGrade) {
          event.preventDefault();
          advance();
        }
        return;
      }

      if (event.key === 'Enter' && !typing) {
        if (result && !result.needsSelfGrade) {
          event.preventDefault();
          advance();
          return;
        }
        if (!result) {
          event.preventDefault();
          void submitCurrent();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [advance, current, grading, result]);

  if (loading) {
    return (
      <div className="container-read py-10">
        <p className="t-eyebrow text-muted">Quiz session</p>
        <h1 className="t-display-md mt-3">Loading session…</h1>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="container-read py-10">
        <p className="t-eyebrow text-muted">Quiz session</p>
        <h1 className="t-display-md mt-3">No items available</h1>
        <p className="mt-4 text-[17px] leading-7 text-body">Try another scope from the quiz launcher.</p>
      </div>
    );
  }

  if (done || !current) {
    const average = sessionLog.length ? sessionLog.reduce((sum, item) => sum + item.score, 0) / sessionLog.length : 0;

    return (
      <div className="container-read py-10">
        <p className="t-eyebrow text-muted">Quiz session</p>
        <h1 className="t-display-md mt-3">Session complete</h1>
        <p className="mt-4 text-[17px] leading-7 text-body">You finished {entries.length} item{entries.length === 1 ? '' : 's'} in this session.</p>
        <p className="mt-3 font-mono text-[12px] text-muted">Stored attempts: {attempts.length} · Average score: {Math.round(average * 100)}%</p>

        <section className="mt-8 rounded-xl border border-line bg-card p-6">
          <p className="t-eyebrow text-muted">Summary</p>
          <div className="mt-4 grid gap-3">
            {sessionLog.map(item => (
              <article key={`${item.itemId}-${item.ts}`} className="rounded-lg border border-line bg-canvas-soft p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-extrabold text-ink">{item.conceptTitle}</h2>
                    <p className="mt-1 text-[14px] leading-6 text-body">{item.prompt}</p>
                  </div>
                  <BadgeRow verdict={item.verdict} score={item.score} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/learn/${item.conceptId}`} className="rounded-pill bg-primary px-4 py-2.5 text-[14px] font-semibold text-on-primary shadow-offset">
                    Review concept
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container-read py-10">
      <p className="t-eyebrow text-muted">Quiz session</p>
      <h1 className="t-display-md mt-3">{modeLabel}</h1>
      <p className="mt-4 text-[17px] leading-7 text-body">{entries.length} item{entries.length === 1 ? '' : 's'} loaded for this session.</p>
      {sessionParams.scope === 'interview' ? <p className="mt-3 rounded-lg border border-line bg-canvas-soft p-4 text-[14px] leading-6 text-body">Answer as if you were in a live interview: be concise first, then add detail only if it matters.</p> : null}

      <section className="mt-8 rounded-lg border border-line bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <p className="t-eyebrow text-muted">Question {index + 1} of {entries.length}</p>
          <p className="font-mono text-[12px] text-muted">{Math.round((index / entries.length) * 100)}% complete</p>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-pill bg-canvas-soft">
          <div className="h-full rounded-pill bg-primary transition-[width] duration-300" style={{ width: `${(index / entries.length) * 100}%` }} />
        </div>

        <p className="mt-3 font-mono text-[12px] text-muted">{current.conceptTitle}</p>
        <h2 className="mt-3 text-[22px] font-extrabold text-ink">{current.item.prompt}</h2>

        {currentHints.length ? (
          <div className="mt-4 rounded-lg border border-line bg-canvas-soft p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="t-eyebrow text-muted">Hint{currentHints.length > 1 ? 's' : ''}</p>
              <Button
                variant="quiet"
                size="sm"
                disabled={hintIndex >= currentHints.length}
                onClick={() => setHintIndex(value => Math.min(currentHints.length, value + 1))}
              >
                {hintIndex >= currentHints.length ? 'No more hints' : hintIndex === 0 ? 'Show hint' : 'Next hint'}
              </Button>
            </div>
            {visibleHints.length ? (
              <ul className="mt-3 grid gap-2">
                {visibleHints.map((hint, hintItemIndex) => (
                  <li key={`${hintItemIndex}-${hint}`} className="rounded-md border border-line bg-card px-3 py-2 text-[14px] leading-6 text-body">
                    {hint}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {current.item.type === 'mcq' ? (
          <div className="mt-6 grid gap-2">
            {current.item.options?.map((option, optionIndex) => (
              <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-canvas-soft p-4 text-ink">
                <input type="radio" name="answer" checked={answer === String(optionIndex)} onChange={() => setAnswer(String(optionIndex))} />
                <span>{option}</span>
              </label>
            ))}
          </div>
        ) : current.item.type === 'code' ? (
          <div className="mt-6">
            <CodeCloze
              item={current.item}
              values={codeValues}
              onChange={(blankId, value) => setCodeValues(values => ({ ...values, [blankId]: value }))}
              onSubmit={() => void submitCurrent()}
            />
          </div>
        ) : (
          <textarea
            value={answer}
            onChange={event => setAnswer(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitCurrent();
              }
            }}
            rows={current.item.type === 'numeric' ? 1 : 4}
            className="mt-6 w-full rounded-lg border border-line bg-canvas-soft p-4 text-ink"
            placeholder={current.item.type === 'numeric' ? '0.95' : 'Type your answer'}
          />
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button disabled={grading || revealed} onClick={() => void submitCurrent()}>
            {grading ? <span className="inline-flex items-center gap-2"><LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Grading…</span> : 'Submit'}
          </Button>
          <Button variant="tertiary" size="sm" disabled={grading || revealed} onClick={skipCurrent}>Skip</Button>
        </div>

        {revealed && result ? (
          <VerdictCard
            item={current.item}
            result={result}
            answer={answerText}
            onNext={handleNext}
            onSelfGrade={selfGrade}
            askContext={currentAskContext}
            nextDisabled={result.needsSelfGrade}
          />
        ) : null}
      </section>
    </div>
  );
}

function BadgeRow({ verdict, score }: { verdict: GradeResult['verdict']; score: number }) {
  const label = verdict === 'correct' ? 'Correct' : verdict === 'partial' ? 'Partial' : verdict === 'incorrect' ? 'Incorrect' : 'Skipped';
  const className = verdict === 'correct'
    ? 'bg-positive-pale text-positive-content'
    : verdict === 'partial'
      ? 'bg-warning-pale text-warning-content'
      : verdict === 'incorrect'
        ? 'bg-negative-pale text-negative-content'
        : 'bg-canvas-soft text-body';

  return <span className={`rounded-pill px-3 py-1 text-[12px] font-semibold ${className}`}>{label} · {Math.round(score * 100)}%</span>;
}