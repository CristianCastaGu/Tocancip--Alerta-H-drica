import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'TAH — Tocancipá Alerta Hídrica',
  description: 'Sistema de monitoreo y alerta temprana de inundaciones — Municipio de Tocancipá',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-primary antialiased">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid #334155',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
