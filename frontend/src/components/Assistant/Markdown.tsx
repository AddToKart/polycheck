'use client'

import { Component, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

/**
 * Chat-safe markdown: GFM tables/lists/bold with the PUP token palette.
 * Raw HTML is never parsed (no rehype-raw, no dangerouslySetInnerHTML) and a
 * boundary degrades to the plain source if a render ever throws.
 */

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h3 className="mt-3 mb-1 font-heading text-base font-bold leading-snug text-maroon first:mt-0 dark:text-golden">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h4 className="mt-3 mb-1 font-heading text-sm font-bold leading-snug text-maroon first:mt-0 dark:text-golden">
      {children}
    </h4>
  ),
  h3: ({ children }) => (
    <h4 className="mt-2 mb-1 font-heading text-sm font-bold leading-snug text-foreground first:mt-0">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-2 mb-1 font-heading text-xs font-bold uppercase tracking-wider text-foreground first:mt-0">
      {children}
    </h5>
  ),
  h5: ({ children }) => (
    <h5 className="mt-2 mb-1 font-heading text-xs font-bold uppercase tracking-wider text-foreground first:mt-0">
      {children}
    </h5>
  ),
  h6: ({ children }) => (
    <h5 className="mt-2 mb-1 font-heading text-xs font-bold uppercase tracking-wider text-zinc-500 first:mt-0">
      {children}
    </h5>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-foreground [&:not(:first-child)]:mt-2">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-zinc-500 line-through">{children}</del>,
  ul: ({ children }) => (
    <ul className="my-2 ml-4 list-disc space-y-1 marker:text-maroon dark:marker:text-golden">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-4 list-decimal space-y-1 marker:text-maroon dark:marker:text-golden">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5 text-sm leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-golden pl-3 text-sm italic text-zinc-600 dark:text-zinc-300">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-zinc-300 dark:border-zinc-700" />,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-maroon underline underline-offset-2 hover:text-maroon-dark dark:text-golden dark:hover:text-golden-dark"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto border border-zinc-300 bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 [&>code]:border-0 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isFenced = typeof className === 'string' && className.startsWith('language-')
    if (isFenced) {
      return <code className="font-mono text-xs text-inherit">{children}</code>
    }
    return (
      <code className="border border-zinc-300/70 bg-zinc-100 px-1 py-0.5 font-mono text-[0.8em] text-maroon dark:border-zinc-700 dark:bg-zinc-800 dark:text-golden">
        {children}
      </code>
    )
  },
  table: ({ children }) => (
    <div className="my-2 w-full overflow-x-auto">
      <table className="w-full border-collapse border border-zinc-300 text-left text-xs dark:border-zinc-700">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-maroon text-white dark:bg-golden dark:text-maroon-dark">{children}</thead>
  ),
  tbody: ({ children }) => (
    <tbody className="[&>tr:nth-child(odd)]:bg-zinc-50 dark:[&>tr:nth-child(odd)]:bg-zinc-900/40">
      {children}
    </tbody>
  ),
  tr: ({ children }) => <tr className="border-b border-zinc-300 last:border-b-0 dark:border-zinc-700">{children}</tr>,
  th: ({ children }) => (
    <th className="border border-zinc-300 px-2 py-1.5 text-left font-bold dark:border-zinc-700">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-300 px-2 py-1.5 align-top dark:border-zinc-700">{children}</td>
  ),
  input: ({ node, ...props }) => {
    void node
    return (
      <input
        {...props}
        readOnly
        className="mr-1 h-3 w-3 align-middle accent-maroon dark:accent-golden"
      />
    )
  },
}

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
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {this.props.fallback}
        </p>
      )
    }
    return this.props.children
  }
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('min-w-0 break-words', className)}>
      <MarkdownBoundary fallback={content} resetKey={content}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </MarkdownBoundary>
    </div>
  )
}
