import './globals.css';
import { Plus_Jakarta_Sans, Space_Mono } from 'next/font/google';

const jakarta = Plus_Jakarta_Sans({
  subsets  : ['latin'],
  variable : '--font-jakarta',
  weight   : ['300','400','500','600','700','800'],
});

const spaceMono = Space_Mono({
  subsets  : ['latin'],
  variable : '--font-mono',
  weight   : ['400','700'],
});

export const metadata = {
  title      : 'QuickAI — Enterprise Commerce Platform',
  description: 'AI-powered commerce platform for enterprise businesses',
  icons      : { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${spaceMono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className="bg-bg text-textprimary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
