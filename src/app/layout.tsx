import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AlphaEdge Terminal — Institutional AI Research',
  description: 'Real-time market data, AI quant signals, and institutional-grade research for serious traders.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
