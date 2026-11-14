import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let savedHtmlOverflow = '';
let savedBodyPosition = '';
let savedBodyTop = '';
let savedBodyLeft = '';
let savedBodyRight = '';
let savedBodyWidth = '';
let savedBodyOverflow = '';

export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof window === 'undefined' || typeof document === 'undefined') return;

    if (lockCount === 0) {
      savedScrollY = window.scrollY;
      const html = document.documentElement;
      const body = document.body;

      savedHtmlOverflow = html.style.overflow;
      savedBodyPosition = body.style.position;
      savedBodyTop = body.style.top;
      savedBodyLeft = body.style.left;
      savedBodyRight = body.style.right;
      savedBodyWidth = body.style.width;
      savedBodyOverflow = body.style.overflow;

      html.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${savedScrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
      body.style.overflow = 'hidden';
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        const html = document.documentElement;
        const body = document.body;

        html.style.overflow = savedHtmlOverflow;
        body.style.position = savedBodyPosition;
        body.style.top = savedBodyTop;
        body.style.left = savedBodyLeft;
        body.style.right = savedBodyRight;
        body.style.width = savedBodyWidth;
        body.style.overflow = savedBodyOverflow;

        window.scrollTo({ top: savedScrollY, behavior: 'instant' as ScrollBehavior });
      }
    };
  }, [locked]);
}
