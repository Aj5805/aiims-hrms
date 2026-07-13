import { Navigate } from 'react-router-dom';
import type { MasterTabId } from '../pages/MastersPage';

/** Redirect legacy /leave-types etc. routes into the unified Masters hub. */
export function MastersRedirect({ tab, category }: { tab: MasterTabId; category?: string }) {
  const params = new URLSearchParams({ tab });
  if (category) params.set('category', category);
  return <Navigate to={`/masters?${params.toString()}`} replace />;
}
