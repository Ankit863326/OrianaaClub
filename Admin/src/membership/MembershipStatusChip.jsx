import { Badge } from '../components/ui.jsx';

export default function MembershipStatusChip({ status }) {
  const label = String(status || 'unknown').replaceAll('_', ' ');
  return <Badge tone={label}>{label}</Badge>;
}
