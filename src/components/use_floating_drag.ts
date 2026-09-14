import { useEffect, useRef, type PointerEvent } from 'react';
import { type RNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { withDeadline } from '../deadline';

type Gesture = { pointer: number; x: number; y: number; latestX: number; latestY: number;
  moved: boolean; released: boolean; origin?: { left: number; top: number }; id?: string };

export function useFloatingDrag(plugin: RNPlugin, enabled: boolean, onError: () => void) {
  const gesture = useRef<Gesture>();
  const pending = useRef<{ id: string; left: number; top: number }>();
  const writing = useRef(false);
  const mounted = useRef(true);
  const suppressClick = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; gesture.current = undefined; pending.current = undefined; }; }, []);
  const drain = async () => {
    if (writing.current) return;
    writing.current = true;
    try {
      while (pending.current && mounted.current) {
        const next = pending.current; pending.current = undefined;
        await withDeadline(plugin.window.setFloatingWidgetPosition(next.id, { left: next.left, top: next.top }));
        // Coalesce rapid pointer events while preserving the final drop position.
        if (pending.current) await new Promise(resolve => setTimeout(resolve, 16));
      }
    } catch { pending.current = undefined; if (mounted.current) onError(); }
    finally { writing.current = false; }
  };
  const update = (g: Gesture) => {
    const dx = g.latestX - g.x, dy = g.latestY - g.y;
    if (Math.hypot(dx, dy) >= 4) g.moved = true;
    if (g.moved && g.origin && g.id) {
      pending.current = { id: g.id, left: Math.max(0, g.origin.left + dx), top: Math.max(0, g.origin.top + dy) };
      void drain();
    }
    if (g.released && g.origin && gesture.current === g) gesture.current = undefined;
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0 || !event.isPrimary || gesture.current) return;
      suppressClick.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      const g: Gesture = { pointer: event.pointerId, x: event.screenX, y: event.screenY,
        latestX: event.screenX, latestY: event.screenY, moved: false, released: false };
      gesture.current = g;
      void (async () => {
        try {
          const context = await withDeadline(plugin.widget.getWidgetContext<WidgetLocation.FloatingWidget>());
          // The SDK context type says string, but RemNote's getDimensions schema requires a number.
          const rect = await withDeadline(plugin.widget.getDimensions(Number(context.widgetInstanceId)));
          if (!mounted.current || gesture.current !== g) return;
          if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) throw new Error('Missing window bounds');
          g.id = context.floatingWidgetId; g.origin = { left: rect.left, top: rect.top }; update(g);
        } catch { if (gesture.current === g) gesture.current = undefined; if (mounted.current) onError(); }
      })();
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const g = gesture.current;
      if (!g || g.pointer !== event.pointerId) return;
      // Screen coordinates remain stable while the iframe itself moves.
      g.latestX = event.screenX; g.latestY = event.screenY; update(g);
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const g = gesture.current;
      if (!g || g.pointer !== event.pointerId) return;
      g.latestX = event.screenX; g.latestY = event.screenY; g.released = true; update(g);
      suppressClick.current = g.moved;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel: () => { gesture.current = undefined; pending.current = undefined; suppressClick.current = true; },
    consumeDragClick: () => { const suppressed = suppressClick.current; suppressClick.current = false; return suppressed; },
  };
}
