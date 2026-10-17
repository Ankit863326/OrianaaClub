// Phase 2: Keep the former review step URL pointed at the integrated application.
import { Navigate } from 'react-router-dom';

export default function LuxuryMembershipStepThree() {
  return <Navigate to="/luxury-membership?step=4" replace />;
}
