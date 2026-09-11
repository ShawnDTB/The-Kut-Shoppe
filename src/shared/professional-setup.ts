export interface SetupProfile { professionalName: string; bio: string; locationIds: string[]; serviceIds: string[] }
export interface ProfessionalSubmission extends SetupProfile {
  id: string; status: 'draft' | 'submitted' | 'returned' | 'approved'; version: number; reviewNote: string; submittedAt: string | null;
}
export interface SetupCatalog {
  locations: { id: string; name: string; timeZone: string }[];
  services: { id: string; name: string; durationMinutes: number; priceCents: number }[];
}
export interface SetupPage extends SetupCatalog { submission: ProfessionalSubmission | null; editable: boolean; revision: number }
export interface SetupReviewQueue { items: { id: string; professionalName: string; submittedAt: string }[]; nextCursor: string | null }
