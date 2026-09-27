import { AlertLevel, WeatherData } from './types';

/* Plantillas de los mensajes que llegan al grupo de WhatsApp de la comunidad.
   Sin dependencias de servidor para poder usarlas también en la vista previa. */

const SIGNATURE = '— Comité de Gestión del Riesgo de Tocancipá';
const EMERGENCY_LINE = '123';

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday:  'long',
    day:      'numeric',
    month:    'short',
    hour:     'numeric',
    minute:   '2-digit',
    hour12:   true,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const weekday = get('weekday');
  const month   = get('month').replace('.', '');
  const period  = get('dayPeriod').replace(/\s/g, ' ');

  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${get('day')} de ${month} · ${get('hour')}:${get('minute')} ${period}`;
}

function rainRate(weather: Partial<WeatherData>): number | undefined {
  const p = weather.precipitation;
  return typeof p === 'number' && Number.isFinite(p) ? p : undefined;
}

function mmPerHour(value: number): string {
  return `${Number(value.toFixed(1))} mm por hora`;
}

function buildInformativo(weather: Partial<WeatherData>, date: string): string {
  const rain = rainRate(weather);
  const status =
    rain === undefined ? 'Por ahora todo está tranquilo'
    : rain === 0       ? 'Por ahora todo está tranquilo: no está lloviendo'
    :                    `Por ahora todo está tranquilo: está lloviendo poco (${mmPerHour(rain)})`;

  return (
    `🟢 *Reporte del clima – Tocancipá*\n` +
    `${date}\n\n` +
    `Hola, vecinos 👋\n` +
    `${status} y no hay riesgo de inundación en La Esmeralda.\n\n` +
    `Un favor: si ven canales o desagües tapados cerca de su casa, cuéntennos por aquí. Seguimos pendientes.`
  );
}

function buildPreventivo(weather: Partial<WeatherData>, date: string): string {
  const rain = rainRate(weather);
  const status = rain
    ? `Está lloviendo más de lo normal (${mmPerHour(rain)}) y el suelo ya está muy mojado.`
    : 'El clima está cambiando y puede llover fuerte en las próximas horas.';

  return (
    `🟡 *Atentos, vecinos de La Esmeralda*\n` +
    `${date}\n\n` +
    `${status} No es para alarmarse, pero sí para estar preparados:\n\n` +
    `• Tengan a mano documentos, medicamentos, linterna y cargador.\n` +
    `• Suban a un lugar alto lo que no se puede mojar.\n` +
    `• Estén pendientes de la quebrada. Si la ven crecer, avisen por aquí.\n` +
    `• Piensen desde ya por dónde saldrían si toca evacuar.\n\n` +
    `Les vamos contando por este grupo.`
  );
}

function buildAlerta(weather: Partial<WeatherData>, date: string): string {
  const rain = rainRate(weather);
  const status = rain
    ? `Vecinos, está lloviendo muy fuerte (${mmPerHour(rain)}) y hay riesgo real de inundación.`
    : 'Vecinos, las condiciones del clima son peligrosas y hay riesgo real de inundación.';

  return (
    `🟠 *ALERTA por lluvias fuertes – La Esmeralda*\n` +
    `${date}\n\n` +
    `${status}\n\n` +
    `*Si vive en zona baja o cerca de la quebrada, salga ahora hacia un lugar alto o a la casa de un familiar.* No espere a que el agua llegue.\n\n` +
    `• Lleve solo lo básico: documentos, medicamentos y agua.\n` +
    `• Ayude a salir a adultos mayores, niños y personas con discapacidad.\n` +
    `• No cruce calles ni puentes con agua corriendo.\n` +
    `• Si el agua se acerca a la casa, baje los tacos de la luz.\n\n` +
    `Defensa Civil y Bomberos ya están atentos.\n` +
    `📞 Emergencias: ${EMERGENCY_LINE}`
  );
}

function buildEmergencia(): string {
  return (
    `🔴 *EMERGENCIA – SALGAN YA DE LA ESMERALDA*\n\n` +
    `Hay riesgo de inundación inmediato. Salgan ahora hacia zonas altas. No se queden recogiendo cosas.\n\n` +
    `• No crucen corrientes de agua, ni a pie ni en carro.\n` +
    `• Si alguien no puede salir, llamen al ${EMERGENCY_LINE} y digan dónde está.\n\n` +
    `Los organismos de socorro ya van en camino.\n` +
    `📲 Reenvíen este mensaje a quien no esté en el grupo.`
  );
}

export function buildAlertMessage(
  level: AlertLevel,
  note: string,
  weather: Partial<WeatherData>,
  now: Date = new Date()
): string {
  const date = formatDate(now);

  const body =
    level === 'INFORMATIVO' ? buildInformativo(weather, date)
    : level === 'PREVENTIVO' ? buildPreventivo(weather, date)
    : level === 'ALERTA'     ? buildAlerta(weather, date)
    :                          buildEmergencia();

  const trimmedNote = note.trim();
  const noteBlock = trimmedNote ? `\n\n📝 *Nota del comité:* ${trimmedNote}` : '';

  return `${body}${noteBlock}\n\n${SIGNATURE}`;
}
