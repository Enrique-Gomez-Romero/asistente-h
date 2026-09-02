import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f4f8f6] px-5 py-14 text-[#173b34]">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-7 shadow-sm md:p-12">
        <Link href="/" className="text-sm font-semibold text-[#1e806a]">
          ← Volver a Asistente H
        </Link>
        <h1 className="mt-8 font-heading text-4xl font-bold">
          Términos de servicio
        </h1>
        <p className="mt-3 text-sm text-[#61716c]">
          Última actualización: 1 de septiembre de 2026. Documento base sujeto
          a revisión legal antes de aceptar clientes de pago.
        </p>
        <div className="mt-8 space-y-7 leading-relaxed text-[#435c55]">
          <Section title="Uso de la plataforma">
            El servicio ayuda a administrar agendas, conversaciones y
            automatizaciones. Cada negocio debe mantener información correcta,
            asignar permisos adecuados y utilizar la plataforma conforme a la
            ley y a las políticas de los proveedores conectados.
          </Section>
          <Section title="Límites clínicos">
            Asistente H no sustituye la valoración de un profesional de salud,
            no diagnostica, no prescribe y debe escalar emergencias o dudas
            clínicas al personal humano.
          </Section>
          <Section title="WhatsApp y comunicaciones">
            El negocio es responsable de obtener los consentimientos
            necesarios, respetar solicitudes de baja y utilizar plantillas
            aprobadas para mensajes iniciados por el negocio.
          </Section>
          <Section title="Disponibilidad y datos">
            El negocio debe revisar las citas, respaldos y notificaciones. Las
            interrupciones de proveedores externos pueden retrasar mensajes o
            automatizaciones, por lo que deben existir procedimientos humanos
            de contingencia.
          </Section>
          <Section title="Suscripciones y pagos">
            Los planes, precios, periodos, impuestos y condiciones de
            cancelación se especificarán en la propuesta comercial. Durante el
            piloto los pagos y activaciones pueden registrarse manualmente.
          </Section>
          <Section title="Suspensión y terminación">
            El acceso puede suspenderse por vencimiento, uso indebido, riesgo de
            seguridad o incumplimiento. El tratamiento y devolución de datos se
            realizará conforme al contrato y al aviso de privacidad.
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
