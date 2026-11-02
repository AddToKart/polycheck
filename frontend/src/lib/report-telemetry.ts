/** Client diagnostics captured automatically with every system report (SR-LD7). */

export type ClientNetworkType = 'wifi' | 'cellular' | 'online' | 'offline' | 'unknown'

export interface ReportTelemetry {
  deviceInfo: string
  appVersion?: string
  route: string
  networkType: ClientNetworkType
}

interface NavigatorWithConnection extends Navigator {
  connection?: { effectiveType?: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' }
  userAgentData?: { platform?: string }
}

/** Pure UA summarizer so tests can pin the copy without a real browser. */
export function describeWebPlatform(userAgent: string, platformHint?: string): string {
  const browser = /Edg\/([\d.]+)/.exec(userAgent)
    ? `Edge ${major(userAgent, 'Edg')}`
    : /OPR\/([\d.]+)/.exec(userAgent)
      ? `Opera ${major(userAgent, 'OPR')}`
      : /Chrome\/([\d.]+)/.exec(userAgent)
        ? `Chrome ${major(userAgent, 'Chrome')}`
        : /Firefox\/([\d.]+)/.exec(userAgent)
          ? `Firefox ${major(userAgent, 'Firefox')}`
          : /Safari\/([\d.]+)/.exec(userAgent) && /Version\/([\d.]+)/.exec(userAgent)
            ? `Safari ${major(userAgent, 'Version')}`
            : 'Unknown browser'
  const os = /Windows NT [\d.]+/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : platformHint ?? 'Unknown OS'
  return `${browser} on ${os}`
}

function major(userAgent: string, marker: string): string {
  const match = new RegExp(`${marker}\\/([\\d.]+)`).exec(userAgent)
  return match ? match[1].split('.')[0] : ''
}

export function mapEffectiveType(effectiveType: string | undefined): ClientNetworkType {
  if (!effectiveType) return 'unknown'
  if (effectiveType === 'wifi') return 'wifi'
  if (['slow-2g', '2g', '3g', '4g'].includes(effectiveType)) return 'cellular'
  return 'unknown'
}

/** Collects bounded telemetry from the current browser context. */
export function collectWebReportTelemetry(): ReportTelemetry {
  const nav = navigator as NavigatorWithConnection
  const online = typeof navigator.onLine === 'boolean' ? navigator.onLine : true
  const networkType: ClientNetworkType = !online
    ? 'offline'
    : nav.connection
      ? mapEffectiveType(nav.connection.effectiveType)
      : 'online'
  return {
    deviceInfo: describeWebPlatform(navigator.userAgent, nav.userAgentData?.platform),
    route: window.location.pathname,
    networkType,
  }
}
