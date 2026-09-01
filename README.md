# Asistente H SaaS

Base funcional multiempresa para vender recepción por WhatsApp e IA mediante suscripción. El primer vertical es dental, pero cada organización conserva su propia agenda, pacientes, catálogo, equipo, horarios, consumo e integraciones.

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
- Organizaciones ilimitadas a nivel plataforma y selector de negocio activo.
- Inicio de sesión con ChatGPT, membresías y roles `owner`, `admin`, `staff` y `viewer`.
- Aislamiento de consultas y mutaciones por organización.
- Onboarding para consultorios dentales y otros tipos de negocio.
- Planes, periodos de prueba, límites de usuarios, sedes, conversaciones y solicitudes de IA.
- Medición mensual de consumo y panel global para el administrador de la plataforma.
- Configuración editable de datos, horarios, equipo e identificadores de integración.
- Recordatorios, confirmación, cancelación, solicitud de reprogramación y seguimiento por WhatsApp.
- Lista de espera, campañas de reactivación y encuestas de satisfacción.
- Anticipos y pagos de suscripción por transferencia con verificación manual.
- Historial unificado por paciente, notificaciones al personal y exportación CSV/iCalendar.
- Centro de administración de organizaciones, planes, vigencias, suspensiones, transferencias y facturas.

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

Para múltiples clientes se usa una sola aplicación de Meta de la plataforma con Embedded Signup. Cada negocio conserva su propio portafolio empresarial, cuenta de WhatsApp Business y número; no necesita una aplicación de desarrollador distinta. `phone_number_id` permite resolver el negocio correcto antes de leer o escribir datos. Los tokens por negocio deben almacenarse en Secret Manager antes de abrir el alta comercial.

## Suscripciones por transferencia

No se conecta una pasarela automática en esta etapa. El administrador de Asistente H registra cada transferencia, periodo cubierto, referencia, folio y enlace de factura. La misma operación activa o extiende la suscripción y deja bitácora. El cliente solo puede consultar su plan, consumo, vigencia e historial de pagos.

## Automatizaciones

El endpoint protegido `POST /api/jobs/automations` procesa mensajes vencidos. En producción debe ejecutarse periódicamente con Cloud Scheduler o Cloud Tasks enviando `Authorization: Bearer AUTOMATION_SECRET`.

## Integración de IA

El asistente no tiene acceso directo para escribir libremente en la base de datos. La OpenAI Responses API solo puede solicitar herramientas tipadas:

- `list_services`
- `find_availability`
- `get_clinic_information`
- `request_human_help`

La agenda, precios y acciones sensibles siguen bajo control del backend. El asistente tiene instrucciones explícitas de no diagnosticar, no recetar y escalar emergencias.

## Base de datos

El proyecto incluye esquema Drizzle, SQLite/D1 e inicialización idempotente. Además de las tablas operativas, incorpora las entidades SaaS:

- `clinics`
- `doctors`
- `services`
- `patients`
- `appointments`
- `conversations`
- `messages`
- `faq_items`
- `audit_logs`
- `saas_users`, `memberships`, `platform_admins`
- `organization_profiles`, `locations`, `business_hours`
- `subscription_plans`, `subscriptions`, `usage_events`
- `integration_connections`, `invitations`
- `organization_states`, `manual_payments`, `subscription_events`
- `automation_rules`, `scheduled_messages`, `waitlist_entries`
- `campaigns`, `campaign_recipients`, `surveys`, `staff_notifications`
- `deposit_requests`, `patient_events`, `doctor_locations`, `doctor_hours`

La versión alojada usa D1 y acceso privado. Para una operación comercial en Google Cloud, el destino recomendado es Cloud Run + Cloud SQL PostgreSQL + Secret Manager. La estructura relacional y el campo interno `clinic_id` facilitan esa migración; en el producto representa el arrendatario u organización.

## Pendientes externos antes de cobrar

- Definir precios comerciales para los planes Profesional y Escala.
- Conectar correo transaccional para invitaciones y notificaciones.
- Cambiar la política de acceso privada por autenticación apta para clientes.
- Llevar tokens de Meta por organización a Secret Manager y completar Embedded Signup.
- Configurar Cloud Scheduler para recordatorios y campañas.
- Crear credenciales OAuth de Google si se desea sincronización directa; CSV e iCalendar ya funcionan sin ellas.

## Validación

```bash
pnpm db:generate
pnpm lint
pnpm build
```

Consulta [Arquitectura](docs/ARCHITECTURE.md) y [Lista para salir a producción](docs/GO_LIVE_CHECKLIST.md).
