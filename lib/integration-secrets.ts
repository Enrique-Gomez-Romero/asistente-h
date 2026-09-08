const ENCRYPTION_KEY_ENV = 'INTEGRATION_CREDENTIALS_ENCRYPTION_KEY';
const ENVELOPE_PREFIX = 'encrypted:v1:';
const ALGORITHM = 'AES-GCM';

type CredentialEnvelope = {
  v: 1;
  tenant: string;
  scope: string;
  iv: string;
  ciphertext: string;
};

export function integrationCredentialEncryptionConfigured() {
  try {
    readMasterKeyBytes();
    return true;
  } catch {
    return false;
  }
}

export async function storeOrganizationSecret(
  clinicId: string,
  scope: string,
  value: string,
) {
  validateContext(clinicId, scope);
  if (!value) throw new Error('La credencial que se intentó guardar está vacía.');

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importMasterKey();
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      additionalData: contextBytes(clinicId, scope),
      tagLength: 128,
    },
    key,
    new TextEncoder().encode(value),
  );
  const envelope: CredentialEnvelope = {
    v: 1,
    tenant: clinicId,
    scope,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
  return `${ENVELOPE_PREFIX}${bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(envelope)),
  )}`;
}

export async function accessOrganizationSecret(
  encryptedReference: string,
  clinicId: string,
  scope: string,
) {
  validateContext(clinicId, scope);
  const envelope = parseEnvelope(encryptedReference);
  if (envelope.tenant !== clinicId || envelope.scope !== scope)
    throw new Error('La credencial no pertenece a esta organización o integración.');

  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: base64UrlToBytes(envelope.iv),
        additionalData: contextBytes(clinicId, scope),
        tagLength: 128,
      },
      await importMasterKey(),
      base64UrlToBytes(envelope.ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error(
      'No fue posible descifrar la credencial. Vuelve a autorizar la integración.',
    );
  }
}

function parseEnvelope(reference: string): CredentialEnvelope {
  if (!reference.startsWith(ENVELOPE_PREFIX))
    throw new Error(
      'Esta conexión usa el almacén anterior. Vuelve a autorizarla para migrarla.',
    );
  try {
    const envelope = JSON.parse(
      new TextDecoder().decode(
        base64UrlToBytes(reference.slice(ENVELOPE_PREFIX.length)),
      ),
    ) as Partial<CredentialEnvelope>;
    if (
      envelope.v !== 1 ||
      typeof envelope.tenant !== 'string' ||
      typeof envelope.scope !== 'string' ||
      typeof envelope.iv !== 'string' ||
      typeof envelope.ciphertext !== 'string' ||
      base64UrlToBytes(envelope.iv).byteLength !== 12 ||
      base64UrlToBytes(envelope.ciphertext).byteLength < 17
    )
      throw new Error('invalid envelope');
    return envelope as CredentialEnvelope;
  } catch {
    throw new Error('La credencial cifrada no tiene un formato válido.');
  }
}

async function importMasterKey() {
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(readMasterKeyBytes()).buffer,
    { name: ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function readMasterKeyBytes() {
  const encoded = process.env[ENCRYPTION_KEY_ENV]?.trim();
  if (!encoded) throw new Error(`Falta configurar ${ENCRYPTION_KEY_ENV}.`);
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(encoded);
  } catch {
    throw new Error(`${ENCRYPTION_KEY_ENV} debe estar codificada en Base64.`);
  }
  if (bytes.byteLength !== 32)
    throw new Error(`${ENCRYPTION_KEY_ENV} debe contener exactamente 32 bytes.`);
  return bytes;
}

function contextBytes(clinicId: string, scope: string) {
  return new TextEncoder().encode(`asistente-h:v1:${clinicId}:${scope}`);
}

function validateContext(clinicId: string, scope: string) {
  if (!clinicId.trim() || !scope.trim())
    throw new Error('Falta identificar la organización o integración.');
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value))
    throw new Error('invalid base64url');
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
