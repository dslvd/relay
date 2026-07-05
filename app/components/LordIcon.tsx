'use client';

import type { CSSProperties } from 'react';
import { LORD_ICON, type LordIconName } from '../lib/lordicons';

type LordIconProps = {
  name: LordIconName;
  size?: number;
  trigger?: 'hover' | 'click' | 'loop' | 'loop-on-hover' | 'in' | 'morph' | 'boomerang';
  /** Explicit "primary:#hex,secondary:#hex" override. Omit to inherit the parent's CSS color. */
  colors?: string;
  stroke?: 'light' | 'regular' | 'bold';
  mirror?: boolean;
  className?: string;
  style?: CSSProperties;
  /**
   * CSS selector for the ancestor whose hover/click should drive the
   * animation (Lordicon walks up via closest()), so the icon animates as
   * soon as the button is hovered rather than only the icon's own few
   * pixels. Defaults to the nearest button or link. Pass `false` to fall
   * back to the icon's own bounds (e.g. if it isn't inside either).
   */
  target?: string | false;
};

export default function LordIcon({
  name,
  size = 16,
  trigger = 'hover',
  colors,
  stroke = 'bold',
  mirror = false,
  className,
  style,
  target = 'button, a',
}: LordIconProps) {
  return (
    <lord-icon
      src={LORD_ICON[name]}
      trigger={trigger}
      target={target || undefined}
      colors={colors}
      stroke={stroke}
      aria-hidden="true"
      // "current-color" is a built-in lord-icon class that makes the icon inherit `color`
      // from its parent, same as our old stroke="currentColor" inline SVGs did.
      className={colors ? className : ['current-color', className].filter(Boolean).join(' ')}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        flexShrink: 0,
        transform: mirror ? 'scaleX(-1)' : undefined,
        ...style,
      }}
    />
  );
}
