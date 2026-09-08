# Arquitectura de Asistente H

## Flujo principal

```text
Paciente
   │ WhatsApp
   ▼
Meta Cloud API ── webhook HTTPS ──► /api/whatsapp/webhook
                                         │
                       ┌─────────────────┼─────────────────┐
                       ▼                 ▼                 ▼
                  Conversaciones    Asistente IA      Motor de agenda
                       │          Responses + tools         │
                       └─────────────────┼─────────────────┘
                                         ▼
                                  Base de datos
                                         │
                                         ▼
                              Panel doctor/recepción
```

## Aislamiento multiempresa

```text
Usuario autenticado
        │
        ▼
Membresía + rol ──► Organización activa ──► Datos operativos
                           │
                           ├── Plan y límites
                           ├── Horarios y sedes
                           ├── Meta WhatsApp
                           └── Consumo de IA
```

`clinics.id` se conserva como clave física de arrendatario para mantener compatibilidad. En la experiencia del producto se presenta como organización o negocio. Cada acción del servidor verifica la organización real del recurso y la membresía del usuario antes de leer o escribir.

## Principios

1. La IA conversa; el backend decide y persiste.
2. La disponibilidad y los precios siempre provienen de la base de datos.
3. Ninguna cita queda confirmada sin una escritura exitosa.
4. El personal puede pausar la IA por conversación.
5. Los webhooks se procesan de forma idempotente usando el ID externo del mensaje.
6. Las llaves permanecen en secretos del servidor.
7. Se minimizan los datos personales enviados a proveedores externos.
8. El número receptor de Meta determina la organización antes de procesar el mensaje.
9. El consumo se registra por organización y se compara con el periodo y los límites del plan.
10. Un usuario sin membresía no puede crear organizaciones; debe aceptar un token de invitación ligado a su correo.
11. D1 solo guarda credenciales cifradas con AES-256-GCM; la llave maestra permanece fuera de la base de datos.
12. Google Calendar se sincroniza como copia operativa; D1 sigue siendo la agenda oficial.
13. Los trabajos programados se reclaman de forma atómica para evitar envíos dobles.

## Módulos

- `app/api/whatsapp/webhook`: verificación, firma, recepción y respuesta.
- `app/api/assistant/simulate`: laboratorio seguro del asistente.
- `app/api/jobs/automations`: ejecución protegida de recordatorios y campañas.
- `app/api/export`: exportaciones CSV, iCalendar y respaldo JSON autorizadas por organización.
- `app/api/google-calendar`: autorización OAuth y retorno seguro por organización.
- `app/actions.ts`: mutaciones autorizadas desde el panel.
- `app/commercial-actions.ts`: cobranza manual y automatización comercial.
- `lib/assistant.ts`: orquestación de la cuenta central de Gemini y fallback local.
- `lib/automations.ts`: cola, plantillas, reintentos y envíos programados.
- `lib/whatsapp.ts`: envío resuelto por organización y número de Meta.
- `lib/integration-secrets.ts`: cifrado autenticado de credenciales por organización y proveedor.
- `lib/google-calendar.ts`: OAuth, renovación de tokens y sincronización de eventos.
- `lib/observability.ts`: registros operativos estructurados y sanitizados.
- `lib/invitations.ts` y `lib/email.ts`: tokens de un solo uso y entrega de invitaciones.
- `app/meta-actions.ts`: intercambio de código, verificación y conexión de Embedded Signup.
- `lib/dental-data.ts`: consultas y tipos del dominio.
- `lib/saas.ts`: identidad, organizaciones, permisos, suscripciones y consumo.
- `db/schema.ts`: modelo relacional.
- `db/initialize.ts`: estructura y datos iniciales idempotentes.
- `components/dental-dashboard.tsx`: superficie operativa completa.

## Producción en Google Cloud

La evolución recomendada es:

- Cloud Run para el contenedor web y los webhooks.
- Cloud SQL PostgreSQL para datos transaccionales.
- Cifrado AES-256-GCM para tokens individuales de Meta; las llaves maestras y la llave central de Gemini se configuran como secretos globales del servicio.
- Cloud Tasks para trabajos asíncronos.
- Cloud Scheduler para buscar recordatorios pendientes.
- Cloud Logging y Error Reporting para observabilidad.
- Identity Platform para clientes finales si el producto deja el acceso privado de Sites.
- Google Calendar API como sincronización opcional; la agenda interna sigue siendo la fuente oficial.

Para evitar dobles reservaciones en PostgreSQL se debe agregar una restricción de exclusión sobre doctor y rango de tiempo, además de la validación de aplicación ya existente.

En esta etapa la cobranza es manual. El administrador registra la transferencia y factura; esa operación actualiza `subscriptions`, conserva `manual_payments` y agrega `subscription_events`. Si después se conecta una pasarela, sus webhooks reemplazarán esta captura como fuente de verdad financiera sin cambiar el control de acceso.

Para Meta multiempresa, cada cliente conserva su WABA y número. Una sola aplicación de desarrollador de Asistente H puede incorporarlos mediante Embedded Signup. Los identificadores no son secretos; los tokens se cifran por organización y nunca se muestran en el navegador. D1 solo recibe el texto cifrado y la llave maestra permanece en el entorno del servidor.
