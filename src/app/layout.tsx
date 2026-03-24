import type { Metadata } from 'next'
import './globals.css'
import CommandBar from '@/components/CommandBar'

export const metadata: Metadata = {
  title: 'AlphaEdge Terminal — Institutional AI Research',
  description: 'Real-time market data, AI quant signals, and institutional-grade research for serious traders.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CommandBar />
        {children}
      </body>
    </html>
  )
}
