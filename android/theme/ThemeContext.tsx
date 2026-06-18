import { createContext, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { useColorScheme, Platform } from 'react-native'

const THEME_KEY = 'polycheck-theme'

type Theme = 'light' | 'dark'

interface ThemeCtx {
  theme: Theme
  isDark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeCtx>({ theme: 'light', isDark: false, toggle: () => {} })

async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    // SecureStore may fail on some simulators; safe to ignore
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme()
  const [theme, setTheme] = useState<Theme>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setTheme(saved)
      else if (system === 'light' || system === 'dark') setTheme(system)
      setReady(true)
    })
  }, [system])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    setItem(THEME_KEY, next)
  }

  if (!ready) return null

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === 'dark', toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
