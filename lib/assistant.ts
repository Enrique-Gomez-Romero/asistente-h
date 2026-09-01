import { getActiveServices, getAvailableSlots } from '@/lib/dental-data';

type AssistantResult = {
  reply: string;
  mode: 'openai' | 'demo';
  toolsUsed: string[];
};

const tools = [
  {
    type: 'function',
    name: 'list_services',
    description: 'Consulta el catálogo autorizado de servicios, precios y duración de la clínica.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    type: 'function',
    name: 'find_availability',
    description: 'Consulta horarios libres reales para una fecha. No crea ni confirma una cita.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' },
        doctor_id: { type: ['string', 'null'], description: 'ID del doctor o null si cualquiera es válido.' },
      },
      required: ['date', 'doctor_id'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_clinic_information',
    description: 'Devuelve ubicación, horario y medios de pago autorizados.',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    type: 'function',
    name: 'request_human_help',
    description: 'Solicita que recepción tome la conversación cuando el paciente lo pide o la situación requiere juicio humano.',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      required: ['reason'],
      additionalProperties: false,
    },
    strict: true,
  },
] as const;

export async function generateAssistantReply(message: string): Promise<AssistantResult> {
  if (!process.env.OPENAI_API_KEY) return generateDemoReply(message);
  try {
    return await generateOpenAiReply(message);
  } catch (error) {
    console.error('OpenAI assistant failed, using safe demo fallback', error);
    return generateDemoReply(message);
  }
}

async function generateOpenAiReply(message: string): Promise<AssistantResult> {
  let response = await callOpenAi({
    model: process.env.OPENAI_MODEL ?? 'gpt-5.6-luna',
    instructions: `Eres el asistente virtual de Clínica Sonrisa. Responde en español mexicano, con calidez y brevedad. Identifícate como asistente virtual cuando sea natural. Usa exclusivamente las herramientas para precios, servicios y disponibilidad; nunca inventes datos ni confirmes una cita sin que el sistema la haya creado. No diagnostiques ni indiques medicamentos. Ante sangrado severo, dificultad para respirar, trauma importante o dolor insoportable, recomienda atención de emergencia inmediata y solicita apoyo humano. Si falta información, pregunta solo lo indispensable. Fecha actual: 2026-08-31, zona horaria America/Mexico_City.`,
    input: message,
    tools,
    tool_choice: 'auto',
    store: false,
  });
  const toolsUsed: string[] = [];

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const calls = (response.output ?? []).filter((item: OpenAiOutput) => item.type === 'function_call');
    if (!calls.length) {
      return { reply: extractOutputText(response) || 'Puedo ayudarte a consultar servicios, costos y horarios disponibles.', mode: 'openai', toolsUsed };
    }
    const outputs = [];
    for (const call of calls) {
      toolsUsed.push(call.name ?? 'unknown');
      const args = safeJson(call.arguments);
      const result = await executeTool(call.name ?? '', args);
      outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
    }
    response = await callOpenAi({
      model: process.env.OPENAI_MODEL ?? 'gpt-5.6-luna',
      previous_response_id: response.id,
      input: outputs,
      tools,
      store: false,
    });
  }
  return { reply: extractOutputText(response) || 'Voy a pedir a recepción que continúe contigo.', mode: 'openai', toolsUsed };
}

async function callOpenAi(body: Record<string, unknown>): Promise<OpenAiResponse> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
  return response.json() as Promise<OpenAiResponse>;
}

