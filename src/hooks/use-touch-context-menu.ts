"use client";

import { useRef, useState } from "react";
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

type TouchContextState<Id extends string> = {
  id: Id;
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  longPressTimer: number | null;
  menuOpened: boolean;
  moved: boolean;
};

type OpenContextMenu<Id extends string> = (id: Id, x: number, y: number) => void;

const TOUCH_ROW_INTERACTION_STYLE: CSSProperties = {
  touchAction: "manipulation",
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
};

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("a, button, input, select, textarea, label, [data-no-row-context-menu='true']"))
    : false;
}

export function useTouchContextMenu<Id extends string>(onOpen: OpenContextMenu<Id>, longPressMs = 550) {
  const touchStateRef = useRef<TouchContextState<Id> | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [activeId, setActiveId] = useState<Id | null>(null);

  function clearTimer() {
    const touchState = touchStateRef.current;
    if (!touchState?.longPressTimer) return;

    window.clearTimeout(touchState.longPressTimer);
    touchState.longPressTimer = null;
  }

  function clearTouchState() {
    clearTimer();
    touchStateRef.current = null;
    setActiveId(null);
  }

  function suppressNextClick() {
    suppressClickUntilRef.current = Date.now() + 800;
  }

  function shouldSuppressClick() {
    if (suppressClickUntilRef.current <= Date.now()) return false;

    suppressClickUntilRef.current = 0;
    return true;
  }

  function bindRow(id: Id) {
    return {
      onContextMenu(event: ReactMouseEvent<HTMLElement>) {
        if (isInteractiveTarget(event.target)) return;

        event.preventDefault();
        suppressNextClick();
        onOpen(id, event.clientX, event.clientY);
      },
      onPointerDown(event: ReactPointerEvent<HTMLElement>) {
        if (event.pointerType === "mouse" || !event.isPrimary || isInteractiveTarget(event.target)) return;

        const startX = event.clientX;
        const startY = event.clientY;
        setActiveId(id);

        const longPressTimer = window.setTimeout(() => {
          const touchState = touchStateRef.current;
          if (!touchState || touchState.pointerId !== event.pointerId || touchState.moved) return;

          touchState.menuOpened = true;
          suppressNextClick();
          onOpen(id, touchState.lastX, touchState.lastY);
        }, longPressMs);

        touchStateRef.current = {
          id,
          pointerId: event.pointerId,
          startX,
          startY,
          lastX: startX,
          lastY: startY,
          longPressTimer,
          menuOpened: false,
          moved: false,
        };
      },
      onPointerMove(event: ReactPointerEvent<HTMLElement>) {
        const touchState = touchStateRef.current;
        if (!touchState || touchState.pointerId !== event.pointerId) return;

        touchState.lastX = event.clientX;
        touchState.lastY = event.clientY;

        const deltaX = Math.abs(event.clientX - touchState.startX);
        const deltaY = Math.abs(event.clientY - touchState.startY);

        if (deltaX < 10 && deltaY < 10) return;

        touchState.moved = true;
        clearTouchState();
      },
      onPointerUp(event: ReactPointerEvent<HTMLElement>) {
        const touchState = touchStateRef.current;
        if (!touchState || touchState.pointerId !== event.pointerId) return;

        if (touchState.menuOpened) {
          event.preventDefault();
        }

        clearTouchState();
      },
      onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
        const touchState = touchStateRef.current;
        if (!touchState || touchState.pointerId !== event.pointerId) return;
        clearTouchState();
      },
      onPointerLeave(event: ReactPointerEvent<HTMLElement>) {
        const touchState = touchStateRef.current;
        if (!touchState || touchState.pointerId !== event.pointerId) return;
        clearTouchState();
      },
      style: TOUCH_ROW_INTERACTION_STYLE,
    };
  }

  return {
    activeId,
    bindRow,
    clearTouchState,
    shouldSuppressClick,
  };
}
