import { AlertLevel, WeatherData } from './types';
import { buildAlertMessage } from './alertMessage';
import { sendTextMessage } from './evolution/client';

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppAlert(
  level: AlertLevel,
  message: string,
  weather: Partial<WeatherData>
): Promise<WhatsAppResult> {
  const recipients = (process.env.WHATSAPP_RECIPIENTS ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { success: false, error: 'WHATSAPP_RECIPIENTS no está configurado' };
  }

  const body = buildAlertMessage(level, message, weather);

  try {
    const results = await Promise.all(
      recipients.map((number) => sendTextMessage(number, body))
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
