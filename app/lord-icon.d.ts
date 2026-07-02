import type { DetailedHTMLProps, HTMLAttributes } from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        trigger?: 'hover' | 'click' | 'loop' | 'loop-on-hover' | 'in' | 'morph' | 'boomerang' | 'sequence';
        colors?: string;
        stroke?: 'light' | 'regular' | 'bold';
        delay?: number | string;
        target?: string;
        state?: string;
      };
    }
  }
}

export {};
