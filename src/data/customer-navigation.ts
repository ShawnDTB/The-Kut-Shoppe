import type { MouseEvent } from 'react';

export function followAccountLink(event: MouseEvent<HTMLAnchorElement>, navigate: () => void) {
  if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); navigate(); }
}