async function executeTool(name: string, args: Record<string, unknown>) {
  if (name === 'list_services') {
    const services = await getActiveServices();
    return services.map((service) => ({ id: service.id, name: service.name, duration_minutes: service.durationMinutes, price_mxn: service.priceCents / 100, description: service.description }));
  }
  if (name === 'find_availability') {
    const date = typeof args.date === 'string' ? args.date : '2026-09-01';
    const doctorId = typeof args.doctor_id === 'string' ? args.doctor_id : undefined;
    return { date, timezone: 'America/Mexico_City', slots: await getAvailableSlots(date, doctorId) };
  }
  if (name === 'get_clinic_information') {
    return { address: 'Av. Reforma 120, Ciudad de México', hours: 'Lunes a viernes de 9:00 a 19:00; sábado de 9:00 a 14:00', payment_methods: ['tarjeta', 'transferencia', 'efectivo'] };
  }
  if (name === 'request_human_help') return { escalated: true, message: 'Recepción fue notificada.' };
  return { error: 'Herramienta no disponible.' };
}

async function generateDemoReply(message: string): Promise<AssistantResult> {
  const normalized = message.toLocaleLowerCase('es-MX');
  if (/sangrado|no puedo respirar|dificultad.*respirar|golpe fuerte|trauma|dolor insoportable/.test(normalized)) {
    return { reply: 'Por lo que describes, busca atención de emergencia inmediata. No puedo diagnosticarte por este medio. También avisaré a recepción para que te apoye cuanto antes.', mode: 'demo', toolsUsed: ['request_human_help'] };
  }
  if (/persona|recepci[oó]n|humano|doctor|doctora|asesor/.test(normalized)) {
    return { reply: 'Claro. Voy a pasar esta conversación a recepción para que una persona continúe contigo.', mode: 'demo', toolsUsed: ['request_human_help'] };
  }
  const services = await getActiveServices();
  const matched = services.find((service) => normalized.includes(service.name.toLocaleLowerCase('es-MX').split(' ')[0])) ?? (normalized.includes('precio') || normalized.includes('costo') || normalized.includes('cuánto') ? services[0] : undefined);
  if (matched) {
    const price = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(matched.priceCents / 100);
    if (/horario|cita|disponib|mañana/.test(normalized)) {
      const date = tomorrowInMexico();
      const slots = await getAvailableSlots(date);
      const labels = slots.slice(0, 3).map(formatMexicoTime).join(', ');
      return { reply: `${matched.name} tiene un costo de ${price} y dura aproximadamente ${matched.durationMinutes} minutos. Para mañana tengo disponibles ${labels}. ¿Qué horario prefieres?`, mode: 'demo', toolsUsed: ['list_services', 'find_availability'] };
    }
    return { reply: `${matched.name} tiene un costo de ${price} y dura aproximadamente ${matched.durationMinutes} minutos. ¿Quieres que busque horarios disponibles?`, mode: 'demo', toolsUsed: ['list_services'] };
  }
  if (/ubicaci[oó]n|direcci[oó]n|d[oó]nde|tarjeta|pago|horario/.test(normalized)) {
    return { reply: 'Estamos en Av. Reforma 120, Ciudad de México. Atendemos de lunes a viernes de 9:00 a 19:00 y sábado de 9:00 a 14:00. Aceptamos tarjeta, transferencia y efectivo.', mode: 'demo', toolsUsed: ['get_clinic_information'] };
  }
  return { reply: '¡Hola! Soy el asistente virtual de Clínica Sonrisa. Puedo ayudarte con servicios, costos, horarios o para agendar una cita. ¿Qué necesitas?', mode: 'demo', toolsUsed: [] };
}

type OpenAiOutput = { type?: string; name?: string; call_id?: string; arguments?: string; content?: Array<{ type?: string; text?: string }> };
type OpenAiResponse = { id: string; output?: OpenAiOutput[]; output_text?: string };

function extractOutputText(response: OpenAiResponse): string {
  if (response.output_text) return response.output_text;
  return (response.output ?? []).flatMap((item) => item.content ?? []).filter((part) => part.type === 'output_text').map((part) => part.text ?? '').join('\n').trim();
}

function safeJson(value?: string): Record<string, unknown> {
  try { return value ? JSON.parse(value) as Record<string, unknown> : {}; } catch { return {}; }
}

function tomorrowInMexico(): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + 1);
  return now.toISOString().slice(0, 10);
}

function formatMexicoTime(value: string): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
