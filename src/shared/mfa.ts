export interface StaffMfaStatus { configured: boolean; enrolled: boolean; unlockedUntil: string | null }
export interface StaffMfaEnrollment { enrollmentId: string; setupKey: string; expiresAt: string }
