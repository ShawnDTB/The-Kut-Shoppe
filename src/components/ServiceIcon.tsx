export type ServiceIconName = 'scissors' | 'razor' | 'beard' | 'color' | 'scalp' | 'locs';

/** Decorative, consistently sized symbols; the adjacent text names the service. */
export function ServiceIcon({ name }: { name: ServiceIconName }) {
  return <svg className="service-symbol" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'scissors' && <><circle cx="7" cy="24" r="4" /><circle cx="25" cy="24" r="4" /><path d="m10 21 16-17M22 21 6 4" /></>}
    {name === 'razor' && <><path d="m5 8 21-3 1 7-20 3Z" /><path d="m7 15 16 12a3 3 0 0 0 4-4L13 13" /><circle cx="9" cy="11" r=".5" /></>}
    {name === 'beard' && <><path d="M6 9v8c0 7 6 10 10 12 4-2 10-5 10-12V9M6 14l5 4 5-2 5 2 5-4M11 22l5 3 5-3" /><path d="M12 11h8" /></>}
    {name === 'color' && <><path d="M7 4h12v8H7zM11 12v14a2 2 0 0 0 4 0V12M11 4v5M15 4v5M25 12s-4 5-4 8a4 4 0 0 0 8 0c0-3-4-8-4-8Z" /></>}
    {name === 'scalp' && <><path d="M7 14h14l2 5v9H5v-9ZM11 14V9h6v5M14 9V4h10v3M9 21h10" /><path d="M26 10s-2 3-2 4a2 2 0 0 0 4 0c0-1-2-4-2-4Z" /></>}
    {name === 'locs' && <><path d="M8 4c-6 7 6 10 0 17-2 3-2 5 0 7M16 4c-6 7 6 10 0 17-2 3-2 5 0 7M24 4c-6 7 6 10 0 17-2 3-2 5 0 7" /></>}
  </svg>;
}
