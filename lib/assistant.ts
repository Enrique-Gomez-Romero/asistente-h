import { env } from 'cloudflare:workers';

import { ensureDatabase } from '@/db/initialize';
import { getActiveServices, getAvailableSlots } from '@/lib/dental-data';
import { recordUsage } from '@/lib/saas';

type AssistantResult = {
  reply: string;
  mode: 'gemini' | 'demo';
  toolsUsed: string[];
};

const functionDeclarations = [
  {
    name: 'list_services',
    description:
      'Consulta el catálogo autorizado de servicios, precios y duración de la clínica.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'find_availability',
    description:
      'Consulta horarios libres reales para una fecha. No crea ni confirma una cita.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' },
        doctor_id: {
          type: 'string',
          description:
            'ID del profesional. Omite este campo si cualquiera es válido.',
        },
        service_id: {
          type: 'string',
          description:
            'ID del servicio para respetar su duración al calcular horarios.',
        },
      },
      required: ['date'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_clinic_information',
    description: 'Devuelve ubicación, horario y medios de pago autorizados.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'request_human_help',
    description:
      'Solicita que recepción tome la conversación cuando el paciente lo pide o la situación requiere juicio humano.',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      required: ['reason'],
      additionalProperties: false,
    },
  },
] as const;

export async function generateAssistantReply(
  message: string,
  clinicId: string,
): Promise<AssistantResult> {
  await ensureDatabase();
  if (!(await hasAssistantCapacity(clinicId))) {
    return {
      reply:
        'En este momento el asistente alcanzó el límite mensual del plan. Voy a pedir a recepción que continúe contigo.',
      mode: 'demo',
      toolsUsed: ['request_human_help'],
    };
  }
  let result: AssistantResult;
  if (!process.env.GEMINI_API_KEY) {
    result = await generateDemoReply(message, clinicId);
  } else {
    try {
      result = await generateGeminiReply(message, clinicId);
    } catch (error) {
      console.error(
        'Gemini assistant failed, using safe demo fallback',
        error instanceof Error ? error.message : error,
      );
      result = await generateDemoReply(message, clinicId);
    }
  }
  await recordUsage(clinicId, 'ai_request');
  return result;
}

async function generateGeminiReply(
  message: string,
  clinicId: string,
): Promise<AssistantResult> {
  const clinic = await getClinicInformation(clinicId);
  if (!clinic) return generateDemoReply(message, clinicId);
  const systemInstruction = `Eres el asistente virtual de ${clinic.name}. Responde en español mexicano, con calidez y brevedad. Identifícate como asistente virtual cuando sea natural. Usa exclusivamente las herramientas para precios, servicios y disponibilidad; nunca inventes datos ni confirmes una cita sin que el sistema la haya creado. No diagnostiques ni indiques medicamentos. Ante sangrado severo, dificultad para respirar, trauma importante o dolor insoportable, recomienda atención de emergencia inmediata y solicita apoyo humano. Si falta información, pregunta solo lo indispensable. Fecha actual: ${new Intl.DateTimeFormat('en-CA', { timeZone: clinic.timezone }).format(new Date())}, zona horaria ${clinic.timezone}.`;
  const contents: GeminiContent[] = [
    { role: 'user', parts: [{ text: message }] },
  ];
  const toolsUsed: string[] = [];

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const response = await callGemini({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      tools: [{ functionDeclarations }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { temperature: 0.25, maxOutputTokens: 700 },
    });
    const modelContent = response.candidates?.[0]?.content;
    const calls = (modelContent?.parts ?? []).filter(
      (part): part is GeminiPart & { functionCall: GeminiFunctionCall } =>
        Boolean(part.functionCall?.name),
    );
    if (!calls.length) {
      return {
        reply:
          extractGeminiText(modelContent) ||
          'Puedo ayudarte a consultar servicios, costos y horarios disponibles.',
        mode: 'gemini',
        toolsUsed,
      };
    }
    if (!modelContent)
      throw new Error('Gemini no devolvió contenido utilizable.');
    contents.push(modelContent);
    const outputs: GeminiPart[] = [];
    for (const call of calls) {
      const name = call.functionCall.name;
      toolsUsed.push(name);
      const result = await executeTool(
        name,
        call.functionCall.args ?? {},
        clinicId,
      );
      outputs.push({
        functionResponse: {
          name,
          ...(call.functionCall.id ? { id: call.functionCall.id } : {}),
          response: { result },
        },
      });
    }
    contents.push({ role: 'user', parts: outputs });
  }
  return {
    reply: 'Voy a pedir a recepción que continúe contigo.',
    mode: 'gemini',
    toolsUsed,
  };
}

