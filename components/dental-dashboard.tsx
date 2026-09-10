'use client';

import { type SyntheticEvent, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  LogOut,
  MessageCircle,
  Megaphone,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  UserPlus,
  Users,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';

import {
  anonymizePatient as serverAnonymizePatient,
  createAppointment as serverCreateAppointment,
  createFaq as serverCreateFaq,
  createLocation as serverCreateLocation,
  createProfessional as serverCreateProfessional,
  createService as serverCreateService,
  disconnectGoogleCalendar as serverDisconnectGoogleCalendar,
  inviteMember as serverInviteMember,
  markConversationRead as serverMarkConversationRead,
  resendInvitation as serverResendInvitation,
  revokeInvitation as serverRevokeInvitation,
  sendConversationMessage as serverSendConversationMessage,
  setAppointmentStatus as serverSetAppointmentStatus,
  toggleBotPaused as serverToggleBotPaused,
  toggleService as serverToggleService,
  updateBusinessHours as serverUpdateBusinessHours,
  updateLocation as serverUpdateLocation,
  updateMemberLocations as serverUpdateMemberLocations,
  updateOrganizationProfile as serverUpdateOrganizationProfile,
  updatePatientConsent as serverUpdatePatientConsent,
  type ActionResult,
} from '@/app/actions';
import {
  addWaitlistEntry as serverAddWaitlistEntry,
  createReactivationCampaign as serverCreateReactivationCampaign,
  requestAppointmentDeposit as serverRequestAppointmentDeposit,
  runAutomationsNow as serverRunAutomationsNow,
  setWaitlistStatus as serverSetWaitlistStatus,
  updateAutomationRule as serverUpdateAutomationRule,
  verifyAppointmentDeposit as serverVerifyAppointmentDeposit,
} from '@/app/commercial-actions';
import { callAppAction } from '@/components/app-action-client';
import { MetaEmbeddedSignup } from '@/components/meta-embedded-signup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type {
  AppointmentRecord,
  ConversationRecord,
  DashboardData,
  ServiceRecord,
} from '@/lib/dental-data';

type View =
  | 'agenda'
  | 'inbox'
  | 'patients'
  | 'services'
  | 'branches'
  | 'team'
  | 'automation'
  | 'analytics'
  | 'plan'
  | 'integrations'
  | 'settings'
  | 'platform';

const anonymizePatient = (...args: Parameters<typeof serverAnonymizePatient>) =>
  callAppAction<ActionResult>('anonymizePatient', args);
const createAppointment = (
  ...args: Parameters<typeof serverCreateAppointment>
) => callAppAction<ActionResult>('createAppointment', args);
const createFaq = (...args: Parameters<typeof serverCreateFaq>) =>
  callAppAction<ActionResult>('createFaq', args);
const createLocation = (...args: Parameters<typeof serverCreateLocation>) =>
  callAppAction<ActionResult>('createLocation', args);
const createProfessional = (
  ...args: Parameters<typeof serverCreateProfessional>
) => callAppAction<ActionResult>('createProfessional', args);
const createService = (...args: Parameters<typeof serverCreateService>) =>
  callAppAction<ActionResult>('createService', args);
const disconnectGoogleCalendar = (
  ...args: Parameters<typeof serverDisconnectGoogleCalendar>
) => callAppAction<ActionResult>('disconnectGoogleCalendar', args);
const inviteMember = (...args: Parameters<typeof serverInviteMember>) =>
  callAppAction<ActionResult>('inviteMember', args);
const markConversationRead = (
  ...args: Parameters<typeof serverMarkConversationRead>
) => callAppAction<ActionResult>('markConversationRead', args);
const resendInvitation = (...args: Parameters<typeof serverResendInvitation>) =>
  callAppAction<ActionResult>('resendInvitation', args);
const revokeInvitation = (...args: Parameters<typeof serverRevokeInvitation>) =>
  callAppAction<ActionResult>('revokeInvitation', args);
const sendConversationMessage = (
  ...args: Parameters<typeof serverSendConversationMessage>
) => callAppAction<ActionResult>('sendConversationMessage', args);
const setAppointmentStatus = (
  ...args: Parameters<typeof serverSetAppointmentStatus>
) => callAppAction<ActionResult>('setAppointmentStatus', args);
const toggleBotPaused = (...args: Parameters<typeof serverToggleBotPaused>) =>
  callAppAction<ActionResult>('toggleBotPaused', args);
const toggleService = (...args: Parameters<typeof serverToggleService>) =>
  callAppAction<ActionResult>('toggleService', args);
const updateBusinessHours = (
  ...args: Parameters<typeof serverUpdateBusinessHours>
) => callAppAction<ActionResult>('updateBusinessHours', args);
const updateLocation = (...args: Parameters<typeof serverUpdateLocation>) =>
  callAppAction<ActionResult>('updateLocation', args);
const updateMemberLocations = (
  ...args: Parameters<typeof serverUpdateMemberLocations>
) => callAppAction<ActionResult>('updateMemberLocations', args);
const updateOrganizationProfile = (
  ...args: Parameters<typeof serverUpdateOrganizationProfile>
) => callAppAction<ActionResult>('updateOrganizationProfile', args);
const updatePatientConsent = (
  ...args: Parameters<typeof serverUpdatePatientConsent>
) => callAppAction<ActionResult>('updatePatientConsent', args);
const addWaitlistEntry = (...args: Parameters<typeof serverAddWaitlistEntry>) =>
  callAppAction<ActionResult>('addWaitlistEntry', args);
const createReactivationCampaign = (
  ...args: Parameters<typeof serverCreateReactivationCampaign>
) => callAppAction<ActionResult>('createReactivationCampaign', args);
const requestAppointmentDeposit = (
  ...args: Parameters<typeof serverRequestAppointmentDeposit>
) => callAppAction<ActionResult>('requestAppointmentDeposit', args);
const runAutomationsNow = (
  ...args: Parameters<typeof serverRunAutomationsNow>
) => callAppAction<ActionResult>('runAutomationsNow', args);
const setWaitlistStatus = (
  ...args: Parameters<typeof serverSetWaitlistStatus>
) => callAppAction<ActionResult>('setWaitlistStatus', args);
const updateAutomationRule = (
  ...args: Parameters<typeof serverUpdateAutomationRule>
) => callAppAction<ActionResult>('updateAutomationRule', args);
const verifyAppointmentDeposit = (
  ...args: Parameters<typeof serverVerifyAppointmentDeposit>
) => callAppAction<ActionResult>('verifyAppointmentDeposit', args);

const navigation: Array<{
  id: View;
  label: string;
  icon: typeof CalendarDays;
}> = [
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'inbox', label: 'Bandeja', icon: MessageCircle },
  { id: 'patients', label: 'Pacientes', icon: Users },
  { id: 'services', label: 'Servicios', icon: Stethoscope },
  { id: 'branches', label: 'Sucursales', icon: Building2 },
  { id: 'team', label: 'Equipo', icon: UserPlus },
  { id: 'automation', label: 'Automatización', icon: Zap },
  { id: 'analytics', label: 'Analítica', icon: BarChart3 },
  { id: 'plan', label: 'Mi plan', icon: CreditCard },
  { id: 'integrations', label: 'Conexiones', icon: Wifi },
  { id: 'settings', label: 'Configuración', icon: Settings2 },
  { id: 'platform', label: 'Plataforma', icon: Building2 },
];

const statusLabels: Record<string, string> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No asistió',
};

