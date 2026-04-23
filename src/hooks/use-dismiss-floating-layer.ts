"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

type RefLike = RefObject<HTMLElement | null>;

export function useDismissFloatingLayer(refs: RefLike[], onDismiss: () => void) {
  useEffect(() => {
    function isInside(target: EventTarget | null) {
      return refs.some((ref) => ref.current && target instanceof Node && ref.current.contains(target));
    }

    function handleClick(event: MouseEvent) {
      if (isInside(event.target)) return;
      onDismiss();
    }

    function handleScrollOrMove() {
      onDismiss();
    }

    window.addEventListener("click", handleClick);
    window.addEventListener("scroll", handleScrollOrMove, true);
    window.addEventListener("wheel", handleScrollOrMove, { passive: true });
    window.addEventListener("touchmove", handleScrollOrMove, { passive: true });

    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("scroll", handleScrollOrMove, true);
      window.removeEventListener("wheel", handleScrollOrMove);
      window.removeEventListener("touchmove", handleScrollOrMove);
    };
  }, [onDismiss, refs]);
}
