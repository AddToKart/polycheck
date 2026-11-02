// This screen is never shown — the "More" tab always opens the bottom sheet
// via the tabPress listener in _layout.tsx. This file exists so Expo Router
// registers the route. The re-exported dashboard applies
// useAuthGate(['teacher', 'super_admin']) for deep-link safety.
export { default } from './dashboard'
