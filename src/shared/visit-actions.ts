export type VisitAction = 'checked_in' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
export const visitActionLabels: Record<VisitAction, string> = {
  checked_in: 'Check in', in_service: 'Start service', completed: 'Complete visit', cancelled: 'Cancel visit', no_show: 'Mark no-show',
};
export interface VisitActionState {
  status: string; startsAt: string | null; endsAt: string | null;
  cancellationPending: boolean; changePending: boolean;
}
export function availableVisitActions(visit: VisitActionState, now = Date.now()): VisitAction[] {
  if (visit.changePending) return [];
  if (visit.cancellationPending) return visit.status === 'confirmed' ? ['cancelled'] : [];
  const start = Date.parse(visit.startsAt ?? ''); const end = Date.parse(visit.endsAt ?? '');
  const valid = Number.isFinite(start) && Number.isFinite(end) && end > start;
  if (visit.status === 'confirmed') return [...(valid && now < end ? ['checked_in' as const] : []), 'cancelled', ...(valid && now >= start ? ['no_show' as const] : [])];
  if (visit.status === 'checked_in') return [...(valid && now >= start && now < end ? ['in_service' as const] : []), 'cancelled'];
  return visit.status === 'in_service' ? ['completed'] : [];
}
