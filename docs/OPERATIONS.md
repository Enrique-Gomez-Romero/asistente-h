# Operación y recuperación

## Respaldo

1. Un propietario o administrador abre Configuración y descarga el respaldo JSON.
2. Guardar el archivo cifrado en una ubicación con acceso restringido.
3. Realizarlo diariamente durante el piloto y antes de cada migración o despliegue importante.
4. Conservar al menos una copia semanal fuera de la cuenta principal.

El respaldo contiene datos personales y operativos del negocio. No contiene tokens cifrados de Meta o Google, referencias de credenciales ni tokens de invitación. Después de una restauración se deben conservar la misma llave maestra del entorno o volver a autorizar las integraciones.

## Restauración

No existe restauración desde el navegador para evitar sobrescrituras accidentales. El procedimiento controlado es:

1. Suspender temporalmente el acceso del negocio afectado.
2. Crear una base D1 aislada de recuperación; nunca probar directamente sobre producción.
3. Aplicar todas las migraciones incluidas en `drizzle/`.
4. Validar que el archivo tenga `format: asistente-h-backup`, versión compatible y el `clinicId` esperado.
5. Importar las tablas respetando dependencias: clínica, usuarios, catálogo, pacientes, citas, conversaciones y finalmente historiales.
6. Comparar conteos por tabla y revisar una muestra de agenda, pacientes y conversaciones.
7. Volver a autorizar Meta y Google Calendar si las credenciales cifradas o la llave maestra original no están disponibles.
8. Cambiar la conexión únicamente después de documentar y aprobar la validación.

Para una pérdida completa del servicio se debe usar primero la recuperación administrada del proveedor de D1. El JSON es una copia adicional por organización y un medio de portabilidad, no reemplaza las copias del proveedor.

## Monitoreo

- Consultar `GET /api/health` cada cinco minutos desde un monitor externo. Debe responder HTTP 200 y `status: ok`.
- Alertar después de dos fallos consecutivos y volver a comprobar antes de escalar.
- Buscar en los registros JSON los eventos `whatsapp.invalid_signature`, `google_calendar.sync_failed`, `automations.failed` y `health.database_failed`.
- Nunca registrar cuerpos de mensajes, teléfonos, tokens ni secretos.
- Revisar diariamente mensajes fallidos y notificaciones de automatización durante el piloto.

## Trabajo programado

Ejecutar `POST /api/jobs/automations` cada cinco minutos con `Authorization: Bearer AUTOMATION_SECRET`. El valor debe ser largo, aleatorio y distinto de las demás credenciales.

## Simulacro antes del piloto

1. Descargar un respaldo.
2. Restaurarlo en un entorno aislado.
3. Verificar conteos y permisos.
4. Crear, reprogramar y cancelar una cita.
5. Confirmar que Google Calendar refleja cada cambio.
6. Enviar un mensaje de prueba y comprobar sus estados de entrega.
7. Registrar fecha, responsable, resultado y tiempo total de recuperación.
