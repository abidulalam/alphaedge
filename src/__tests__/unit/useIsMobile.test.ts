import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '@/hooks/useIsMobile'

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

describe('useIsMobile', () => {
  afterEach(() => setWidth(1024))

  it('returns false by default (desktop width)', () => {
    setWidth(1024)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true when width is at or below the default 768px breakpoint', () => {
    setWidth(768)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns true for widths below the breakpoint', () => {
    setWidth(375)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false for widths above the breakpoint', () => {
    setWidth(769)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('updates when window is resized below breakpoint', () => {
    setWidth(1200)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
    act(() => setWidth(400))
    expect(result.current).toBe(true)
  })

  it('updates when window is resized above breakpoint', () => {
    setWidth(400)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
    act(() => setWidth(1200))
    expect(result.current).toBe(false)
  })

  it('respects a custom breakpoint', () => {
    setWidth(1100)
    const { result } = renderHook(() => useIsMobile(1200))
    expect(result.current).toBe(true)
  })

  it('removes the resize listener on unmount', () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useIsMobile())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    removeSpy.mockRestore()
  })
})
