const EDGE_PX = 72;
const MAX_SPEED = 22;

let rafId: number | null = null;
let pointerX = 0;
let pointerY = 0;
let active = false;

function tick() {
  if (!active) return;
  const nodes = Array.from(
    document.querySelectorAll("[data-planner-scroll-x], [data-planner-scroll-y]")
  );
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;
    const rect = el.getBoundingClientRect();
    if (el.hasAttribute("data-planner-scroll-y")) {
      if (pointerY >= rect.top && pointerY <= rect.bottom) {
        const distTop = pointerY - rect.top;
        const distBottom = rect.bottom - pointerY;
        if (distTop < EDGE_PX) {
          const speed = Math.ceil(((EDGE_PX - distTop) / EDGE_PX) * MAX_SPEED);
          el.scrollTop -= speed;
        } else if (distBottom < EDGE_PX) {
          const speed = Math.ceil(((EDGE_PX - distBottom) / EDGE_PX) * MAX_SPEED);
          el.scrollTop += speed;
        }
      }
    }
    if (el.hasAttribute("data-planner-scroll-x")) {
      if (pointerX >= rect.left && pointerX <= rect.right) {
        const distLeft = pointerX - rect.left;
        const distRight = rect.right - pointerX;
        if (distLeft < EDGE_PX) {
          const speed = Math.ceil(((EDGE_PX - distLeft) / EDGE_PX) * MAX_SPEED);
          el.scrollLeft -= speed;
        } else if (distRight < EDGE_PX) {
          const speed = Math.ceil(((EDGE_PX - distRight) / EDGE_PX) * MAX_SPEED);
          el.scrollLeft += speed;
        }
      }
    }
  }
  rafId = requestAnimationFrame(tick);
}

export function trackDragPointer(clientX: number, clientY: number) {
  pointerX = clientX;
  pointerY = clientY;
}

export function startDragAutoScroll() {
  if (active) return;
  active = true;
  if (rafId == null) rafId = requestAnimationFrame(tick);
}

export function stopDragAutoScroll() {
  active = false;
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

/** @deprecated Use startDragAutoScroll + trackDragPointer */
export function maybeAutoScrollDrag(clientX: number, clientY: number) {
  trackDragPointer(clientX, clientY);
  startDragAutoScroll();
}
