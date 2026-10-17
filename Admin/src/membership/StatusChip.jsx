import { Badge } from '../components/ui.jsx';

export default function StatusChip({ active }) {
  return <Badge>{active ? 'Active' : 'Inactive'}</Badge>;
}
