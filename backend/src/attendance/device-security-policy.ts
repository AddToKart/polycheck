import type { DeviceSecurityEvidence } from '@polycheck/shared'

type DeviceSecurityRule = {
  flag: keyof DeviceSecurityEvidence
  reason: 'rooted_device' | 'hook_detected' | 'emulator_detected'
  message: string
}

const DEVICE_SECURITY_RULES = [
  {
    flag: 'emulatorDetected',
    reason: 'emulator_detected',
    message: 'Emulators are not permitted for attendance check-in.',
  },
  {
    flag: 'rootDetected',
    reason: 'rooted_device',
    message: 'Device integrity is compromised (Root/Jailbreak detected).',
  },
  {
    flag: 'hookDetected',
    reason: 'hook_detected',
    message: 'Dynamic hooking framework detected on device.',
  },
] as const satisfies readonly DeviceSecurityRule[]

export const getDeviceSecuritySignals = (evidence?: DeviceSecurityEvidence): string[] =>
  DEVICE_SECURITY_RULES.filter(({ flag }) => evidence?.[flag] === true).map(({ reason }) => reason)

export const getPrimaryDeviceSecurityDispute = (evidence?: DeviceSecurityEvidence) =>
  DEVICE_SECURITY_RULES.find(({ flag }) => evidence?.[flag] === true)

export const matchesStoredDeviceSecurityEvidence = (
  evidence: DeviceSecurityEvidence | undefined,
  storedRiskSignals: unknown,
): boolean => {
  const storedSignals = new Set(
    Array.isArray(storedRiskSignals)
      ? storedRiskSignals.filter((signal): signal is string => typeof signal === 'string')
      : [],
  )

  return DEVICE_SECURITY_RULES.every(({ flag, reason }) => (evidence?.[flag] === true) === storedSignals.has(reason))
}
