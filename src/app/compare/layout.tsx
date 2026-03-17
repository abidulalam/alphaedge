import { Suspense } from 'react'

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text3)' }}>
        Loading…
      </div>
    }>
      {children}
    </Suspense>
  )
}
