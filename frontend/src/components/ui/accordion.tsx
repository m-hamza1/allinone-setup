"use client";

import { ChevronDownIcon } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import * as React from "react";
import { useFlipGroup } from "@/hooks/use-flip-group";
import { useMergedRef } from "@/hooks/use-merged-ref";
import { type RevealTiming, sweepPanel, useReveal } from "@/hooks/use-reveal";
import { cn } from "@/lib/utils";

function blocksOf(content: HTMLElement): HTMLElement[] {
  const loose = [...content.childNodes].some(
    (node) => node.nodeType === 3 && node.textContent?.trim(),
  );
  const children = [...content.children] as HTMLElement[];
  return loose || children.length === 0 ? [content] : children;
}

function sweepItems(
  root: HTMLElement | null,
  changed: Map<HTMLElement, boolean>,
  t: RevealTiming,
) {
  for (const [item, open] of changed) {
    if (item.parentElement !== root) continue;
    const panel = item.querySelector<HTMLElement>(
      ':scope > [data-slot="accordion-content"]',
    );
    const content = panel?.firstElementChild as HTMLElement | null;
    if (!panel || !content) continue;
    sweepPanel(
      {
        box: panel,
        layers: [content],
        blocks: blocksOf(content),
        open,
        distance: panel.offsetHeight,
      },
      t,
    );
  }
}

function Accordion({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [move, flip] = React.useReducer(
    (
      state: { version: number; ms?: number; ease?: string },
      next: { ms: number; ease: string },
    ) => ({ version: state.version + 1, ...next }),
    { version: 0 },
  );
  useFlipGroup(rootRef, move.version, {
    selector: ':scope > [data-slot="accordion-item"]',
    duration: move.ms,
    easing: move.ease,
  });
  useReveal(rootRef, {
    flip,
    sweep: (changed, t) => sweepItems(rootRef.current, changed, t),
  });
  const setRootRef = useMergedRef(rootRef, ref);

  return (
    <AccordionPrimitive.Root
      ref={setRootRef}
      data-slot="accordion"
      className={cn("ease-spring-smooth", className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("relative border-t first:border-t-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:[transform:rotate(180deg)]",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-[transform] duration-(--godui-duration-base) ease-spring-smooth motion-reduce:transition-none [[data-state=closed]>&]:duration-(--godui-duration-fast)" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="pointer-events-none overflow-hidden text-sm data-[state=closed]:absolute data-[state=closed]:inset-x-0 data-[state=closed]:animate-godui-reveal-hold"
      {...props}
    >
      <div className={cn("pointer-events-auto pt-0 pb-4", className)}>
        {children}
      </div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
