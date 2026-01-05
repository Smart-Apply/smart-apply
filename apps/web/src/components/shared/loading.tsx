"use client"

import * as React from "react"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface FullPageLoaderProps {
  message?: string
  className?: string
}

export function FullPageLoader({ message = "Laden...", className }: FullPageLoaderProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-4">
        <Spinner size="xl" label={message} />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

interface CenteredLoaderProps {
  message?: string
  className?: string
}

export function CenteredLoader({ message = "Laden...", className }: CenteredLoaderProps) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <div className="text-center">
        <Spinner size="xl" label={message} className="mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

interface InlineLoaderProps {
  message?: string
  className?: string
  size?: "default" | "sm" | "lg" | "xl"
}

export function InlineLoader({
  message,
  className,
  size = "default",
}: InlineLoaderProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Spinner size={size} label={message || "Laden..."} />
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  )
}
