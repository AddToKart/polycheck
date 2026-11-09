import { forwardRef, useCallback, useEffect, useRef } from 'react'
import {
  findNodeHandle,
  Keyboard,
  ScrollView,
  TextInput,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native'

/** Wait for the IME animation and the root inset to settle before measuring. */
const KEYBOARD_SETTLE_MS = 100
/** Breathing room kept between the focused input and the keyboard. */
const KEYBOARD_OFFSET = 24

/**
 * ScrollView that reveals the focused TextInput when the IME opens.
 *
 * The root layout already applies the Android 15+ keyboard inset, so this
 * deliberately does not render a KeyboardAvoidingView; it only scrolls the
 * focused input into view. Wrap the page-level ScrollView of form screens.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      keyboardShouldPersistTaps = 'handled',
      showsVerticalScrollIndicator = false,
      scrollEventThrottle = 16,
      onScroll,
      ...rest
    },
    forwardedRef,
  ) {
    const scrollRef = useRef<ScrollView | null>(null)
    const offsetRef = useRef(0)
    const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const setRefs = useCallback(
      (node: ScrollView | null) => {
        scrollRef.current = node
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      },
      [forwardedRef],
    )

    const revealFocusedInput = useCallback((event: KeyboardEvent) => {
      const scrollView = scrollRef.current
      if (!scrollView) return

      const input = TextInput.State.currentlyFocusedInput()
      if (!input) return

      const scrollIntoView = () => {
        try {
          input.measureInWindow((_x, y, _width, height) => {
            if (scrollRef.current !== scrollView) return
            const overlap =
              y + height + KEYBOARD_OFFSET - event.endCoordinates.screenY
            if (overlap > 0) {
              scrollView.scrollTo({
                y: offsetRef.current + overlap,
                animated: true,
              })
            }
          })
        } catch {
          // The input cannot be measured; leave the current scroll position.
        }
      }

      // Prefer RN's responder math, which accounts for the scroll view's own
      // content offset. Fall back to a manual measure on platforms where the
      // method is unavailable or the node handle cannot be resolved.
      try {
        // findNodeHandle accepts the HostInstance at runtime; its legacy
        // typings only declare React component instances.
        const nodeHandle = findNodeHandle(
          input as unknown as Parameters<typeof findNodeHandle>[0],
        )
        if (
          nodeHandle != null &&
          typeof scrollView.scrollResponderScrollNativeHandleToKeyboard === 'function'
        ) {
          scrollView.scrollResponderScrollNativeHandleToKeyboard(
            nodeHandle,
            KEYBOARD_OFFSET,
            true,
          )
          // The responder helper assumes a full-screen list, so re-measure
          // after its scroll animation and cover any header/safe-area gap.
          if (verifyTimer.current) clearTimeout(verifyTimer.current)
          verifyTimer.current = setTimeout(() => {
            verifyTimer.current = null
            scrollIntoView()
          }, 300)
          return
        }
      } catch {
        // Fall through to the manual measurement below.
      }

      scrollIntoView()
    }, [])

    useEffect(() => {
      const scheduleReveal = (event: KeyboardEvent) => {
        if (settleTimer.current) clearTimeout(settleTimer.current)
        settleTimer.current = setTimeout(() => {
          settleTimer.current = null
          revealFocusedInput(event)
        }, KEYBOARD_SETTLE_MS)
      }
      const cancelPendingReveal = () => {
        if (settleTimer.current) {
          clearTimeout(settleTimer.current)
          settleTimer.current = null
        }
        if (verifyTimer.current) {
          clearTimeout(verifyTimer.current)
          verifyTimer.current = null
        }
      }

      const show = Keyboard.addListener('keyboardDidShow', scheduleReveal)
      const hide = Keyboard.addListener('keyboardDidHide', cancelPendingReveal)
      return () => {
        show.remove()
        hide.remove()
        cancelPendingReveal()
      }
    }, [revealFocusedInput])

    const handleScroll = useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetRef.current = event.nativeEvent.contentOffset.y
        onScroll?.(event)
      },
      [onScroll],
    )

    return (
      <ScrollView
        ref={setRefs}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        scrollEventThrottle={scrollEventThrottle}
        onScroll={handleScroll}
        {...rest}
      />
    )
  },
)

KeyboardAwareScrollView.displayName = 'KeyboardAwareScrollView'
