'use client';

import { Check, Minus, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { QuizItem } from '@/lib/content/types';
import type { GradeResult } from '@/lib/grading/pipeline';
import { RubricList } from './RubricList';
import { useUiStore } from '@/lib/store/ui';
import type { AskContext } from '@/lib/llm/types';

const TONE = {
  correct: { tone: 'positive' as const, label: 'Correct', Icon: Check },
  partial: { tone: 'warning' as const, label: 'Partial', Icon: Minus },
  incorrect: { tone: 'negative' as const, label: 'Incorrect', Icon: X },
  skipped: { tone: 'neutral' as const, label: 'Not graded', Icon: Minus },
};

export function VerdictCard({
  item,
  result,
  answer,
  onNext,
  onSelfGrade,
  askContext,
  nextDisabled = false,
}: {
  item: QuizItem;
  result: GradeResult;
  answer: string;
  onNext: () => void;
  onSelfGrade: (verdict: 'correct' | 'partial' | 'incorrect', score: number) => void;
  askContext: AskContext;
  nextDisabled?: boolean;
}) {
  const openAsk = useUiStore(state => state.openAsk);
  const { tone, label, Icon } = TONE[result.verdict];
  const rubric = result.rubric ?? [];
  const checks = result.checks ?? [];
  const displayAnswer = formatAnswer(item, answer);

  return (
    <section aria-live="polite" className="mt-6 rounded-xl border-2 border-line-strong bg-card p-6 shadow-offset">
      <header className="flex flex-wrap items-center gap-3">
        <Badge tone={tone}><Icon size={14} aria-hidden="true" />{label}</Badge>
        <span className="font-mono text-[12px] text-muted">
          {Math.round(result.score * 100)}% · graded by {result.gradedBy}
        </span>
      </header>

      {rubric.length > 0 ? (
        <div className="mt-5">
          <p className="t-eyebrow text-muted">Rubric</p>
          <div className="mt-3">
            <RubricList rubric={rubric} checks={checks} />
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        <div>
          <p className="t-eyebrow text-muted">Your answer</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-canvas-soft p-4 font-mono text-[13px] text-ink whitespace-pre-wrap">{displayAnswer || '(blank)'}</pre>
        </div>
        {item.answer ? (
          <div>
            <p className="t-eyebrow text-muted">Reference answer</p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-canvas-soft p-4 font-mono text-[13px] text-ink whitespace-pre-wrap">{item.answer}</pre>
          </div>
        ) : null}
        {item.explanation ? (
          <div>
            <p className="t-eyebrow text-muted">Why</p>
            <p className="mt-2 text-[15px] leading-7 text-body">{item.explanation}</p>
          </div>
        ) : null}
        {result.note ? (
          <div>
            <p className="t-eyebrow text-muted">Judge note</p>
            <p className="mt-2 text-[15px] leading-7 text-body">{result.note}</p>
          </div>
        ) : null}

        {result.needsSelfGrade ? (
          <div className="mt-5 rounded-lg border border-line bg-canvas-soft p-4">
            <p className="t-eyebrow text-muted">Self-grade</p>
            <p className="mt-2 text-[14px] leading-6 text-body">{result.note}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['correct', 'partial', 'incorrect'] as const).map(verdict => (
                <Button key={verdict} size="sm" variant="tertiary" onClick={() => onSelfGrade(verdict, verdict === 'correct' ? 1 : verdict === 'partial' ? 0.5 : 0)}>
                  {verdict[0].toUpperCase() + verdict.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="mt-6 flex flex-wrap items-center gap-2">
        <Button onClick={onNext} disabled={nextDisabled}>Next question</Button>
        <Button
          variant="quiet"
          size="sm"
          className="gap-2"
          onClick={() => openAsk(askContext, `I answered:\n\n${answer || '(blank)'}\n\nThe reference answer is:\n\n${item.answer ?? '(no reference answer)'}\n\nExplain precisely what is different and why it matters.`)}
        >
          <MessageSquare size={15} aria-hidden="true" /> Explain the difference
        </Button>
      </footer>
    </section>
  );
}

function formatAnswer(item: QuizItem, answer: string) {
  if (item.type !== 'mcq') return answer;
  const optionIndex = Number(answer);
  const option = Number.isInteger(optionIndex) ? item.options?.[optionIndex] : undefined;
  return option ? `${optionIndex + 1}. ${option}` : answer;
}
