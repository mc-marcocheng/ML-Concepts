'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Copy, Highlighter, MessageSquare, PenLine, X, type LucideIcon } from 'lucide-react';
import { newId, upsertNote } from '@/lib/persistence/notes';
import { useAnnotationUi } from '@/lib/store/annotation';
import { useUiStore } from '@/lib/store/ui';
import { captureSelection, copyText, selectionRects, type CapturedSelection } from '@/lib/notes/selection-capture';

/** Coalesce bursts of selectionchange while handles are dragged. */
const SYNC_DEBOUNCE = 90;
/** Keep the bar alive long enough for a tap on it to reach `click`. */
const HIDE_GRACE = 160;

/** Worst-case height + gap of the OS selection menu (iOS edit menu / Android action bar). */
const NATIVE_MENU_H = 52;
const NATIVE_MENU_GAP = 14;
/** Extra clearance before we consider a dock "colliding". */
const COLLISION_PAD = 8;
/** Hysteresis so scrolling cannot make the bar ping-pong between docks. */
const COLLISION_HYST = 28;

type Dock = 'bottom' | 'top' | 'float';

interface Capture extends CapturedSelection {
  conceptId: string;
  conceptTitle: string;
  conceptSummary: string;
}

interface Metrics {
  barHeight: number;
  bottomInset: number;
  headerHeight: number;
}

function ActionButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button type="button" onClick={onClick} className="sel-action">
      <Icon size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function SelectionToolbar() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [active, setActive] = useState<Capture | null>(null);
  const [rects, setRects] = useState<DOMRect[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [dock, setDock] = useState<Dock>('bottom');
  const [copied, setCopied] = useState(false);

  const barRef = useRef<HTMLDivElement | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);

  /** Actions read this, never the live selection — a tap on our own bar collapses it (iOS/Android). */
  const lastCaptureRef = useRef<Capture | null>(null);
  /** True between pointerdown and pointerup on the bar itself. */
  const barPointerRef = useRef(false);
  const hideRef = useRef<number | undefined>(undefined);
  const syncRef = useRef<number | undefined>(undefined);
  const syncFnRef = useRef<() => void>(() => {});

  const openAsk = useUiStore(state => state.openAsk);
  const startDraft = useAnnotationUi(state => state.startDraft);

  useEffect(() => {
    setMounted(true);
    const query = window.matchMedia('(pointer: coarse)');
    const apply = () => setCoarse(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const cancelHide = useCallback(() => window.clearTimeout(hideRef.current), []);

  const hide = useCallback(() => {
    cancelHide();
    window.clearTimeout(syncRef.current);
    setActive(null);
    setRects([]);
    setCopied(false);
    lastCaptureRef.current = null;
    barPointerRef.current = false;
  }, [cancelHide]);

  const armHide = useCallback((delay = HIDE_GRACE) => {
    cancelHide();
    hideRef.current = window.setTimeout(() => hide(), delay);
  }, [cancelHide, hide]);

  useEffect(() => {
    hide();
  }, [pathname, hide]);

  /* ---- read the selection; never write to it ---------------------------- */
  const sync = useCallback(() => {
    if (useUiStore.getState().askOpen || useUiStore.getState().paletteOpen || useAnnotationUi.getState().draft) {
      hide();
      return;
    }

    const article = document.querySelector<HTMLElement>('[data-askable][data-concept-id]');
    if (!article) {
      hide();
      return;
    }

    const captured = captureSelection(article);

    if (!captured) {
      // A tap on our own bar collapses the selection on iOS/Android.
      // Stay mounted so the pending click can still run.
      if (barPointerRef.current) return;
      armHide();
      return;
    }

    cancelHide();
    const next: Capture = {
      ...captured,
      conceptId: article.dataset.conceptId ?? '',
      conceptTitle: article.dataset.conceptTitle ?? '',
      conceptSummary: article.dataset.conceptSummary ?? '',
    };
    lastCaptureRef.current = next;
    setActive(next);
    setRects(captured.rects);
  }, [armHide, cancelHide, hide]);

  useEffect(() => {
    syncFnRef.current = sync;
  });

  const scheduleSync = useCallback((delay = SYNC_DEBOUNCE) => {
    window.clearTimeout(syncRef.current);
    syncRef.current = window.setTimeout(() => syncFnRef.current(), delay);
  }, []);

  /* ---- listeners ---------------------------------------------------------- */
  useEffect(() => {
    const onSelectionChange = () => scheduleSync();

    const onPointerDown = (event: PointerEvent) => {
      const insideBar = !!barRef.current?.contains(event.target as Node);
      barPointerRef.current = insideBar;
      if (insideBar) cancelHide();
      // NOTE: no dismissal here. Hiding on outside-pointerdown fights the start
      // of every new long-press.
    };

    const onPointerUp = () => {
      if (!barPointerRef.current) return;
      barPointerRef.current = false;
      // The click handler runs immediately after this; if it did not fire
      // (finger dragged off the button) the empty selection will close us.
      scheduleSync(HIDE_GRACE + 120);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };

    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(syncRef.current);
      window.clearTimeout(hideRef.current);
    };
  }, [cancelHide, hide, scheduleSync]);

  /* ---- keep rects fresh (drives dock choice + desktop float) ------------- */
  useEffect(() => {
    if (!active) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRects(selectionRects(active.range)));
    };

    const viewport = window.visualViewport;
    document.addEventListener('scroll', update, { passive: true, capture: true });
    window.addEventListener('resize', update);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
    };
  }, [active]);

  /* ---- measure the two candidate docks ------------------------------------ */
  useLayoutEffect(() => {
    if (!active || !coarse) return;
    const bar = barRef.current;
    const probe = probeRef.current;
    if (!bar || !probe) return;

    const headerHeight =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 64;
    const next: Metrics = {
      barHeight: bar.offsetHeight,
      bottomInset: probe.getBoundingClientRect().height,
      headerHeight,
    };
    setMetrics(current =>
      current
      && Math.abs(current.barHeight - next.barHeight) < 1
      && Math.abs(current.bottomInset - next.bottomInset) < 1
      && Math.abs(current.headerHeight - next.headerHeight) < 1
        ? current
        : next,
    );
  }, [active, coarse, dock, rects.length]);

  /* ---- dock selection ------------------------------------------------------ */
  useEffect(() => {
    if (!coarse) {
      setDock('float');
      return;
    }
    if (!metrics || rects.length === 0) return;

    const first = rects[0];
    const last = rects[rects.length - 1];
    const viewportH = window.visualViewport?.height ?? window.innerHeight;

    // Where the OS menu can plausibly land: hugging the top or bottom of the selection.
    const nativeTop = first.top - NATIVE_MENU_H - NATIVE_MENU_GAP;
    const nativeBottom = last.bottom + NATIVE_MENU_H + NATIVE_MENU_GAP;

    const bottomBand = {
      top: viewportH - metrics.bottomInset - metrics.barHeight,
      bottom: viewportH - metrics.bottomInset,
    };
    const topBand = {
      top: metrics.headerHeight + 12,
      bottom: metrics.headerHeight + 12 + metrics.barHeight,
    };

    const hitsBottom = (pad: number) => nativeBottom > bottomBand.top - pad && nativeTop < bottomBand.bottom + pad;
    const hitsTop = (pad: number) => nativeBottom > topBand.top - pad && nativeTop < topBand.bottom + pad;

    setDock(current => {
      if (current === 'top') {
        // Only fall back to the bottom when it is comfortably clear.
        return hitsBottom(COLLISION_PAD + COLLISION_HYST) ? 'top' : 'bottom';
      }
      if (hitsBottom(COLLISION_PAD) && !hitsTop(COLLISION_PAD)) return 'top';
      return 'bottom';
    });
  }, [coarse, metrics, rects]);

  /* ---- flag for the tab bar ------------------------------------------------ */
  useEffect(() => {
    const root = document.documentElement;
    if (active && coarse) root.dataset.selectionActive = 'true';
    else delete root.dataset.selectionActive;
    return () => {
      delete root.dataset.selectionActive;
    };
  }, [active, coarse]);

  const floatStyle = useMemo(() => {
    if (dock !== 'float' || rects.length === 0) return undefined;
    const first = rects[0];
    const last = rects[rects.length - 1];
    const centre = first.left + first.width / 2;
    const above = first.top > 72;

    return {
      left: Math.min(Math.max(centre, 140), Math.max(140, window.innerWidth - 140)),
      top: above ? first.top - 54 : last.bottom + 12,
    };
  }, [dock, rects]);

  /* ---- actions -------------------------------------------------------------- */
  const withCapture = (run: (capture: Capture) => void) => () => {
    const capture = lastCaptureRef.current;
    if (!capture) {
      hide();
      return;
    }
    run(capture);
  };

  const onHighlight = withCapture(capture => {
    const now = Date.now();
    upsertNote({
      id: newId(),
      conceptId: capture.conceptId,
      color: 'yellow',
      exact: capture.anchor.exact,
      prefix: capture.anchor.prefix,
      suffix: capture.anchor.suffix,
      start: capture.anchor.start,
      body: '',
      createdAt: now,
      updatedAt: now,
    });
    // Safe to clear now: the user has committed.
    window.getSelection()?.removeAllRanges();
    hide();
  });

  const onNote = withCapture(capture => {
    startDraft(capture.anchor);
    window.getSelection()?.removeAllRanges();
    hide();
  });

  const onAsk = withCapture(capture => {
    openAsk(capture.context, `Explain this passage: "${capture.text.slice(0, 400)}"`);
    window.getSelection()?.removeAllRanges();
    hide();
  });

  const onCopy = withCapture(capture => {
    void copyText(capture.text).then(ok => {
      setCopied(ok);
      window.setTimeout(hide, 700);
    });
  });

  if (!mounted || !active) return null;

  return createPortal(
    <>
      {/* Measures tab-bar height + safe-area inset exactly, in CSS pixels. */}
      <div ref={probeRef} className="sel-probe" aria-hidden="true" />

      <div
        ref={barRef}
        role="toolbar"
        aria-label="Selection actions"
        data-dock={dock}
        className="sel-bar"
        style={floatStyle}
        onMouseDown={event => event.preventDefault()}
      >
        <div className="sel-bar__inner">
          <ActionButton onClick={onHighlight} icon={Highlighter} label="Highlight" />
          <ActionButton onClick={onNote} icon={PenLine} label="Note" />
          <ActionButton onClick={onAsk} icon={MessageSquare} label="Ask" />
          {dock === 'float' ? <ActionButton onClick={onCopy} icon={Copy} label={copied ? 'Copied' : 'Copy'} /> : null}
          <button type="button" className="sel-bar__close" aria-label="Dismiss selection actions" onClick={hide}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard' : 'Selection actions available'}
      </p>
    </>,
    document.body,
  );
}
