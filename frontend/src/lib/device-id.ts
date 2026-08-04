const INSTALLATION_ID_KEY = 'polycheck.installation-id.v1'

export const getOrCreateWebInstallationId = () => {
  const stored = window.localStorage.getItem(INSTALLATION_ID_KEY)
  if (stored) return stored

  const generated = `web-${crypto.randomUUID()}`
  window.localStorage.setItem(INSTALLATION_ID_KEY, generated)
  return generated
}
