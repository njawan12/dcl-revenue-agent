import { redirect } from 'next/navigation';

/**
 * Opportunity intelligence is workspace-backed at /accounts/[id].
 * Keep this legacy route as a compatibility bridge so old bookmarks never
 * fall back to mock or invented prospect data.
 */
export default async function Opportunity({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/accounts/${encodeURIComponent(id)}`);
}
