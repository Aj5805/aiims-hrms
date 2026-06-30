import { Navigate } from 'react-router-dom';
import type { MasterTabId } from '../pages/MastersPage';

/** Redirect legacy /leave-types etc. routes into the unified Masters hub. */
export function MastersRedirect({ tab }: { tab: MasterTabId }) {
  return <Navigate to={`/masters?tab=${tab}`} replace />;
}
