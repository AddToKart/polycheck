// Mock expo-crypto for Jest
export function getRandomBytesAsync(length: number): Promise<Uint8Array> {
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Promise.resolve(bytes)
}
