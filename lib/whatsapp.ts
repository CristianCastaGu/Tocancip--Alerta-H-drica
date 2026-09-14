import { AlertLevel, WeatherData } from './types';
import { LEVEL_LABELS } from './riskEngine';
import { sendTextMessage } from './evolution/client';

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const LEVEL_EMOJIS: Record<AlertLevel, string> = {
  INFORMATIVO: 'ℹ️',
  PREVENTIVO:  '⚠️',
  ALERTA:      '🔶',
  EMERGENCIA:  '🚨',
};

/* Acciones de protección por nivel — basadas en PMGRD Tocancipá */
const PROTECTION_ACTIONS: Record<AlertLevel, string> = {
  INFORMATIVO:
    '✅ Monitoreo de rutina activo.\n' +
    '• Verificar canales y drenajes en zonas bajas.\n' +
    '• Mantener comunicación con líderes comunales.',

  PREVENTIVO:
    '⚠️ Acciones preventivas requeridas:\n' +
    '• Revisar y activar protocolos de evacuación.\n' +
    '• Alertar a comunidades de la Vereda La Esmeralda.\n' +
    '• Verificar aforo de quebradas y cuerpos de agua.\n' +
    '• Mantener equipos de respuesta en alerta.',

  ALERTA:
    '🔶 Acciones de contingencia inmediatas:\n' +
    '• Activar brigadas de respuesta de Defensa Civil.\n' +
    '• Evacuar zonas de ladera baja y áreas inundables.\n' +
    '• Coordinar con Bomberos Voluntarios Tocancipá.\n' +
    '• Restringir tránsito en vías afectadas.\n' +
    '• Abrir albergues temporales.',

  EMERGENCIA:
    '🚨 EVACUACIÓN INMEDIATA:\n' +
    '• Evacuar de inmediato la Vereda La Esmeralda.\n' +
    '• Activar el PMGRD (Plan Municipal de Gestión del Riesgo).\n' +
    '• Coordinar con UNGRD, Cruz Roja y Ejército Nacional.\n' +
    '• Cerrar vías de acceso a zonas de inundación.\n' +
    '• Activar línea de emergencias 112.',
};

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

  const now = new Date().toLocaleString('es-CO', {
    timeZone:  'America/Bogota',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const body =
    `${LEVEL_EMOJIS[level]} *ALERTA ${LEVEL_LABELS[level].toUpperCase()} — TAH TOCANCIPÁ*\n\n` +
    `📅 *Fecha y hora:* ${now}\n` +
    `📍 *Lugar:* Municipio de Tocancipá, Cundinamarca\n` +
    `🏛 *Fuente:* Comité de Gestión de Riesgo de Tocancipá\n\n` +
    `⚡ *Riesgo potencial:* Inundación con impacto en la población\n` +
    `   de la Vereda La Esmeralda, Tocancipá.\n\n` +
    `📊 *Condiciones meteorológicas actuales:*\n` +
    `   🌧 Precipitación: ${weather.precipitation?.toFixed(1) ?? 'N/D'} mm/h\n` +
    `   💧 Humedad relativa: ${weather.humidity?.toFixed(0) ?? 'N/D'}%\n` +
    `   💨 Velocidad del viento: ${weather.windSpeed?.toFixed(1) ?? 'N/D'} km/h\n` +
    `   🌡 Temperatura: ${weather.temperature?.toFixed(1) ?? 'N/D'} °C\n\n` +
    (message ? `📝 *Observación:* ${message}\n\n` : '') +
    `🛡 *Acciones de protección:*\n${PROTECTION_ACTIONS[level]}\n\n` +
    `_Sistema de Alerta Temprana Hídrica — Municipio de Tocancipá_`;

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
