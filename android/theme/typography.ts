export const fonts = {
  heading: 'DMSans_700Bold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
  mono: 'monospace',
}

export const typography = {
  h1: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 24 },
  subtitle: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodySmall: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  caption: { fontFamily: fonts.body, fontSize: 10, lineHeight: 14, letterSpacing: 0.5 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14, letterSpacing: 0.5 },
}
