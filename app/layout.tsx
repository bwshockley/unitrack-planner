import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'KATO Unitrack N Scale Planner', description: 'Plan N scale layouts with KATO Unitrack geometry.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
