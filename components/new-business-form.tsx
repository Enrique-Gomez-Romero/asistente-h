'use client';

import { type SyntheticEvent, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Clipboard, Plus } from 'lucide-react';

import type { ActionResult } from '@/app/actions';
import { callAppAction } from '@/components/app-action-client';
import { Button, buttonVariants } from '@/components/ui/button';
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
import type { ActivePlan } from '@/lib/saas';

export function NewBusinessForm({ plans }: { plans: ActivePlan[] }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [copied, setCopied] = useState(false);

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCopied(false);
    startTransition(async () => {
      const response = await callAppAction<ActionResult>(
        'createOrganization',
        [
          {
            name: value(form, 'name'),
            businessType: value(form, 'businessType'),
            planId: value(form, 'planId'),
            ownerEmail: value(form, 'ownerEmail'),
            phone: value(form, 'phone'),
            address: value(form, 'address'),
            timezone: value(form, 'timezone'),
          },
        ],
        '/platform',
      );
      setResult(response);
    });
  }

  async function copyInvitation() {
    if (!result?.invitationPath) return;
    await navigator.clipboard.writeText(
      new URL(result.invitationPath, window.location.origin).toString(),
    );
    setCopied(true);
  }

  return (
    <main className="min-h-screen bg-[#f4f8f6] px-4 py-10 text-foreground">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/platform"
          className={buttonVariants({ variant: 'ghost', className: 'mb-5' })}
        >
          <ArrowLeft data-icon="inline-start" />
          Volver a administración
        </Link>
        <Card className="border-0 shadow-[0_20px_60px_rgb(26_52_45/10%)]">
          <CardHeader>
            <CardTitle className="text-2xl">Crear un negocio cliente</CardTitle>
            <CardDescription>
              Define su primera sucursal, plan y propietario. El resto de la
              información quedará aislada dentro de esta cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit}>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="business-name">
                      Nombre del negocio
                    </FieldLabel>
                    <Input id="business-name" name="name" required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="business-type">Tipo</FieldLabel>
                    <NativeSelect
                      id="business-type"
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
                        Otro
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="business-owner">
                      Correo del propietario
                    </FieldLabel>
                    <Input
                      id="business-owner"
                      name="ownerEmail"
                      type="email"
                      placeholder="propietario@negocio.com"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="business-plan">
                      Plan inicial
                    </FieldLabel>
                    <NativeSelect
                      id="business-plan"
                      name="planId"
                      defaultValue="plan_trial"
                      className="w-full"
                    >
                      {plans.map((plan) => (
                        <NativeSelectOption key={plan.id} value={plan.id}>
                          {plan.name} · {plan.maxLocations}{' '}
                          {plan.maxLocations === 1 ? 'sucursal' : 'sucursales'}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="business-phone">
                      Teléfono de la sede principal
                    </FieldLabel>
                    <Input id="business-phone" name="phone" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="business-timezone">
                      Zona horaria
                    </FieldLabel>
                    <NativeSelect
                      id="business-timezone"
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
                    </NativeSelect>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="business-address">
                    Dirección de la sede principal
                  </FieldLabel>
                  <Input id="business-address" name="address" />
                </Field>
                <Button type="submit" size="lg" disabled={pending}>
                  <Plus data-icon="inline-start" />
                  {pending ? 'Creando negocio…' : 'Crear negocio e invitación'}
                </Button>
              </FieldGroup>
            </form>
            {result ? (
              <div
                className={`mt-5 rounded-xl border p-4 text-sm ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}
              >
                <p>{result.message}</p>
                {result.invitationPath ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={copyInvitation}>
                      {copied ? (
                        <Check data-icon="inline-start" />
                      ) : (
                        <Clipboard data-icon="inline-start" />
                      )}
                      {copied ? 'Enlace copiado' : 'Copiar invitación'}
                    </Button>
                    {result.organizationId ? (
                      <Link
                        href={`/app?organization=${encodeURIComponent(result.organizationId)}`}
                        className={buttonVariants({
                          variant: 'outline',
                          size: 'sm',
                        })}
                      >
                        Abrir negocio
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function value(form: FormData, key: string) {
  const field = form.get(key);
  return typeof field === 'string' ? field : '';
}
