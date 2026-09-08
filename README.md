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
- Gemini API central con herramientas controladas y consumo medido por negocio.
- Webhook de verificación y recepción de Meta WhatsApp.
- Validación obligatoria de firma `x-hub-signature-256`; el webhook se desactiva si falta `META_APP_SECRET`.
- Bitácora de cambios, indicadores y reglas de seguridad clínica.
- Organizaciones ilimitadas a nivel plataforma y selector de negocio activo.
- Inicio de sesión propio con correo y contraseña, recuperación de acceso, membresías y roles `owner`, `admin`, `staff` y `viewer`.
- Aislamiento de consultas y mutaciones por organización.
- Onboarding para consultorios dentales y otros tipos de negocio.
- Planes, periodos de prueba, límites de usuarios, sedes, conversaciones y solicitudes de IA.
- Medición mensual de consumo y panel global para el administrador de la plataforma.
- Configuración editable de datos, horarios, equipo e integraciones autorizadas.
- Recordatorios, confirmación, cancelación, solicitud de reprogramación y seguimiento por WhatsApp.
- Lista de espera, campañas de reactivación y encuestas de satisfacción.
- Anticipos y pagos de suscripción por transferencia con verificación manual.
- Historial unificado por paciente, notificaciones al personal y exportación CSV, iCalendar y respaldo JSON.
- Centro de administración de organizaciones, planes, vigencias, suspensiones, transferencias y facturas.
- Alta controlada: solo la plataforma crea negocios y los clientes entran mediante invitaciones de un solo uso.
- Meta Embedded Signup preparado para autorizar el WABA y número propiedad de cada cliente.
- Tokens de Meta por organización cifrados con AES-256-GCM antes de almacenarse en D1.
- OAuth de Google Calendar por organización y sincronización de altas, cambios y cancelaciones.
- Consentimiento de campañas, anonimización de pacientes y estados de entrega de mensajes.

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

Para múltiples clientes se usa una sola aplicación de Meta de la plataforma con Embedded Signup. Cada negocio conserva su propio portafolio empresarial, cuenta de WhatsApp Business y número; no necesita una aplicación de desarrollador distinta. `phone_number_id` permite resolver el negocio correcto antes de leer o escribir datos. Los tokens se cifran individualmente en el servidor antes de guardarse en D1.

## Acceso e invitaciones

El sitio puede publicarse sin volver públicos los datos. La portada acepta visitantes anónimos, pero `/app`, `/platform`, exportaciones y acciones verifican una sesión propia en el servidor. Las contraseñas se derivan con PBKDF2 y sal individual usando el máximo de 100 000 iteraciones admitido por el runtime; las sesiones usan cookies seguras y tokens que se almacenan únicamente como hash. Cinco intentos fallidos bloquean temporalmente la cuenta.

Para la primera instalación, configura `AUTH_SETUP_TOKEN` con una cadena aleatoria de al menos 32 caracteres y abre `/configurar-acceso?token=VALOR`. Ese enlace crea una sola cuenta administradora y deja de funcionar en cuanto existe una credencial administrativa.

Un usuario nuevo no puede crear negocios ni convertirse en administrador. La administración crea la organización, invita al usuario y el enlace solo puede aceptarse con el correo destinatario. Si todavía no existe una cuenta, el invitado define su nombre y contraseña desde el propio enlace.

Las invitaciones y la recuperación de contraseña usan Resend mediante `RESEND_API_KEY` y un remitente verificado en `EMAIL_FROM`. Las invitaciones vencen en siete días y los enlaces de recuperación en 30 minutos. Desde Configuración, una invitación puede reenviarse o revocarse.

## Credenciales de Meta

Embedded Signup entrega un código temporal y los identificadores del WABA y número. El servidor intercambia el código, comprueba el número, suscribe el webhook y cifra el token con AES-256-GCM. D1 conserva el sobre cifrado en `secret_reference`; el contexto autenticado impide usarlo con otra organización o proveedor. Al desconectar WhatsApp, el sobre cifrado se elimina. La llave maestra `INTEGRATION_CREDENTIALS_ENCRYPTION_KEY` permanece exclusivamente como secreto del hosting.

## Suscripciones por transferencia

No se conecta una pasarela automática en esta etapa. El administrador de Asistente H registra cada transferencia, periodo cubierto, referencia, folio y enlace de factura. La misma operación activa o extiende la suscripción y deja bitácora. El cliente solo puede consultar su plan, consumo, vigencia e historial de pagos.

## Automatizaciones

El endpoint protegido `POST /api/jobs/automations` procesa mensajes vencidos. En producción debe ejecutarse periódicamente con Cloud Scheduler o Cloud Tasks enviando `Authorization: Bearer AUTOMATION_SECRET`.

Los envíos automáticos fuera de la ventana de atención usan exclusivamente plantillas aprobadas. Configura los nombres exactos indicados en `.env.example`. La cola toma cada trabajo de forma atómica y recupera ejecuciones interrumpidas después de 15 minutos.

## Google Calendar

Configura `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_STATE_SECRET` y `PUBLIC_APP_URL`. En Google Cloud, registra exactamente `PUBLIC_APP_URL/api/google-calendar/callback` como URI de redirección. Después, cada propietario o administrador conecta su calendario desde Configuración. La agenda interna continúa siendo la fuente de verdad.

## Respaldo y monitoreo

Propietarios y administradores pueden descargar un respaldo JSON aislado desde Configuración. El archivo omite secretos y tokens de invitación. El endpoint `/api/health` comprueba la disponibilidad de D1 y los procesos críticos producen registros JSON sin datos clínicos ni credenciales. Consulta [Operación y recuperación](docs/OPERATIONS.md).

## Integración de IA

Asistente H utiliza una sola cuenta de Gemini para toda la plataforma. `GEMINI_API_KEY` y `GEMINI_MODEL` son secretos globales administrados únicamente por la plataforma; los clientes no conectan cuentas de IA ni pueden ver la llave. El consumo continúa registrándose por organización para aplicar los límites de cada plan.

El asistente no tiene acceso directo para escribir libremente en la base de datos. Gemini solo puede solicitar herramientas tipadas:

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

La versión alojada usa D1, acceso privado y cifrado de credenciales a nivel de aplicación. Para una operación comercial en Google Cloud, el destino recomendado es Cloud Run + Cloud SQL PostgreSQL; Secret Manager puede añadirse después como defensa adicional, pero no es un requisito de esta versión. La estructura relacional y el campo interno `clinic_id` facilitan esa migración; en el producto representa el arrendatario u organización.

## Pendientes externos antes de cobrar

- Definir precios comerciales para los planes Profesional y Escala.
- Cargar las credenciales de Resend y verificar el remitente para activar el envío real de invitaciones.
- Cargar la aplicación de Meta y la llave maestra de cifrado para activar Embedded Signup.
- Configurar Cloud Scheduler para recordatorios y campañas.
- Crear credenciales OAuth de Google y registrar la URI de retorno para activar la sincronización directa; CSV e iCalendar funcionan sin ellas.

## Validación

```bash
pnpm db:generate
pnpm test
pnpm lint
pnpm build
```

Consulta [Arquitectura](docs/ARCHITECTURE.md) y [Lista para salir a producción](docs/GO_LIVE_CHECKLIST.md).
