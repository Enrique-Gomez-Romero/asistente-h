'use client';

import { type SyntheticEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  LogOut,
  MessageCircle,
  Sparkles,
} from 'lucide-react';

import { createOrganization, type ActionResult } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

export function OrganizationOnboarding({
  displayName,
  canCreateOrganization,
}: {
  displayName: string;
  canCreateOrganization: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await createOrganization({
        name: text(form, 'name'),
        businessType: text(form, 'businessType'),
        phone: text(form, 'phone'),
        address: text(form, 'address'),
        timezone: text(form, 'timezone'),
      });
      setResult(response);
      if (response.ok && response.organizationId)
        router.push(
          `/app?organization=${encodeURIComponent(response.organizationId)}`,
        );
    });
  }

  return (
    <main className="min-h-screen bg-[#f4f8f6] px-4 py-10 text-foreground md:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <section>
          <div className="mb-8 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary text-white">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-heading text-xl font-bold">Asistente H</p>
              <p className="text-xs text-muted-foreground">
                Plataforma multiempresa
              </p>
            </div>
          </div>
          <p className="text-sm font-semibold text-primary">
            Hola, {displayName}
          </p>
          <h1 className="mt-2 font-heading text-4xl font-bold tracking-[-0.045em] md:text-5xl">
            {canCreateOrganization
              ? 'Configura tu primer negocio.'
              : 'Tu acceso está listo para una invitación.'}
          </h1>
          <p className="mt-4 max-w-lg leading-relaxed text-muted-foreground">
            {canCreateOrganization
              ? 'Crearemos una organización aislada con su propia agenda, equipo, catálogo, horarios, consumo e integraciones.'
              : 'Inicia sesión desde el enlace que te envió el administrador de tu negocio. Así podremos asignarte la organización y el rol correctos.'}
          </p>
          <div className="mt-7 space-y-3 text-sm">
            <Benefit
              icon={Building2}
              text="Datos separados para cada negocio o sucursal"
            />
            <Benefit
              icon={MessageCircle}
              text="WhatsApp e inteligencia artificial configurables por cuenta"
            />
            <Benefit
              icon={CheckCircle2}
              text="30 días de prueba y límites de consumo medibles"
            />
          </div>
        </section>
        {canCreateOrganization ? (
          <Card className="border-0 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
            <CardHeader>
              <CardTitle>Datos básicos</CardTitle>
              <CardDescription>
                Podrás modificarlos después desde Configuración.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="onboarding-name">
                      Nombre del negocio
                    </FieldLabel>
                    <Input
                      id="onboarding-name"
                      name="name"
                      placeholder="Clínica, consultorio o empresa"
                      required
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="onboarding-type">
                        Tipo de negocio
                      </FieldLabel>
                      <NativeSelect
                        id="onboarding-type"
                        name="businessType"
                        defaultValue="dental"
                        className="w-full"
                      >
                        <NativeSelectOption value="dental">
                          Consultorio dental
                        </NativeSelectOption>
                        <NativeSelectOption value="medical">
                          Consultorio médico
                        </NativeSelectOption>
                        <NativeSelectOption value="beauty">
                          Belleza y bienestar
                        </NativeSelectOption>
                        <NativeSelectOption value="professional">
                          Servicios profesionales
                        </NativeSelectOption>
                        <NativeSelectOption value="general">
                          Otro negocio
                        </NativeSelectOption>
                      </NativeSelect>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="onboarding-phone">
                        Teléfono
                      </FieldLabel>
                      <Input
                        id="onboarding-phone"
                        name="phone"
                        placeholder="+52 55…"
                      />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="onboarding-address">
                      Dirección
                    </FieldLabel>
                    <Input
                      id="onboarding-address"
                      name="address"
                      placeholder="Dirección de la sede principal"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="onboarding-timezone">
                      Zona horaria
                    </FieldLabel>
                    <NativeSelect
                      id="onboarding-timezone"
                      name="timezone"
                      defaultValue="America/Mexico_City"
                      className="w-full"
                    >
                      <NativeSelectOption value="America/Mexico_City">
                        Ciudad de México
                      </NativeSelectOption>
                      <NativeSelectOption value="America/Cancun">
                        Cancún
                      </NativeSelectOption>
                      <NativeSelectOption value="America/Monterrey">
                        Monterrey
                      </NativeSelectOption>
                      <NativeSelectOption value="America/Tijuana">
                        Tijuana
                      </NativeSelectOption>
                      <NativeSelectOption value="America/Bogota">
                        Bogotá
                      </NativeSelectOption>
                      <NativeSelectOption value="America/Lima">
                        Lima
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  {result ? (
                    <p
                      className={`rounded-xl border p-3 text-sm ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}
                    >
                      {result.message}
                    </p>
                  ) : null}
                  <Button type="submit" size="lg" disabled={pending}>
                    {pending ? 'Creando espacio…' : 'Crear mi negocio'}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-[0_24px_70px_rgb(26_52_45/12%)]">
            <CardHeader>
              <CardTitle>No tienes negocios asignados</CardTitle>
              <CardDescription>
                Pide al administrador que reenvíe tu invitación al correo con el
                que acabas de iniciar sesión.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">
                Por seguridad, una cuenta nueva no puede crear organizaciones ni
                ver información hasta aceptar una invitación válida.
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  window.location.assign('/signout-with-chatgpt?return_to=/')
                }
              >
                <LogOut data-icon="inline-start" /> Cambiar de cuenta
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}

function Benefit({
  icon: Icon,
  text: value,
}: {
  icon: typeof Building2;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-9 place-items-center rounded-xl bg-white text-primary shadow-sm">
        <Icon className="size-4" />
      </div>
      <span>{value}</span>
    </div>
  );
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}
