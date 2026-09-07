import { KeyRound, Sparkles } from 'lucide-react';

import { BootstrapAdminForm } from '@/components/auth-forms';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function SetupAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = '' } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f8f6] px-4 py-10">
      <Card className="w-full max-w-lg border-0 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
        <CardHeader>
          <div className="mb-4 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-white">
              <Sparkles className="size-5" />
            </div>
            <p className="font-heading text-xl font-bold">Asistente H</p>
          </div>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <KeyRound className="size-5 text-primary" /> Configurar acceso
          </CardTitle>
          <CardDescription>
            Crea la primera cuenta administradora. Este enlace funciona una sola
            vez.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BootstrapAdminForm setupToken={token} />
        </CardContent>
      </Card>
    </main>
  );
}
