import * as React from "react";

export type DecorativeBackgroundProps = React.HTMLAttributes<HTMLDivElement>;

const BACKGROUND_KEYS = [
  "background",
  "backgroundColor",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "backgroundRepeat",
  "backgroundBlendMode",
] as const;

const baseStyle = {
  background: "radial-gradient(125% 125% at 50% 10%, #fff 40%, #0f6e56 100%)",
} as React.CSSProperties;

/**
 * Full-bleed background. Drop it as the first child of a `relative` container;
 * your content sits above it at z-10 or higher.
 */
const DecorativeBackground = React.forwardRef<
  HTMLDivElement,
  DecorativeBackgroundProps
>(({ className, style, ...props }, ref) => {
  const ownsBackground =
    style != null && BACKGROUND_KEYS.some((key) => key in style);
  return (
    <div
      ref={ref}
      data-slot="decorative-background"
      aria-hidden="true"
      className={`absolute inset-0 z-0 ${className ?? ""}`}
      style={ownsBackground ? style : { ...baseStyle, ...style }}
      {...props}
    />
  );
});
DecorativeBackground.displayName = "DecorativeBackground";

export { DecorativeBackground };
