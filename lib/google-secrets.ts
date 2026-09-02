type GoogleToken = { value: string; expiresAt: number };

let cachedToken: GoogleToken | null = null;

export function googleSecretManagerConfigured() {
  return Boolean(
    process.env.GOOGLE_PROJECT_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

export async function storeOrganizationSecret(
  clinicId: string,
  provider: string,
  value: string,
) {
  const projectId = required('GOOGLE_PROJECT_ID');
  const secretId = `asistente-h-${provider}-${sanitizeSecretId(clinicId)}`;
  const accessToken = await getGoogleAccessToken();
  const collection = `https://secretmanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/secrets`;
  const createResponse = await fetch(
    `${collection}?secretId=${encodeURIComponent(secretId)}`,
    {
      method: 'POST',
      headers: googleHeaders(accessToken),
      body: JSON.stringify({ replication: { automatic: {} } }),
    },
  );
  if (!createResponse.ok && createResponse.status !== 409) {
    throw new Error(
      `Google Secret Manager no pudo crear el secreto (${createResponse.status}).`,
    );
  }
  const secretName = `projects/${projectId}/secrets/${secretId}`;
  const versionResponse = await fetch(
    `https://secretmanager.googleapis.com/v1/${secretName}:addVersion`,
    {
      method: 'POST',
      headers: googleHeaders(accessToken),
      body: JSON.stringify({
        payload: { data: utf8ToBase64(value) },
      }),
    },
  );
  if (!versionResponse.ok)
    throw new Error(
      `Google Secret Manager no pudo guardar la credencial (${versionResponse.status}).`,
    );
  return secretName;
}

export async function accessOrganizationSecret(secretReference: string) {
  if (!/^projects\/[^/]+\/secrets\/[A-Za-z0-9_-]+$/.test(secretReference))
    throw new Error('La referencia del secreto no es válida.');
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://secretmanager.googleapis.com/v1/${secretReference}/versions/latest:access`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok)
    throw new Error(
      `Google Secret Manager no pudo leer la credencial (${response.status}).`,
    );
  const result = (await response.json()) as {
    payload?: { data?: string };
  };
  if (!result.payload?.data)
    throw new Error('El secreto no contiene una versión accesible.');
  return base64ToUtf8(result.payload.data);
}

export async function deleteOrganizationSecret(secretReference: string) {
  if (!/^projects\/[^/]+\/secrets\/[A-Za-z0-9_-]+$/.test(secretReference))
    throw new Error('La referencia del secreto no es válida.');
  const accessToken = await getGoogleAccessToken();
  const response = await fetch(
    `https://secretmanager.googleapis.com/v1/${secretReference}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok && response.status !== 404)
    throw new Error(
      `Google Secret Manager no pudo eliminar la credencial (${response.status}).`,
    );
}

async function getGoogleAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000)
    return cachedToken.value;
  const email = required('GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = required('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replaceAll(
    '\\n',
    '\n',
  );
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    privateKey,
  );
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok)
    throw new Error(
      `Google rechazó la cuenta de servicio (${response.status}).`,
    );
  const result = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!result.access_token) throw new Error('Google no devolvió un token.');
  cachedToken = {
    value: result.access_token,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
  return result.access_token;
}

async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKeyPem: string,
) {
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

function base64UrlJson(value: Record<string, unknown>) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}

function utf8ToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToUtf8(value: string) {
  const binary = atob(value);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

function googleHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

function sanitizeSecretId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 180);
}

function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Falta configurar ${key}.`);
  return value;
}
