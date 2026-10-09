import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const level = searchParams.get('level');
  const type = searchParams.get('type');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = 20;

  const where: Record<string, unknown> = {};
  if (level) where.level = level;
  if (type) where.triggeredBy = type;
  if (from || to) {
    where.createdAt = {};
    /* Los filtros llegan como fecha local de Colombia (YYYY-MM-DD); "hasta" incluye todo ese día */
    const start = from ? new Date(`${from}T00:00:00-05:00`) : null;
    const end = to ? new Date(`${to}T23:59:59.999-05:00`) : null;
    if (start && !isNaN(start.getTime())) (where.createdAt as Record<string, Date>).gte = start;
    if (end && !isNaN(end.getTime())) (where.createdAt as Record<string, Date>).lte = end;
  }

  const [alerts, total, byLevel, byStatus, byType] = await Promise.all([
    prisma.alert.findMany({
      where,
      include: { user: { select: { username: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.alert.count({ where }),
    prisma.alert.groupBy({ by: ['level'], where, _count: { _all: true } }),
    prisma.alert.groupBy({ by: ['waStatus'], where, _count: { _all: true } }),
    prisma.alert.groupBy({ by: ['triggeredBy'], where, _count: { _all: true } }),
  ]);

  /* Resumen de todos los registros que cumplen el filtro (no solo la página actual) */
  const stats = {
    byLevel: Object.fromEntries(byLevel.map((r) => [r.level, r._count._all])),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.waStatus, r._count._all])),
    byType: Object.fromEntries(byType.map((r) => [r.triggeredBy, r._count._all])),
  };

  return NextResponse.json({ alerts, total, page, pageSize, stats });
}
