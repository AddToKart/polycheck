import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { HOLOGRAM_WATERMARK_TEXT } from '@polycheck/shared'
import { HologramOverlay } from './HologramOverlay'

const storeMock = vi.hoisted(() => ({
  getServerClockOffset: vi.fn<() => Promise<number | null>>(),
}))

vi.mock('@/lib/offline/store', () => storeMock)

const FROZEN_NOW = Date.UTC(2026, 10, 2, 8, 1, 14)
const SETTLED_STAMP = '2026-11-02 08:01:14'

const installFakeClock = () => vi.useFakeTimers({ now: FROZEN_NOW })

// Interval ticks fire outside React's scheduler boundaries, so every fake
// advance is wrapped in act() to deterministically flush the re-stamp.
const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const overlayRootOf = (container: HTMLElement) => container.firstElementChild as HTMLElement

const textOf = (container: HTMLElement) => overlayRootOf(container).textContent ?? ''

const sweepBandOf = (container: HTMLElement) => {
  const band = container.querySelector('[class*="hologram-sweep"]')
  if (!(band instanceof HTMLElement)) throw new Error('Sweep band not rendered')
  return band
}

const watermarkBoxOf = (container: HTMLElement) => {
  const box = container.querySelector('[class*="-inset-[60%]"]')
  if (!(box instanceof HTMLElement)) throw new Error('Watermark box not rendered')
  return box
}

const firstMarkOf = (container: HTMLElement) => {
  const mark = container.querySelector('span')
  if (!(mark instanceof HTMLElement)) throw new Error('Watermark mark not rendered')
  return mark
}

// Layout contract: WATERMARK_ROW_COUNT x WATERMARK_COLUMN_COUNT marks per overlay.
const EXPECTED_MARK_COUNT = 32

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

beforeEach(() => {
  storeMock.getServerClockOffset.mockReset().mockResolvedValue(null)
})

describe('HologramOverlay', () => {
  it('renders the diagonal watermark with the verified constant and a live UTC stamp', async () => {
    installFakeClock()
    const { container } = render(<HologramOverlay deviceId="mobile-a1b2c3d4e5" />)
    await tick(0)

    const text = textOf(container)
    expect(text).toContain(HOLOGRAM_WATERMARK_TEXT)
    expect(text).toContain(
      `PUP-ID-VERIFIED • LIVE UTC: ${SETTLED_STAMP} • DEVICE-BOUND •·•·d4e5`,
    )
    expect(storeMock.getServerClockOffset).toHaveBeenCalledTimes(1)
  })

  it('re-stamps the watermark every second and does not re-poll the clock offset', async () => {
    installFakeClock()
    const { container } = render(<HologramOverlay />)
    await tick(0)
    expect(textOf(container)).toContain(`LIVE UTC: ${SETTLED_STAMP}`)

    await tick(1000)
    expect(textOf(container)).toContain('LIVE UTC: 2026-11-02 08:01:15')

    await tick(1000 * 5)
    expect(storeMock.getServerClockOffset).toHaveBeenCalledTimes(1)
    expect(textOf(container)).toContain('LIVE UTC: 2026-11-02 08:01:20')
  })

  it('applies the trusted server-clock offset to every re-stamp', async () => {
    installFakeClock()
    storeMock.getServerClockOffset.mockResolvedValue(60_000)
    const { container } = render(<HologramOverlay />)
    await tick(0)

    expect(textOf(container)).toContain('LIVE UTC: 2026-11-02 08:02:14')

    await tick(1000)
    expect(textOf(container)).toContain('LIVE UTC: 2026-11-02 08:02:15')
  })

  it('renders the WEB-SESSION chip when the card is not device-bound', async () => {
    installFakeClock()
    const { container } = render(<HologramOverlay deviceId={null} />)
    await tick(0)

    expect(textOf(container)).toContain('• WEB-SESSION')
    expect(textOf(container)).not.toContain('DEVICE-BOUND')
  })

  it('is a purely decorative layer that never intercepts pointer input', () => {
    const { container } = render(<HologramOverlay />)
    const root = overlayRootOf(container)

    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.className).toContain('pointer-events-none')
    expect(root.className).toContain('absolute inset-0 overflow-hidden')
  })

  it('carries reduced-motion and sweep animation classes so CSS can gate the sweep', () => {
    const { container } = render(<HologramOverlay />)
    const band = sweepBandOf(container)

    expect(band.className).toContain('motion-reduce:animate-none')
    expect(band.className).toContain('motion-reduce:left-[33%]')
    expect(band.className).toContain('animate-[hologram-sweep_5s_linear_infinite]')
  })

  it('tints the sweep and watermark per surface tone', () => {
    const light = render(<HologramOverlay tone="light" />)
    expect(sweepBandOf(light.container).className).toContain('via-maroon/30')
    expect(sweepBandOf(light.container).className).toContain('dark:via-golden/30')
    expect(firstMarkOf(light.container).className).toContain('text-maroon/50')
    expect(firstMarkOf(light.container).className).toContain('dark:text-golden/70')
    light.unmount()

    const dark = render(<HologramOverlay tone="dark" />)
    expect(sweepBandOf(dark.container).className).toContain('via-golden/30')
    expect(firstMarkOf(dark.container).className).toContain('text-golden/70')
    dark.unmount()
  })

  it('repeats the watermark diagonally across rows and columns with tabular digits', () => {
    const { container } = render(<HologramOverlay />)

    expect(container.querySelectorAll('span')).toHaveLength(EXPECTED_MARK_COUNT)
    expect(firstMarkOf(container).className).toContain('tabular-nums')
    expect(watermarkBoxOf(container).className).toContain('rotate-[22deg]')
    expect(sweepBandOf(container).className).toContain('rotate-[22deg]')
  })

  it('clears its tick timer on unmount (no interval leak)', async () => {
    installFakeClock()
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const { unmount } = render(<HologramOverlay />)
    await tick(0)

    const tickIntervalId = setIntervalSpy.mock.results.at(-1)?.value
    expect(tickIntervalId).toBeTruthy()

    unmount()
    expect(clearIntervalSpy).toHaveBeenCalledWith(tickIntervalId)
  })
})
