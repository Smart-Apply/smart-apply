import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const spinnerVariants = cva("animate-spin", {
  variants: {
    size: {
      default: "h-4 w-4",
      sm: "h-3 w-3",
      lg: "h-6 w-6",
      xl: "h-8 w-8",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

export interface SpinnerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof spinnerVariants> {
  label?: string
}

function Spinner({ className, size, label = "Loading...", ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("inline-block", className)}
      {...props}
    >
      <Loader2 className={cn(spinnerVariants({ size }))} />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export { Spinner, spinnerVariants }
