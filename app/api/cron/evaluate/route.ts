import { NextResponse } from 'next/server';
import { fetchOpenMeteo } from '@/lib/weather/openmeteo';
import { fetchOpenWeather } from '@/lib/weather/openweather';
import { fetchWeatherAPI } from '@/lib/weather/weatherapi';
import { evaluateRisk, LEVEL_ORDER } from '@/lib/riskEngine';
import { sendWhatsAppAlert } from '@/lib/whatsapp';
import prisma from '@/lib/prisma';
import { WeatherData, Thresholds } from '@/lib/types';

export async function POST() {
  const threshold = await prisma.threshold.findFirst({ orderBy: { updatedAt: 'desc' } });

  if (!threshold?.autoEnabled) {
    return NextResponse.json({ message: 'Agente automático desactivado' });
  }

  const weatherSources: WeatherData[] = [];

  await Promise.allSettled([
    fetchOpenMeteo().then((r) => weatherSources.push(r.current)).catch(() =>
      weatherSources.push({
        source: 'open-meteo', temperature: 0, humidity: 0, precipitation: 0,
        windSpeed: 0, rainProbability: 0, timestamp: new Date().toISOString(), available: false,
      })
    ),
    fetchOpenWeather().then((r) => weatherSources.push(r.current)).catch(() =>
      weatherSources.push({
        source: 'openweather', temperature: 0, humidity: 0, precipitation: 0,
        windSpeed: 0, rainProbability: 0, timestamp: new Date().toISOString(), available: false,
      })
    ),
    fetchWeatherAPI().then((r) => weatherSources.push(r.current)).catch(() =>
      weatherSources.push({
        source: 'weatherapi', temperature: 0, humidity: 0, precipitation: 0,
        windSpeed: 0, rainProbability: 0, timestamp: new Date().toISOString(), available: false,
      })
    ),
  ]);

  const thresholds: Thresholds = {
    precipPreventivo: threshold.precipPreventivo,
    precipAlerta: threshold.precipAlerta,
    precipEmergencia: threshold.precipEmergencia,
    windPreventivo: threshold.windPreventivo,
    windAlerta: threshold.windAlerta,
    windEmergencia: threshold.windEmergencia,
    humidityPreventivo: threshold.humidityPreventivo,
  };

  const newLevel = evaluateRisk(weatherSources, thresholds);

  const lastAlert = await prisma.alert.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  const lastLevel = lastAlert?.level ?? 'INFORMATIVO';

  if (LEVEL_ORDER[newLevel] <= LEVEL_ORDER[lastLevel as keyof typeof LEVEL_ORDER]) {
    return NextResponse.json({ message: 'Sin escalada de riesgo', current: newLevel });
  }

  const avgWeather = weatherSources.filter((d) => d.available)[0] ?? weatherSources[0];
  const waResult = await sendWhatsAppAlert(newLevel, 'Activación automática del sistema TAH', avgWeather);

  const alert = await prisma.alert.create({
    data: {
      level: newLevel,
      triggeredBy: 'auto',
      message: 'Activación automática por umbral superado',
      waStatus: waResult.success ? 'sent' : 'failed',
      waMessageId: waResult.messageId ?? null,
      weatherData: avgWeather as object,
    },
  });

  return NextResponse.json({ alert, whatsapp: waResult, level: newLevel });
}
