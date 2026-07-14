/** Throttle drag-over UI updates to one React commit per animation frame. */
export function createDragHighlightScheduler(
  apply: (columnId: string | null, guide: { columnId: string; beforeTaskId: string | null } | null) => void
) {
  let rafId: number | null = null;
  let pendingColumnId: string | null = null;
  let pendingGuide: { columnId: string; beforeTaskId: string | null } | null = null;

  function flush() {
    rafId = null;
    apply(pendingColumnId, pendingGuide);
  }

  return {
    schedule(columnId: string | null, guide: { columnId: string; beforeTaskId: string | null } | null) {
      pendingColumnId = columnId;
      pendingGuide = guide;
      if (rafId != null) return;
      rafId = requestAnimationFrame(flush);
    },
    cancel() {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      pendingColumnId = null;
      pendingGuide = null;
    },
  };
}
