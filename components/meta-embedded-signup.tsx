'use client';

import {
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Clipboard,
  KeyRound,
  Link2,
  RefreshCw,
  Unplug,
} from 'lucide-react';

import {
  connectCustomerMetaApp,
  completeMetaEmbeddedSignup,
  disconnectMetaWhatsApp,
  getCustomerMetaWebhookSetup,
  testMetaConnection,
  type MetaActionResult,
} from '@/app/meta-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: { code?: string };
          status?: string;
        }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type SessionInfo = { wabaId: string; phoneNumberId: string };

export function MetaEmbeddedSignup({
  clinicId,
  locationId,
  locationName,
  connectionId,
  appId,
  configId,
  ready,
  secretStorageReady,
  connected,
  phoneNumberId,
  scope = 'location',
}: {
  clinicId: string;
  locationId: string | null;
  locationName: string;
  connectionId?: string;
  appId: string | null;
  configId: string | null;
  ready: boolean;
  secretStorageReady: boolean;
  connected: boolean;
  phoneNumberId: string | null;
  scope?: 'organization' | 'location';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sdkReady, setSdkReady] = useState(Boolean(windowSafeFb()));
  const [notice, setNotice] = useState<MetaActionResult | null>(null);
  const [setup, setSetup] = useState<MetaActionResult['setup']>(undefined);
  const [authorizationCode, setAuthorizationCode] = useState<string | null>(
    null,
  );
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const completing = useRef(false);
  const fieldIdPrefix = `meta-${clinicId}-${locationId ?? 'organization'}`;

  useEffect(() => {
    if (!appId || !configId) return;
    const markSdkReady = () => setSdkReady(Boolean(window.FB));
    const initialize = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v23.0',
      });
      markSdkReady();
      window.dispatchEvent(new Event('meta-facebook-sdk-ready'));
    };
    window.addEventListener('meta-facebook-sdk-ready', markSdkReady);
    window.fbAsyncInit = initialize;
    if (window.FB) initialize();
    else if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://connect.facebook.net/es_LA/sdk.js';
      document.body.appendChild(script);
    }
    return () => {
      window.removeEventListener('meta-facebook-sdk-ready', markSdkReady);
    };
  }, [appId, configId]);

  useEffect(() => {
    function receiveMessage(event: MessageEvent) {
      if (!isFacebookOrigin(event.origin)) return;
      let payload: unknown = event.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      if (!isEmbeddedSignupFinish(payload)) return;
      setSessionInfo({
        wabaId: payload.data.waba_id,
        phoneNumberId: payload.data.phone_number_id,
      });
    }
    window.addEventListener('message', receiveMessage);
    return () => window.removeEventListener('message', receiveMessage);
  }, []);

  useEffect(() => {
    if (!authorizationCode || !sessionInfo || completing.current) return;
    completing.current = true;
    startTransition(async () => {
      const result = await completeMetaEmbeddedSignup({
        clinicId,
        locationId,
        label:
          scope === 'organization'
            ? 'WhatsApp principal'
            : `WhatsApp · ${locationName}`,
        code: authorizationCode,
        wabaId: sessionInfo.wabaId,
        phoneNumberId: sessionInfo.phoneNumberId,
      });
      setNotice(result);
      completing.current = false;
      setAuthorizationCode(null);
      setSessionInfo(null);
      if (result.ok) router.refresh();
    });
  }, [
    authorizationCode,
    clinicId,
    locationId,
    locationName,
    router,
    scope,
    sessionInfo,
  ]);

  function connect() {
    setNotice(null);
    if (!ready || !configId || !window.FB) {
      setNotice({
        ok: false,
        message:
          'La aplicación de Meta y el cifrado de credenciales todavía no están configurados.',
      });
      return;
    }
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (code) setAuthorizationCode(code);
        else
          setNotice({
            ok: false,
            message:
              'La autorización de Meta fue cancelada o quedó incompleta.',
          });
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      },
    );
  }

  function run(operation: () => Promise<MetaActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const result = await operation();
      setNotice(result);
      if (result.setup) setSetup(result.setup);
      if (result.ok) router.refresh();
    });
  }

  function connectManual(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setNotice(null);
    setSetup(undefined);
    const form = event.currentTarget;
    const values = new FormData(form);
    startTransition(async () => {
      const result = await connectCustomerMetaApp({
        clinicId,
        locationId,
        label:
          scope === 'organization'
            ? 'WhatsApp principal'
            : `WhatsApp · ${locationName}`,
        appId: formText(values, 'appId'),
        appSecret: formText(values, 'appSecret'),
        accessToken: formText(values, 'accessToken'),
        wabaId: formText(values, 'wabaId'),
        phoneNumberId: formText(values, 'phoneNumberId'),
      });
      setNotice(result);
      if (result.setup) setSetup(result.setup);
      if (result.ok) {
        form.reset();
        router.refresh();
      }
    });
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice({ ok: true, message: `${label} copiado.` });
    } catch {
      setNotice({
        ok: false,
        message: `No se pudo copiar ${label.toLowerCase()}. Selecciónalo manualmente.`,
      });
    }
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">
              {scope === 'organization'
                ? 'WhatsApp principal del negocio'
                : `WhatsApp · ${locationName}`}
            </p>
            <Badge variant={connected ? 'default' : 'secondary'}>
              {connected
                ? 'Conectado'
                : secretStorageReady
                  ? 'Por configurar'
                  : 'Pendiente'}
            </Badge>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            {scope === 'organization'
              ? 'Este número atiende todas las sedes. Si una sede tiene un número exclusivo, se usará como reemplazo para esa sede.'
              : 'Número exclusivo opcional para esta sede. Si no se configura, se utilizará el WhatsApp principal del negocio.'}
          </p>
          {phoneNumberId ? (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Phone Number ID: {phoneNumberId}
            </p>
          ) : null}
        </div>
        {connected ? (
          <CheckCircle2 className="size-5 text-emerald-600" />
        ) : (
          <Link2 className="size-5 text-primary" />
        )}
      </div>
      {!connected ? (
        <form
          className="space-y-4 rounded-xl bg-muted/25 p-4"
          onSubmit={connectManual}
        >
          <div>
            <p className="text-sm font-semibold">
              Aplicación de Meta del cliente
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Pega las credenciales de la aplicación creada para este negocio.
              Se enviarán directamente al servidor y se guardarán cifradas.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <CredentialField
              id={`${fieldIdPrefix}-appId`}
              label="Meta App ID"
              name="appId"
              placeholder="1045393104790379"
            />
            <CredentialField
              id={`${fieldIdPrefix}-appSecret`}
              label="Meta App Secret"
              name="appSecret"
              placeholder="App Secret"
              secret
            />
            <CredentialField
              id={`${fieldIdPrefix}-wabaId`}
              label="WABA ID"
              name="wabaId"
              placeholder="ID de la cuenta de WhatsApp"
            />
            <CredentialField
              id={`${fieldIdPrefix}-phoneNumberId`}
              label="Phone Number ID"
              name="phoneNumberId"
              placeholder="ID del número"
            />
          </div>
          <CredentialField
            id={`${fieldIdPrefix}-accessToken`}
            label="Token permanente de usuario del sistema"
            name="accessToken"
            placeholder="EAAB…"
            secret
          />
          <Button type="submit" disabled={pending || !secretStorageReady}>
            <KeyRound data-icon="inline-start" />
            {pending ? 'Validando con Meta…' : 'Validar y guardar conexión'}
          </Button>
          {ready ? (
            <details className="rounded-lg border bg-background p-3">
              <summary className="cursor-pointer text-xs font-medium">
                Conexión automática con Asistente H (alternativa)
              </summary>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Usa esta opción únicamente cuando la aplicación central tenga
                autorización de Meta para registrar clientes.
              </p>
              <Button
                className="mt-3"
                type="button"
                variant="outline"
                onClick={connect}
                disabled={pending || !sdkReady}
              >
                <Link2 data-icon="inline-start" /> Conectar automáticamente
              </Button>
            </details>
          ) : null}
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(() => testMetaConnection(clinicId, connectionId!))
              }
            >
              <RefreshCw data-icon="inline-start" /> Probar conexión
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(() => getCustomerMetaWebhookSetup(clinicId, connectionId!))
              }
            >
              <KeyRound data-icon="inline-start" /> Ver webhook
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(() => disconnectMetaWhatsApp(clinicId, connectionId!))
              }
            >
              <Unplug data-icon="inline-start" /> Desconectar
            </Button>
          </>
        </div>
      )}
      {!secretStorageReady ? (
        <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          Falta configurar la clave de cifrado del servidor. No se aceptarán
          credenciales hasta que esté disponible.
        </p>
      ) : null}
      {setup ? (
        <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <div>
            <p className="text-sm font-semibold">Último paso en Meta</p>
            <p className="mt-1 text-xs leading-relaxed">
              En la aplicación {setup.appId}, abre WhatsApp → Configuración y
              registra estos valores. Después suscribe el campo
              <span className="font-mono"> messages</span>.
            </p>
          </div>
          <SetupValue
            label="URL de devolución de llamada"
            value={setup.callbackUrl}
            onCopy={() => copyValue(setup.callbackUrl, 'URL del webhook')}
          />
          <SetupValue
            label="Token de verificación"
            value={setup.verifyToken}
            onCopy={() => copyValue(setup.verifyToken, 'Token de verificación')}
          />
          <p className="text-[11px] leading-relaxed text-sky-800">
            Este token verifica el webhook; no es el token de acceso de
            WhatsApp. Puedes volver a verlo desde este botón cuando lo
            necesites.
          </p>
        </div>
      ) : null}
      {notice ? (
        <p
          className={`rounded-lg p-3 text-xs ${notice.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}
        >
          {notice.message}
          {notice.displayPhoneNumber
            ? ` Número: ${notice.displayPhoneNumber}.`
            : ''}
        </p>
      ) : null}
    </div>
  );
}

function CredentialField({
  id,
  label,
  name,
  placeholder,
  secret = false,
}: {
  id: string;
  label: string;
  name: string;
  placeholder: string;
  secret?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={secret ? 'password' : 'text'}
        placeholder={placeholder}
        autoComplete={secret ? 'new-password' : 'off'}
        required
      />
    </div>
  );
}

function formText(values: FormData, key: string) {
  const value = values.get(key);
  return typeof value === 'string' ? value : '';
}

function SetupValue({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input className="font-mono text-xs" value={value} readOnly />
        <Button type="button" size="icon" variant="outline" onClick={onCopy}>
          <Clipboard />
          <span className="sr-only">Copiar {label}</span>
        </Button>
      </div>
    </div>
  );
}

function windowSafeFb() {
  return typeof window === 'undefined' ? undefined : window.FB;
}

function isFacebookOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === 'facebook.com' || hostname.endsWith('.facebook.com');
  } catch {
    return false;
  }
}

function isEmbeddedSignupFinish(value: unknown): value is {
  type: 'WA_EMBEDDED_SIGNUP';
  event: 'FINISH';
  data: { waba_id: string; phone_number_id: string };
} {
  if (!value || typeof value !== 'object') return false;
  const payload = value as {
    type?: unknown;
    event?: unknown;
    data?: { waba_id?: unknown; phone_number_id?: unknown };
  };
  return (
    payload.type === 'WA_EMBEDDED_SIGNUP' &&
    payload.event === 'FINISH' &&
    typeof payload.data?.waba_id === 'string' &&
    typeof payload.data.phone_number_id === 'string'
  );
}
