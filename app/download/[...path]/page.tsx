import { redirect } from 'next/navigation';

// The download page now lives at /d/{path} (shorter, and matches the raw
// file endpoint's old slot — see app/dl/[...path]/route.ts). This route only
// exists so links shared before the move keep working.
export default async function LegacyDownloadRedirect({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  redirect(`/d/${path.join('/')}`);
}
