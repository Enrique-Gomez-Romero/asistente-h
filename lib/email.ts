type InvitationEmailInput = {
  invitationId: string;
  recipient: string;
  inviterName: string;
  organizationName: string;
  role: string;
  token: string;
};

export async function sendInvitationEmail(
  input: InvitationEmailInput,
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.PUBLIC_APP_URL;
  if (!apiKey || !from || !appUrl)
    return {
      sent: false,
      error: 'Falta configurar RESEND_API_KEY, EMAIL_FROM o PUBLIC_APP_URL.',
    };
  const invitationUrl = new URL(
    `/invite/${encodeURIComponent(input.token)}`,
    trustedAppOrigin(appUrl),
  ).toString();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `invite-${input.invitationId}-${input.token.slice(0, 12)}`,
      'User-Agent': 'Asistente-H/1.0',
    },
    body: JSON.stringify({
      from,
      to: [input.recipient],
      subject: `Invitación para colaborar en ${input.organizationName}`,
      html: invitationHtml({ ...input, invitationUrl }),
      text: `${input.inviterName} te invitó a colaborar en ${input.organizationName} con el rol ${input.role}. Acepta la invitación aquí: ${invitationUrl}`,
      tags: [{ name: 'category', value: 'team_invitation' }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return {
      sent: false,
      error: `El correo no pudo enviarse (${response.status})${detail ? `: ${detail.slice(0, 180)}` : '.'}`,
    };
  }
  return { sent: true };
}

function trustedAppOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost')
    throw new Error('PUBLIC_APP_URL debe utilizar HTTPS.');
  return url.origin;
}

function invitationHtml(
  input: InvitationEmailInput & { invitationUrl: string },
) {
  const organization = escapeHtml(input.organizationName);
  const inviter = escapeHtml(input.inviterName);
  const role = escapeHtml(input.role);
  const url = escapeHtml(input.invitationUrl);
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f8f6;font-family:Arial,sans-serif;color:#173b34"><div style="max-width:560px;margin:40px auto;padding:32px;background:white;border-radius:20px"><div style="font-size:20px;font-weight:700;margin-bottom:24px">Asistente H</div><h1 style="font-size:28px;line-height:1.2;margin:0 0 16px">Te invitaron a ${organization}</h1><p style="line-height:1.6;color:#61716c">${inviter} te invitó a colaborar como <strong>${role}</strong>. Inicia sesión con el mismo correo al que recibiste este mensaje.</p><a href="${url}" style="display:inline-block;margin-top:18px;padding:13px 20px;background:#1e806a;color:white;text-decoration:none;border-radius:10px;font-weight:700">Aceptar invitación</a><p style="margin-top:24px;font-size:12px;line-height:1.5;color:#788984">Este enlace vence en siete días y solo funciona para ${escapeHtml(input.recipient)}.</p></div></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}
