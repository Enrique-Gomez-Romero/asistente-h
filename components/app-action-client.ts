'use client';

export type AppActionResponse = {
  ok: boolean;
  message: string;
};

export async function callAppAction<T extends AppActionResponse>(
  action: string,
  args: unknown[],
  returnTo = '/app',
): Promise<T> {
  try {
    const response = await fetch('/api/app/actions', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, args }),
    });
    const result = (await response.json()) as T;
    if (response.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent(returnTo)}`);
      return {
        ...result,
        ok: false,
        message: 'Tu sesión expiró. Inicia sesión otra vez.',
      };
    }
    return result;
  } catch {
    return {
      ok: false,
      message: 'No fue posible guardar el cambio. Intenta de nuevo.',
    } as T;
  }
}
