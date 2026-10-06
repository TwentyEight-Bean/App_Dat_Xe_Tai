import { flushSync } from "react-dom";

export type TabDirection = "left" | "right";

const motionQuery = "(prefers-reduced-motion: reduce)";
const sheetSelector = ".tab-screen, .booking-sheet, .orders-screen, .driver-home-control, .d-tab";

function placeOverlay(element: HTMLElement, rect: DOMRect, shellRect: DOMRect) {
  Object.assign(element.style, {
    position: "absolute",
    inset: "auto",
    left: `${rect.left - shellRect.left}px`,
    top: `${rect.top - shellRect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    overflow: "hidden",
    pointerEvents: "none",
  });
}

let activeTransitionCleanup: (() => void) | null = null;

export function runTabTransition(
  shell: HTMLElement | null,
  direction: TabDirection,
  update: () => void,
) {
  // Clean up any ongoing transition immediately
  if (activeTransitionCleanup) {
    activeTransitionCleanup();
    activeTransitionCleanup = null;
  }

  const layer = shell?.querySelector<HTMLElement>(":scope > .tab-content-surface");
  const current = layer?.querySelector<HTMLElement>(sheetSelector);

  if (!shell || !layer || !current || typeof current.animate !== "function") {
    update();
    return;
  }

  const reduced = window.matchMedia(motionQuery).matches;
  if (reduced) {
    update();
    return;
  }

  const shellRect = shell.getBoundingClientRect();
  const currentRect = current.getBoundingClientRect();

  // Clone current tab screen as outgoing ghost overlay
  const outgoing = current.cloneNode(true) as HTMLElement;
  outgoing.setAttribute("aria-hidden", "true");
  outgoing.classList.add("tab-sheet-ghost");
  placeOverlay(outgoing, currentRect, shellRect);
  outgoing.scrollTop = current.scrollTop;
  shell.append(outgoing);

  const navClass = direction === "right" ? "nav-flow-right" : "nav-flow-left";
  shell.classList.add("tab-sheet-transitioning", navClass);

  // Synchronously update React state to mount incoming tab screen
  flushSync(update);

  const incoming = layer.querySelector<HTMLElement>(sheetSelector);
  if (!incoming) {
    outgoing.remove();
    shell.classList.remove("tab-sheet-transitioning", "nav-flow-right", "nav-flow-left");
    return;
  }

  // Consistent, buttery-smooth horizontal slide for ALL tabs (including Trang chủ)
  // Crucial: Incoming maintains solid opacity so it NEVER flashes, blinks, or becomes transparent!
  const travel = direction === "right" ? -1 : 1;
  const springEasing = "cubic-bezier(0.16, 1, 0.3, 1)";
  const smoothOutEasing = "cubic-bezier(0.25, 1, 0.5, 1)";

  const animations: Animation[] = [];

  const cleanup = () => {
    if (activeTransitionCleanup === cleanup) {
      activeTransitionCleanup = null;
    }
    animations.forEach((a) => {
      try {
        a.cancel();
      } catch {}
    });
    outgoing.remove();
    shell.classList.remove("tab-sheet-transitioning", "nav-flow-right", "nav-flow-left");
    incoming.style.transform = "";
  };

  activeTransitionCleanup = cleanup;

  const outAnim = outgoing.animate(
    [
      { transform: "translate3d(0, 0, 0)", opacity: 1 },
      { transform: `translate3d(${travel * 44}px, 0, 0)`, opacity: 0 },
    ],
    { duration: 220, easing: smoothOutEasing, fill: "both" }
  );

  const inAnim = incoming.animate(
    [
      { transform: `translate3d(${travel * -44}px, 0, 0)` },
      { transform: "translate3d(0, 0, 0)" },
    ],
    { duration: 260, easing: springEasing, fill: "both" }
  );

  animations.push(inAnim, outAnim);
  void Promise.all([inAnim.finished, outAnim.finished]).then(cleanup, cleanup);
}
