'use client';

import { type SyntheticEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';

import {
  createAppointment,
  createService,
  markConversationRead,
  sendConversationMessage,
  setAppointmentStatus,
  toggleBotPaused,
  toggleService,
  type ActionResult,
} from '@/app/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { AppointmentRecord, ConversationRecord, DashboardData, ServiceRecord } from '@/lib/dental-data';

type View = 'agenda' | 'inbox' | 'patients' | 'services' | 'analytics' | 'settings';

const navigation: Array<{ id: View; label: string; icon: typeof CalendarDays }> = [
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'inbox', label: 'Bandeja', icon: MessageCircle },
  { id: 'patients', label: 'Pacientes', icon: Users },
  { id: 'services', label: 'Servicios', icon: Stethoscope },
  { id: 'analytics', label: 'Analítica', icon: BarChart3 },
  { id: 'settings', label: 'Configuración', icon: Settings2 },
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
  const [isPending, startTransition] = useTransition();
  const unread = data.conversations.reduce((total, item) => total + item.unreadCount, 0);

  const runAction = (operation: () => Promise<ActionResult>, onSuccess?: () => void) => {
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
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = item.id === view;
              return (
                <button key={item.id} type="button" onClick={() => setView(item.id)} className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                  <Icon className="size-[18px]" />
                  <span>{item.label}</span>
                  {item.id === 'inbox' && unread ? <span className="ml-auto grid size-5 place-items-center rounded-full bg-[#ef715f] text-[11px] font-semibold text-white">{unread}</span> : null}
                </button>
              );
            })}
          </nav>
          <div className="mt-auto space-y-3">
            <Card className="border-0 bg-[#ecf8f4] shadow-none ring-0">
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-[#176d59]"><Bot className="size-4" /><span className="text-xs font-semibold">Asistente activo</span></div>
                <p className="text-xs leading-relaxed text-[#3d6e63]">Modo {data.integration.mode === 'demo' ? 'demostración segura' : 'producción'} · {data.conversations.length} conversaciones abiertas.</p>
                <Progress value={78} className="h-1.5 bg-white" />
              </CardContent>
            </Card>
            <div className="flex items-center gap-3 border-t border-sidebar-border px-2 pt-4">
              <div className="grid size-9 place-items-center rounded-full bg-[#dce8ff] text-xs font-bold text-[#405593]">DR</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Dra. Renata Díaz</p><p className="truncate text-xs text-muted-foreground">Administradora</p></div>
              <MoreHorizontal className="size-4 text-muted-foreground" />
            </div>
          </div>
        </aside>

        <section className="min-w-0 pb-20 lg:pb-0">
          <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
            <div className="lg:hidden"><Brand compact clinicName={data.clinic.name} /></div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Buscar"><Search /></Button>
              <Button variant="outline" size="icon" aria-label="Notificaciones" className="relative"><Bell />{unread ? <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#ef715f]" /> : null}</Button>
              <Button size="lg" className="ml-1 rounded-xl px-4 shadow-sm" onClick={() => setAppointmentOpen(true)}><Plus data-icon="inline-start" />Nueva cita</Button>
            </div>
          </header>

          <div className="px-4 py-6 md:px-8 md:py-8">
            {view === 'agenda' ? <AgendaView data={data} onOpenInbox={() => setView('inbox')} runAction={runAction} isPending={isPending} /> : null}
            {view === 'inbox' ? <InboxView conversations={data.conversations} runAction={runAction} isPending={isPending} /> : null}
            {view === 'patients' ? <PatientsView data={data} /> : null}
            {view === 'services' ? <ServicesView services={data.services} onAdd={() => setServiceOpen(true)} runAction={runAction} /> : null}
            {view === 'analytics' ? <AnalyticsView data={data} /> : null}
            {view === 'settings' ? <SettingsView data={data} /> : null}
          </div>
        </section>
      </div>

      <MobileNavigation view={view} setView={setView} unread={unread} />
      <NewAppointmentDialog open={appointmentOpen} setOpen={setAppointmentOpen} data={data} runAction={runAction} isPending={isPending} />
      <NewServiceDialog open={serviceOpen} setOpen={setServiceOpen} runAction={runAction} isPending={isPending} />
      {notice ? <output className={`fixed bottom-20 right-4 z-[80] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-xl lg:bottom-5 ${notice.ok ? 'border-[#bfe8dc] bg-[#effaf7] text-[#176d59]' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.message}</output> : null}
    </main>
  );
}

function Brand({ clinicName, compact = false }: { clinicName: string; compact?: boolean }) {
  return <div className="flex items-center gap-3 px-2"><div className="grid size-10 place-items-center rounded-[14px] bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-5" /></div>{compact ? <span className="font-heading text-lg font-bold">Dento AI</span> : <div><p className="font-heading text-lg font-bold tracking-[-0.03em]">Dento AI</p><p className="text-xs text-muted-foreground">{clinicName}</p></div>}</div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-sm font-medium text-primary">{eyebrow}</p><h1 className="font-heading text-3xl font-bold tracking-[-0.04em] md:text-[36px]">{title}</h1><p className="mt-1.5 text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}

function AgendaView({ data, onOpenInbox, runAction, isPending }: { data: DashboardData; onOpenInbox: () => void; runAction: (operation: () => Promise<ActionResult>) => void; isPending: boolean }) {
  const todayAppointments = data.appointments.filter((item) => item.startsAt.startsWith('2026-08-31'));
  const confirmed = todayAppointments.filter((item) => item.status === 'confirmed').length;
  const pending = todayAppointments.filter((item) => item.status === 'pending').length;
  return <>
    <PageHeading eyebrow="Lunes, 31 de agosto" title="Buenos días, Renata" description={`Tu agenda está al día. Tienes ${todayAppointments.length} citas programadas.`} action={<div className="flex items-center gap-2 rounded-xl border bg-card p-1"><Button variant="ghost" size="sm">Día</Button><Button variant="secondary" size="sm" className="shadow-sm">Semana</Button><Button variant="ghost" size="sm">Mes</Button></div>} />
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric value={String(todayAppointments.length)} label="Citas de hoy" detail="Agenda activa" />
      <Metric value={String(confirmed)} label="Confirmadas" detail={`${todayAppointments.length ? Math.round((confirmed / todayAppointments.length) * 100) : 0}% de la agenda`} />
      <Metric value={String(pending)} label="Por confirmar" detail="Requieren atención" warning />
      <Metric value="86%" label="Ocupación" detail="6 h 25 min reservadas" />
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
        <CardHeader className="border-b border-border/70 pb-4"><CardTitle>Agenda de hoy</CardTitle><CardDescription>Todos los doctores · horario local</CardDescription><CardAction><Button variant="ghost" size="sm">Ver calendario <ChevronRight data-icon="inline-end" /></Button></CardAction></CardHeader>
        <CardContent className="divide-y divide-border/70">
          {todayAppointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onStatus={(status) => runAction(() => setAppointmentStatus(appointment.id, status))} disabled={isPending} />)}
          {!todayAppointments.length ? <p className="py-10 text-center text-sm text-muted-foreground">No hay citas para este día.</p> : null}
        </CardContent>
      </Card>
      <AssistantCard data={data} onOpenInbox={onOpenInbox} />
    </div>
  </>;
}

function Metric({ value, label, detail, warning = false }: { value: string; label: string; detail: string; warning?: boolean }) {
  return <Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]"><CardContent><div className="flex items-start justify-between"><div><p className="font-heading text-2xl font-bold tracking-tight">{value}</p><p className="mt-0.5 text-sm font-medium">{label}</p></div><div className={`grid size-8 place-items-center rounded-lg ${warning ? 'bg-[#fff3d8] text-[#a56b00]' : 'bg-primary/10 text-primary'}`}>{warning ? <Clock3 className="size-4" /> : <CheckCircle2 className="size-4" />}</div></div><p className="mt-3 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function AppointmentRow({ appointment, onStatus, disabled }: { appointment: AppointmentRecord; onStatus: (status: string) => void; disabled: boolean }) {
  return <div className="grid grid-cols-[64px_1fr] items-center gap-3 py-4 sm:grid-cols-[78px_42px_1fr_auto]">
    <div><p className="text-sm font-bold tabular-nums">{formatTime(appointment.startsAt)}</p><p className="text-[11px] text-muted-foreground">{formatTime(appointment.endsAt)}</p></div>
    <div className="hidden size-10 place-items-center rounded-full text-xs font-bold sm:grid" style={{ backgroundColor: `${appointment.doctorColor}22`, color: appointment.doctorColor }}>{initials(appointment.patientName)}</div>
    <div className="min-w-0"><p className="truncate text-sm font-semibold">{appointment.patientName}</p><p className="truncate text-xs text-muted-foreground">{appointment.serviceName} · {appointment.doctorName}</p></div>
    <NativeSelect size="sm" value={appointment.status} disabled={disabled} onChange={(event) => onStatus(event.target.value)} className="col-start-2 w-full sm:col-start-auto sm:w-[132px]">
      {Object.entries(statusLabels).map(([value, label]) => <NativeSelectOption key={value} value={value}>{label}</NativeSelectOption>)}
    </NativeSelect>
  </div>;
}

function AssistantCard({ data, onOpenInbox }: { data: DashboardData; onOpenInbox: () => void }) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; body: string }>>([
    { role: 'user', body: '¿Cuánto cuesta una limpieza y tienen horario mañana?' },
    { role: 'assistant', body: 'La limpieza tiene un costo de $850. Puedo consultar los horarios reales para mañana.' },
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
      const response = await fetch('/api/assistant/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      const result = await response.json() as { reply?: string; error?: string };
      setMessages((current) => [...current, { role: 'assistant', body: result.reply ?? result.error ?? 'No pude responder en este momento.' }]);
    } finally { setLoading(false); }
  }
  return <Card className="border-0 bg-[#173b34] text-white shadow-[0_14px_40px_rgb(19_55_47/18%)] ring-0">
    <CardHeader className="border-b border-white/10 pb-4"><div className="mb-2 flex items-center gap-2"><div className="grid size-9 place-items-center rounded-xl bg-white/10"><Bot className="size-[18px] text-[#78dfc1]" /></div><Badge className="bg-[#2e9b7f] text-white">{data.integration.openAiConfigured ? 'IA conectada' : 'Modo demo'}</Badge></div><CardTitle className="text-white">Prueba la recepción con IA</CardTitle><CardDescription className="text-white/60">Consulta costos, servicios o disponibilidad</CardDescription></CardHeader>
    <CardContent className="space-y-3">
      <div className="max-h-[250px] space-y-3 overflow-y-auto pr-1">{messages.slice(-5).map((message, index) => <div key={`${message.role}-${index}`} className={message.role === 'assistant' ? 'ml-7 rounded-2xl rounded-br-md bg-[#eafaf5] p-3 text-xs leading-relaxed text-[#173b34]' : 'mr-7 rounded-2xl rounded-bl-md bg-white/10 p-3 text-xs leading-relaxed text-white/75'}>{message.body}</div>)}</div>
      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 pt-3"><Input aria-label="Mensaje de prueba" value={text} onChange={(event) => setText(event.target.value)} placeholder="Pregunta como paciente…" className="border-white/15 bg-white/10 text-white placeholder:text-white/40" /><Button type="submit" size="icon" variant="secondary" disabled={loading} aria-label="Enviar"><Send /></Button></form>
      <div className="flex items-center gap-2 text-[11px] text-white/45"><span className="size-1.5 rounded-full bg-[#78dfc1]" />{data.integration.openAiConfigured ? 'Respuestas generadas con herramientas controladas' : 'Simulador seguro sin credenciales externas'}</div>
      <Button variant="secondary" className="w-full bg-white text-[#173b34] hover:bg-white/90" onClick={onOpenInbox}>Abrir bandeja</Button>
    </CardContent>
  </Card>;
}

function InboxView({ conversations, runAction, isPending }: { conversations: ConversationRecord[]; runAction: (operation: () => Promise<ActionResult>) => void; isPending: boolean }) {
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? '');
  const selected = conversations.find((item) => item.id === selectedId) ?? conversations[0];
  const [message, setMessage] = useState('');
  if (!selected) return <p>No hay conversaciones.</p>;
  function choose(id: string) { setSelectedId(id); void markConversationRead(id); }
  function submit(event: SyntheticEvent<HTMLFormElement>) { event.preventDefault(); const body = message.trim(); if (!body) return; runAction(() => sendConversationMessage(selected.id, body)); setMessage(''); }
  return <>
    <PageHeading eyebrow="WhatsApp" title="Bandeja de conversaciones" description="La IA y tu equipo trabajando en el mismo lugar." />
    <Card className="min-h-[620px] overflow-hidden border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]">
      <div className="grid min-h-[620px] md:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="border-b border-border md:border-b-0 md:border-r"><div className="border-b p-3"><div className="relative"><Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" /><Input aria-label="Buscar conversación" placeholder="Buscar conversación" className="pl-8" /></div></div><div className="max-h-[555px] overflow-y-auto">{conversations.map((conversation) => <button aria-label={`Abrir conversación con ${conversation.patientName}`} key={conversation.id} type="button" onClick={() => choose(conversation.id)} className={`w-full border-b p-4 text-left transition-colors ${conversation.id === selected.id ? 'bg-primary/8' : 'hover:bg-muted/50'}`}><div className="flex items-start gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(conversation.patientName)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{conversation.patientName}</p><span className="text-[10px] text-muted-foreground">{formatTime(conversation.lastMessageAt)}</span></div><p className="mt-1 truncate text-xs text-muted-foreground">{conversation.lastMessage}</p><div className="mt-2 flex items-center gap-1.5">{conversation.botPaused ? <Badge variant="outline" className="text-[10px]">Atención humana</Badge> : <Badge className="bg-[#e5f7f1] text-[10px] text-[#176d59]">IA activa</Badge>}{conversation.unreadCount ? <span className="ml-auto grid size-5 place-items-center rounded-full bg-primary text-[10px] text-white">{conversation.unreadCount}</span> : null}</div></div></div></button>)}</div></aside>
        <section className="flex min-w-0 flex-col"><header className="flex items-center gap-3 border-b p-4"><div className="grid size-10 place-items-center rounded-full bg-[#dce8ff] text-xs font-bold text-[#405593]">{initials(selected.patientName)}</div><div className="min-w-0 flex-1"><p className="font-semibold">{selected.patientName}</p><p className="text-xs text-muted-foreground">{selected.patientPhone ?? 'Sin teléfono'} · WhatsApp</p></div><div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{selected.botPaused ? 'Tomada por el equipo' : 'Atiende la IA'}</span><Switch aria-label="Activar o pausar la IA para esta conversación" checked={!selected.botPaused} onCheckedChange={(checked) => runAction(() => toggleBotPaused(selected.id, !checked))} disabled={isPending} /></div></header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fbfa] p-4 md:p-6">{selected.messages.map((item) => <div key={item.id} className={`flex ${item.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${item.direction === 'outbound' ? 'rounded-br-md bg-[#dff7ef] text-[#173b34]' : 'rounded-bl-md bg-white'}`}><p>{item.body}</p><p className="mt-1 text-right text-[10px] opacity-50">{item.authorType === 'assistant' ? 'IA · ' : ''}{formatTime(item.createdAt)}</p></div></div>)}</div>
          <form onSubmit={submit} className="border-t bg-card p-3"><div className="flex gap-2"><Input aria-label="Respuesta al paciente" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe una respuesta…" /><Button type="submit" disabled={isPending}><Send data-icon="inline-start" />Enviar</Button></div><p className="mt-2 text-[10px] text-muted-foreground">Fuera de la ventana de 24 horas se requiere una plantilla aprobada de Meta.</p></form>
        </section>
      </div>
    </Card>
  </>;
}

function PatientsView({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState('');
  const patients = data.patients.filter((patient) => `${patient.fullName} ${patient.phone} ${patient.email ?? ''}`.toLocaleLowerCase('es-MX').includes(query.toLocaleLowerCase('es-MX')));
  return <><PageHeading eyebrow="Directorio" title="Pacientes" description={`${data.patients.length} pacientes registrados en ${data.clinic.name}.`} action={<Button variant="outline"><Plus data-icon="inline-start" />Agregar paciente</Button>} /><Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]"><CardHeader className="border-b"><CardTitle>Directorio de pacientes</CardTitle><CardDescription>Datos de contacto y actividad de citas.</CardDescription><CardAction><div className="relative"><Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" /><Input aria-label="Buscar paciente" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" className="w-[220px] pl-8" /></div></CardAction></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Paciente</TableHead><TableHead>Teléfono</TableHead><TableHead>Correo</TableHead><TableHead>Citas</TableHead><TableHead>Última visita</TableHead></TableRow></TableHeader><TableBody>{patients.map((patient) => <TableRow key={patient.id}><TableCell><div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(patient.fullName)}</div><div><p className="font-medium">{patient.fullName}</p>{patient.notes ? <p className="max-w-[240px] truncate text-xs text-muted-foreground">{patient.notes}</p> : null}</div></div></TableCell><TableCell>{patient.phone}</TableCell><TableCell className="text-muted-foreground">{patient.email ?? '—'}</TableCell><TableCell><Badge variant="secondary">{patient.appointmentCount}</Badge></TableCell><TableCell>{patient.lastVisitAt ? formatDate(patient.lastVisitAt) : 'Paciente nuevo'}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card></>;
}

function ServicesView({ services, onAdd, runAction }: { services: ServiceRecord[]; onAdd: () => void; runAction: (operation: () => Promise<ActionResult>) => void }) {
  return <><PageHeading eyebrow="Catálogo autorizado" title="Servicios y precios" description="Esta información es la única que la IA puede cotizar a los pacientes." action={<Button onClick={onAdd}><Plus data-icon="inline-start" />Nuevo servicio</Button>} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{services.map((service) => <Card key={service.id} className={`border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)] ${service.active ? '' : 'opacity-60'}`}><CardHeader><div className="mb-3 flex items-center justify-between"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Stethoscope className="size-5" /></div><Switch aria-label={`${service.active ? 'Desactivar' : 'Activar'} ${service.name}`} checked={service.active === 1} onCheckedChange={(checked) => runAction(() => toggleService(service.id, checked))} /></div><CardTitle>{service.name}</CardTitle><CardDescription>{service.category}</CardDescription></CardHeader><CardContent><p className="min-h-10 text-sm text-muted-foreground">{service.description}</p><div className="mt-5 flex items-end justify-between border-t pt-4"><div><p className="font-heading text-2xl font-bold">{money(service.priceCents)}</p><p className="text-xs text-muted-foreground">Precio vigente</p></div><Badge variant="outline"><Clock3 data-icon="inline-start" />{service.durationMinutes} min</Badge></div></CardContent></Card>)}</div></>;
}

function AnalyticsView({ data }: { data: DashboardData }) {
  const total = data.appointments.length;
  const confirmed = data.appointments.filter((item) => item.status === 'confirmed').length;
  const fromWhatsapp = data.appointments.filter((item) => item.source === 'whatsapp').length;
  const revenue = data.appointments.filter((item) => item.status !== 'cancelled').reduce((sum, item) => sum + (data.services.find((service) => service.id === item.serviceId)?.priceCents ?? 0), 0);
  const serviceStats = data.services.map((service) => ({ ...service, count: data.appointments.filter((item) => item.serviceId === service.id).length })).sort((a, b) => b.count - a.count);
  return <><PageHeading eyebrow="Rendimiento" title="Analítica del consultorio" description="Indicadores para medir agenda, automatización y conversión." /><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric value={String(total)} label="Citas registradas" detail="Periodo de demostración" /><Metric value={`${total ? Math.round((confirmed / total) * 100) : 0}%`} label="Confirmación" detail={`${confirmed} citas confirmadas`} /><Metric value={`${total ? Math.round((fromWhatsapp / total) * 100) : 0}%`} label="Origen WhatsApp" detail={`${fromWhatsapp} generadas por el canal`} /><Metric value={money(revenue)} label="Valor agendado" detail="Estimado según catálogo" /></div><div className="grid gap-5 xl:grid-cols-2"><Card className="border-0 shadow-[0_12px_40px_rgb(26_52_45/6%)]"><CardHeader><CardTitle>Servicios más solicitados</CardTitle><CardDescription>Participación en la agenda registrada</CardDescription></CardHeader><CardContent className="space-y-5">{serviceStats.map((service) => <div key={service.id}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{service.name}</span><span className="text-muted-foreground">{service.count} citas</span></div><Progress value={total ? (service.count / total) * 100 : 0} /></div>)}</CardContent></Card><Card className="border-0 bg-[#173b34] text-white ring-0"><CardHeader><CardTitle className="text-white">Automatización</CardTitle><CardDescription className="text-white/60">Impacto esperado durante el piloto</CardDescription></CardHeader><CardContent className="space-y-5"><AutomationItem icon={Bot} value="70%" label="Meta de conversaciones resueltas sin intervención" /><AutomationItem icon={Clock3} value="< 10 s" label="Meta de tiempo para la primera respuesta" /><AutomationItem icon={CheckCircle2} value="0" label="Tolerancia a dobles reservaciones" /><AutomationItem icon={Activity} value="24/7" label="Disponibilidad del canal automatizado" /></CardContent></Card></div></>;
}

function AutomationItem({ icon: Icon, value, label }: { icon: typeof Bot; value: string; label: string }) { return <div className="flex items-center gap-4"><div className="grid size-10 place-items-center rounded-xl bg-white/10 text-[#78dfc1]"><Icon className="size-5" /></div><div><p className="font-heading text-xl font-bold">{value}</p><p className="text-xs text-white/55">{label}</p></div></div>; }

function SettingsView({ data }: { data: DashboardData }) {
  return <><PageHeading eyebrow="Operación" title="Configuración" description="Estado de conexiones, datos de la clínica y reglas del asistente." /><div className="grid gap-5 xl:grid-cols-[1fr_1fr]"><Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]"><CardHeader><CardTitle>Integraciones</CardTitle><CardDescription>Credenciales externas necesarias para operar en producción.</CardDescription></CardHeader><CardContent className="space-y-3"><IntegrationRow name="OpenAI Responses API" description="Comprensión, conversación y llamadas a herramientas" configured={data.integration.openAiConfigured} /><IntegrationRow name="WhatsApp Cloud API" description="Recepción y envío de mensajes de Meta" configured={data.integration.whatsappConfigured} /><IntegrationRow name="Base de datos" description="Persistencia de citas, pacientes y conversaciones" configured /><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">La versión actual funciona en modo demo. Al agregar secretos, el mismo código activa las conexiones reales sin exponer llaves en el navegador.</div></CardContent></Card><Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]"><CardHeader><CardTitle>Datos del consultorio</CardTitle><CardDescription>Información que el asistente puede compartir.</CardDescription></CardHeader><CardContent className="space-y-4"><InfoRow icon={Stethoscope} label="Consultorio" value={data.clinic.name} /><InfoRow icon={MapPin} label="Dirección" value={data.clinic.address ?? 'Pendiente'} /><InfoRow icon={MessageCircle} label="Teléfono" value={data.clinic.phone ?? 'Pendiente'} /><InfoRow icon={Clock3} label="Zona horaria" value={data.clinic.timezone} /></CardContent></Card><Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]"><CardHeader><CardTitle>Base de conocimiento</CardTitle><CardDescription>Respuestas revisadas por el consultorio.</CardDescription></CardHeader><CardContent className="space-y-3">{data.faqs.map((faq) => <div key={faq.id} className="rounded-xl border p-3"><p className="text-sm font-semibold">{faq.question}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{faq.answer}</p></div>)}</CardContent></Card><Card className="border-0 shadow-[0_8px_30px_rgb(26_52_45/5%)]"><CardHeader><CardTitle>Seguridad clínica</CardTitle><CardDescription>Reglas aplicadas en el diseño del producto.</CardDescription></CardHeader><CardContent className="space-y-4"><InfoRow icon={ShieldCheck} label="Datos mínimos" value="La IA no recibe expedientes clínicos completos" /><InfoRow icon={UserRound} label="Escalamiento" value="El equipo puede tomar control en cualquier momento" /><InfoRow icon={FileText} label="Trazabilidad" value="Las modificaciones importantes generan bitácora" /><InfoRow icon={Bot} label="Límites médicos" value="El asistente no diagnostica ni receta medicamentos" /></CardContent></Card></div></>;
}

function IntegrationRow({ name, description, configured }: { name: string; description: string; configured: boolean }) { return <div className="flex items-center gap-3 rounded-xl border p-3"><div className={`grid size-9 place-items-center rounded-lg ${configured ? 'bg-[#e5f7f1] text-[#176d59]' : 'bg-stone-100 text-stone-500'}`}>{configured ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{name}</p><p className="truncate text-xs text-muted-foreground">{description}</p></div><Badge variant={configured ? 'default' : 'outline'}>{configured ? 'Lista' : 'Pendiente'}</Badge></div>; }
function InfoRow({ icon: Icon, label, value }: { icon: typeof Stethoscope; label: string; value: string }) { return <div className="flex items-start gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></div><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div></div>; }

function NewAppointmentDialog({ open, setOpen, data, runAction, isPending }: { open: boolean; setOpen: (open: boolean) => void; data: DashboardData; runAction: (operation: () => Promise<ActionResult>, onSuccess?: () => void) => void; isPending: boolean }) {
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction(() => createAppointment({ patientName: formText(form, 'patientName'), phone: formText(form, 'phone'), email: formText(form, 'email'), serviceId: formText(form, 'serviceId'), doctorId: formText(form, 'doctorId'), startsAtLocal: formText(form, 'startsAtLocal'), notes: formText(form, 'notes') }), () => setOpen(false));
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Nueva cita</DialogTitle><DialogDescription>El sistema validará la duración y evitará traslapes antes de guardar.</DialogDescription></DialogHeader><form onSubmit={submit}><FieldGroup><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="patientName">Nombre del paciente</FieldLabel><Input id="patientName" name="patientName" required placeholder="Nombre completo" /></Field><Field><FieldLabel htmlFor="phone">WhatsApp</FieldLabel><Input id="phone" name="phone" required placeholder="+52 55…" /></Field></div><Field><FieldLabel htmlFor="email">Correo opcional</FieldLabel><Input id="email" name="email" type="email" placeholder="paciente@correo.com" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="serviceId">Servicio</FieldLabel><NativeSelect id="serviceId" name="serviceId" required className="w-full">{data.services.filter((item) => item.active).map((service) => <NativeSelectOption key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor="doctorId">Doctor</FieldLabel><NativeSelect id="doctorId" name="doctorId" required className="w-full">{data.doctors.filter((item) => item.active).map((doctor) => <NativeSelectOption key={doctor.id} value={doctor.id}>{doctor.name}</NativeSelectOption>)}</NativeSelect></Field></div><Field><FieldLabel htmlFor="startsAtLocal">Fecha y hora</FieldLabel><Input id="startsAtLocal" name="startsAtLocal" type="datetime-local" defaultValue="2026-09-01T10:00" required /></Field><Field><FieldLabel htmlFor="notes">Notas internas</FieldLabel><Textarea id="notes" name="notes" placeholder="Información relevante para recepción" /></Field></FieldGroup><DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={isPending}>{isPending ? 'Guardando…' : 'Crear cita'}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function NewServiceDialog({ open, setOpen, runAction, isPending }: { open: boolean; setOpen: (open: boolean) => void; runAction: (operation: () => Promise<ActionResult>, onSuccess?: () => void) => void; isPending: boolean }) {
  function submit(event: SyntheticEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); runAction(() => createService({ name: formText(form, 'name'), category: formText(form, 'category'), durationMinutes: Number(formText(form, 'durationMinutes')), pricePesos: Number(formText(form, 'pricePesos')), description: formText(form, 'description') }), () => setOpen(false)); }
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Nuevo servicio</DialogTitle><DialogDescription>El precio y la duración quedarán disponibles para la agenda y la IA.</DialogDescription></DialogHeader><form onSubmit={submit}><FieldGroup><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="serviceName">Nombre</FieldLabel><Input id="serviceName" name="name" required /></Field><Field><FieldLabel htmlFor="category">Categoría</FieldLabel><Input id="category" name="category" defaultValue="General" required /></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="durationMinutes">Duración en minutos</FieldLabel><Input id="durationMinutes" name="durationMinutes" type="number" min="10" step="5" defaultValue="30" required /></Field><Field><FieldLabel htmlFor="pricePesos">Precio en MXN</FieldLabel><Input id="pricePesos" name="pricePesos" type="number" min="0" step="50" required /></Field></div><Field><FieldLabel htmlFor="description">Descripción autorizada</FieldLabel><Textarea id="description" name="description" required /></Field></FieldGroup><DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={isPending}>{isPending ? 'Guardando…' : 'Agregar servicio'}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function MobileNavigation({ view, setView, unread }: { view: View; setView: (view: View) => void; unread: number }) { return <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-background/95 px-1 py-1.5 backdrop-blur lg:hidden" aria-label="Navegación móvil">{navigation.slice(0, 5).map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setView(item.id)} className={`relative flex flex-col items-center gap-1 rounded-lg py-1 text-[10px] ${view === item.id ? 'text-primary' : 'text-muted-foreground'}`}><Icon className="size-5" />{item.label}{item.id === 'inbox' && unread ? <span className="absolute right-[28%] top-0 grid size-4 place-items-center rounded-full bg-[#ef715f] text-[9px] text-white">{unread}</span> : null}</button>; })}</nav>; }

function formText(form: FormData, key: string) { const value = form.get(key); return typeof value === 'string' ? value : ''; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'PA'; }
function formatTime(value: string) { return new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }
function money(cents: number) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cents / 100); }
