import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-none px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-maroon/10 text-maroon dark:bg-maroon-dark/30 dark:text-white",
        present: "bg-golden text-maroon-dark",
        late: "bg-maroon text-white",
        absent: "bg-maroon-dark text-golden border border-golden",
        pending: "bg-white text-maroon border border-maroon",
        active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        inactive: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
        outline: "border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
