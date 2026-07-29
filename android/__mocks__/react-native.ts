// Mock react-native for Jest
export const Platform = {
  OS: 'android' as const,
  select: (obj: Record<string, unknown>) => obj.android ?? obj.default,
}
