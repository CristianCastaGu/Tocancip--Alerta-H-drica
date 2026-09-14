import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchGroups } from '@/lib/evolution/client';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const result = await fetchGroups();
  if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ groups: result.groups });
}
