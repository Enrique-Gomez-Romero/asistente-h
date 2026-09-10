import { accessOrganizationSecret } from '@/lib/integration-secrets';

export type WhatsAppCredentialBundle = {
  version: 1;
  mode: 'customer_app';
  accessToken: string;
  appId: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
};

export type StoredWhatsAppCredentials =
  | WhatsAppCredentialBundle
  | {
      version: 0;
      mode: 'legacy';
      accessToken: string;
    };

export function whatsappCredentialScope(connectionId: string) {
  return `whatsapp:${connectionId}`;
}

export function serializeWhatsAppCredentialBundle(
  bundle: WhatsAppCredentialBundle,
) {
  return JSON.stringify(bundle);
}

export async function readStoredWhatsAppCredentials(input: {
  secretReference: string;
  clinicId: string;
  connectionId: string;
}): Promise<StoredWhatsAppCredentials> {
  try {
    const plaintext = await accessOrganizationSecret(
      input.secretReference,
      input.clinicId,
      whatsappCredentialScope(input.connectionId),
    );
    return parseBundle(plaintext);
  } catch (connectionScopedError) {
    try {
      const accessToken = await accessOrganizationSecret(
        input.secretReference,
        input.clinicId,
        'whatsapp',
      );
      return { version: 0, mode: 'legacy', accessToken };
    } catch {
      throw connectionScopedError;
    }
  }
}

function parseBundle(value: string): WhatsAppCredentialBundle {
  let candidate: Partial<WhatsAppCredentialBundle>;
  try {
    candidate = JSON.parse(value) as Partial<WhatsAppCredentialBundle>;
  } catch {
    throw new Error(
      'La configuración cifrada de WhatsApp no tiene un formato válido.',
    );
  }
  if (
    candidate.version !== 1 ||
    candidate.mode !== 'customer_app' ||
    !isNonEmpty(candidate.accessToken) ||
    !isNonEmpty(candidate.appId) ||
    !isNonEmpty(candidate.appSecret) ||
    !isNonEmpty(candidate.verifyToken) ||
    !isGraphVersion(candidate.graphVersion)
  )
    throw new Error(
      'La configuración cifrada de WhatsApp está incompleta. Vuelve a conectarla.',
    );
  return candidate as WhatsAppCredentialBundle;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isGraphVersion(value: unknown): value is string {
  return typeof value === 'string' && /^v\d+\.\d+$/.test(value);
}
