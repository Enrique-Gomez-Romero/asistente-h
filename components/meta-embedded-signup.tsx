'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Link2, RefreshCw, Unplug } from 'lucide-react';

import {
  completeMetaEmbeddedSignup,
  disconnectMetaWhatsApp,
  testMetaConnection,
  type MetaActionResult,
} from '@/app/meta-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
  appId,
  configId,
  ready,
  connected,
  phoneNumberId,
}: {
  clinicId: string;
  appId: string | null;
  configId: string | null;
  ready: boolean;
  connected: boolean;
  phoneNumberId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sdkReady, setSdkReady] = useState(Boolean(windowSafeFb()));
  const [notice, setNotice] = useState<MetaActionResult | null>(null);
  const [authorizationCode, setAuthorizationCode] = useState<string | null>(
    null,
  );
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const completing = useRef(false);

  useEffect(() => {
    if (!appId || !configId) return;
    const initialize = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: 'v23.0',
      });
      setSdkReady(Boolean(window.FB));
    };
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
      delete window.fbAsyncInit;
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
  }, [authorizationCode, clinicId, router, sessionInfo]);

  function connect() {
    setNotice(null);
    if (!ready || !configId || !window.FB) {
      setNotice({
        ok: false,
        message:
          'La aplicación de Meta y Google Secret Manager todavía no están configurados.',
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
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Conexión oficial de Meta</p>
            <Badge variant={connected ? 'default' : 'secondary'}>
              {connected ? 'Conectado' : ready ? 'Disponible' : 'Pendiente'}
            </Badge>
          </div>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            El propietario inicia sesión en Meta, selecciona su empresa y
            autoriza su propio número. Asistente H nunca muestra el token.
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
      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <Button
            type="button"
            onClick={connect}
            disabled={pending || !ready || !sdkReady}
          >
            <Link2 data-icon="inline-start" />
            {pending ? 'Conectando…' : 'Conectar WhatsApp'}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => testMetaConnection(clinicId))}
            >
              <RefreshCw data-icon="inline-start" /> Probar conexión
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => disconnectMetaWhatsApp(clinicId))}
            >
              <Unplug data-icon="inline-start" /> Desconectar
            </Button>
          </>
        )}
      </div>
      {!ready ? (
        <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          Falta configurar la aplicación de Meta y las credenciales de Google
          Secret Manager. El botón se habilitará automáticamente después.
        </p>
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
