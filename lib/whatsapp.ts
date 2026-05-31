import { AlertLevel, WeatherData } from './types';
import { LEVEL_LABELS } from './riskEngine';

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
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient = process.env.WHATSAPP_RECIPIENT;

  if (!token || !phoneNumberId || !recipient) {
    return { success: false, error: 'Variables de entorno de WhatsApp no configuradas' };
  }

  const levelEmojis: Record<AlertLevel, string> = {
    INFORMATIVO: 'ℹ️',
    PREVENTIVO: '⚠️',
    ALERTA: '🔶',
    EMERGENCIA: '🚨',
  };

  const body =
    `${levelEmojis[level]} *ALERTA TAH — ${LEVEL_LABELS[level].toUpperCase()}*\n\n` +
    `📅 ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}\n` +
    `🌧 Precipitación: ${weather.precipitation?.toFixed(1) ?? 'N/D'} mm\n` +
    `💧 Humedad: ${weather.humidity?.toFixed(0) ?? 'N/D'}%\n` +
    `💨 Viento: ${weather.windSpeed?.toFixed(1) ?? 'N/D'} km/h\n` +
    `🌡 Temperatura: ${weather.temperature?.toFixed(1) ?? 'N/D'} °C\n\n` +
    `📝 ${message || 'Sin mensaje adicional.'}\n\n` +
    `— Sistema TAH · Municipio de Tocancipá`;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: recipient,
          type: 'text',
          text: { body },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data?.error?.message ?? 'Error desconocido de WhatsApp' };
    }

    return { success: true, messageId: data?.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
