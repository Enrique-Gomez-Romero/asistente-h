import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  const contact =
    process.env.PRIVACY_CONTACT_EMAIL ?? 'privacidad@tu-dominio.com';
  return (
    <main className="min-h-screen bg-[#f4f8f6] px-5 py-14 text-[#173b34]">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-7 shadow-sm md:p-12">
        <Link href="/" className="text-sm font-semibold text-[#1e806a]">
          ← Volver a Asistente H
        </Link>
        <h1 className="mt-8 font-heading text-4xl font-bold">
          Aviso de privacidad
        </h1>
        <p className="mt-3 text-sm text-[#61716c]">
          Última actualización: 1 de septiembre de 2026. Documento base sujeto
          a revisión legal antes de operar comercialmente.
        </p>
        <div className="mt-8 space-y-7 leading-relaxed text-[#435c55]">
          <Section title="Responsable y alcance">
            Asistente H proporciona herramientas de agenda, atención por
            WhatsApp y seguimiento. Cada negocio es responsable de los datos de
            sus pacientes y Asistente H actúa como proveedor de la plataforma,
            conforme al contrato aplicable.
          </Section>
          <Section title="Datos tratados">
            Podemos tratar nombre, teléfono, correo, citas, servicios,
            conversaciones, preferencias de contacto y registros operativos.
            No solicitamos diagnósticos ni expedientes clínicos completos por
            WhatsApp. El negocio debe evitar capturar información que no sea
            necesaria para la atención.
          </Section>
          <Section title="Finalidades">
            Los datos se utilizan para organizar citas, atender solicitudes,
            enviar confirmaciones y recordatorios, transferir conversaciones a
            personal humano, mantener seguridad y generar evidencia operativa.
            Las campañas promocionales requieren consentimiento independiente.
          </Section>
          <Section title="Proveedores y transferencias">
            La operación puede involucrar a los proveedores de alojamiento,
            mensajería, correo e inteligencia artificial configurados por la
            plataforma. Sólo se comparte la información indispensable para
            prestar cada servicio y se deben formalizar los contratos de
            tratamiento correspondientes.
          </Section>
          <Section title="Conservación y seguridad">
            Los datos se conservarán únicamente durante el plazo definido por
            el negocio y las obligaciones legales aplicables. Se emplean
            controles de acceso por organización y rol, bitácoras y secretos
            administrados fuera de la base operativa.
          </Section>
          <Section title="Derechos ARCO y revocación">
            Para solicitar acceso, rectificación, cancelación, oposición o
            revocar el consentimiento, escribe a{' '}
            <a className="font-semibold text-[#1e806a]" href={`mailto:${contact}`}>
              {contact}
            </a>
            . La identidad y relación con el negocio deberán verificarse antes
            de ejecutar la solicitud.
          </Section>
          <Section title="Cambios al aviso">
            Los cambios relevantes se publicarán en esta misma página con su
            nueva fecha de actualización.
          </Section>
        </div>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-heading text-xl font-bold">{title}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
