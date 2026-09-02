# Lista para salir a producción

## Negocio

- [ ] Confirmar horarios, doctores, servicios, duración y precios.
- [ ] Definir políticas de cancelación, anticipos y tolerancia.
- [ ] Aprobar respuestas frecuentes y mensajes de emergencia.
- [ ] Definir quién recibe los escalamientos humanos.
- [ ] Definir precios, impuestos, moneda, prueba y política de cancelación de cada plan.
- [ ] Preparar términos de servicio, aviso de privacidad y contrato de encargado de datos.

## Suscripción y acceso

- [ ] Definir cuenta bancaria, instructivo de pago y proceso de conciliación.
- [ ] Probar alta, renovación por transferencia, vencimiento, suspensión y reactivación.
- [ ] Confirmar folio y enlace de factura en cada pago registrado.
- [ ] Aplicar límites de plan con mensajes claros y sin perder datos.
- [ ] Verificar el dominio remitente y configurar Resend para invitaciones.
- [ ] Probar invitación, correo equivocado, expiración, reenvío y revocación.
- [ ] Confirmar que el sitio público conserva `/app` y `/platform` protegidos por inicio de sesión.
- [ ] Confirmar que un usuario de una organización no puede consultar IDs de otra.

## Meta WhatsApp

- [ ] Verificar el negocio y el número en Meta.
- [ ] Configurar webhook HTTPS y token de verificación.
- [ ] Guardar token de sistema, ID de número y secreto de aplicación.
- [ ] Suscribir mensajes y estados.
- [ ] Aprobar plantillas de confirmación, recordatorio y reprogramación.
- [ ] Probar la ventana de atención de 24 horas.
- [ ] Completar Embedded Signup y guardar un token por negocio en Secret Manager.
- [ ] Dar a la cuenta de servicio únicamente permisos de lectura/escritura sobre los secretos de Asistente H.

## Gemini central

- [ ] Crear una sola llave de Gemini para Asistente H y guardarla como secreto global del servidor.
- [ ] Configurar el modelo estable y los límites de gasto de la cuenta central.
- [ ] Probar respuestas con información diferente en al menos dos organizaciones.
- [ ] Confirmar que cada negocio consume únicamente la cuota mensual de su propio plan.
- [ ] Verificar que ningún cliente puede consultar, sustituir ni exportar la llave global.

## Seguridad y privacidad

- [ ] Publicar aviso de privacidad y mecanismo de consentimiento.
- [ ] Revisar el tratamiento de datos sensibles con asesoría legal mexicana.
- [ ] Configurar roles para administradores, doctores y recepción.
- [ ] Definir al menos dos administradores de plataforma y un proceso de recuperación.
- [ ] Definir conservación, eliminación y atención de derechos ARCO.
- [ ] Revisar retención y contrato de todos los proveedores.
- [ ] Ejecutar respaldo y restauración de prueba.
- [ ] Activar alertas por errores y fallas de webhook.

## Calidad

- [ ] Cero dobles reservaciones en pruebas concurrentes.
- [ ] Reintentos idempotentes para mensajes duplicados.
- [ ] Confirmación de zona horaria America/Mexico_City.
- [ ] Prueba de cancelación, reprogramación y toma humana.
- [ ] Prueba de mensajes urgentes y límites médicos.
- [ ] Piloto controlado con un consultorio y un número.
- [ ] Prueba de aislamiento con al menos dos negocios, dos números y catálogos diferentes.
- [ ] Prueba de límites mensuales y cambio de periodo de suscripción.
- [ ] Configurar Cloud Scheduler con `AUTOMATION_SECRET` y comprobar reintentos.
- [ ] Probar CSV, iCalendar y, si se habilita, OAuth de Google Calendar.
