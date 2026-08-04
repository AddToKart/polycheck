import * as Crypto from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'

const INSTALLATION_ID_KEY = 'polycheck.installation-id.v1'
let installationIdPromise: Promise<string> | null = null

const encodeHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export const getOrCreateInstallationId = () => {
  if (installationIdPromise) return installationIdPromise

  installationIdPromise = (async () => {
    const stored = await SecureStore.getItemAsync(INSTALLATION_ID_KEY)
    if (stored) return stored

    const randomBytes = await Crypto.getRandomBytesAsync(16)
    const generated = `mobile-${encodeHex(randomBytes)}`
    await SecureStore.setItemAsync(INSTALLATION_ID_KEY, generated, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    })
    return generated
  })().catch((error) => {
    installationIdPromise = null
    throw new Error(
      `Unable to establish this device's secure installation identity: ${
        error instanceof Error ? error.message : 'secure storage failed'
      }`,
    )
  })

  return installationIdPromise
}

export const resetInstallationIdForTests = () => {
  installationIdPromise = null
}
