import { redirect } from 'next/navigation';
import { getBootstrapEligibility } from '../../lib/workspaces/bootstrap';
import { listUserWorkspaces } from '../../lib/workspaces/session';
import { claimBootstrapWorkspace } from './actions';

export const dynamic = 'force-dynamic';

export default async function BootstrapPage() {
  const existing = await listUserWorkspaces();
  if (existing.length) redirect('/');

  const eligibility = await getBootstrapEligibility();
  if (!eligibility.enabled) redirect('/onboarding');

  return <main style={{maxWidth:620,margin:'80px auto',padding:'0 24px'}}>
    <div className="eyebrow">Existing workspace</div>
    <h1>Claim your pre-provisioned workspace</h1>
    {eligibility.eligible ? <>
      <p>Your authenticated account matches the server-side bootstrap owner configuration. This is a one-time operation.</p>
      <div className="panel" style={{marginTop:24}}>
        <strong>Security rule</strong>
        <p>The claim will be rejected if this workspace already has any member.</p>
        <form action={claimBootstrapWorkspace}><button className="primary" type="submit">Claim workspace as owner</button></form>
      </div>
    </> : <div className="panel" style={{marginTop:24}}><strong>This account is not authorized to claim the seeded workspace.</strong><p>You can create a new workspace instead.</p><a className="primary" href="/onboarding">Create workspace</a></div>}
  </main>;
}
