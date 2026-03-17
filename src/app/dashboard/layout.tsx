import { Suspense } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text3)' }}>
        Loading terminal…
      </div>
    }>
      {children}
    </Suspense>
  )
}
