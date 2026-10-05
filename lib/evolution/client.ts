/**
 * Cliente de bajo nivel para Evolution API (https://doc.evolution-api.com).
 * Evolution API expone WhatsApp mediante una conexión tipo WhatsApp Web (Baileys),
 * autenticada por QR — no requiere aprobación de Meta Business.
 */

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

function getConfig(): EvolutionConfig {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

  if (!baseUrl || !apiKey || !instanceName) {
    throw new Error(
      'Evolution API no configurada. Define EVOLUTION_API_URL, EVOLUTION_API_KEY y EVOLUTION_INSTANCE_NAME.'
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, instanceName };
}

async function evoFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const { baseUrl, apiKey } = getConfig();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
        // Evita la página de advertencia HTML que ngrok inserta en su plan gratuito
        'ngrok-skip-browser-warning': 'true',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const message =
        (data && (data.message || data.error || JSON.stringify(data))) ||
        `Error HTTP ${response.status}`;
      return { ok: false, status: response.status, data, error: Array.isArray(message) ? message.join(', ') : message };
    }

    return { ok: true, status: response.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: (err as Error).message };
  }
}

export interface InstanceStatus {
  exists: boolean;
  state: 'open' | 'connecting' | 'close' | 'unknown';
}

export async function getInstanceStatus(): Promise<InstanceStatus> {
  const { instanceName } = getConfig();
  const res = await evoFetch<{ instance?: { state?: string } }>(
    `/instance/connectionState/${instanceName}`
  );

  if (!res.ok) {
    if (res.status === 404) return { exists: false, state: 'close' };
    return { exists: false, state: 'unknown' };
  }

  const state = (res.data?.instance?.state ?? 'unknown') as InstanceStatus['state'];
  return { exists: true, state };
}

export interface QrResult {
  base64?: string;
  pairingCode?: string;
  connected?: boolean;
  error?: string;
}

/** Crea la instancia si no existe todavía. Idempotente. */
async function ensureInstanceExists(): Promise<QrResult | null> {
  const { instanceName } = getConfig();

  const res = await evoFetch<{ qrcode?: { base64?: string; pairingCode?: string } }>(
    '/instance/create',
    {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      }),
    }
  );

  if (res.ok) {
    return {
      base64: res.data?.qrcode?.base64,
      pairingCode: res.data?.qrcode?.pairingCode,
    };
  }

  // 403/409: la instancia ya existe — no es un error, seguimos con /instance/connect
  if (res.status === 403 || res.status === 409) return null;

  return { error: res.error ?? 'No fue posible crear la instancia en Evolution API' };
}

/** Obtiene (o genera) el código QR para vincular WhatsApp. */
export async function getQrCode(): Promise<QrResult> {
  const { instanceName } = getConfig();

  const status = await getInstanceStatus();
  if (status.exists && status.state === 'open') {
    return { connected: true };
  }

  if (!status.exists) {
    const created = await ensureInstanceExists();
    if (created?.base64 || created?.pairingCode) return created;
    if (created?.error) return created;
  }

  const res = await evoFetch<{ base64?: string; pairingCode?: string; count?: number }>(
    `/instance/connect/${instanceName}`
  );

  if (!res.ok) {
    return { error: res.error ?? 'No fue posible obtener el código QR' };
  }

  return { base64: res.data?.base64, pairingCode: res.data?.pairingCode };
}

export async function logoutInstance(): Promise<{ ok: boolean; error?: string }> {
  const { instanceName } = getConfig();
  const res = await evoFetch(`/instance/logout/${instanceName}`, { method: 'DELETE' });
  return { ok: res.ok, error: res.error };
}

export async function restartInstance(): Promise<{ ok: boolean; error?: string }> {
  const { instanceName } = getConfig();
  const res = await evoFetch(`/instance/restart/${instanceName}`, { method: 'PUT' });
  return { ok: res.ok, error: res.error };
}

export interface WhatsAppGroup {
  id: string;
  subject: string;
  size?: number;
}

/** Lista los grupos de WhatsApp de los que la instancia conectada es miembro. */
export async function fetchGroups(): Promise<{ groups: WhatsAppGroup[]; error?: string }> {
  const { instanceName } = getConfig();

  const res = await evoFetch<Array<{ id: string; subject: string; size?: number }>>(
    `/group/fetchAllGroups/${instanceName}?getParticipants=false`
  );

  if (!res.ok) {
    return { groups: [], error: res.error ?? 'No fue posible obtener los grupos' };
  }

  const groups = (res.data ?? []).map((g) => ({ id: g.id, subject: g.subject, size: g.size }));
  return { groups };
}

export interface SendTextResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Envía un mensaje de texto. `number` en formato internacional sin '+' (ej: 573001234567). */
export async function sendTextMessage(number: string, text: string): Promise<SendTextResult> {
  const { instanceName } = getConfig();

  const res = await evoFetch<{ key?: { id?: string } }>(
    `/message/sendText/${instanceName}`,
    {
      method: 'POST',
      body: JSON.stringify({ number, text }),
    }
  );

  if (!res.ok) {
    return { success: false, error: res.error ?? 'Error desconocido al enviar el mensaje' };
  }

  return { success: true, messageId: res.data?.key?.id };
}

/** Envía una imagen (base64 sin prefijo `data:`) con el texto como caption. */
export async function sendMediaMessage(
  number: string,
  caption: string,
  image: { base64: string; mimetype: string; fileName: string }
): Promise<SendTextResult> {
  const { instanceName } = getConfig();

  const res = await evoFetch<{ key?: { id?: string } }>(
    `/message/sendMedia/${instanceName}`,
    {
      method: 'POST',
      body: JSON.stringify({
        number,
        mediatype: 'image',
        mimetype: image.mimetype,
        caption,
        media: image.base64,
        fileName: image.fileName,
      }),
    }
  );

  if (!res.ok) {
    return { success: false, error: res.error ?? 'Error al enviar la imagen' };
  }

  return { success: true, messageId: res.data?.key?.id };
}