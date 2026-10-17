// Phase 2: Keep the former family step URL pointed at the integrated application.
import { Navigate } from 'react-router-dom';

export default function StepTwo() {
  return <Navigate to="/luxury-membership?step=3" replace />;
}
