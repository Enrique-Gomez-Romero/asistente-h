# Dento AI

MVP funcional de recepción dental por WhatsApp. Incluye agenda, pacientes, catálogo de servicios, bandeja de conversaciones, simulador de IA, persistencia y endpoints preparados para Meta y OpenAI.

## Funciones disponibles

- Agenda con alta de citas y validación de traslapes.
- Confirmación, cancelación y seguimiento de estados.
- Directorio de pacientes.
- Catálogo autorizado de precios y duración.
- Bandeja conjunta para IA y personal humano.
- Pausa y reanudación del asistente por conversación.
- Simulador de conversaciones sin credenciales externas.
- OpenAI Responses API con herramientas controladas.
- Webhook de verificación y recepción de Meta WhatsApp.
- Validación de firma `x-hub-signature-256` cuando existe `META_APP_SECRET`.
- Bitácora de cambios, indicadores y reglas de seguridad clínica.

## Ejecutar localmente

Requiere Node.js 22 o posterior y pnpm.

```bash
pnpm install
pnpm dev
```

La aplicación estará en `http://localhost:3000`.

## Variables de entorno

Copia `.env.example` a `.env.local` y completa únicamente las conexiones que quieras activar. Sin llaves, la aplicación usa datos de demostración y un asistente determinista seguro.

Nunca subas tokens o llaves al repositorio. En producción deben guardarse como secretos del proveedor de hosting.

## Configurar WhatsApp Cloud API

1. Crear o seleccionar una aplicación en Meta for Developers.
2. Agregar el producto WhatsApp y asociar la cuenta empresarial.
3. Configurar el webhook público `https://TU_DOMINIO/api/whatsapp/webhook`.
4. Usar el mismo valor en Meta y `WHATSAPP_VERIFY_TOKEN`.
5. Suscribir el campo `messages` de la cuenta de WhatsApp.
6. Crear un token de sistema y guardarlo en `WHATSAPP_ACCESS_TOKEN`.
7. Guardar el ID del número en `WHATSAPP_PHONE_NUMBER_ID`.
8. Configurar `META_APP_SECRET` para validar firmas.
9. Crear y aprobar plantillas para confirmaciones y recordatorios fuera de la ventana de 24 horas.

## Integración de IA

El asistente no tiene acceso directo para escribir libremente en la base de datos. La OpenAI Responses API solo puede solicitar herramientas tipadas:

- `list_services`
- `find_availability`
- `get_clinic_information`
- `request_human_help`

La agenda, precios y acciones sensibles siguen bajo control del backend. El asistente tiene instrucciones explícitas de no diagnosticar, no recetar y escalar emergencias.

## Base de datos

El proyecto incluye esquema Drizzle, migración SQLite/D1 e inicialización idempotente para la demostración. Tablas principales:

- `clinics`
- `doctors`
- `services`
- `patients`
- `appointments`
- `conversations`
- `messages`
- `faq_items`
- `audit_logs`

Para producción en Google Cloud, el destino recomendado es Cloud SQL PostgreSQL. La estructura es relacional para facilitar esa migración.

## Validación

```bash
pnpm db:generate
pnpm lint
pnpm build
```

Consulta [Arquitectura](docs/ARCHITECTURE.md) y [Lista para salir a producción](docs/GO_LIVE_CHECKLIST.md).
