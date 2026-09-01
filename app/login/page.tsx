import { ArrowRight, LockKeyhole, Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';

import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getSaasContext } from '@/lib/saas';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getChatGPTUser();
  if (user) {
    const context = await getSaasContext(user);
    redirect(context.isPlatformAdmin ? '/platform' : '/app');
  }
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f8f6] px-4">
      <Card className="w-full max-w-md border-0 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-primary text-white">
            <Sparkles className="size-5" />
          </div>
          <CardTitle className="text-2xl">Entrar a Asistente H</CardTitle>
          <CardDescription>
            El mismo acceso te dirige al portal que corresponda según tu
            organización y permisos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <a href={chatGPTSignInPath('/app')} target="_top" className="block">
            <Button size="lg" className="w-full">
              Continuar con ChatGPT
              <ArrowRight data-icon="inline-end" />
            </Button>
          </a>
          <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" />
            Tu identidad se verifica de forma segura. Asistente H aplica después
            la organización y el rol asignados por el administrador.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
