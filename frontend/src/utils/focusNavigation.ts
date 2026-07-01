import type { KeyboardEvent } from 'react';

const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])';

function listFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex !== -1,
  );
}

/** Move focus to the next tabbable field inside `root`, like Tab. */
export function focusNextField(root: HTMLElement | null, current: HTMLElement): boolean {
  if (!root) return false;
  const elements = listFocusable(root);
  const idx = elements.indexOf(current);
  if (idx === -1 || idx >= elements.length - 1) return false;
  elements[idx + 1].focus();
  return true;
}

/** Enter on a form field should advance focus (except textarea / submit). */
export function handleFormEnterKey(
  e: KeyboardEvent<HTMLElement>,
  root: HTMLElement | null,
): void {
  if (e.key !== 'Enter') return;
  const target = e.target as HTMLElement;
  if (target.tagName === 'TEXTAREA') return;
  if (target instanceof HTMLButtonElement && target.type === 'submit') return;
  // Date fields validate then advance on their own.
  if (target instanceof HTMLInputElement && target.dataset.dateField === 'true') return;

  e.preventDefault();
  focusNextField(root, target);
}
