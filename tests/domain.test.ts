import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePhone } from '../lib/phone.ts';
import { appointmentEnd, rangesOverlap } from '../lib/scheduling.ts';
import { renderAutomationTemplate } from '../lib/automation-template.ts';
import { verifyWebhookSignature } from '../lib/webhook-security.ts';
import {
  accessOrganizationSecret,
  integrationCredentialEncryptionConfigured,
  storeOrganizationSecret,
} from '../lib/integration-secrets.ts';

void test('normaliza teléfonos mexicanos para coincidir con Meta', () => {
  assert.equal(normalizePhone('+52 55 1234 5678'), '525512345678');
  assert.equal(normalizePhone('55 1234 5678'), '525512345678');
  assert.equal(normalizePhone('5215512345678'), '525512345678');
  assert.equal(normalizePhone('123'), null);
});

void test('calcula la duración completa de una cita', () => {
  assert.equal(
    appointmentEnd('2026-09-10T15:00:00.000Z', 90).toISOString(),
    '2026-09-10T16:30:00.000Z',
  );
});

void test('detecta traslapes sin bloquear citas consecutivas', () => {
  assert.equal(
    rangesOverlap(
      '2026-09-10T15:00:00.000Z',
      '2026-09-10T16:00:00.000Z',
      '2026-09-10T15:30:00.000Z',
      '2026-09-10T16:30:00.000Z',
    ),
    true,
  );
  assert.equal(
    rangesOverlap(
      '2026-09-10T15:00:00.000Z',
      '2026-09-10T16:00:00.000Z',
      '2026-09-10T16:00:00.000Z',
      '2026-09-10T17:00:00.000Z',
    ),
    false,
  );
});

void test('renderiza las variables permitidas de una automatización', () => {
  assert.equal(
    renderAutomationTemplate(
      'Hola {{patient_name}}, tu cita en {{business_name}} es {{appointment_date}}.',
      {
        patientName: 'María',
        businessName: 'Clínica Centro',
        appointmentDate: '10 de septiembre a las 10:00',
      },
    ),
    'Hola María, tu cita en Clínica Centro es 10 de septiembre a las 10:00.',
  );
});

void test('acepta solamente firmas HMAC válidas de Meta', async () => {
  const valid =
    'sha256=f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8';
  assert.equal(
    await verifyWebhookSignature(
      'The quick brown fox jumps over the lazy dog',
      valid,
      'key',
    ),
    true,
  );
  assert.equal(
    await verifyWebhookSignature(
      'The quick brown fox jumps over the lazy dog.',
      valid,
      'key',
    ),
    false,
  );
});

void test('cifra credenciales por organización y detecta alteraciones', async () => {
  const keyName = 'INTEGRATION_CREDENTIALS_ENCRYPTION_KEY';
  const previousKey = process.env[keyName];
  process.env[keyName] = Buffer.from('k'.repeat(32)).toString('base64');
  try {
    assert.equal(integrationCredentialEncryptionConfigured(), true);
    const token = 'meta-token-super-secreto';
    const encrypted = await storeOrganizationSecret(
      'clinic_alpha',
      'whatsapp',
      token,
    );
    assert.match(encrypted, /^encrypted:v1:/);
    assert.equal(encrypted.includes(token), false);
    assert.equal(
      await accessOrganizationSecret(
        encrypted,
        'clinic_alpha',
        'whatsapp',
      ),
      token,
    );
    await assert.rejects(
      accessOrganizationSecret(encrypted, 'clinic_beta', 'whatsapp'),
      /no pertenece/,
    );
    const tamperIndex = Math.floor(encrypted.length / 2);
    const tampered = `${encrypted.slice(0, tamperIndex)}${encrypted[tamperIndex] === 'A' ? 'B' : 'A'}${encrypted.slice(tamperIndex + 1)}`;
    await assert.rejects(
      accessOrganizationSecret(tampered, 'clinic_alpha', 'whatsapp'),
    );
  } finally {
    if (previousKey === undefined) delete process.env[keyName];
    else process.env[keyName] = previousKey;
  }
});
