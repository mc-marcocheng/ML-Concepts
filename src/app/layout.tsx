import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { AppChrome } from '@/components/layout/AppChrome';
import { listConcepts } from '@/lib/content/server';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'ML Concepts', template: '%s · ML Concepts' },
  description: 'Revise machine learning concepts with on-device quizzing and tutoring.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'ML Concepts', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfcf9' },
    { media: '(prefers-color-scheme: dark)', color: '#080c09' },
  ],
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('mlc.theme');var t=(s==='light'||s==='dark')?s:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;document.documentElement.classList.add('js');if(localStorage.getItem('mlc.expandProofs')==='1')document.documentElement.dataset.expandProofs='1';}catch(e){document.documentElement.dataset.theme='light';}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const concepts = await listConcepts().catch(() => []);

  return (
    <html lang="en" suppressHydrationWarning className={manrope.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>
        <AppChrome concepts={concepts}>{children}</AppChrome>
      </body>
    </html>
  );
}
