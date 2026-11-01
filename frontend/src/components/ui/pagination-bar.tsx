'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface PaginationBarProps {
  /** 1-based active page */
  page: number
  /** Total number of pages */
  totalPages: number
  /** Callback invoked when page changes */
  onPageChange: (newPage: number) => void
  /** Total number of items across all pages */
  totalItems?: number
  /** Number of items per page */
  pageSize?: number
  /** Optional item name for summary (e.g. "sessions", "students", "records") */
  itemName?: string
  /** Optional container class name */
  className?: string
  /** Whether to render compact page buttons (defaults to true when totalPages <= 5) */
  showNumbers?: boolean
}

export function PaginationBar({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  itemName = 'entries',
  className = '',
  showNumbers = false,
}: PaginationBarProps) {
  if (totalPages <= 0) return null

  const safePage = Math.min(Math.max(1, page), totalPages)
  const startItem = totalItems !== undefined && pageSize !== undefined
    ? Math.min((safePage - 1) * pageSize + 1, totalItems)
    : undefined
  const endItem = totalItems !== undefined && pageSize !== undefined
    ? Math.min(safePage * pageSize, totalItems)
    : undefined

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/80 px-4 py-3 dark:border-zinc-800 ${className}`}
      aria-label="Pagination Navigation"
    >
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {totalItems !== undefined && startItem !== undefined && endItem !== undefined ? (
          totalItems === 0 ? (
            <span>No {itemName}</span>
          ) : (
            <span>
              Showing <span className="font-semibold text-foreground">{startItem}</span>–
              <span className="font-semibold text-foreground">{endItem}</span> of{' '}
              <span className="font-semibold text-foreground">{totalItems}</span> {itemName}
            </span>
          )
        ) : (
          <span>
            Page <span className="font-semibold text-foreground">{safePage}</span> of{' '}
            <span className="font-semibold text-foreground">{totalPages}</span>
          </span>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            aria-label="Go to previous page"
            className="h-8 px-2.5 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Previous
          </Button>

          {showNumbers && totalPages <= 7 ? (
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={safePage === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={safePage === p ? 'page' : undefined}
                  className={`h-8 w-8 p-0 text-xs ${
                    safePage === p
                      ? 'bg-maroon text-white dark:bg-golden dark:text-maroon-dark font-bold'
                      : ''
                  }`}
                >
                  {p}
                </Button>
              ))}
            </div>
          ) : (
            <span className="px-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Page {safePage} of {totalPages}
            </span>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Go to next page"
            className="h-8 px-2.5 text-xs"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  )
}
