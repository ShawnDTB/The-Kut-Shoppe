// The browser-only platform is an explicit local design preview, never a fallback
// after an API failure and never available in a production build.
export const localPlatformPreview = import.meta.env.DEV && import.meta.env.VITE_LOCAL_PLATFORM_PREVIEW === 'true';

// Public release deliberately omits unfinished account, booking and store screens.
export const publicLaunch = import.meta.env.PROD && import.meta.env.VITE_PUBLIC_LAUNCH !== 'false';
