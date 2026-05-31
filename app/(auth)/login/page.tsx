'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Droplets, AlertCircle, Loader2 } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await signIn('credentials', { username, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError('Credenciales incorrectas. Verifica usuario y contraseña.');
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Toggle de tema en esquina */}
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: 'color-mix(in srgb, var(--tw-accent) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--tw-accent) 30%, transparent)',
            }}
          >
            <Droplets className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Tocancipá Alerta Hídrica</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--tw-secondary)' }}>
            Oficina de Gestión del Riesgo y Emergencias
          </p>
        </div>

        {/* Formulario */}
        <div className="card">
          <h2 className="text-lg font-semibold text-primary mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5 text-primary">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                className="input-field"
                placeholder="Ingresa tu usuario"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5 text-primary">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="input-field"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-red-400 text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</>
              ) : (
                'Ingresar al sistema'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--tw-secondary)', opacity: 0.6 }}>
          Sistema TAH v1.0 · Municipio de Tocancipá · Colombia
        </p>
      </div>
    </div>
  );
}
