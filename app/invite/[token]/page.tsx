import { AlertCircle, ArrowRight, Sparkles, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { InvitationRegistrationForm } from '@/components/auth-forms';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthenticatedUser, loginPath } from '@/lib/auth';
import {
  acceptInvitationToken,
  getInvitationDetails,
} from '@/lib/invitations';
import type { MembershipRole } from '@/lib/saas';

export const dynamic = 'force-dynamic';

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const returnTo = `/invite/${encodeURIComponent(token)}`;
  const user = await getAuthenticatedUser();
  if (user) {
    const result = await acceptInvitationToken(token, user);
    if (result.ok)
      redirect(
        `/app?organization=${encodeURIComponent(result.organizationId)}&joined=1`,
      );
    return <InvitationError message={result.message} />;
  }

  const invitation = await getInvitationDetails(token);
  if (!invitation.ok) return <InvitationError message={invitation.message} />;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f8f6] px-4 py-10 text-[#173b34]">
      <Card className="w-full max-w-lg border-0 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
        <CardHeader>
          <div className="mb-4 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-white">
              <Sparkles className="size-5" />
            </div>
            <p className="font-heading text-xl font-bold">Asistente H</p>
          </div>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UserPlus className="size-5 text-primary" /> Invitación a{' '}
            {invitation.organizationName}
          </CardTitle>
          <CardDescription>
            Te asignaron el rol {roleLabel(invitation.role)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitation.hasCredential ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Ya tienes una cuenta con {invitation.email}. Inicia sesión para
                aceptar esta invitación.
              </p>
              <Link href={loginPath(returnTo)}>
                <Button size="lg" className="w-full">
                  Iniciar sesión <ArrowRight data-icon="inline-end" />
                </Button>
              </Link>
            </div>
          ) : (
            <InvitationRegistrationForm
              token={token}
              email={invitation.email}
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function InvitationError({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f8f6] px-4 text-[#173b34]">
      <section className="w-full max-w-lg rounded-[24px] bg-white p-8 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600">
          <AlertCircle className="size-6" />
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-[-0.04em]">
          No pudimos aceptar la invitación
        </h1>
        <p className="mt-3 leading-relaxed text-[#61716c]">{message}</p>
        <Link href="/" className="mt-7 inline-block">
          <Button>
            Volver al inicio <ArrowRight data-icon="inline-end" />
          </Button>
        </Link>
      </section>
    </main>
  );
}

function roleLabel(role: MembershipRole) {
  return {
    owner: 'Propietario',
    admin: 'Administrador',
    staff: 'Personal',
    viewer: 'Solo lectura',
  }[role];
}
