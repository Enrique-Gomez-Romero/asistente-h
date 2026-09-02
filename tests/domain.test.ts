import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePhone } from '../lib/phone.ts';
import { appointmentEnd, rangesOverlap } from '../lib/scheduling.ts';
import { renderAutomationTemplate } from '../lib/automation-template.ts';
import { verifyWebhookSignature } from '../lib/webhook-security.ts';

test('normaliza teléfonos mexicanos para coincidir con Meta', () => {
  assert.equal(normalizePhone('+52 55 1234 5678'), '525512345678');
  assert.equal(normalizePhone('55 1234 5678'), '525512345678');
  assert.equal(normalizePhone('5215512345678'), '525512345678');
  assert.equal(normalizePhone('123'), null);
});

test('calcula la duración completa de una cita', () => {
  assert.equal(
    appointmentEnd('2026-09-10T15:00:00.000Z', 90).toISOString(),
    '2026-09-10T16:30:00.000Z',
  );
});

test('detecta traslapes sin bloquear citas consecutivas', () => {
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

test('renderiza las variables permitidas de una automatización', () => {
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

test('acepta solamente firmas HMAC válidas de Meta', async () => {
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
