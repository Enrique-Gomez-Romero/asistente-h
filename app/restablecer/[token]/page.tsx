import { KeyRound } from 'lucide-react';

import { PasswordResetForm } from '@/components/auth-forms';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f8f6] px-4 py-10">
      <Card className="w-full max-w-md border-0 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
        <CardHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary text-white">
            <KeyRound className="size-5" />
          </div>
          <CardTitle className="text-2xl">Nueva contraseña</CardTitle>
          <CardDescription>
            Al guardarla se cerrarán las demás sesiones de tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordResetForm token={token} />
        </CardContent>
      </Card>
    </main>
  );
}
