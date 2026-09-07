import {
  ArrowRight,
  Bot,
  CalendarCheck2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

import { getAuthenticatedUser, loginPath } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getAuthenticatedUser();
  const destination = user ? '/app' : loginPath('/app');
  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f8f6] text-[#173b34]">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-[14px] bg-[#1e806a] text-white">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold">Asistente H</p>
            <p className="text-[11px] text-[#62756f]">Recepción inteligente</p>
          </div>
        </div>
        <a href={destination} target="_top">
          <Button variant={user ? 'default' : 'outline'}>
            {user ? 'Abrir mi panel' : 'Iniciar sesión'}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </a>
      </header>
      <section className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-5 py-14 md:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative z-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#b8d9cf] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#176d59]">
            <span className="size-1.5 rounded-full bg-[#2e9b7f]" />
            Agenda, WhatsApp e IA en un solo lugar
          </div>
          <h1 className="max-w-3xl font-heading text-5xl font-bold tracking-[-0.055em] md:text-7xl">
            Tu recepción responde, agenda y da seguimiento.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#61716c]">
            Asistente H ayuda a negocios de servicios a atender clientes por
            WhatsApp, organizar citas y automatizar recordatorios sin perder el
            control humano.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={destination} target="_top">
              <Button size="lg">
                {user ? 'Entrar a la plataforma' : 'Comenzar'}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </a>
            <a href="#funciones">
              <Button size="lg" variant="outline">
                Conocer funciones
              </Button>
            </a>
          </div>
          <p className="mt-4 text-xs text-[#788984]">
            Cada negocio conserva sus propios usuarios, información, horarios e
            integraciones.
          </p>
        </div>
        <div className="relative">
          <div className="absolute -inset-20 rounded-full bg-[#8be1c8]/20 blur-3xl" />
          <div className="relative rounded-[30px] border border-white/80 bg-[#173b34] p-5 text-white shadow-[0_30px_90px_rgb(22_74_62/22%)] md:p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-sm font-semibold">Recepción activa</p>
                <p className="mt-1 text-xs text-white/50">
                  Consultorio Central · WhatsApp
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-[#2e9b7f]/25 px-3 py-1.5 text-xs text-[#8be1c8]">
                <span className="size-2 rounded-full bg-[#69d6b5]" />
                En línea
              </div>
            </div>
            <div className="space-y-3 py-6">
              <div className="mr-12 rounded-2xl rounded-bl-md bg-white/10 p-4 text-sm text-white/75">
                Hola, ¿tienen disponibilidad mañana por la tarde?
              </div>
              <div className="ml-10 rounded-2xl rounded-br-md bg-[#e9faf5] p-4 text-sm text-[#173b34]">
                Sí. Encontré horarios a las 4:00, 5:30 y 6:00. ¿Cuál prefieres?
              </div>
              <div className="mr-20 rounded-2xl rounded-bl-md bg-white/10 p-4 text-sm text-white/75">
                A las 5:30, por favor.
              </div>
              <div className="ml-10 rounded-2xl rounded-br-md bg-[#e9faf5] p-4 text-sm text-[#173b34]">
                Listo. Tu cita quedó registrada y recibirás un recordatorio
                automático.
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-5">
              <MiniStat value="24/7" label="Atención" />
              <MiniStat value="< 10 s" label="Respuesta" />
              <MiniStat value="1 panel" label="Todo unido" />
            </div>
          </div>
        </div>
      </section>
      <section
        id="funciones"
        className="border-t border-[#dce8e3] bg-white py-20"
      >
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold text-[#1e806a]">
              Hecho para operar
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-[-0.04em] md:text-4xl">
              Una plataforma para atender y crecer.
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Feature
              icon={MessageCircle}
              title="Conversaciones"
              description="La IA responde con la información autorizada y tu equipo puede tomar el control."
            />
            <Feature
              icon={CalendarCheck2}
              title="Agenda y seguimiento"
              description="Citas, recordatorios, confirmaciones, reprogramación y lista de espera."
            />
            <Feature
              icon={ShieldCheck}
              title="Seguro por organización"
              description="Usuarios, roles, consumo e información aislada para cada negocio."
            />
          </div>
        </div>
      </section>
      <footer className="border-t border-[#dce8e3] bg-white px-5 py-7 text-sm text-[#62756f]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <p>© 2026 Asistente H</p>
          <div className="flex gap-5">
            <Link className="hover:text-[#1e806a]" href="/privacidad">
              Privacidad
            </Link>
            <Link className="hover:text-[#1e806a]" href="/terminos">
              Términos
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dce8e3] bg-[#f8fbfa] p-6">
      <div className="grid size-11 place-items-center rounded-xl bg-[#e1f5ef] text-[#1e806a]">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-5 font-heading text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#62756f]">
        {description}
      </p>
    </div>
  );
}
function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <p className="font-heading text-lg font-bold text-[#8be1c8]">{value}</p>
      <p className="text-[10px] text-white/45">{label}</p>
    </div>
  );
}