async function callGemini(
  body: Record<string, unknown>,
): Promise<GeminiResponse> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
  if (!/^[A-Za-z0-9._-]+$/.test(model))
    throw new Error('El modelo de Gemini configurado no es válido.');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Gemini returned ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
    );
  }
  return response.json() as Promise<GeminiResponse>;
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  clinicId: string,
) {
  if (name === 'list_services') {
    const services = await getActiveServices(clinicId);
    return services.map((service) => ({
      id: service.id,
      name: service.name,
      duration_minutes: service.durationMinutes,
      price_mxn: service.priceCents / 100,
      description: service.description,
    }));
  }
  if (name === 'find_availability') {
    const date = typeof args.date === 'string' ? args.date : '2026-09-01';
    const doctorId =
      typeof args.doctor_id === 'string' ? args.doctor_id : undefined;
    const serviceId =
      typeof args.service_id === 'string' ? args.service_id : undefined;
    const clinic = await getClinicInformation(clinicId);
    return {
      date,
      timezone: clinic?.timezone,
      slots: await getAvailableSlots(clinicId, date, doctorId, serviceId),
    };
  }
  if (name === 'get_clinic_information') {
    return getClinicInformation(clinicId);
  }
  if (name === 'request_human_help')
    return { escalated: true, message: 'Recepción fue notificada.' };
  return { error: 'Herramienta no disponible.' };
}

async function generateDemoReply(
  message: string,
  clinicId: string,
): Promise<AssistantResult> {
  const normalized = message.toLocaleLowerCase('es-MX');
  if (
    /sangrado|no puedo respirar|dificultad.*respirar|golpe fuerte|trauma|dolor insoportable/.test(
      normalized,
    )
  ) {
    return {
      reply:
        'Por lo que describes, busca atención de emergencia inmediata. No puedo diagnosticarte por este medio. También avisaré a recepción para que te apoye cuanto antes.',
      mode: 'demo',
      toolsUsed: ['request_human_help'],
    };
  }
  if (/persona|recepci[oó]n|humano|doctor|doctora|asesor/.test(normalized)) {
    return {
      reply:
        'Claro. Voy a pasar esta conversación a recepción para que una persona continúe contigo.',
      mode: 'demo',
      toolsUsed: ['request_human_help'],
    };
  }
  const services = await getActiveServices(clinicId);
  if (
    /todos? los servicios|que servicios|qué servicios|catalogo|catálogo|servicios disponibles/.test(
      normalized,
    )
  ) {
    if (!services.length) {
      return {
        reply:
          'Por el momento no tengo servicios publicados en el catálogo. Voy a pedir a recepción que te comparta la información.',
        mode: 'demo',
        toolsUsed: ['list_services'],
      };
    }
    const serviceList = services
      .map((service) => {
        const price = new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: 'MXN',
          maximumFractionDigits: 0,
        }).format(service.priceCents / 100);
        return `• ${service.name}: ${price}, ${service.durationMinutes} minutos`;
      })
      .join('\n');
    return {
      reply: `Estos son los servicios disponibles:\n${serviceList}\n\n¿Cuál te interesa consultar?`,
      mode: 'demo',
      toolsUsed: ['list_services'],
    };
  }
  const matched =
    services.find((service) =>
      normalized.includes(
        service.name.toLocaleLowerCase('es-MX').split(' ')[0],
      ),
    ) ??
    (normalized.includes('precio') ||
    normalized.includes('costo') ||
    normalized.includes('cuánto')
      ? services[0]
      : undefined);
  if (matched) {
    const price = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(matched.priceCents / 100);
    if (/horario|cita|disponib|mañana/.test(normalized)) {
      const clinic = await getClinicInformation(clinicId);
      const date = tomorrowInTimeZone(
        clinic?.timezone ?? 'America/Mexico_City',
      );
      const slots = await getAvailableSlots(clinicId, date);
      const labels = slots
        .slice(0, 3)
        .map((value) =>
          formatTime(value, clinic?.timezone ?? 'America/Mexico_City'),
        )
        .join(', ');
      const availability = labels || 'ningún horario libre en la agenda';
      return {
        reply: `${matched.name} tiene un costo de ${price} y dura aproximadamente ${matched.durationMinutes} minutos. Para mañana encontré ${availability}. ¿Quieres que revise otra fecha?`,
        mode: 'demo',
        toolsUsed: ['list_services', 'find_availability'],
      };
    }
    return {
      reply: `${matched.name} tiene un costo de ${price} y dura aproximadamente ${matched.durationMinutes} minutos. ¿Quieres que busque horarios disponibles?`,
      mode: 'demo',
      toolsUsed: ['list_services'],
    };
  }
  if (
    /ubicaci[oó]n|direcci[oó]n|d[oó]nde|tarjeta|pago|horario/.test(normalized)
  ) {
    const clinic = await getClinicInformation(clinicId);
    return {
      reply: `${clinic?.address ? `Estamos en ${clinic.address}. ` : ''}${clinic?.hoursText ?? 'Nuestro horario está disponible con recepción.'} Aceptamos tarjeta, transferencia y efectivo.`,
      mode: 'demo',
      toolsUsed: ['get_clinic_information'],
    };
  }
  const clinic = await getClinicInformation(clinicId);
  return {
    reply: `¡Hola! Soy el asistente virtual de ${clinic?.name ?? 'nuestro negocio'}. Puedo ayudarte con servicios, costos, horarios o para agendar una cita. ¿Qué necesitas?`,
    mode: 'demo',
    toolsUsed: [],
  };
}

