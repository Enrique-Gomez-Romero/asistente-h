import { ArrowLeft, KeyRound } from 'lucide-react';
import Link from 'next/link';

import { PasswordResetRequestForm } from '@/components/auth-forms';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function RecoverPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f8f6] px-4 py-10">
      <Card className="w-full max-w-md border-0 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
        <CardHeader>
          <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-primary text-white">
            <KeyRound className="size-5" />
          </div>
          <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
          <CardDescription>
            Te enviaremos un enlace de recuperación si el correo tiene una
            cuenta activa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <PasswordResetRequestForm />
          <Link href="/login">
            <Button variant="ghost" className="w-full">
              <ArrowLeft data-icon="inline-start" /> Volver al inicio de sesión
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
