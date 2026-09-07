'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import {
  bootstrapAdminAction,
  initialAuthState,
  loginAction,
  registerInvitedUserAction,
  requestPasswordResetAction,
  resetPasswordAction,
} from '@/app/auth-actions';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(
    loginAction,
    initialAuthState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="login-email">Correo electrónico</FieldLabel>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="login-password">Contraseña</FieldLabel>
            <Link
              href="/recuperar"
              className="text-xs font-medium text-primary hover:underline"
            >
              ¿La olvidaste?
            </Link>
          </div>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <AuthNotice state={state} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Verificando…' : 'Iniciar sesión'}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function BootstrapAdminForm({ setupToken }: { setupToken: string }) {
  const [state, action, pending] = useActionState(
    bootstrapAdminAction,
    initialAuthState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="setupToken" value={setupToken} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="setup-name">Nombre completo</FieldLabel>
          <Input id="setup-name" name="fullName" autoComplete="name" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="setup-email">Correo electrónico</FieldLabel>
          <Input
            id="setup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <PasswordFields prefix="setup" />
        <AuthNotice state={state} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Creando acceso…' : 'Crear cuenta administradora'}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function InvitationRegistrationForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, action, pending] = useActionState(
    registerInvitedUserAction,
    initialAuthState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="invite-email">Correo invitado</FieldLabel>
          <Input id="invite-email" value={email} disabled />
        </Field>
        <Field>
          <FieldLabel htmlFor="invite-name">Nombre completo</FieldLabel>
          <Input id="invite-name" name="fullName" autoComplete="name" required />
        </Field>
        <PasswordFields prefix="invite" />
        <AuthNotice state={state} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Creando cuenta…' : 'Crear cuenta y aceptar'}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function PasswordResetRequestForm() {
  const [state, action, pending] = useActionState(
    requestPasswordResetAction,
    initialAuthState,
  );
  return (
    <form action={action}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="recovery-email">Correo electrónico</FieldLabel>
          <Input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <AuthNotice state={state} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Enviando…' : 'Enviar enlace'}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function PasswordResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    initialAuthState,
  );
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <FieldGroup>
        <PasswordFields prefix="reset" />
        <AuthNotice state={state} />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Actualizando…' : 'Guardar nueva contraseña'}
        </Button>
      </FieldGroup>
    </form>
  );
}

function PasswordFields({ prefix }: { prefix: string }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${prefix}-password`}>Contraseña</FieldLabel>
        <Input
          id={`${prefix}-password`}
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
        <p className="text-xs text-muted-foreground">Mínimo 12 caracteres.</p>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${prefix}-confirmation`}>
          Confirmar contraseña
        </FieldLabel>
        <Input
          id={`${prefix}-confirmation`}
          name="passwordConfirmation"
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </Field>
    </>
  );
}

function AuthNotice({
  state,
}: {
  state: { ok: boolean; message: string };
}) {
  if (!state.message) return null;
  return (
    <output
      className={`rounded-xl border p-3 text-sm ${
        state.ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {state.message}
    </output>
  );
}
