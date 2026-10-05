import { NextRequest, NextResponse } from 'next/server';
import { collectWeather } from '@/lib/weather/collect';
import { assessRisk, consensus, LEVEL_ORDER } from '@/lib/riskEngine';
import { sendWhatsAppAlert } from '@/lib/whatsapp';
import prisma from '@/lib/prisma';
import { AlertLevel, Thresholds } from '@/lib/types';

export const dynamic = 'force-dynamic';

/* Una alerta deja de considerarse "vigente" pasado este tiempo. Sin esto, una
   EMERGENCIA antigua silenciaría al agente para siempre (nada escala por encima). */
const ALERT_VALIDITY_MS = 6 * 60 * 60 * 1000;

async function evaluate(req: NextRequest) {
  /* Vercel Cron envía "Authorization: Bearer <CRON_SECRET>" cuando la variable existe */
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const threshold = await prisma.threshold.findFirst({ orderBy: { updatedAt: 'desc' } });

  if (!threshold?.autoEnabled) {
    return NextResponse.json({ message: 'Agente automático desactivado' });
  }

  const weather = await collectWeather();
  const avg = consensus(weather.current);
  if (!avg) {
    return NextResponse.json({ message: 'Ninguna fuente meteorológica disponible' }, { status: 503 });
  }

  const thresholds: Thresholds = {
    precipPreventivo: threshold.precipPreventivo,
    precipAlerta: threshold.precipAlerta,
    precipEmergencia: threshold.precipEmergencia,
    windPreventivo: threshold.windPreventivo,
    windAlerta: threshold.windAlerta,
    windEmergencia: threshold.windEmergencia,
    humidityPreventivo: threshold.humidityPreventivo,
  };

  const risk = assessRisk(weather.current, thresholds, weather.rainStats);
  const newLevel = risk.level;

  const lastAlert = await prisma.alert.findFirst({
    where: { createdAt: { gte: new Date(Date.now() - ALERT_VALIDITY_MS) } },
    orderBy: { createdAt: 'desc' },
  });
  const lastLevel: AlertLevel = lastAlert?.level ?? 'INFORMATIVO';

  if (LEVEL_ORDER[newLevel] <= LEVEL_ORDER[lastLevel]) {
    return NextResponse.json({ message: 'Sin escalada de riesgo', current: newLevel, iri: risk.iri.iri });
  }

  const waResult = await sendWhatsAppAlert(newLevel, '', avg);

  const alert = await prisma.alert.create({
    data: {
      level: newLevel,
      triggeredBy: 'auto',
      message: `Activación automática — ${risk.reason}`,
      waStatus: waResult.success ? 'sent' : 'failed',
      waMessageId: waResult.messageId ?? null,
      weatherData: { ...avg, iri: risk.iri.iri, rainStats: weather.rainStats ?? null } as object,
    },
  });

  return NextResponse.json({ alert, whatsapp: waResult, level: newLevel, iri: risk.iri.iri });
}

/* Vercel Cron invoca con GET; POST se conserva para disparos manuales o externos */
export const GET = evaluate;
export const POST = evaluate;
