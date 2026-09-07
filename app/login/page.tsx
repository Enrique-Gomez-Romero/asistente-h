import { LockKeyhole, Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth-forms';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthenticatedUser, safeRelativePath } from '@/lib/auth';
import { getSaasContext } from '@/lib/saas';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getAuthenticatedUser();
  if (user) {
    const context = await getSaasContext(user);
    redirect(context.isPlatformAdmin ? '/platform' : '/app');
  }
  const { next } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f8f6] px-4 py-10">
      <Card className="w-full max-w-md border-0 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary text-white">
            <Sparkles className="size-5" />
          </div>
          <CardTitle className="text-2xl">Entrar a Asistente H</CardTitle>
          <CardDescription>
            Usa el correo y la contraseña asignados a tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <LoginForm next={safeRelativePath(next ?? '/app')} />
          <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            Después de verificar tu cuenta, el sistema muestra únicamente las
            funciones permitidas para tu rol.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
