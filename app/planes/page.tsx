import Link from 'next/link';
import { ArrowRight, Building2, Check, Sparkles, Users } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthenticatedUser, loginPath } from '@/lib/auth';
import { getActivePlans } from '@/lib/saas';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  const [plans, user] = await Promise.all([
    getActivePlans(),
    getAuthenticatedUser(),
  ]);
  const visiblePlans = plans.filter((plan) => plan.slug !== 'trial');
  return (
    <main className="min-h-screen bg-[#f4f8f6] text-[#173b34]">
      <header className="border-b border-[#dce8e3] bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-3 px-5 md:px-8">
          <div className="grid size-10 place-items-center rounded-[14px] bg-[#1e806a] text-white">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold">Asistente H</p>
            <p className="text-xs text-[#62756f]">Planes para cada etapa</p>
          </div>
          <Link
            href={user ? '/app' : loginPath('/app')}
            className={buttonVariants({ className: 'ml-auto' })}
          >
            {user ? 'Abrir mi panel' : 'Iniciar sesión'}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-5 py-14 md:px-8 md:py-20">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <p className="text-sm font-semibold text-[#1e806a]">Precios en MXN</p>
          <h1 className="mt-2 font-heading text-4xl font-bold tracking-[-0.05em] md:text-6xl">
            Un plan para cada número de sucursales.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#62756f]">
            Todos los planes separan la información de cada negocio e incluyen
            agenda, pacientes, equipo y automatizaciones.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {visiblePlans.map((plan) => (
            <Card
              key={plan.id}
              className={`border-0 shadow-[0_16px_50px_rgb(26_52_45/8%)] ${plan.slug === 'professional' ? 'ring-2 ring-[#2e9b7f]' : ''}`}
            >
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <span className="font-heading text-4xl font-bold">
                    {money(plan.priceCents)}
                  </span>
                  <span className="text-sm text-muted-foreground"> / mes</span>
                </div>
                <div className="space-y-3 text-sm">
                  <Feature
                    icon={Building2}
                    text={`${plan.maxLocations} ${plan.maxLocations === 1 ? 'sucursal' : 'sucursales'}`}
                  />
                  <Feature icon={Users} text={`${plan.maxUsers} usuarios`} />
                  <Feature
                    icon={Check}
                    text={`${plan.maxConversations.toLocaleString('es-MX')} conversaciones al mes`}
                  />
                  <Feature
                    icon={Check}
                    text={`${plan.maxAiRequests.toLocaleString('es-MX')} solicitudes de IA`}
                  />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  WhatsApp y Google se conectan con las cuentas propias de cada
                  negocio. Los cargos externos de Meta no están incluidos.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="mt-8 border-0 bg-[#173b34] text-white">
          <CardContent className="flex flex-col items-start justify-between gap-5 py-7 md:flex-row md:items-center">
            <div>
              <p className="font-heading text-2xl font-bold">
                Prueba durante 14 días
              </p>
              <p className="mt-1 text-sm text-white/65">
                Incluye una sucursal, tres usuarios y 300 conversaciones.
              </p>
            </div>
            <Button variant="secondary" disabled>
              Activación mediante administrador
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Check; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-8 place-items-center rounded-lg bg-[#e1f5ef] text-[#1e806a]">
        <Icon className="size-4" />
      </div>
      <span>{text}</span>
    </div>
  );
}

function money(cents: number | null) {
  if (cents === null) return 'Cotización';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
