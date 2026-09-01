# Arquitectura de Dento AI

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

## Principios

1. La IA conversa; el backend decide y persiste.
2. La disponibilidad y los precios siempre provienen de la base de datos.
3. Ninguna cita queda confirmada sin una escritura exitosa.
4. El personal puede pausar la IA por conversación.
5. Los webhooks se procesan de forma idempotente usando el ID externo del mensaje.
6. Las llaves permanecen en secretos del servidor.
7. Se minimizan los datos personales enviados a proveedores externos.

## Módulos

- `app/api/whatsapp/webhook`: verificación, firma, recepción y respuesta.
- `app/api/assistant/simulate`: laboratorio seguro del asistente.
- `app/actions.ts`: mutaciones autorizadas desde el panel.
- `lib/assistant.ts`: orquestación OpenAI y fallback local.
- `lib/dental-data.ts`: consultas y tipos del dominio.
- `db/schema.ts`: modelo relacional.
- `db/initialize.ts`: estructura y datos iniciales idempotentes.
- `components/dental-dashboard.tsx`: superficie operativa completa.

## Producción en Google Cloud

La evolución recomendada es:

- Cloud Run para el contenedor web y los webhooks.
- Cloud SQL PostgreSQL para datos transaccionales.
- Secret Manager para tokens de Meta y OpenAI.
- Cloud Tasks para trabajos asíncronos.
- Cloud Scheduler para buscar recordatorios pendientes.
- Cloud Logging y Error Reporting para observabilidad.
- Firebase Authentication o Identity Platform para usuarios del consultorio.
- Google Calendar API como sincronización opcional; la agenda interna sigue siendo la fuente oficial.

Para evitar dobles reservaciones en PostgreSQL se debe agregar una restricción de exclusión sobre doctor y rango de tiempo, además de la validación de aplicación ya existente.