export function DentalDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [view, setView] = useState<View>('agenda');
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [notice, setNotice] = useState<ActionResult | null>(null);
  const currentMember = data.saas.members.find(
    (member) => member.userId === data.saas.user.userId,
  );
  const canSeeAllLocations =
    data.saas.isPlatformAdmin ||
    ['owner', 'admin'].includes(data.saas.activeOrganization?.role ?? '');
  const availableLocations = canSeeAllLocations
    ? data.locations
    : data.locations.filter((location) =>
        currentMember?.locationIds.includes(location.id),
      );
  const [selectedLocationId, setSelectedLocationId] = useState(
    canSeeAllLocations ? 'all' : (availableLocations[0]?.id ?? 'all'),
  );
  const scopedData =
    selectedLocationId === 'all'
      ? data
      : {
          ...data,
          appointments: data.appointments.filter(
            (item) => item.locationId === selectedLocationId,
          ),
          conversations: data.conversations.filter(
            (item) => item.locationId === selectedLocationId,
          ),
          doctors: data.doctors.filter((item) =>
            item.locationIds.includes(selectedLocationId),
          ),
        };
  const [isPending, startTransition] = useTransition();
  const unread = data.conversations.reduce(
    (total, item) => total + item.unreadCount,
    0,
  );
  const activeRole = data.saas.activeOrganization?.role;
  const canOperate =
    data.saas.isPlatformAdmin ||
    ['owner', 'admin', 'staff'].includes(activeRole ?? '');
  const canManage =
    data.saas.isPlatformAdmin || ['owner', 'admin'].includes(activeRole ?? '');

  const runAction = (
    operation: () => Promise<ActionResult>,
    onSuccess?: () => void,
  ) => {
    setNotice(null);
    startTransition(async () => {
      const result = await operation();
      setNotice(result);
      if (result.ok) {
        onSuccess?.();
        router.refresh();
      }
    });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen max-w-[1720px] lg:grid-cols-[244px_minmax(0,1fr)]">
        <aside className="hidden border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex lg:flex-col">
          <Brand clinicName={data.clinic.name} />
          <nav className="mt-8 space-y-1" aria-label="Navegación principal">
            {navigation
              .filter(
                (item) => item.id !== 'platform' || data.saas.isPlatformAdmin,
              )
              .map((item) => {
                const Icon = item.icon;
                const active = item.id === view;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      item.id === 'platform'
                        ? router.push('/platform')
                        : setView(item.id)
                    }
                    className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}
                  >
                    <Icon className="size-[18px]" />
                    <span>{item.label}</span>
                    {item.id === 'inbox' && unread ? (
                      <span className="ml-auto grid size-5 place-items-center rounded-full bg-[#ef715f] text-[11px] font-semibold text-white">
                        {unread}
                      </span>
                    ) : null}
                  </button>
                );
              })}
          </nav>
          <div className="mt-5 space-y-2 border-t border-sidebar-border pt-5">
            <label
              htmlFor="organization-switcher"
              className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Negocio activo
            </label>
            <NativeSelect
              id="organization-switcher"
              value={data.clinic.id}
              onChange={(event) =>
                router.push(
                  `/app?organization=${encodeURIComponent(event.target.value)}`,
                )
              }
              className="w-full bg-background"
            >
              {data.saas.organizations.map((organization) => (
                <NativeSelectOption
                  key={organization.id}
                  value={organization.id}
                >
                  {organization.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="mt-auto space-y-3">
            <Card className="border-0 bg-[#ecf8f4] shadow-none ring-0">
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-[#176d59]">
                  <Bot className="size-4" />
                  <span className="text-xs font-semibold">
                    Asistente activo
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#3d6e63]">
                  Modo{' '}
                  {data.integration.mode === 'demo'
                    ? 'demostración segura'
                    : 'producción'}{' '}
                  · {data.conversations.length} conversaciones abiertas.
                </p>
                <Progress value={78} className="h-1.5 bg-white" />
              </CardContent>
            </Card>
            <div className="space-y-2 border-t border-sidebar-border px-2 pt-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-[#dce8ff] text-xs font-bold text-[#405593]">
                  {initials(data.saas.user.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {data.saas.user.displayName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {roleLabel(data.saas.activeOrganization?.role)}
                  </p>
                </div>
              </div>
              <form action="/logout" method="post">
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-destructive"
                >
                  <LogOut data-icon="inline-start" /> Cerrar sesión
                </Button>
              </form>
            </div>
          </div>
        </aside>

        <section className="min-w-0 pb-20 lg:pb-0">
          <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
            <div className="lg:hidden">
              <Brand compact clinicName={data.clinic.name} />
            </div>
            <NativeSelect
              aria-label="Negocio activo"
              value={data.clinic.id}
              onChange={(event) =>
                router.push(
                  `/app?organization=${encodeURIComponent(event.target.value)}`,
                )
              }
              className="hidden max-w-[180px] sm:block lg:hidden"
            >
              {data.saas.organizations.map((organization) => (
                <NativeSelectOption
                  key={organization.id}
                  value={organization.id}
                >
                  {organization.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Sucursal activa"
              value={selectedLocationId}
              onChange={(event) => setSelectedLocationId(event.target.value)}
              className="max-w-[210px]"
            >
              {canSeeAllLocations ? (
                <NativeSelectOption value="all">
                  Todas las sucursales
                </NativeSelectOption>
              ) : null}
              {availableLocations.map((location) => (
                <NativeSelectOption key={location.id} value={location.id}>
                  {location.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Buscar">
                <Search />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Notificaciones"
                className="relative"
              >
                <Bell />
                {unread ? (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#ef715f]" />
                ) : null}
              </Button>
              <Button
                size="lg"
                className="ml-1 rounded-xl px-4 shadow-sm"
                onClick={() => setAppointmentOpen(true)}
                disabled={!canOperate}
              >
                <Plus data-icon="inline-start" />
                Nueva cita
              </Button>
            </div>
          </header>

          <div className="px-4 py-6 md:px-8 md:py-8">
            {view === 'agenda' ? (
              <AgendaView
                data={scopedData}
                onOpenInbox={() => setView('inbox')}
                runAction={runAction}
                isPending={isPending || !canOperate}
              />
            ) : null}
            {view === 'inbox' ? (
              <InboxView
                conversations={scopedData.conversations}
                runAction={runAction}
                isPending={isPending || !canOperate}
              />
            ) : null}
            {view === 'patients' ? (
              <PatientsView
                data={data}
                runAction={runAction}
                isPending={isPending}
                canManage={canManage}
              />
            ) : null}
            {view === 'services' ? (
              <ServicesView
                services={data.services}
                onAdd={() => setServiceOpen(true)}
                runAction={runAction}
                canManage={canManage}
              />
            ) : null}
            {view === 'branches' ? (
              <BranchesView
                data={data}
                runAction={runAction}
                isPending={isPending}
              />
            ) : null}
            {view === 'team' ? (
              <TeamView
                data={data}
                runAction={runAction}
                isPending={isPending}
              />
            ) : null}
            {view === 'analytics' ? <AnalyticsView data={scopedData} /> : null}
            {view === 'plan' ? <PlanView data={data} /> : null}
            {view === 'integrations' ? (
              <IntegrationsView
                data={data}
                runAction={runAction}
                isPending={isPending}
              />
            ) : null}
            {view === 'automation' ? (
              <CommercialView
                data={scopedData}
                runAction={runAction}
                isPending={isPending || !canManage}
              />
            ) : null}
            {view === 'settings' ? (
              <SettingsView
                data={data}
                runAction={runAction}
                isPending={isPending}
              />
            ) : null}
            {view === 'platform' && data.saas.isPlatformAdmin ? (
              <PlatformView data={data} />
            ) : null}
          </div>
        </section>
      </div>

      <MobileNavigation view={view} setView={setView} unread={unread} />
      <NewAppointmentDialog
        open={appointmentOpen}
        setOpen={setAppointmentOpen}
        data={data}
        selectedLocationId={selectedLocationId}
        runAction={runAction}
        isPending={isPending}
      />
      <NewServiceDialog
        open={serviceOpen}
        setOpen={setServiceOpen}
        runAction={runAction}
        isPending={isPending}
        clinicId={data.clinic.id}
      />
      {notice ? (
        <output
          className={`fixed bottom-20 right-4 z-[80] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-xl lg:bottom-5 ${notice.ok ? 'border-[#bfe8dc] bg-[#effaf7] text-[#176d59]' : 'border-red-200 bg-red-50 text-red-700'}`}
        >
          <span>{notice.message}</span>
          {notice.invitationPath ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="ml-3 bg-white"
              onClick={() =>
                navigator.clipboard.writeText(
                  new URL(
                    notice.invitationPath!,
                    window.location.origin,
                  ).toString(),
                )
              }
            >
              Copiar enlace
            </Button>
          ) : null}
        </output>
      ) : null}
    </main>
  );
}

function Brand({
  clinicName,
  compact = false,
}: {
  clinicName: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="grid size-10 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-sm">
        <Sparkles className="size-5" />
      </div>
      {compact ? (
        <span className="font-heading text-lg font-bold">Asistente H</span>
      ) : (
        <div>
          <p className="font-heading text-lg font-bold tracking-[-0.03em]">
            Asistente H
          </p>
          <p className="text-xs text-muted-foreground">{clinicName}</p>
        </div>
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1 text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="font-heading text-3xl font-bold tracking-[-0.04em] md:text-[36px]">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function AgendaView({
  data,
  onOpenInbox,
  runAction,
  isPending,
}: {
  data: DashboardData;
  onOpenInbox: () => void;
  runAction: (operation: () => Promise<ActionResult>) => void;
  isPending: boolean;
}) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: data.clinic.timezone,
  }).format(new Date());
  const todayAppointments = data.appointments.filter(
    (item) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: data.clinic.timezone,
      }).format(new Date(item.startsAt)) === today,
  );
  const confirmed = todayAppointments.filter(
    (item) => item.status === 'confirmed',
  ).length;
  const pending = todayAppointments.filter(
    (item) => item.status === 'pending',
  ).length;
  return (
    <>
      <PageHeading
        eyebrow={new Intl.DateTimeFormat('es-MX', {
          timeZone: data.clinic.timezone,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date())}
        title={`Hola, ${firstName(data.saas.user.displayName)}`}
        description={`Tu agenda está al día. Tienes ${todayAppointments.length} citas programadas hoy.`}
        action={
          <div className="flex items-center gap-2 rounded-xl border bg-card p-1">
            <Button variant="ghost" size="sm">
              Día
            </Button>
            <Button variant="secondary" size="sm" className="shadow-sm">
              Semana
            </Button>
            <Button variant="ghost" size="sm">
              Mes
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          value={String(todayAppointments.length)}
          label="Citas de hoy"
          detail="Agenda activa"
        />
        <Metric
          value={String(confirmed)}
          label="Confirmadas"
          detail={`${todayAppointments.length ? Math.round((confirmed / todayAppointments.length) * 100) : 0}% de la agenda`}
        />
        <Metric
          value={String(pending)}
          label="Por confirmar"
          detail="Requieren atención"
          warning
        />
        <Metric value="86%" label="Ocupación" detail="6 h 25 min reservadas" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Agenda de hoy</CardTitle>
            <CardDescription>
              Todos los doctores · horario local
            </CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm">
                Ver calendario <ChevronRight data-icon="inline-end" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="divide-y divide-border/70">
            {todayAppointments.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                onStatus={(status) =>
                  runAction(() => setAppointmentStatus(appointment.id, status))
                }
                disabled={isPending}
              />
            ))}
            {!todayAppointments.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No hay citas para este día.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <AssistantCard data={data} onOpenInbox={onOpenInbox} />
      </div>
    </>
  );
}

function Metric({
  value,
  label,
  detail,
  warning = false,
}: {
  value: string;
  label: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
      <CardContent>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-heading text-2xl font-bold tracking-tight">
              {value}
            </p>
            <p className="mt-0.5 text-sm font-medium">{label}</p>
          </div>
          <div
            className={`grid size-8 place-items-center rounded-lg ${warning ? 'bg-[#fff3d8] text-[#a56b00]' : 'bg-primary/10 text-primary'}`}
          >
            {warning ? (
              <Clock3 className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function AppointmentRow({
  appointment,
  onStatus,
  disabled,
}: {
  appointment: AppointmentRecord;
  onStatus: (status: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-[64px_1fr] items-center gap-3 py-4 sm:grid-cols-[78px_42px_1fr_auto]">
      <div>
        <p className="text-sm font-bold tabular-nums">
          {formatTime(appointment.startsAt)}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatTime(appointment.endsAt)}
        </p>
      </div>
      <div
        className="hidden size-10 place-items-center rounded-full text-xs font-bold sm:grid"
        style={{
          backgroundColor: `${appointment.doctorColor}22`,
          color: appointment.doctorColor,
        }}
      >
        {initials(appointment.patientName)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">
          {appointment.patientName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {appointment.serviceName} · {appointment.doctorName}
        </p>
      </div>
      <NativeSelect
        size="sm"
        value={appointment.status}
        disabled={disabled}
        onChange={(event) => onStatus(event.target.value)}
        className="col-start-2 w-full sm:col-start-auto sm:w-[132px]"
      >
        {Object.entries(statusLabels).map(([value, label]) => (
          <NativeSelectOption key={value} value={value}>
            {label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function AssistantCard({
  data,
  onOpenInbox,
}: {
  data: DashboardData;
  onOpenInbox: () => void;
}) {
  const [messages, setMessages] = useState<
    Array<{ role: 'user' | 'assistant'; body: string }>
  >([
    {
      role: 'user',
      body: '¿Cuánto cuesta una limpieza y tienen horario mañana?',
    },
    {
      role: 'assistant',
      body: 'La limpieza tiene un costo de $850. Puedo consultar los horarios reales para mañana.',
    },
  ]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = text.trim();
    if (!message || loading) return;
    setMessages((current) => [...current, { role: 'user', body: message }]);
    setText('');
    setLoading(true);
    try {
      const response = await fetch('/api/assistant/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, clinicId: data.clinic.id }),
      });
      const result = (await response.json()) as {
        reply?: string;
        error?: string;
      };
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          body:
            result.reply ??
            result.error ??
            'No pude responder en este momento.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Card className="border-0 bg-[#173b34] text-white shadow-[0_14px_40px_rgb(19_55_47/18%)] ring-0">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl bg-white/10">
            <Bot className="size-[18px] text-[#78dfc1]" />
          </div>
          <Badge className="bg-[#2e9b7f] text-white">
            {data.integration.aiConfigured ? 'Gemini conectado' : 'Modo demo'}
          </Badge>
        </div>
        <CardTitle className="text-white">Prueba la recepción con IA</CardTitle>
        <CardDescription className="text-white/60">
          Consulta costos, servicios o disponibilidad
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-[250px] space-y-3 overflow-y-auto pr-1">
          {messages.slice(-5).map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={
                message.role === 'assistant'
                  ? 'ml-7 rounded-2xl rounded-br-md bg-[#eafaf5] p-3 text-xs leading-relaxed text-[#173b34]'
                  : 'mr-7 rounded-2xl rounded-bl-md bg-white/10 p-3 text-xs leading-relaxed text-white/75'
              }
            >
              {message.body}
            </div>
          ))}
        </div>
        <form
          onSubmit={submit}
          className="flex gap-2 border-t border-white/10 pt-3"
        >
          <Input
            aria-label="Mensaje de prueba"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Pregunta como paciente…"
            className="border-white/15 bg-white/10 text-white placeholder:text-white/40"
          />
          <Button
            type="submit"
            size="icon"
            variant="secondary"
            disabled={loading}
            aria-label="Enviar"
          >
            <Send />
          </Button>
        </form>
        <div className="flex items-center gap-2 text-[11px] text-white/45">
          <span className="size-1.5 rounded-full bg-[#78dfc1]" />
          {data.integration.aiConfigured
            ? 'Gemini central con herramientas controladas'
            : 'Simulador seguro sin credenciales externas'}
        </div>
        <Button
          variant="secondary"
          className="w-full bg-white text-[#173b34] hover:bg-white/90"
          onClick={onOpenInbox}
        >
          Abrir bandeja
        </Button>
      </CardContent>
    </Card>
  );
}

function InboxView({
  conversations,
  runAction,
  isPending,
}: {
  conversations: ConversationRecord[];
  runAction: (operation: () => Promise<ActionResult>) => void;
  isPending: boolean;
}) {
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? '');
  const selected =
    conversations.find((item) => item.id === selectedId) ?? conversations[0];
  const [message, setMessage] = useState('');
  if (!selected) return <p>No hay conversaciones.</p>;
  function choose(id: string) {
    setSelectedId(id);
    void markConversationRead(id);
  }
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = message.trim();
    if (!body) return;
    runAction(() => sendConversationMessage(selected.id, body));
    setMessage('');
  }
  return (
    <>
      <PageHeading
        eyebrow="WhatsApp"
        title="Bandeja de conversaciones"
        description="La IA y tu equipo trabajando en el mismo lugar."
      />
      <Card className="min-h-[620px] overflow-hidden border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
        <div className="grid min-h-[620px] md:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="border-b border-border md:border-b-0 md:border-r">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
                <Input
                  aria-label="Buscar conversación"
                  placeholder="Buscar conversación"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="max-h-[555px] overflow-y-auto">
              {conversations.map((conversation) => (
                <button
                  aria-label={`Abrir conversación con ${conversation.patientName}`}
                  key={conversation.id}
                  type="button"
                  onClick={() => choose(conversation.id)}
                  className={`w-full border-b p-4 text-left transition-colors ${conversation.id === selected.id ? 'bg-primary/8' : 'hover:bg-muted/50'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials(conversation.patientName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">
                          {conversation.patientName}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(conversation.lastMessageAt)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {conversation.lastMessage}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {conversation.botPaused ? (
                          <Badge variant="outline" className="text-[10px]">
                            Atención humana
                          </Badge>
                        ) : (
                          <Badge className="bg-[#e5f7f1] text-[10px] text-[#176d59]">
                            IA activa
                          </Badge>
                        )}
                        {conversation.unreadCount ? (
                          <span className="ml-auto grid size-5 place-items-center rounded-full bg-primary text-[10px] text-white">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>
          <section className="flex min-w-0 flex-col">
            <header className="flex items-center gap-3 border-b p-4">
              <div className="grid size-10 place-items-center rounded-full bg-[#dce8ff] text-xs font-bold text-[#405593]">
                {initials(selected.patientName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{selected.patientName}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.patientPhone ?? 'Sin teléfono'} · WhatsApp
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {selected.botPaused
                    ? 'Tomada por el equipo'
                    : 'Atiende la IA'}
                </span>
                <Switch
                  aria-label="Activar o pausar la IA para esta conversación"
                  checked={!selected.botPaused}
                  onCheckedChange={(checked) =>
                    runAction(() => toggleBotPaused(selected.id, !checked))
                  }
                  disabled={isPending}
                />
              </div>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fbfa] p-4 md:p-6">
              {selected.messages.map((item) => (
                <div
                  key={item.id}
                  className={`flex ${item.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${item.direction === 'outbound' ? 'rounded-br-md bg-[#dff7ef] text-[#173b34]' : 'rounded-bl-md bg-white'}`}
                  >
                    <p>{item.body}</p>
                    <p className="mt-1 text-right text-[10px] opacity-50">
                      {item.authorType === 'assistant' ? 'IA · ' : ''}
                      {formatTime(item.createdAt)}
                      {item.direction === 'outbound' &&
                      item.deliveryStatus === 'failed'
                        ? ' · No entregado'
                        : ''}
                    </p>
                    {item.lastError ? (
                      <p className="mt-1 text-[10px] text-red-700">
                        {item.lastError}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={submit} className="border-t bg-card p-3">
              <div className="flex gap-2">
                <Input
                  aria-label="Respuesta al paciente"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Escribe una respuesta…"
                />
                <Button type="submit" disabled={isPending}>
                  <Send data-icon="inline-start" />
                  Enviar
                </Button>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Fuera de la ventana de 24 horas se requiere una plantilla
                aprobada de Meta.
              </p>
            </form>
          </section>
        </div>
      </Card>
    </>
  );
}

function PatientsView({
  data,
  runAction,
  isPending,
  canManage,
}: {
  data: DashboardData;
  runAction: (operation: () => Promise<ActionResult>) => void;
  isPending: boolean;
  canManage: boolean;
}) {
  const [query, setQuery] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(
    data.patients[0]?.id ?? '',
  );
  const patients = data.patients.filter((patient) =>
    `${patient.fullName} ${patient.phone} ${patient.email ?? ''}`
      .toLocaleLowerCase('es-MX')
      .includes(query.toLocaleLowerCase('es-MX')),
  );
  const selectedPatient = data.patients.find(
    (patient) => patient.id === selectedPatientId,
  );
  const history = [
    ...data.commercial.patientEvents
      .filter((event) => event.patientId === selectedPatientId)
      .map((event) => ({
        id: event.id,
        title: event.title,
        detail: event.details,
        createdAt: event.createdAt,
      })),
    ...data.appointments
      .filter((appointment) => appointment.patientId === selectedPatientId)
      .map((appointment) => ({
        id: `appointment-${appointment.id}`,
        title: `${appointment.serviceName} · ${statusLabels[appointment.status] ?? appointment.status}`,
        detail: `Con ${appointment.doctorName}`,
        createdAt: appointment.startsAt,
      })),
  ].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  return (
    <>
      <PageHeading
        eyebrow="Directorio"
        title="Pacientes"
        description={`${data.patients.length} pacientes registrados en ${data.clinic.name}.`}
        action={
          <Button variant="outline">
            <Plus data-icon="inline-start" />
            Agregar paciente
          </Button>
        }
      />
      <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
        <CardHeader className="border-b">
          <CardTitle>Directorio de pacientes</CardTitle>
          <CardDescription>
            Datos de contacto y actividad de citas.
          </CardDescription>
          <CardAction>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
              <Input
                aria-label="Buscar paciente"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar"
                className="w-[220px] pl-8"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Citas</TableHead>
                <TableHead>Última visita</TableHead>
                <TableHead>Mensajes</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {initials(patient.fullName)}
                      </div>
                      <div>
                        <p className="font-medium">{patient.fullName}</p>
                        {patient.notes ? (
                          <p className="max-w-[240px] truncate text-xs text-muted-foreground">
                            {patient.notes}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{patient.phone}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {patient.email ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {patient.appointmentCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {patient.lastVisitAt
                      ? formatDate(patient.lastVisitAt)
                      : 'Paciente nuevo'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      aria-label={`Consentimiento de ${patient.fullName}`}
                      checked={Boolean(patient.marketingOptIn)}
                      disabled={isPending}
                      onCheckedChange={(allowed) =>
                        runAction(() =>
                          updatePatientConsent(patient.id, allowed),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={
                        selectedPatientId === patient.id ? 'secondary' : 'ghost'
                      }
                      onClick={() => setSelectedPatientId(patient.id)}
                    >
                      Historial
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {selectedPatient ? (
        <Card className="mt-5 border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
          <CardHeader>
            <CardTitle>Historial de {selectedPatient.fullName}</CardTitle>
            <CardDescription>
              Citas, cambios, lista de espera, anticipos y seguimientos.
            </CardDescription>
            {canManage ? (
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Se eliminarán los datos identificables y el contenido de conversaciones. Las citas se conservarán anonimizadas. ¿Continuar?',
                      )
                    )
                      runAction(() => anonymizePatient(selectedPatient.id));
                  }}
                >
                  Anonimizar datos
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl border p-3">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    {item.detail ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              {!history.length ? (
                <p className="text-sm text-muted-foreground">
                  Este paciente todavía no tiene actividad registrada.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function ServicesView({
  services,
  onAdd,
  runAction,
  canManage,
}: {
  services: ServiceRecord[];
  onAdd: () => void;
  runAction: (operation: () => Promise<ActionResult>) => void;
  canManage: boolean;
}) {
  return (
    <>
      <PageHeading
        eyebrow="Catálogo autorizado"
        title="Servicios y precios"
        description="Esta información es la única que la IA puede cotizar a los pacientes."
        action={
          canManage ? (
            <Button onClick={onAdd}>
              <Plus data-icon="inline-start" />
              Nuevo servicio
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <Card
            key={service.id}
            className={`border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)] ${service.active ? '' : 'opacity-60'}`}
          >
            <CardHeader>
              <div className="mb-3 flex items-center justify-between">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Stethoscope className="size-5" />
                </div>
                <Switch
                  aria-label={`${service.active ? 'Desactivar' : 'Activar'} ${service.name}`}
                  checked={service.active === 1}
                  disabled={!canManage}
                  onCheckedChange={(checked) =>
                    runAction(() => toggleService(service.id, checked))
                  }
                />
              </div>
              <CardTitle>{service.name}</CardTitle>
              <CardDescription>{service.category}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="min-h-10 text-sm text-muted-foreground">
                {service.description}
              </p>
              <div className="mt-5 flex items-end justify-between border-t pt-4">
                <div>
                  <p className="font-heading text-2xl font-bold">
                    {money(service.priceCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Precio vigente
                  </p>
                </div>
                <Badge variant="outline">
                  <Clock3 data-icon="inline-start" />
                  {service.durationMinutes} min
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function AnalyticsView({ data }: { data: DashboardData }) {
  const total = data.appointments.length;
  const confirmed = data.appointments.filter(
    (item) => item.status === 'confirmed',
  ).length;
  const fromWhatsapp = data.appointments.filter(
    (item) => item.source === 'whatsapp',
  ).length;
  const revenue = data.appointments
    .filter((item) => item.status !== 'cancelled')
    .reduce(
      (sum, item) =>
        sum +
        (data.services.find((service) => service.id === item.serviceId)
          ?.priceCents ?? 0),
      0,
    );
  const serviceStats = data.services
    .map((service) => ({
      ...service,
      count: data.appointments.filter((item) => item.serviceId === service.id)
        .length,
    }))
    .sort((a, b) => b.count - a.count);
  return (
    <>
      <PageHeading
        eyebrow="Rendimiento"
        title="Analítica del consultorio"
        description="Indicadores para medir agenda, automatización y conversión."
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          value={String(total)}
          label="Citas registradas"
          detail="Periodo de demostración"
        />
        <Metric
          value={`${total ? Math.round((confirmed / total) * 100) : 0}%`}
          label="Confirmación"
          detail={`${confirmed} citas confirmadas`}
        />
        <Metric
          value={`${total ? Math.round((fromWhatsapp / total) * 100) : 0}%`}
          label="Origen WhatsApp"
          detail={`${fromWhatsapp} generadas por el canal`}
        />
        <Metric
          value={money(revenue)}
          label="Valor agendado"
          detail="Estimado según catálogo"
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
          <CardHeader>
            <CardTitle>Servicios más solicitados</CardTitle>
            <CardDescription>
              Participación en la agenda registrada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {serviceStats.map((service) => (
              <div key={service.id}>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium">{service.name}</span>
                  <span className="text-muted-foreground">
                    {service.count} citas
                  </span>
                </div>
                <Progress value={total ? (service.count / total) * 100 : 0} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-0 bg-[#173b34] text-white ring-0">
          <CardHeader>
            <CardTitle className="text-white">Automatización</CardTitle>
            <CardDescription className="text-white/60">
              Impacto esperado durante el piloto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <AutomationItem
              icon={Bot}
              value="70%"
              label="Meta de conversaciones resueltas sin intervención"
            />
            <AutomationItem
              icon={Clock3}
              value="< 10 s"
              label="Meta de tiempo para la primera respuesta"
            />
            <AutomationItem
              icon={CheckCircle2}
              value="0"
              label="Tolerancia a dobles reservaciones"
            />
            <AutomationItem
              icon={Activity}
              value="24/7"
              label="Disponibilidad del canal automatizado"
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CommercialView({
  data,
  runAction,
  isPending,
}: {
  data: DashboardData;
  runAction: (operation: () => Promise<ActionResult>) => void;
  isPending: boolean;
}) {
  const [renderedAt] = useState(() => Date.now());
  const upcomingAppointments = data.appointments.filter(
    (item) =>
      new Date(item.startsAt).getTime() > renderedAt &&
      !['cancelled', 'completed'].includes(item.status),
  );

  function waitlistSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      addWaitlistEntry({
        clinicId: data.clinic.id,
        patientId: formText(form, 'patientId'),
        serviceId: formText(form, 'serviceId'),
        doctorId: formText(form, 'doctorId'),
        dateFrom: formText(form, 'dateFrom'),
        dateTo: formText(form, 'dateTo'),
        preferredTime: formText(form, 'preferredTime'),
        notes: formText(form, 'notes'),
      }),
    );
  }

  function campaignSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      createReactivationCampaign({
        clinicId: data.clinic.id,
        name: formText(form, 'name'),
        template: formText(form, 'template'),
        scheduledFor: formText(form, 'scheduledFor'),
      }),
    );
  }

  function depositSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      requestAppointmentDeposit({
        appointmentId: formText(form, 'appointmentId'),
        amountPesos: Number(formText(form, 'amountPesos')),
        reference: formText(form, 'reference'),
      }),
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Operación automática"
        title="Automatización y crecimiento"
        description="Recordatorios, lista de espera, reactivación, anticipos, encuestas y seguimiento desde un solo lugar."
        action={
          <Button
            onClick={() => runAction(() => runAutomationsNow(data.clinic.id))}
            disabled={isPending}
          >
            <Zap data-icon="inline-start" />
            Procesar pendientes
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          value={String(data.commercial.scheduledPending)}
          label="Mensajes programados"
          detail="Recordatorios y seguimientos"
        />
        <Metric
          value={String(
            data.commercial.waitlist.filter((item) => item.status === 'waiting')
              .length,
          )}
          label="Lista de espera"
          detail="Pacientes disponibles"
        />
        <Metric
          value={`${data.commercial.surveysAnswered}/${data.commercial.surveysSent}`}
          label="Encuestas respondidas"
          detail="Seguimiento de satisfacción"
        />
        <Metric
          value={
            data.commercial.averageScore === null
              ? '—'
              : `${Number(data.commercial.averageScore).toFixed(1)}/5`
          }
          label="Satisfacción"
          detail="Promedio de respuestas"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
          <CardHeader>
            <CardTitle>Reglas de WhatsApp</CardTitle>
            <CardDescription>
              Se crean al confirmar una cita y se envían cuando corresponde.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.commercial.automationRules.map((rule) => (
              <AutomationRuleEditor
                key={rule.id}
                rule={rule}
                clinicId={data.clinic.id}
                runAction={runAction}
                disabled={isPending}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
          <CardHeader>
            <CardTitle>Calendario y reportes</CardTitle>
            <CardDescription>
              Exportaciones compatibles con Excel y Google Calendar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Google Calendar</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.integration.googleCalendarConfigured
                      ? 'Conexión OAuth activa.'
                      : 'Exportación disponible; la sincronización OAuth requiere credenciales de Google.'}
                  </p>
                </div>
                <Badge
                  variant={
                    data.integration.googleCalendarConfigured
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {data.integration.googleCalendarConfigured
                    ? 'Conectado'
                    : 'Preparado'}
                </Badge>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <a
                href={`/api/export/appointments?clinicId=${encodeURIComponent(data.clinic.id)}`}
                className="inline-flex h-10 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted"
              >
                <FileText className="mr-2 size-4" /> Exportar citas CSV
              </a>
              <a
                href={`/api/export/calendar?clinicId=${encodeURIComponent(data.clinic.id)}`}
                className="inline-flex h-10 items-center justify-center rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted"
              >
                <CalendarDays className="mr-2 size-4" /> Descargar calendario
              </a>
            </div>
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notificaciones al personal
              </p>
              {data.commercial.notifications.length ? (
                data.commercial.notifications.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-lg bg-muted/40 p-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay incidencias pendientes.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
          <CardHeader>
            <CardTitle>Lista de espera</CardTitle>
            <CardDescription>
              Registra preferencias para cubrir espacios cancelados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form
              onSubmit={waitlistSubmit}
              className="grid gap-3 sm:grid-cols-2"
            >
              <NativeSelect name="patientId" required className="w-full">
                <NativeSelectOption value="">Paciente</NativeSelectOption>
                {data.patients.map((patient) => (
                  <NativeSelectOption key={patient.id} value={patient.id}>
                    {patient.fullName}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect name="serviceId" className="w-full">
                <NativeSelectOption value="">
                  Cualquier servicio
                </NativeSelectOption>
                {data.services.map((service) => (
                  <NativeSelectOption key={service.id} value={service.id}>
                    {service.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect name="doctorId" className="w-full">
                <NativeSelectOption value="">
                  Cualquier profesional
                </NativeSelectOption>
                {data.doctors.map((doctor) => (
                  <NativeSelectOption key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                name="preferredTime"
                type="time"
                aria-label="Horario preferido"
              />
              <Input name="dateFrom" type="date" aria-label="Fecha inicial" />
              <Input name="dateTo" type="date" aria-label="Fecha final" />
              <Textarea
                name="notes"
                placeholder="Preferencias adicionales"
                className="sm:col-span-2"
              />
              <Button
                type="submit"
                disabled={isPending}
                className="sm:col-span-2"
              >
                <Plus data-icon="inline-start" /> Agregar a espera
              </Button>
            </form>
            <div className="space-y-2 border-t pt-4">
              {data.commercial.waitlist.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.serviceName ?? 'Cualquier servicio'} ·{' '}
                      {item.preferredDateFrom ?? 'Fecha flexible'}{' '}
                      {item.preferredTime ? `· ${item.preferredTime}` : ''}
                    </p>
                  </div>
                  <NativeSelect
                    value={item.status}
                    onChange={(event) =>
                      runAction(() =>
                        setWaitlistStatus(
                          item.id,
                          event.target.value as
                            | 'waiting'
                            | 'contacted'
                            | 'booked'
                            | 'closed',
                        ),
                      )
                    }
                    disabled={isPending}
                  >
                    <NativeSelectOption value="waiting">
                      En espera
                    </NativeSelectOption>
                    <NativeSelectOption value="contacted">
                      Contactado
                    </NativeSelectOption>
                    <NativeSelectOption value="booked">
                      Agendado
                    </NativeSelectOption>
                    <NativeSelectOption value="closed">
                      Cerrado
                    </NativeSelectOption>
                  </NativeSelect>
                </div>
              ))}
              {!data.commercial.waitlist.length ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay personas en espera.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
          <CardHeader>
            <CardTitle>Campañas de reactivación</CardTitle>
            <CardDescription>
              Programa un mensaje para pacientes sin visita en 180 días.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={campaignSubmit} className="space-y-3">
              <Input name="name" placeholder="Nombre de la campaña" required />
              <Textarea
                name="template"
                defaultValue="Hola {{patient_name}}, en {{business_name}} queremos saber cómo te encuentras. ¿Deseas que te ayudemos a agendar una nueva cita?"
                required
              />
              <Input
                name="scheduledFor"
                type="datetime-local"
                defaultValue={defaultAppointmentDate(data.clinic.timezone)}
                required
              />
              <Button type="submit" disabled={isPending}>
                <Megaphone data-icon="inline-start" /> Programar campaña
              </Button>
            </form>
            <div className="space-y-2 border-t pt-4">
              {data.commercial.campaigns.slice(0, 5).map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center gap-3 rounded-lg bg-muted/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {campaign.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.recipients} destinatarios · {campaign.sent}{' '}
                      enviados
                    </p>
                  </div>
                  <Badge variant="secondary">{campaign.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)] xl:col-span-2">
          <CardHeader>
            <CardTitle>Anticipos por transferencia</CardTitle>
            <CardDescription>
              Solicita un monto y verifica manualmente cuando llegue la
              transferencia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form
              onSubmit={depositSubmit}
              className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
            >
              <NativeSelect name="appointmentId" required className="w-full">
                <NativeSelectOption value="">
                  Selecciona una cita
                </NativeSelectOption>
                {upcomingAppointments.map((appointment) => (
                  <NativeSelectOption
                    key={appointment.id}
                    value={appointment.id}
                  >
                    {appointment.patientName} ·{' '}
                    {formatDate(appointment.startsAt)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                name="amountPesos"
                type="number"
                min="1"
                placeholder="Monto MXN"
                required
              />
              <Input name="reference" placeholder="Referencia" />
              <Button type="submit" disabled={isPending}>
                Solicitar
              </Button>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Cita</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.commercial.deposits.map((deposit) => (
                  <TableRow key={deposit.id}>
                    <TableCell>{deposit.patientName}</TableCell>
                    <TableCell>{formatDate(deposit.startsAt)}</TableCell>
                    <TableCell>{money(deposit.amountCents)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          deposit.status === 'paid' ? 'default' : 'secondary'
                        }
                      >
                        {deposit.status === 'paid' ? 'Recibido' : 'Solicitado'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {deposit.status !== 'paid' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() =>
                            runAction(() =>
                              verifyAppointmentDeposit(deposit.appointmentId),
                            )
                          }
                        >
                          Verificar
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function AutomationRuleEditor({
  rule,
  clinicId,
  runAction,
  disabled,
}: {
  rule: DashboardData['commercial']['automationRules'][number];
  clinicId: string;
  runAction: (operation: () => Promise<ActionResult>) => void;
  disabled: boolean;
}) {
  const [enabled, setEnabled] = useState(rule.enabled === 1);

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      updateAutomationRule({
        clinicId,
        kind: rule.kind,
        enabled,
        offsetMinutes: Number(formText(form, 'offsetMinutes')),
        template: formText(form, 'template'),
      }),
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{automationLabel(rule.kind)}</p>
          <p className="text-xs text-muted-foreground">
            Minutos relativos a la cita; negativos se envían antes.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[110px_1fr_auto]">
        <Input
          name="offsetMinutes"
          type="number"
          defaultValue={rule.offsetMinutes}
          aria-label="Minutos relativos"
        />
        <Input name="template" defaultValue={rule.template} required />
        <Button type="submit" variant="outline" disabled={disabled}>
          Guardar
        </Button>
      </div>
    </form>
  );
}

function AutomationItem({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Bot;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="grid size-10 place-items-center rounded-xl bg-white/10 text-[#78dfc1]">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="font-heading text-xl font-bold">{value}</p>
        <p className="text-xs text-white/55">{label}</p>
      </div>
    </div>
  );
}

function BranchesView({
  data,
  runAction,
  isPending,
}: {
  data: DashboardData;
  runAction: (operation: () => Promise<ActionResult>) => void;
  isPending: boolean;
}) {
  const canManage =
    data.saas.isPlatformAdmin ||
    ['owner', 'admin'].includes(data.saas.activeOrganization?.role ?? '');
  const limit = data.saas.subscription?.plan.maxLocations ?? 0;

  function locationSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      createLocation({
        clinicId: data.clinic.id,
        name: formText(form, 'name'),
        address: formText(form, 'address'),
        phone: formText(form, 'phone'),
      }),
    );
  }

  function professionalSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      createProfessional({
        clinicId: data.clinic.id,
        name: formText(form, 'name'),
        email: formText(form, 'email'),
        specialty: formText(form, 'specialty'),
        locationId: formText(form, 'locationId'),
      }),
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Establecimientos"
        title="Sucursales"
        description="Administra las sedes físicas incluidas en el plan de este negocio."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Sucursales activas</CardTitle>
            <CardDescription>
              {data.locations.length} de {limit || '—'} disponibles en el plan
              actual.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.locations.map((location) => (
              <div key={location.id} className="rounded-xl border p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{location.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {location.address ?? 'Dirección pendiente'}
                    </p>
                  </div>
                  <Badge variant="outline">Activa</Badge>
                </div>
                {canManage ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      runAction(() =>
                        updateLocation({
                          clinicId: data.clinic.id,
                          locationId: location.id,
                          name: formText(form, 'name'),
                          address: formText(form, 'address'),
                          phone: formText(form, 'phone'),
                        }),
                      );
                    }}
                    className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <Input
                      name="name"
                      defaultValue={location.name}
                      aria-label="Nombre de la sucursal"
                      required
                    />
                    <Input
                      name="address"
                      defaultValue={location.address ?? ''}
                      placeholder="Dirección"
                      aria-label="Dirección"
                    />
                    <Input
                      name="phone"
                      defaultValue={location.phone ?? ''}
                      placeholder="Teléfono"
                      aria-label="Teléfono"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                    >
                      Guardar
                    </Button>
                  </form>
                ) : null}
              </div>
            ))}
            {canManage ? (
              <form
                onSubmit={locationSubmit}
                className="grid gap-3 border-t pt-5 sm:grid-cols-2"
              >
                <Input
                  name="name"
                  placeholder="Nombre de la sucursal"
                  required
                />
                <Input name="phone" placeholder="Teléfono" />
                <Input
                  name="address"
                  placeholder="Dirección"
                  className="sm:col-span-2"
                />
                <Button
                  type="submit"
                  disabled={isPending}
                  className="sm:col-span-2"
                >
                  Agregar sucursal
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Profesionales</CardTitle>
            <CardDescription>
              Asigna a cada profesional una sede de trabajo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.doctors.map((doctor) => (
              <div key={doctor.id} className="rounded-xl border p-3">
                <p className="text-sm font-semibold">{doctor.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doctor.specialty ?? 'Sin especialidad'}
                </p>
              </div>
            ))}
            {canManage ? (
              <form
                onSubmit={professionalSubmit}
                className="grid gap-3 border-t pt-5"
              >
                <Input
                  name="name"
                  placeholder="Nombre del profesional"
                  required
                />
                <Input name="specialty" placeholder="Especialidad o función" />
                <Input name="email" type="email" placeholder="Correo" />
                <NativeSelect name="locationId" className="w-full" required>
                  {data.locations.map((location) => (
                    <NativeSelectOption key={location.id} value={location.id}>
                      {location.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button type="submit" variant="outline" disabled={isPending}>
                  Agregar profesional
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function TeamView({
  data,
  runAction,
  isPending,
}: {
  data: DashboardData;
  runAction: (operation: () => Promise<ActionResult>) => void;
  isPending: boolean;
}) {
  const canManage =
    data.saas.isPlatformAdmin ||
    ['owner', 'admin'].includes(data.saas.activeOrganization?.role ?? '');

  function inviteSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      inviteMember({
        clinicId: data.clinic.id,
        email: formText(form, 'email'),
        role: formText(form, 'role') as 'owner' | 'admin' | 'staff' | 'viewer',
        locationIds: form.getAll('locationIds').map(String),
      }),
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Accesos del negocio"
        title="Equipo y permisos"
        description="Invita personas y define lo que cada una puede hacer dentro de este negocio."
      />
      <Card className="max-w-4xl border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
        <CardContent className="space-y-3 pt-6">
          {data.saas.members.map((member) => (
            <div key={member.id} className="rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {initials(member.fullName ?? member.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {member.fullName ?? member.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
                <Badge variant="outline">{roleLabel(member.role)}</Badge>
              </div>
              <form
                className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  runAction(() =>
                    updateMemberLocations({
                      clinicId: data.clinic.id,
                      membershipId: member.id,
                      locationIds: form.getAll('locationIds').map(String),
                    }),
                  );
                }}
              >
                {data.locations.map((location) => (
                  <label
                    key={location.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      name="locationIds"
                      value={location.id}
                      defaultChecked={member.locationIds.includes(location.id)}
                      disabled={!canManage}
                      className="size-4 accent-primary"
                    />
                    {location.name}
                  </label>
                ))}
                {canManage ? (
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                  >
                    Guardar sucursales
                  </Button>
                ) : null}
              </form>
            </div>
          ))}
          {canManage ? (
            <form
              onSubmit={inviteSubmit}
              className="grid gap-3 border-t pt-5 sm:grid-cols-[1fr_150px_auto]"
            >
              <Input
                name="email"
                type="email"
                placeholder="persona@negocio.com"
                required
              />
              <NativeSelect name="role" defaultValue="staff">
                {data.saas.isPlatformAdmin ? (
                  <NativeSelectOption value="owner">
                    Propietario
                  </NativeSelectOption>
                ) : null}
                <NativeSelectOption value="admin">
                  Administrador
                </NativeSelectOption>
                <NativeSelectOption value="staff">Personal</NativeSelectOption>
                <NativeSelectOption value="viewer">
                  Solo lectura
                </NativeSelectOption>
              </NativeSelect>
              <Button type="submit" disabled={isPending}>
                <UserPlus data-icon="inline-start" />
                Invitar
              </Button>
              <fieldset className="flex flex-wrap gap-3 sm:col-span-3">
                <legend className="mb-2 text-xs font-semibold text-muted-foreground">
                  Sucursales permitidas
                </legend>
                {data.locations.map((location) => (
                  <label
                    key={location.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="locationIds"
                      value={location.id}
                      defaultChecked
                      className="size-4 accent-primary"
                    />
                    {location.name}
                  </label>
                ))}
              </fieldset>
            </form>
          ) : null}
          {data.saas.invitations
            .filter((invitation) => invitation.status === 'pending')
            .map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {invitation.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel(invitation.role)} · vence{' '}
                    {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                {canManage ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        runAction(() => resendInvitation(invitation.id))
                      }
                    >
                      Reenviar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() =>
                        runAction(() => revokeInvitation(invitation.id))
                      }
                    >
                      Revocar
                    </Button>
                  </>
                ) : null}
              </div>
            ))}
          {!data.integration.invitationEmailReady ? (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              El correo automático aún no está configurado. Las invitaciones
              creadas desde administración pueden copiarse y enviarse
              manualmente.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

function PlanView({ data }: { data: DashboardData }) {
  const subscription = data.saas.subscription;
  return (
    <>
      <PageHeading
        eyebrow="Suscripción del negocio"
        title="Mi plan"
        description="Consulta tus límites, consumo y capacidad para agregar usuarios o sucursales."
      />
      {subscription ? (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
          <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
            <CardHeader>
              <CardTitle>{subscription.plan.name}</CardTitle>
              <CardDescription>
                {subscription.plan.description ?? 'Suscripción del negocio'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <PlanLimit
                  label="Sucursales"
                  current={data.locations.length}
                  limit={subscription.plan.maxLocations}
                />
                <PlanLimit
                  label="Usuarios"
                  current={data.saas.members.length}
                  limit={subscription.plan.maxUsers}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {subscription.status === 'trialing'
                  ? `Periodo de prueba hasta ${formatDate(subscription.trialEndsAt ?? subscription.currentPeriodEnd)}.`
                  : `Vigencia hasta ${formatDate(subscription.currentPeriodEnd)}.`}
              </p>
              <Link href="/planes">
                <Button variant="outline">Comparar todos los planes</Button>
              </Link>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
            <CardHeader>
              <CardTitle>Consumo del periodo</CardTitle>
              <CardDescription>
                Se mide de forma independiente para este negocio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <UsageBar
                label="Conversaciones"
                value={data.saas.usage.conversations}
                limit={subscription.plan.maxConversations}
              />
              <UsageBar
                label="Solicitudes de IA"
                value={data.saas.usage.aiRequests}
                limit={subscription.plan.maxAiRequests}
              />
              <div className="rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
                Para cambiar de plan, solicita la modificación al administrador
                de Asistente H. Los cobros externos de Meta se administran por
                separado.
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Este negocio todavía no tiene un plan asociado.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function PlanLimit({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold">
        {current} / {limit}
      </p>
    </div>
  );
}

function IntegrationsView({
  data,
  runAction,
  isPending,
}: {
  data: DashboardData;
  runAction: (operation: () => Promise<ActionResult>) => void;
  isPending: boolean;
}) {
  const canManage =
    data.saas.isPlatformAdmin ||
    ['owner', 'admin'].includes(data.saas.activeOrganization?.role ?? '');
  const connected = data.saas.integrations.filter(
    (item) => item.status === 'connected',
  );
  const primaryWhatsapp = connected.find(
    (item) => item.provider === 'whatsapp' && item.locationId === null,
  );
  return (
    <>
      <PageHeading
        eyebrow="Canales del negocio"
        title="WhatsApp del negocio"
        description="Usa un número principal para todas las sedes. Los números exclusivos por sucursal son opcionales."
      />
      <div className="space-y-5">
        <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Conexión principal</CardTitle>
            <CardDescription>
              Este es el número que verá el cliente y atenderá todas las sedes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {primaryWhatsapp ? (
              <MetaEmbeddedSignup
                clinicId={data.clinic.id}
                locationId={null}
                locationName={data.clinic.name}
                connectionId={primaryWhatsapp.id}
                appId={data.integration.metaEmbeddedSignup.appId}
                configId={data.integration.metaEmbeddedSignup.configId}
                ready={data.integration.metaEmbeddedSignup.ready}
                secretStorageReady={
                  data.integration.metaEmbeddedSignup.secretStorageReady
                }
                connected
                phoneNumberId={primaryWhatsapp.phoneNumberId}
                scope="organization"
              />
            ) : canManage ? (
              <MetaEmbeddedSignup
                clinicId={data.clinic.id}
                locationId={null}
                locationName={data.clinic.name}
                appId={data.integration.metaEmbeddedSignup.appId}
                configId={data.integration.metaEmbeddedSignup.configId}
                ready={data.integration.metaEmbeddedSignup.ready}
                secretStorageReady={
                  data.integration.metaEmbeddedSignup.secretStorageReady
                }
                connected={false}
                phoneNumberId={null}
                scope="organization"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                El propietario todavía no conecta el WhatsApp principal.
              </p>
            )}
          </CardContent>
        </Card>

        <details className="group rounded-2xl border bg-card shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <summary
            className="cursor-pointer list-none px-6 py-5"
            aria-label="Mostrar configuración avanzada por sede"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Configuración avanzada por sede</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Agrega un número exclusivo o un calendario distinto sólo
                  cuando una sede lo necesite.
                </p>
              </div>
              <Badge variant="outline">Opcional</Badge>
            </div>
          </summary>
          <div className="space-y-4 border-t px-6 py-5">
            {data.locations.map((location) => {
              const locationConnections = connected.filter(
                (item) => item.locationId === location.id,
              );
              const whatsappOverride = locationConnections.find(
                (item) => item.provider === 'whatsapp',
              );
              const googleConnections = locationConnections.filter(
                (item) => item.provider === 'google_calendar',
              );
              return (
                <div key={location.id} className="rounded-xl border p-4">
                  <div className="mb-4">
                    <p className="font-semibold">{location.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {location.address ?? 'Dirección pendiente'}
                    </p>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">
                        Número exclusivo de la sede
                      </p>
                      {whatsappOverride ? (
                        <MetaEmbeddedSignup
                          clinicId={data.clinic.id}
                          locationId={location.id}
                          locationName={location.name}
                          connectionId={whatsappOverride.id}
                          appId={data.integration.metaEmbeddedSignup.appId}
                          configId={
                            data.integration.metaEmbeddedSignup.configId
                          }
                          ready={data.integration.metaEmbeddedSignup.ready}
                          secretStorageReady={
                            data.integration.metaEmbeddedSignup
                              .secretStorageReady
                          }
                          connected
                          phoneNumberId={whatsappOverride.phoneNumberId}
                        />
                      ) : canManage ? (
                        <MetaEmbeddedSignup
                          clinicId={data.clinic.id}
                          locationId={location.id}
                          locationName={location.name}
                          appId={data.integration.metaEmbeddedSignup.appId}
                          configId={
                            data.integration.metaEmbeddedSignup.configId
                          }
                          ready={data.integration.metaEmbeddedSignup.ready}
                          secretStorageReady={
                            data.integration.metaEmbeddedSignup
                              .secretStorageReady
                          }
                          connected={false}
                          phoneNumberId={null}
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Esta sede utiliza el WhatsApp principal.
                        </p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-semibold">
                        Calendario de Google
                      </p>
                      {googleConnections.map((connection) => (
                        <div
                          key={connection.id}
                          className="flex items-center gap-3 rounded-xl border p-3"
                        >
                          <CalendarDays className="size-4 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {connection.label ?? 'Google Calendar'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {connection.externalAccountId ?? 'primary'}
                            </p>
                          </div>
                          {canManage ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() =>
                                runAction(() =>
                                  disconnectGoogleCalendar(
                                    data.clinic.id,
                                    connection.id,
                                  ),
                                )
                              }
                            >
                              Desconectar
                            </Button>
                          ) : null}
                        </div>
                      ))}
                      {canManage ? (
                        <form
                          action="/api/google-calendar/connect"
                          method="get"
                          className="grid gap-2 rounded-xl border p-3"
                        >
                          <input
                            type="hidden"
                            name="clinicId"
                            value={data.clinic.id}
                          />
                          <input
                            type="hidden"
                            name="locationId"
                            value={location.id}
                          />
                          <Input
                            name="label"
                            defaultValue={`Agenda · ${location.name}`}
                            aria-label="Nombre de la conexión"
                            required
                          />
                          <Input
                            name="calendarId"
                            defaultValue="primary"
                            aria-label="Identificador del calendario"
                            required
                          />
                          <Button type="submit" variant="outline">
                            Conectar calendario
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </>
  );
}

function SettingsView({
  data,
  runAction,
  isPending,
}: {
  data: DashboardData;
  runAction: (operation: () => Promise<ActionResult>) => void;
  isPending: boolean;
}) {
  const canManage =
    ['owner', 'admin'].includes(data.saas.activeOrganization?.role ?? '') ||
    data.saas.isPlatformAdmin;
  const [hours, setHours] = useState(() =>
    Array.from(
      { length: 7 },
      (_, dayOfWeek) =>
        data.saas.hours.find((item) => item.dayOfWeek === dayOfWeek) ?? {
          id: `new-${dayOfWeek}`,
          dayOfWeek,
          opensAt: '09:00',
          closesAt: dayOfWeek === 6 ? '14:00' : '19:00',
          breakStart: null,
          breakEnd: null,
          active: dayOfWeek === 0 ? 0 : 1,
        },
    ),
  );
  const subscription = data.saas.subscription;

  function profileSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      updateOrganizationProfile({
        clinicId: data.clinic.id,
        name: formText(form, 'name'),
        phone: formText(form, 'phone'),
        address: formText(form, 'address'),
        timezone: formText(form, 'timezone'),
      }),
    );
  }

  function inviteSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      inviteMember({
        clinicId: data.clinic.id,
        email: formText(form, 'email'),
        role: formText(form, 'role') as 'owner' | 'admin' | 'staff' | 'viewer',
      }),
    );
  }

  function locationSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      createLocation({
        clinicId: data.clinic.id,
        name: formText(form, 'name'),
        address: formText(form, 'address'),
        phone: formText(form, 'phone'),
      }),
    );
  }

  function professionalSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      createProfessional({
        clinicId: data.clinic.id,
        name: formText(form, 'name'),
        email: formText(form, 'email'),
        specialty: formText(form, 'specialty'),
        locationId: formText(form, 'locationId'),
      }),
    );
  }

  function faqSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() =>
      createFaq({
        clinicId: data.clinic.id,
        question: formText(form, 'question'),
        answer: formText(form, 'answer'),
      }),
    );
    event.currentTarget.reset();
  }

  return (
    <>
      <PageHeading
        eyebrow="Operación multiempresa"
        title="Configuración"
        description="Administra el negocio, los horarios, el equipo, el plan y las conexiones."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Datos del negocio</CardTitle>
            <CardDescription>
              Información visible para pacientes y para el asistente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={profileSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="settings-name">Nombre</FieldLabel>
                  <Input
                    id="settings-name"
                    name="name"
                    defaultValue={data.clinic.name}
                    disabled={!canManage}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="settings-phone">Teléfono</FieldLabel>
                    <Input
                      id="settings-phone"
                      name="phone"
                      defaultValue={data.clinic.phone ?? ''}
                      disabled={!canManage}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="settings-timezone">
                      Zona horaria
                    </FieldLabel>
                    <NativeSelect
                      id="settings-timezone"
                      name="timezone"
                      defaultValue={data.clinic.timezone}
                      disabled={!canManage}
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
                </div>
                <Field>
                  <FieldLabel htmlFor="settings-address">Dirección</FieldLabel>
                  <Input
                    id="settings-address"
                    name="address"
                    defaultValue={data.clinic.address ?? ''}
                    disabled={!canManage}
                  />
                </Field>
                {canManage ? (
                  <Button type="submit" disabled={isPending}>
                    Guardar datos
                  </Button>
                ) : null}
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Plan y consumo</CardTitle>
            <CardDescription>
              Control mensual aplicado de forma independiente a esta
              organización.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {subscription ? (
              <>
                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Plan actual</p>
                    <p className="font-heading text-xl font-bold">
                      {subscription.plan.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {subscription.status === 'trialing'
                        ? `Prueba hasta ${formatDate(subscription.trialEndsAt ?? subscription.currentPeriodEnd)}`
                        : `Renueva ${formatDate(subscription.currentPeriodEnd)}`}
                    </p>
                  </div>
                  <Badge>
                    {subscription.status === 'trialing' ? 'Prueba' : 'Activo'}
                  </Badge>
                </div>
                <UsageBar
                  label="Solicitudes de IA"
                  value={data.saas.usage.aiRequests}
                  limit={subscription.plan.maxAiRequests}
                />
                <UsageBar
                  label="Conversaciones"
                  value={data.saas.usage.conversations}
                  limit={subscription.plan.maxConversations}
                />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Usuarios</p>
                    <p className="mt-1 font-bold">
                      {data.saas.members.length} / {subscription.plan.maxUsers}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Sedes</p>
                    <p className="mt-1 font-bold">
                      {data.locations.length} / {subscription.plan.maxLocations}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  La vigencia se activa cuando el administrador registra la
                  transferencia y el folio de factura en su centro de control.
                </p>
                {data.saas.paymentHistory.length ? (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Pagos registrados
                    </p>
                    {data.saas.paymentHistory.slice(0, 3).map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {money(payment.amountCents)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(payment.receivedAt)} ·{' '}
                            {payment.reference ?? 'Transferencia'}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {payment.invoiceFolio ?? 'Sin folio'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay una suscripción asociada.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Horarios de atención</CardTitle>
            <CardDescription>
              La agenda y la IA consultan estas reglas en tiempo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hours.map((item, index) => (
              <div
                key={item.dayOfWeek}
                className="grid grid-cols-[90px_44px_1fr_1fr] items-center gap-2"
              >
                <span className="text-sm font-medium">
                  {dayLabel(item.dayOfWeek)}
                </span>
                <Switch
                  aria-label={`Abrir ${dayLabel(item.dayOfWeek)}`}
                  checked={Boolean(item.active)}
                  disabled={!canManage}
                  onCheckedChange={(checked) =>
                    setHours((current) =>
                      current.map((value, valueIndex) =>
                        valueIndex === index
                          ? { ...value, active: checked ? 1 : 0 }
                          : value,
                      ),
                    )
                  }
                />
                <Input
                  aria-label={`Apertura ${dayLabel(item.dayOfWeek)}`}
                  type="time"
                  value={item.opensAt}
                  disabled={!canManage || !item.active}
                  onChange={(event) =>
                    setHours((current) =>
                      current.map((value, valueIndex) =>
                        valueIndex === index
                          ? { ...value, opensAt: event.target.value }
                          : value,
                      ),
                    )
                  }
                />
                <Input
                  aria-label={`Cierre ${dayLabel(item.dayOfWeek)}`}
                  type="time"
                  value={item.closesAt}
                  disabled={!canManage || !item.active}
                  onChange={(event) =>
                    setHours((current) =>
                      current.map((value, valueIndex) =>
                        valueIndex === index
                          ? { ...value, closesAt: event.target.value }
                          : value,
                      ),
                    )
                  }
                />
              </div>
            ))}
            {canManage ? (
              <Button
                disabled={isPending}
                onClick={() =>
                  runAction(() =>
                    updateBusinessHours(
                      data.clinic.id,
                      hours.map(({ dayOfWeek, opensAt, closesAt, active }) => ({
                        dayOfWeek,
                        opensAt,
                        closesAt,
                        active,
                      })),
                    ),
                  )
                }
              >
                Guardar horarios
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="hidden border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Equipo y permisos</CardTitle>
            <CardDescription>
              Propietarios, administradores, personal operativo y lectura.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.saas.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {initials(member.fullName ?? member.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {member.fullName ?? member.email}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
                <Badge variant="outline">{roleLabel(member.role)}</Badge>
              </div>
            ))}
            {canManage ? (
              <form
                onSubmit={inviteSubmit}
                className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-[1fr_130px_auto]"
              >
                <Input
                  aria-label="Correo del nuevo integrante"
                  name="email"
                  type="email"
                  placeholder="equipo@negocio.com"
                  required
                />
                <NativeSelect aria-label="Rol" name="role" defaultValue="staff">
                  {data.saas.isPlatformAdmin ? (
                    <NativeSelectOption value="owner">
                      Propietario
                    </NativeSelectOption>
                  ) : null}
                  <NativeSelectOption value="admin">
                    Administrador
                  </NativeSelectOption>
                  <NativeSelectOption value="staff">
                    Personal
                  </NativeSelectOption>
                  <NativeSelectOption value="viewer">
                    Lectura
                  </NativeSelectOption>
                </NativeSelect>
                <Button type="submit" disabled={isPending}>
                  <UserPlus data-icon="inline-start" />
                  Invitar
                </Button>
              </form>
            ) : null}
            {data.saas.invitations
              .filter((item) => item.status === 'pending')
              .map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex flex-col gap-3 rounded-xl border border-dashed p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {invitation.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel(invitation.role)} · vence{' '}
                      {formatDate(invitation.expiresAt)}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() =>
                          runAction(() => resendInvitation(invitation.id))
                        }
                      >
                        Reenviar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          runAction(() => revokeInvitation(invitation.id))
                        }
                      >
                        Revocar
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            {!data.integration.invitationEmailReady ? (
              <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                El flujo de invitación está listo, pero falta configurar el
                servicio de correo para enviar los enlaces automáticamente.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="hidden border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Sucursales y profesionales</CardTitle>
            <CardDescription>
              Estructura la agenda del negocio sin mezclar sedes ni
              responsables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              {data.locations.map((location) => (
                <div
                  key={location.id}
                  className="flex items-center gap-3 rounded-xl border p-3"
                >
                  <Building2 className="size-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{location.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {location.address ?? 'Sin dirección'}
                    </p>
                  </div>
                  <Badge variant="outline">Activa</Badge>
                </div>
              ))}
            </div>
            {canManage ? (
              <>
                <form
                  onSubmit={locationSubmit}
                  className="grid gap-2 border-t pt-4 sm:grid-cols-2"
                >
                  <Input
                    name="name"
                    placeholder="Nombre de sucursal"
                    required
                  />
                  <Input name="phone" placeholder="Teléfono" />
                  <Input
                    name="address"
                    placeholder="Dirección"
                    className="sm:col-span-2"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isPending}
                    className="sm:col-span-2"
                  >
                    Agregar sucursal
                  </Button>
                </form>
                <form
                  onSubmit={professionalSubmit}
                  className="grid gap-2 border-t pt-4 sm:grid-cols-2"
                >
                  <Input
                    name="name"
                    placeholder="Nombre del profesional"
                    required
                  />
                  <Input
                    name="specialty"
                    placeholder="Especialidad o función"
                  />
                  <Input name="email" type="email" placeholder="Correo" />
                  <NativeSelect name="locationId" className="w-full" required>
                    {data.locations.map((location) => (
                      <NativeSelectOption key={location.id} value={location.id}>
                        {location.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isPending}
                    className="sm:col-span-2"
                  >
                    Agregar profesional
                  </Button>
                </form>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="hidden border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Integraciones</CardTitle>
            <CardDescription>
              Gemini es administrado de forma central; Meta y Calendar se
              conectan por negocio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <IntegrationRow
              name="Gemini central"
              description="Una cuenta para todos los negocios; administrada por la plataforma"
              configured={data.integration.aiConfigured}
            />
            <IntegrationRow
              name="WhatsApp Cloud API"
              description="Número y cuenta empresarial de Meta"
              configured={data.integration.whatsappConfigured}
            />
            <IntegrationRow
              name="Google Calendar"
              description="Exportación activa y OAuth preparado"
              configured={data.integration.googleCalendarConfigured}
            />
            <IntegrationRow
              name="Base de datos aislada"
              description="Citas, pacientes y conversaciones por organización"
              configured
            />
            {canManage ? (
              <>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-sm font-semibold">Gemini central</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    La cuenta y la llave son administradas únicamente por
                    Asistente H. Este negocio consume su límite mensual sin ver
                    ni modificar la credencial global.
                  </p>
                </div>
                <MetaEmbeddedSignup
                  clinicId={data.clinic.id}
                  locationId={data.locations[0]?.id ?? ''}
                  locationName={data.locations[0]?.name ?? 'Sede principal'}
                  connectionId={
                    data.saas.integrations.find(
                      (item) =>
                        item.provider === 'whatsapp' &&
                        item.status === 'connected',
                    )?.id
                  }
                  appId={data.integration.metaEmbeddedSignup.appId}
                  configId={data.integration.metaEmbeddedSignup.configId}
                  ready={data.integration.metaEmbeddedSignup.ready}
                  secretStorageReady={
                    data.integration.metaEmbeddedSignup.secretStorageReady
                  }
                  connected={data.integration.whatsappConfigured}
                  phoneNumberId={
                    data.saas.integrations.find(
                      (item) => item.provider === 'whatsapp',
                    )?.phoneNumberId ?? null
                  }
                />
                <form
                  action="/api/google-calendar/connect"
                  method="get"
                  className="space-y-2 rounded-xl border p-3"
                >
                  <input type="hidden" name="clinicId" value={data.clinic.id} />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Google Calendar</p>
                    <Badge variant="outline">
                      {data.integration.googleCalendarConfigured
                        ? 'Conectado'
                        : 'Pendiente'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Autoriza a Asistente H para crear, mover y cancelar eventos
                    de citas. Usa “primary” para tu calendario principal.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <Input
                      name="calendarId"
                      defaultValue={
                        data.saas.integrations.find(
                          (item) => item.provider === 'google_calendar',
                        )?.externalAccountId ?? 'primary'
                      }
                      placeholder="primary o ID del calendario"
                      required
                    />
                    <Button type="submit" variant="outline">
                      {data.integration.googleCalendarConfigured
                        ? 'Reconectar'
                        : 'Conectar con Google'}
                    </Button>
                  </div>
                </form>
              </>
            ) : null}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-800">
              Los tokens de cada negocio se cifran en el servidor antes de
              guardarse. Cada organización conserva una credencial separada que
              nunca se muestra en el navegador.
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Base de conocimiento</CardTitle>
            <CardDescription>
              Respuestas revisadas y aisladas para este negocio.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.faqs.map((faq) => (
              <div key={faq.id} className="rounded-xl border p-3">
                <p className="text-sm font-semibold">{faq.question}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {faq.answer}
                </p>
              </div>
            ))}
            {!data.faqs.length ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay respuestas frecuentes configuradas.
              </p>
            ) : null}
            {canManage ? (
              <form onSubmit={faqSubmit} className="space-y-3 border-t pt-4">
                <Field>
                  <FieldLabel htmlFor="faq-question">Pregunta</FieldLabel>
                  <Input
                    id="faq-question"
                    name="question"
                    placeholder="¿Aceptan tarjeta?"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="faq-answer">Respuesta</FieldLabel>
                  <Textarea
                    id="faq-answer"
                    name="answer"
                    placeholder="Sí, aceptamos efectivo, tarjeta y transferencia."
                    rows={3}
                    required
                  />
                </Field>
                <Button type="submit" disabled={isPending}>
                  Agregar respuesta
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Seguridad y trazabilidad</CardTitle>
            <CardDescription>
              Controles activos en la arquitectura SaaS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow
              icon={ShieldCheck}
              label="Aislamiento"
              value="Todas las consultas y acciones validan organización y membresía"
            />
            <InfoRow
              icon={UserRound}
              label="Roles"
              value="Propietario, administrador, personal y solo lectura"
            />
            <InfoRow
              icon={FileText}
              label="Bitácora"
              value="Las modificaciones importantes registran al usuario responsable"
            />
            <InfoRow
              icon={Bot}
              label="Límites del asistente"
              value="No diagnostica, no receta y escala casos sensibles"
            />
            {canManage ? (
              <a
                href={`/api/export/backup?clinicId=${encodeURIComponent(data.clinic.id)}`}
                className="inline-flex h-9 w-full items-center justify-center rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted sm:w-auto"
              >
                <FileText className="mr-2 size-4" /> Descargar respaldo JSON
              </a>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
          <CardHeader>
            <CardTitle>Sesión</CardTitle>
            <CardDescription>
              Has iniciado sesión como {data.saas.user.displayName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/logout" method="post">
              <Button type="submit" variant="outline">
                <LogOut data-icon="inline-start" /> Cerrar sesión
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function UsageBar({
  label,
  value,
  limit,
}: {
  label: string;
  value: number;
  limit: number;
}) {
  const percentage = limit ? Math.min(100, (value / limit) * 100) : 0;
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {value.toLocaleString('es-MX')} / {limit.toLocaleString('es-MX')}
        </span>
      </div>
      <Progress value={percentage} />
    </div>
  );
}

function PlatformView({ data }: { data: DashboardData }) {
  const stats = data.saas.platformStats;
  if (!stats) return null;
  return (
    <>
      <PageHeading
        eyebrow="Administración SaaS"
        title="Plataforma"
        description="Vista global del producto; los datos operativos siguen aislados por organización."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          value={String(stats.organizations)}
          label="Organizaciones"
          detail="Negocios registrados"
        />
        <Metric
          value={String(stats.users)}
          label="Usuarios"
          detail="Identidades de la plataforma"
        />
        <Metric
          value={String(stats.activeSubscriptions)}
          label="Suscripciones activas"
          detail="Incluye periodos de prueba"
        />
        <Metric
          value={stats.aiRequests.toLocaleString('es-MX')}
          label="Solicitudes de IA"
          detail="Consumo histórico"
        />
      </div>
      <Card className="mt-5 border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]">
        <CardHeader>
          <CardTitle>Negocios administrados</CardTitle>
          <CardDescription>
            Cambia de organización para revisar su operación y configuración.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organización</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.saas.organizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell className="font-medium">
                    {organization.name}
                  </TableCell>
                  <TableCell>{organization.businessType}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {roleLabel(organization.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        window.location.assign(
                          `/app?organization=${encodeURIComponent(organization.id)}`,
                        )
                      }
                    >
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function IntegrationRow({
  name,
  description,
  configured,
}: {
  name: string;
  description: string;
  configured: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <div
        className={`grid size-9 place-items-center rounded-lg ${configured ? 'bg-[#e5f7f1] text-[#176d59]' : 'bg-stone-100 text-stone-500'}`}
      >
        {configured ? (
          <Wifi className="size-4" />
        ) : (
          <WifiOff className="size-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <Badge variant={configured ? 'default' : 'outline'}>
        {configured ? 'Lista' : 'Pendiente'}
      </Badge>
    </div>
  );
}
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Stethoscope;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function NewAppointmentDialog({
  open,
  setOpen,
  data,
  selectedLocationId,
  runAction,
  isPending,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  data: DashboardData;
  selectedLocationId: string;
  runAction: (
    operation: () => Promise<ActionResult>,
    onSuccess?: () => void,
  ) => void;
  isPending: boolean;
}) {
  const [locationId, setLocationId] = useState(
    selectedLocationId === 'all'
      ? (data.locations[0]?.id ?? '')
      : selectedLocationId,
  );
  const availableDoctors = data.doctors.filter(
    (doctor) => doctor.active && doctor.locationIds.includes(locationId),
  );
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(
      () =>
        createAppointment({
          clinicId: data.clinic.id,
          locationId: formText(form, 'locationId'),
          patientName: formText(form, 'patientName'),
          phone: formText(form, 'phone'),
          email: formText(form, 'email'),
          serviceId: formText(form, 'serviceId'),
          doctorId: formText(form, 'doctorId'),
          startsAtLocal: formText(form, 'startsAtLocal'),
          notes: formText(form, 'notes'),
          marketingOptIn: form.get('marketingOptIn') === 'on',
        }),
      () => setOpen(false),
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
          <DialogDescription>
            El sistema validará la duración y evitará traslapes antes de
            guardar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="appointmentLocationId">
                  Sucursal
                </FieldLabel>
                <NativeSelect
                  id="appointmentLocationId"
                  name="locationId"
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  required
                  className="w-full"
                >
                  {data.locations.map((location) => (
                    <NativeSelectOption key={location.id} value={location.id}>
                      {location.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="patientName">
                  Nombre del paciente
                </FieldLabel>
                <Input
                  id="patientName"
                  name="patientName"
                  required
                  placeholder="Nombre completo"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">WhatsApp</FieldLabel>
                <Input id="phone" name="phone" required placeholder="+52 55…" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="email">Correo opcional</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="paciente@correo.com"
              />
            </Field>
            <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
              <input
                className="mt-1 size-4 accent-primary"
                type="checkbox"
                name="marketingOptIn"
              />
              <span>
                El paciente autorizó recibir recordatorios y mensajes por
                WhatsApp. Registra esta opción sólo cuando exista
                consentimiento.
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="serviceId">Servicio</FieldLabel>
                <NativeSelect
                  id="serviceId"
                  name="serviceId"
                  required
                  className="w-full"
                >
                  {data.services
                    .filter((item) => item.active)
                    .map((service) => (
                      <NativeSelectOption key={service.id} value={service.id}>
                        {service.name} · {service.durationMinutes} min
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="doctorId">Profesional</FieldLabel>
                <NativeSelect
                  id="doctorId"
                  name="doctorId"
                  required
                  className="w-full"
                >
                  {availableDoctors.map((doctor) => (
                    <NativeSelectOption key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="startsAtLocal">Fecha y hora</FieldLabel>
              <Input
                id="startsAtLocal"
                name="startsAtLocal"
                type="datetime-local"
                defaultValue={defaultAppointmentDate(data.clinic.timezone)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notas internas</FieldLabel>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Información relevante para recepción"
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                isPending ||
                !data.services.some((item) => item.active) ||
                !availableDoctors.length ||
                !locationId
              }
            >
              {isPending ? 'Guardando…' : 'Crear cita'}
            </Button>
          </DialogFooter>
          {!data.services.some((item) => item.active) ? (
            <p className="mt-3 text-xs text-amber-700">
              Agrega al menos un servicio activo antes de crear una cita.
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewServiceDialog({
  open,
  setOpen,
  runAction,
  isPending,
  clinicId,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  runAction: (
    operation: () => Promise<ActionResult>,
    onSuccess?: () => void,
  ) => void;
  isPending: boolean;
  clinicId?: string;
}) {
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(
      () =>
        createService({
          clinicId: clinicId ?? '',
          name: formText(form, 'name'),
          category: formText(form, 'category'),
          durationMinutes: Number(formText(form, 'durationMinutes')),
          pricePesos: Number(formText(form, 'pricePesos')),
          description: formText(form, 'description'),
        }),
      () => setOpen(false),
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo servicio</DialogTitle>
          <DialogDescription>
            El precio y la duración quedarán disponibles para la agenda y la IA.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="serviceName">Nombre</FieldLabel>
                <Input id="serviceName" name="name" required />
              </Field>
              <Field>
                <FieldLabel htmlFor="category">Categoría</FieldLabel>
                <Input
                  id="category"
                  name="category"
                  defaultValue="General"
                  required
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="durationMinutes">
                  Duración en minutos
                </FieldLabel>
                <Input
                  id="durationMinutes"
                  name="durationMinutes"
                  type="number"
                  min="10"
                  step="5"
                  defaultValue="30"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="pricePesos">Precio en MXN</FieldLabel>
                <Input
                  id="pricePesos"
                  name="pricePesos"
                  type="number"
                  min="0"
                  step="50"
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="description">
                Descripción autorizada
              </FieldLabel>
              <Textarea id="description" name="description" required />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Agregar servicio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MobileNavigation({
  view,
  setView,
  unread,
}: {
  view: View;
  setView: (view: View) => void;
  unread: number;
}) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-background/95 px-1 py-1.5 backdrop-blur lg:hidden"
      aria-label="Navegación móvil"
    >
      {navigation
        .filter((item) =>
          ['agenda', 'inbox', 'patients', 'automation', 'settings'].includes(
            item.id,
          ),
        )
        .map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`relative flex flex-col items-center gap-1 rounded-lg py-1 text-[10px] ${view === item.id ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Icon className="size-5" />
              {item.label}
              {item.id === 'inbox' && unread ? (
                <span className="absolute right-[28%] top-0 grid size-4 place-items-center rounded-full bg-[#ef715f] text-[9px] text-white">
                  {unread}
                </span>
              ) : null}
            </button>
          );
        })}
    </nav>
  );
}

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}
function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'PA'
  );
}
function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || 'equipo';
}
function roleLabel(role?: string) {
  return (
    (
      {
        owner: 'Propietario',
        admin: 'Administrador',
        staff: 'Personal',
        viewer: 'Solo lectura',
      } as Record<string, string>
    )[role ?? ''] ?? 'Administrador'
  );
}
function automationLabel(kind: string) {
  return (
    (
      {
        reminder_24h: 'Recordatorio 24 horas antes',
        reminder_2h: 'Recordatorio 2 horas antes',
        follow_up: 'Seguimiento después de la cita',
        survey: 'Encuesta de satisfacción',
      } as Record<string, string>
    )[kind] ?? kind
  );
}
function dayLabel(day: number) {
  return (
    ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
      day
    ] ?? ''
  );
}
function defaultAppointmentDate(timeZone: string) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(
    new Date(),
  );
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return `${value.toISOString().slice(0, 10)}T10:00`;
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
function money(cents: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
