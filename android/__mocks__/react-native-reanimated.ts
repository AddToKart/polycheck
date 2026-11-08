/**
 * Minimal mock for react-native-reanimated in Jest: the node-mode suite only
 * needs animated views to pass through and the useReducedMotion hook to be
 * false, so UI components importing Animated stay testable without the
 * native module's ESM bundle.
 */
type AnimationFactory = () => Record<string, unknown>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const View: any = require('react-native').View

module.exports = {
  // With __esModule set, esModuleInterop consumers take `default` directly,
  // so `Animated.createAnimatedComponent` resolves on this object.
  __esModule: true as const,
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  default: {
    View,
    createAnimatedComponent: (Component: any) => Component,
  },
  FadeInDown: { duration: (_ms?: number) => ({ springify: (_damping?: number) => ({}) }) },
  FadeOutUp: { duration: (_ms?: number) => ({}) },
  useReducedMotion: (): boolean => false,
}