type GeminiFunctionCall = {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
};
type GeminiPart = {
  text?: string;
  thoughtSignature?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: {
    id?: string;
    name: string;
    response: Record<string, unknown>;
  };
};
type GeminiContent = { role: string; parts: GeminiPart[] };
type GeminiResponse = {
  candidates?: Array<{ content?: GeminiContent }>;
};

function extractGeminiText(content?: GeminiContent): string {
  return (content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
}

function tomorrowInTimeZone(timeZone: string): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(
    new Date(),
  );
  const value = new Date(`${today}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function formatTime(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function hasAssistantCapacity(clinicId: string): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT p.max_ai_requests AS limitValue, p.max_conversations AS conversationLimit, s.current_period_end AS periodEnd, COALESCE((SELECT SUM(quantity) FROM usage_events u WHERE u.clinic_id = s.clinic_id AND u.metric = 'ai_request' AND u.created_at >= s.current_period_start), 0) AS usedValue, COALESCE((SELECT SUM(quantity) FROM usage_events u WHERE u.clinic_id = s.clinic_id AND u.metric = 'conversation' AND u.created_at >= s.current_period_start), 0) AS conversationValue FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id WHERE s.clinic_id = ? AND s.status IN ('trialing', 'active')`,
  )
    .bind(clinicId)
    .first<{
      limitValue: number;
      conversationLimit: number;
      periodEnd: string;
      usedValue: number;
      conversationValue: number;
    }>();
  return Boolean(
    row &&
      new Date(row.periodEnd).getTime() >= Date.now() &&
      Number(row.usedValue) < Number(row.limitValue) &&
      Number(row.conversationValue) <= Number(row.conversationLimit),
  );
}

async function getClinicInformation(clinicId: string): Promise<null | {
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
  hoursText: string;
  payment_methods: string[];
}> {
  const clinic = await env.DB.prepare(
    'SELECT name, address, phone, timezone FROM clinics WHERE id = ?',
  )
    .bind(clinicId)
    .first<{
      name: string;
      address: string | null;
      phone: string | null;
      timezone: string;
    }>();
  if (!clinic) return null;
  const hours = await env.DB.prepare(
    'SELECT day_of_week AS dayOfWeek, opens_at AS opensAt, closes_at AS closesAt, active FROM business_hours WHERE clinic_id = ? ORDER BY day_of_week',
  )
    .bind(clinicId)
    .all<{
      dayOfWeek: number;
      opensAt: string;
      closesAt: string;
      active: number;
    }>();
  const dayNames = [
    'domingo',
    'lunes',
    'martes',
    'miércoles',
    'jueves',
    'viernes',
    'sábado',
  ];
  const activeHours = hours.results
    .filter((item) => item.active)
    .map(
      (item) => `${dayNames[item.dayOfWeek]} ${item.opensAt}–${item.closesAt}`,
    )
    .join(', ');
  return {
    ...clinic,
    hoursText: activeHours
      ? `Atendemos ${activeHours}.`
      : 'El horario está pendiente de configuración.',
    payment_methods: ['tarjeta', 'transferencia', 'efectivo'],
  };
}
