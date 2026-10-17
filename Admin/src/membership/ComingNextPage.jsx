import { PageHeading, Panel } from '../components/ui.jsx';
import SettingsPage from './SettingsPage.jsx';
import MembershipMembersPage from './MembershipMembersPage.jsx';
import MembershipBillsPage from './MembershipBillsPage.jsx';
import MembershipPendingQueuePage from './MembershipPendingQueuePage.jsx';
import MembershipReportsPage from './MembershipReportsPage.jsx';
import MembershipAuditLogPage from './MembershipAuditLogPage.jsx';

export default function ComingNextPage({ title }) {
  if (title === 'Settings') return <SettingsPage />;
  if (title === 'Members') return <MembershipMembersPage />;
  if (title === 'Bills') return <MembershipBillsPage />;
  if (title === 'Pending Queue') return <MembershipPendingQueuePage />;
  if (title === 'Reports') return <MembershipReportsPage />;
  if (title === 'Audit Log') return <MembershipAuditLogPage />;

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title={title} />
    <Panel>Coming next</Panel>
  </section>;
}
