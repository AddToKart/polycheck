// Mock react-native for Jest
export const Platform = {
  OS: 'android' as const,
  constants: { isTesting: false },
  select: (obj: Record<string, unknown>) => obj.android ?? obj.default,
}
