'use client';

import { type SyntheticEvent, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Building2,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import type { CommercialActionResult } from '@/app/commercial-actions';
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
import type { PlatformAdminData } from '@/lib/saas';

export function PlatformAdmin({ data }: { data: PlatformAdminData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<CommercialActionResult | null>(null);
  const [query, setQuery] = useState('');
  const organizations = data.organizations.filter((organization) =>
    `${organization.name} ${organization.businessType} ${organization.planName}`
      .toLocaleLowerCase('es-MX')
      .includes(query.toLocaleLowerCase('es-MX')),
  );

  function run(operation: () => Promise<CommercialActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const result = await operation();
      setNotice(result);
      if (result.ok) router.refresh();
    });
  }

  function paymentSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(() =>
      runPlatformAdminAction('record-payment', {
        clinicId: value(form, 'clinicId'),
        amountPesos: Number(value(form, 'amountPesos')),
        periodStart: value(form, 'periodStart'),
        periodEnd: value(form, 'periodEnd'),
        receivedAt: value(form, 'receivedAt'),
        status: value(form, 'status') as
          | 'pending'
          | 'paid'
          | 'overdue'
          | 'suspended',
        reference: value(form, 'reference'),
        invoiceFolio: value(form, 'invoiceFolio'),
        invoiceUrl: value(form, 'invoiceUrl'),
        receiptUrl: value(form, 'receiptUrl'),
        notes: value(form, 'notes'),
      }),
    );
  }

  const [dateDefaults] = useState(() => {
    const current = new Date();
    const periodEnd = new Date(current.getTime() + 30 * 24 * 60 * 60_000);
    return {
      today: current.toISOString().slice(0, 10),
      nextMonth: periodEnd.toISOString().slice(0, 10),
    };
  });
  return (
    <main className="min-h-screen bg-[#f4f8f6] text-foreground">
      <header className="border-b bg-[#173b34] text-white">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center gap-4 px-5 md:px-8">
          <div className="grid size-10 place-items-center rounded-[14px] bg-[#2e9b7f]">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold">Asistente H</p>
            <p className="text-[11px] text-white/50">
              Administración de plataforma
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/platform/negocios/nuevo"
              className={buttonVariants({ variant: 'secondary' })}
            >
              <Plus data-icon="inline-start" />
              Nuevo negocio
            </Link>
            <Link href="/app" prefetch={false}>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                Ver panel cliente
              </Button>
            </Link>
            <form action="/logout" method="post">
              <Button
                type="submit"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1500px] px-5 py-8 md:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">Control central</p>
          <h1 className="mt-1 font-heading text-4xl font-bold tracking-[-0.045em]">
            Suscripciones y clientes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestiona planes, vigencias, transferencias, facturación manual y
            estado de cada organización.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/platform/negocios/nuevo" className={buttonVariants()}>
              <Plus data-icon="inline-start" />
              Crear negocio cliente
            </Link>
            <Link
              href="/planes"
              className={buttonVariants({ variant: 'outline' })}
            >
              Ver página de planes
            </Link>
          </div>
        </div>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={Building2}
            value={data.stats.organizations}
            label="Organizaciones"
          />
          <Metric icon={Users} value={data.stats.users} label="Usuarios" />
          <Metric
            icon={CheckCircle2}
            value={data.stats.activeSubscriptions}
            label="Suscripciones vigentes"
          />
          <Metric
            icon={Activity}
            value={data.stats.aiRequests}
            label="Solicitudes de IA"
          />
        </div>
        {notice ? (
          <div
            className={`mb-5 rounded-xl border p-3 text-sm ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}
          >
            {notice.message}
          </div>
        ) : null}
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.5fr)_440px]">
          <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
            <CardHeader>
              <CardTitle>Negocios administrados</CardTitle>
              <CardDescription>
                Los cambios quedan registrados en la bitácora de suscripción.
              </CardDescription>
              <div className="relative mt-3 max-w-sm">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  aria-label="Buscar organizaciones"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar negocio o plan"
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {organizations.map((organization) => (
                <OrganizationCard
                  key={organization.id}
                  organization={organization}
                  plans={data.plans}
                  pending={pending}
                  run={run}
                />
              ))}
              {organizations.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No encontramos negocios con esa búsqueda.
                </div>
              ) : null}
            </CardContent>
          </Card>
          <div className="space-y-5">
            <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
              <CardHeader>
                <CardTitle>Registrar transferencia</CardTitle>
                <CardDescription>
                  Activa la suscripción y conserva referencia y factura.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={paymentSubmit}>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="payment-clinic">Cliente</FieldLabel>
                      <NativeSelect
                        id="payment-clinic"
                        name="clinicId"
                        className="w-full"
                        required
                      >
                        {data.organizations.map((organization) => (
                          <NativeSelectOption
                            key={organization.id}
                            value={organization.id}
                          >
                            {organization.name}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="payment-status">Estado</FieldLabel>
                        <NativeSelect
                          id="payment-status"
                          name="status"
                          defaultValue="paid"
                        >
                          <NativeSelectOption value="pending">
                            Pendiente
                          </NativeSelectOption>
                          <NativeSelectOption value="paid">
                            Pagado
                          </NativeSelectOption>
                          <NativeSelectOption value="overdue">
                            Vencido
                          </NativeSelectOption>
                          <NativeSelectOption value="suspended">
                            Suspendido
                          </NativeSelectOption>
                        </NativeSelect>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="payment-amount">
                          Monto MXN
                        </FieldLabel>
                        <Input
                          id="payment-amount"
                          name="amountPesos"
                          type="number"
                          min="1"
                          step="0.01"
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="payment-received">
                          Fecha de registro
                        </FieldLabel>
                        <Input
                          id="payment-received"
                          name="receivedAt"
                          type="date"
                          defaultValue={dateDefaults.today}
                          required
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="payment-receipt-url">
                        Enlace del comprobante (opcional)
                      </FieldLabel>
                      <Input
                        id="payment-receipt-url"
                        name="receiptUrl"
                        type="url"
                        placeholder="https://..."
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="payment-start">
                          Inicio del periodo
                        </FieldLabel>
                        <Input
                          id="payment-start"
                          name="periodStart"
                          type="date"
                          defaultValue={dateDefaults.today}
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="payment-end">
                          Fin del periodo
                        </FieldLabel>
                        <Input
                          id="payment-end"
                          name="periodEnd"
                          type="date"
                          defaultValue={dateDefaults.nextMonth}
                          required
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="payment-reference">
                        Referencia bancaria
                      </FieldLabel>
                      <Input id="payment-reference" name="reference" />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="payment-invoice">
                          Folio de factura
                        </FieldLabel>
                        <Input id="payment-invoice" name="invoiceFolio" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="payment-invoice-url">
                          Enlace de factura
                        </FieldLabel>
                        <Input
                          id="payment-invoice-url"
                          name="invoiceUrl"
                          type="url"
                        />
                      </Field>
                    </div>
                    <Field>
                      <FieldLabel htmlFor="payment-notes">Notas</FieldLabel>
                      <Input id="payment-notes" name="notes" />
                    </Field>
                    <Button type="submit" disabled={pending}>
                      <CreditCard data-icon="inline-start" />
                      Registrar pago
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
              <CardHeader>
                <CardTitle>Infraestructura comercial</CardTitle>
                <CardDescription>
                  Estado de las conexiones necesarias para incorporar clientes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfrastructureRow
                  label="Gemini central"
                  ready={data.infrastructure.gemini}
                />
                <InfrastructureRow
                  label="Correo de invitaciones"
                  ready={data.infrastructure.invitationEmail}
                />
                <InfrastructureRow
                  label="Meta Embedded Signup"
                  ready={data.infrastructure.metaEmbeddedSignup}
                />
                <InfrastructureRow
                  label="Google Secret Manager"
                  ready={data.infrastructure.googleSecretManager}
                />
                <InfrastructureRow
                  label="Ejecución de automatizaciones"
                  ready={data.infrastructure.automationRunner}
                />
              </CardContent>
            </Card>
            <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
              <CardHeader>
                <CardTitle>Pagos recientes</CardTitle>
                <CardDescription>
                  Transferencias capturadas manualmente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-start gap-3 rounded-xl border p-3"
                  >
                    <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <CreditCard className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {payment.clinicName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {money(payment.amountCents, payment.currency)} ·{' '}
                        {formatDate(payment.receivedAt)}
                      </p>
                      <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
                        {paymentStatusLabel(payment.status)}
                      </span>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {payment.invoiceFolio
                          ? `Factura ${payment.invoiceFolio}`
                          : 'Factura pendiente'}
                        {payment.reference
                          ? ` · Ref. ${payment.reference}`
                          : ''}
                      </p>
                      {payment.receiptUrl ? (
                        <a
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex text-xs font-medium text-primary"
                        >
                          Ver comprobante
                        </a>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(
                          ['pending', 'paid', 'overdue', 'suspended'] as const
                        ).map((status) => (
                          <Button
                            key={status}
                            type="button"
                            size="sm"
                            variant={
                              payment.status === status ? 'secondary' : 'ghost'
                            }
                            disabled={pending || payment.status === status}
                            onClick={() =>
                              run(() =>
                                runPlatformAdminAction(
                                  'update-payment-status',
                                  {
                                    paymentId: payment.id,
                                    status,
                                  },
                                ),
                              )
                            }
                          >
                            {paymentStatusLabel(status)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {!data.recentPayments.length ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay transferencias registradas.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfrastructureRow({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <ShieldCheck
          className={`size-4 ${ready ? 'text-emerald-600' : 'text-amber-600'}`}
        />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span
        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
      >
        {ready ? 'Listo' : 'Configurar'}
      </span>
    </div>
  );
}

function OrganizationCard({
  organization,
  plans,
  pending,
  run,
}: {
  organization: PlatformAdminData['organizations'][number];
  plans: PlatformAdminData['plans'];
  pending: boolean;
  run: (operation: () => Promise<CommercialActionResult>) => void;
}) {
  const [name, setName] = useState(organization.name);
  const [phone, setPhone] = useState(organization.phone ?? '');
  const [address, setAddress] = useState(organization.address ?? '');
  const [timezone, setTimezone] = useState(organization.timezone);
  const [planId, setPlanId] = useState(organization.planId);
  const [status, setStatus] = useState(
    organization.subscriptionStatus as
      | 'trialing'
      | 'active'
      | 'past_due'
      | 'canceled',
  );
  const [periodEnd, setPeriodEnd] = useState(
    organization.periodEnd
      ? organization.periodEnd.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  return (
    <section className="rounded-2xl border bg-background p-4 shadow-[0_8px_24px_rgb(26_52_45/5%)] sm:p-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{organization.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {organization.businessType} ·{' '}
            {organization.whatsappStatus === 'connected'
              ? 'WhatsApp listo'
              : 'WhatsApp pendiente'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${organization.accountStatus === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}
          >
            <ShieldCheck className="size-3" />
            {organization.accountStatus === 'suspended'
              ? 'Suspendida'
              : 'Activa'}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() =>
                runPlatformAdminAction('set-organization-status', {
                  clinicId: organization.id,
                  status:
                    organization.accountStatus === 'suspended'
                      ? 'active'
                      : 'suspended',
                  reason:
                    organization.accountStatus === 'suspended'
                      ? undefined
                      : 'Control administrativo o pago pendiente',
                }),
              )
            }
          >
            {organization.accountStatus === 'suspended'
              ? 'Reactivar'
              : 'Suspender'}
          </Button>
          <a
            href={`/app?organization=${encodeURIComponent(organization.id)}`}
            className={buttonVariants({ size: 'sm' })}
          >
            Abrir operación <ExternalLink data-icon="inline-end" />
          </a>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(150px,0.5fr)_minmax(300px,1fr)]">
        <div className="min-w-0">
          <p className="mb-3 text-sm font-semibold">Datos del negocio</p>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(() =>
                runPlatformAdminAction('update-organization-profile', {
                  clinicId: organization.id,
                  name,
                  phone,
                  address,
                  timezone,
                }),
              );
            }}
          >
            <Input
              aria-label={`Nombre de ${organization.name}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-8 text-xs"
            />
            <Input
              aria-label={`Teléfono de ${organization.name}`}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Teléfono"
              className="h-8 text-xs"
            />
            <Input
              aria-label={`Dirección de ${organization.name}`}
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Dirección"
              className="h-8 text-xs"
            />
            <NativeSelect
              aria-label={`Zona horaria de ${organization.name}`}
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="h-8 w-full text-xs"
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
              <NativeSelectOption value="America/Lima">Lima</NativeSelectOption>
            </NativeSelect>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={pending}
            >
              Guardar datos
            </Button>
          </form>
        </div>

        <div className="min-w-0">
          <p className="mb-3 text-sm font-semibold">Uso del periodo</p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="rounded-lg bg-muted/50 px-3 py-2">
              <MessageCircle className="mr-1 inline size-3" />
              {organization.conversations} conversaciones
            </p>
            <p className="rounded-lg bg-muted/50 px-3 py-2">
              <Activity className="mr-1 inline size-3" />
              {organization.aiRequests} solicitudes IA
            </p>
            <p className="rounded-lg bg-muted/50 px-3 py-2">
              <Users className="mr-1 inline size-3" />
              {organization.users} usuarios
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-3 text-sm font-semibold">Plan y vigencia</p>
          <div className="space-y-2">
            <NativeSelect
              aria-label={`Plan de ${organization.name}`}
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className="w-full"
            >
              {plans.map((plan) => (
                <NativeSelectOption key={plan.id} value={plan.id}>
                  {plan.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <div className="grid grid-cols-2 gap-2">
              <NativeSelect
                aria-label={`Estado de suscripción de ${organization.name}`}
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as typeof status)
                }
              >
                <NativeSelectOption value="trialing">Prueba</NativeSelectOption>
                <NativeSelectOption value="active">Activa</NativeSelectOption>
                <NativeSelectOption value="past_due">
                  Pago pendiente
                </NativeSelectOption>
                <NativeSelectOption value="canceled">
                  Cancelada
                </NativeSelectOption>
              </NativeSelect>
              <Input
                aria-label={`Vigencia de ${organization.name}`}
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    runPlatformAdminAction('update-subscription', {
                      clinicId: organization.id,
                      planId,
                      status,
                      periodEnd,
                    }),
                  )
                }
              >
                <CalendarClock data-icon="inline-start" />
                Guardar
              </Button>
              <Button
                size="sm"
                disabled={pending}
                onClick={() => {
                  setStatus('active');
                  run(() =>
                    runPlatformAdminAction('update-subscription', {
                      clinicId: organization.id,
                      planId,
                      status: 'active',
                      periodEnd,
                    }),
                  );
                }}
              >
                Activar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  const renewal = renewalDate(periodEnd);
                  setStatus('active');
                  setPeriodEnd(renewal);
                  run(() =>
                    runPlatformAdminAction('update-subscription', {
                      clinicId: organization.id,
                      planId,
                      status: 'active',
                      periodEnd: renewal,
                    }),
                  );
                }}
              >
                Renovar 30 días
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  value: metricValue,
  label,
}: {
  icon: typeof Building2;
  value: number;
  label: string;
}) {
  return (
    <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div>
            <p className="font-heading text-2xl font-bold">
              {metricValue.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function paymentStatusLabel(status: string) {
  return (
    {
      pending: 'Pendiente',
      paid: 'Pagado',
      overdue: 'Vencido',
      suspended: 'Suspendido',
    }[status] ?? status
  );
}

function renewalDate(currentPeriodEnd: string) {
  const today = new Date();
  const current = new Date(`${currentPeriodEnd}T12:00:00.000Z`);
  const base =
    Number.isNaN(current.getTime()) || current < today ? today : current;
  base.setUTCDate(base.getUTCDate() + 30);
  return base.toISOString().slice(0, 10);
}
function value(form: FormData, key: string) {
  const result = form.get(key);
  return typeof result === 'string' ? result : '';
}
function money(cents: number, currency: string) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(
    new Date(date),
  );
}

async function runPlatformAdminAction(
  action:
    | 'update-subscription'
    | 'set-organization-status'
    | 'update-organization-profile'
    | 'record-payment'
    | 'update-payment-status',
  input: Record<string, unknown>,
): Promise<CommercialActionResult> {
  try {
    const response = await fetch('/api/platform/actions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, input }),
    });
    const result = (await response.json()) as CommercialActionResult;
    if (response.status === 401) {
      window.location.assign('/login?next=%2Fplatform');
      return {
        ok: false,
        message: 'Tu sesión expiró. Inicia sesión otra vez.',
      };
    }
    return result;
  } catch {
    return {
      ok: false,
      message: 'No fue posible guardar el cambio. Intenta de nuevo.',
    };
  }
}
