import { AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { Button } from '@/components/ui/button';
import { acceptInvitationToken } from '@/lib/invitations';

export const dynamic = 'force-dynamic';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const returnTo = `/invite/${encodeURIComponent(token)}`;
  const user = await requireChatGPTUser(returnTo);
  const result = await acceptInvitationToken(token, user);
  if (result.ok)
    redirect(
      `/app?organization=${encodeURIComponent(result.organizationId)}&joined=1`,
    );

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f8f6] px-4 text-[#173b34]">
      <section className="w-full max-w-lg rounded-[24px] bg-white p-8 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
        <div className="mb-7 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-[#1e806a] text-white">
            <Sparkles className="size-5" />
          </div>
          <p className="font-heading text-xl font-bold">Asistente H</p>
        </div>
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600">
          <AlertCircle className="size-6" />
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-[-0.04em]">
          No pudimos aceptar la invitación
        </h1>
        <p className="mt-3 leading-relaxed text-[#61716c]">{result.message}</p>
        <Link href="/" className="mt-7 inline-block">
          <Button>
            Volver al inicio <ArrowRight data-icon="inline-end" />
          </Button>
        </Link>
      </section>
    </main>
  );
}
