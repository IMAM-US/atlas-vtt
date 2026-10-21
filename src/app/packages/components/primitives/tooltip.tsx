"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "src/utils/cn"
import "./tooltip.css"

const ProviderMounted = React.createContext(false)

function TooltipProvider(props: React.ComponentProps<typeof TooltipPrimitive.Provider>): React.ReactElement {
  return (
    <ProviderMounted.Provider value={true}>
      <TooltipPrimitive.Provider {...props} />
    </ProviderMounted.Provider>
  )
}

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

type TooltipContentProps = React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & { portalContainer?: HTMLElement | undefined };
const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(({ className, sideOffset = 4, portalContainer, ...props }, ref) => (
  <TooltipPrimitive.Portal container={portalContainer}>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn("tooltip-content", className)}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

interface LabelTooltipProps {
  label: string
  open?: boolean
  contentClassName?: string
  portalContainer?: HTMLElement
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>["side"]
  /** Describes `children` instead of naming them, for controls whose visible text already names them. */
  describe?: boolean
  children: React.ReactElement
}

/**
 * Wraps `children` in the shared Atlas tooltip and names it for assistive tech.
 * The name is set through `aria-labelledby`, which takes precedence over an
 * `aria-label` on `children`. Never give `children` a `title`: it adds the browser's
 * tooltip. Obsidian's `aria-label` tooltip is off throughout Atlas (styles/_native-tooltips.scss).
 */
function LabelTooltip({ label, side = "top", describe = false, children, open, contentClassName, portalContainer }: LabelTooltipProps): React.ReactElement {
  const labelId = React.useId()
  const hasProvider = React.useContext(ProviderMounted)
  const tooltip = (
    <Tooltip {...(open !== undefined ? { open } : {})}>
      <TooltipTrigger asChild {...(describe ? { "aria-describedby": labelId } : { "aria-labelledby": labelId })}>{children}</TooltipTrigger>
      <span id={labelId} hidden>{label}</span>
      <TooltipContent side={side} sideOffset={10} className={contentClassName} portalContainer={portalContainer}>
        <div className="tooltip-inner">
          <span className="tooltip-label">{label}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
  return hasProvider ? tooltip : <TooltipProvider delayDuration={300}>{tooltip}</TooltipProvider>
}

export { LabelTooltip, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
