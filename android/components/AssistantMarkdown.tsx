import { Component, useCallback, useMemo, type ReactNode } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import Markdown, { MarkdownIt, type RenderRules } from 'react-native-markdown-display'
import { useTheme } from '../theme/ThemeContext'
import { pupColors } from '../theme/colors'
import { fonts } from '../theme/typography'

/**
 * Chat-safe markdown for assistant replies: GFM tables/lists/bold/code with
 * the PUP token palette. HTML and images are disabled, links are restricted to
 * http(s), and any render failure degrades to the raw source text.
 */
const markdownIt = MarkdownIt({ typographer: true, linkify: true, breaks: true })
markdownIt.enable(['table', 'strikethrough'])
markdownIt.disable(['image', 'html_block', 'html_inline'])

interface MarkdownBoundaryProps {
  fallback: string
  resetKey: string
  children: ReactNode
}

interface MarkdownBoundaryState {
  failed: boolean
}

class MarkdownBoundary extends Component<MarkdownBoundaryProps, MarkdownBoundaryState> {
  state: MarkdownBoundaryState = { failed: false }

  static getDerivedStateFromError(): MarkdownBoundaryState {
    return { failed: true }
  }

  componentDidUpdate(previous: MarkdownBoundaryProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <Text selectable className="font-sans text-sm leading-6 text-ink dark:text-zinc-100">
          {this.props.fallback}
        </Text>
      )
    }
    return this.props.children
  }
}

function createStyles(isDark: boolean) {
  const text = isDark ? pupColors.white : pupColors.black
  const line = isDark ? pupColors.lineDark : pupColors.mutedLight
  const surface = isDark ? pupColors.maroonInk : pupColors.campus
  const heading = isDark ? pupColors.golden : pupColors.maroon
  const zebra = isDark ? pupColors.maroonInk : pupColors.campus
  const codeBlock = {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: line,
    backgroundColor: surface,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 17,
    color: text,
    padding: 8,
    marginVertical: 4,
  }

  return StyleSheet.create({
    body: { color: text, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
    heading1: { color: heading, fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, marginTop: 4, marginBottom: 4 },
    heading2: { color: heading, fontFamily: fonts.heading, fontSize: 15, lineHeight: 20, marginTop: 4, marginBottom: 3 },
    heading3: { color: text, fontFamily: fonts.heading, fontSize: 14, lineHeight: 19, marginTop: 3, marginBottom: 2 },
    heading4: { color: text, fontFamily: fonts.heading, fontSize: 13, lineHeight: 18, marginTop: 2, marginBottom: 2 },
    heading5: { color: text, fontFamily: fonts.heading, fontSize: 12, lineHeight: 17, marginTop: 2, marginBottom: 1 },
    heading6: { color: isDark ? pupColors.mutedLight : pupColors.muted, fontFamily: fonts.heading, fontSize: 11, lineHeight: 16, marginTop: 2, marginBottom: 1 },
    paragraph: { marginTop: 0, marginBottom: 6 },
    strong: { color: text, fontFamily: fonts.heading, fontWeight: 'bold' },
    em: { fontStyle: 'italic' },
    s: { color: isDark ? pupColors.mutedLight : pupColors.muted, textDecorationLine: 'line-through' },
    link: { color: heading, fontFamily: fonts.bodyMedium, textDecorationLine: 'underline' },
    blockquote: {
      backgroundColor: 'transparent',
      borderLeftColor: pupColors.golden,
      borderLeftWidth: 2,
      fontStyle: 'italic',
      marginLeft: 0,
      marginVertical: 4,
      paddingHorizontal: 0,
      paddingLeft: 8,
    },
    hr: { backgroundColor: line, height: StyleSheet.hairlineWidth, marginVertical: 8 },
    bullet_list: { marginVertical: 2 },
    ordered_list: { marginVertical: 2 },
    list_item: { marginVertical: 1 },
    bullet_list_icon: { color: heading, marginLeft: 2, marginRight: 6 },
    ordered_list_icon: { color: heading, marginLeft: 2, marginRight: 6 },
    code_inline: {
      backgroundColor: surface,
      borderColor: line,
      borderRadius: 0,
      borderWidth: 1,
      color: heading,
      fontFamily: fonts.mono,
      fontSize: 12,
      paddingHorizontal: 3,
      paddingVertical: 1,
    },
    code_block: codeBlock,
    fence: codeBlock,
    table: { borderColor: line, borderRadius: 0, borderWidth: 1, marginVertical: 6 },
    thead: { backgroundColor: isDark ? pupColors.maroonDeep : pupColors.maroon },
    tbody: {},
    tr: { borderBottomWidth: 1, borderColor: line, flexDirection: 'row' },
    trAlt: { backgroundColor: zebra },
    th: {
      borderColor: line,
      borderRightWidth: 1,
      color: isDark ? pupColors.golden : pupColors.white,
      flex: 1,
      fontFamily: fonts.heading,
      fontSize: 11,
      fontWeight: 'bold',
      lineHeight: 15,
      paddingHorizontal: 6,
      paddingVertical: 5,
    },
    td: {
      borderColor: line,
      borderRightWidth: 1,
      color: text,
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 6,
      paddingVertical: 5,
    },
  })
}

const renderRules: RenderRules = {
  tr: (node, children, _parent, styles) => (
    <View
      key={node.key}
      style={[styles.tr, node.index % 2 === 1 ? styles.trAlt : null]}
    >
      {children}
    </View>
  ),
}

export function AssistantMarkdown({ content }: { content: string }) {
  const { isDark } = useTheme()
  const styles = useMemo(() => createStyles(isDark), [isDark])
  const handleLinkPress = useCallback((url: string) => {
    if (!/^https?:\/\//i.test(url)) return false
    void Linking.openURL(url).catch(() => undefined)
    return false
  }, [])

  return (
    <View className="min-w-0">
      <MarkdownBoundary fallback={content} resetKey={content}>
        <Markdown
          markdownit={markdownIt}
          style={styles}
          rules={renderRules}
          onLinkPress={handleLinkPress}
        >
          {content}
        </Markdown>
      </MarkdownBoundary>
    </View>
  )
}
