import { AlertLevel, WeatherData } from './types';
import { buildAlertMessage } from './alertMessage';
import { sendTextMessage, sendMediaMessage } from './evolution/client';   // ← CAMBIO 1
import { loadLevelImage } from './whatsappImages';                        // ← CAMBIO 2 (línea nueva)

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppAlert(
  level: AlertLevel,
  message: string,
  weather: Partial<WeatherData>,
  options: { includeImage?: boolean } = {}
): Promise<WhatsAppResult> {
  const recipients = (process.env.WHATSAPP_RECIPIENTS ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { success: false, error: 'WHATSAPP_RECIPIENTS no está configurado' };
  }

  const body = buildAlertMessage(level, message, weather);
  // loadLevelImage devuelve null para los niveles sin imagen (ALERTA/EMERGENCIA)
  const image = options.includeImage === false ? null : await loadLevelImage(level);

  try {
    const results = await Promise.all(
      recipients.map(async (number) => {                                  // ← CAMBIO 4 (reemplaza el map de una línea)
        if (!image) return sendTextMessage(number, body);
        const withImage = await sendMediaMessage(number, body, image);
        if (withImage.success) return withImage;
        // Respaldo: si la imagen falla, que al menos llegue el texto
        console.error(`[whatsapp] Falló el envío con imagen a ${number}: ${withImage.error}`);
        return sendTextMessage(number, body);
      })
    );

    const firstFailure = results.find((r) => !r.success);
    if (firstFailure) {
      return { success: false, error: firstFailure.error ?? 'Error desconocido de WhatsApp' };
    }

    return { success: true, messageId: results[0]?.messageId };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}