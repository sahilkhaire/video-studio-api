import { cn } from "@/lib/utils"

type StateMessageProps = {
  variant?: "default" | "success" | "destructive"
  title?: string
  message: string
  className?: string
}

const variantClassName: Record<NonNullable<StateMessageProps["variant"]>, string> = {
  default: "border-border/70 bg-muted/40 text-foreground",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
  destructive:
    "border-destructive/40 bg-destructive/10 text-destructive",
}

export function StateMessage({
  variant = "default",
  title,
  message,
  className,
}: StateMessageProps) {
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        variantClassName[variant],
        className
      )}
    >
      {title ? <p className="mb-1 font-medium">{title}</p> : null}
      <p>{message}</p>
    </div>
  )
}