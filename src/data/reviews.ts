import { booksyUrl } from './site';

// Public Booksy profile checked October 8, 2026. Keep this a dated snapshot,
// not a live counter or a combined rating across different platforms.
export const booksyReviews = {
  rating: '5.0', total: 664, fiveStar: 649, fourStar: 12, oneStar: 3,
  checkedOn: 'October 8, 2026',
  href: `${booksyUrl}#business-reviews`,
} as const;
