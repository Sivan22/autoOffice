import { makeStyles, shorthands, tokens } from '@fluentui/react-components';
import { useDirection } from './hooks';

/**
 * RTL-aware styles for layout and spacing
 * These styles automatically adjust based on text direction
 */

/**
 * Hook for creating direction-aware margin styles
 * @param size - Margin size in pixels or tokens
 * @returns Style object with appropriate margin-inline-start or margin-inline-end
 */
export function useMarginInlineStart(size: string) {
  const direction = useDirection();
  return {
    [direction === 'rtl' ? 'marginRight' : 'marginLeft']: size,
  };
}

export function useMarginInlineEnd(size: string) {
  const direction = useDirection();
  return {
    [direction === 'rtl' ? 'marginLeft' : 'marginRight']: size,
  };
}

/**
 * Hook for creating direction-aware padding styles
 */
export function usePaddingInlineStart(size: string) {
  const direction = useDirection();
  return {
    [direction === 'rtl' ? 'paddingRight' : 'paddingLeft']: size,
  };
}

export function usePaddingInlineEnd(size: string) {
  const direction = useDirection();
  return {
    [direction === 'rtl' ? 'paddingLeft' : 'paddingRight']: size,
  };
}

/**
 * Hook for creating direction-aware text alignment
 */
export function useTextAlign() {
  const direction = useDirection();
  return {
    textAlign: direction === 'rtl' ? ('right' as const) : ('left' as const),
  };
}

/**
 * Hook for creating direction-aware flex row styles
 * In RTL, flex direction should be row-reverse
 */
export function useFlexRow() {
  const direction = useDirection();
  return {
    display: 'flex',
    flexDirection: direction === 'rtl' ? ('row-reverse' as const) : ('row' as const),
  };
}

/**
 * Common RTL-aware styles for the application
 */
export const useRtlStyles = makeStyles({
  // Container that respects text direction
  directionContainer: {
    direction: 'inherit',
  },
  
  // Text that always stays LTR (for code, URLs, etc.)
  ltrText: {
    direction: 'ltr',
    textAlign: 'left',
  },
  
  // Flex container that mirrors in RTL
  flexRow: {
    display: 'flex',
    flexDirection: 'row',
  },
  
  // Flex container that doesn't mirror in RTL
  flexRowNoMirror: {
    display: 'flex',
    flexDirection: 'row',
  },
});

/**
 * Get inline-start property name based on direction
 */
export function getInlineStart(direction: 'ltr' | 'rtl'): 'left' | 'right' {
  return direction === 'rtl' ? 'right' : 'left';
}

/**
 * Get inline-end property name based on direction
 */
export function getInlineEnd(direction: 'ltr' | 'rtl'): 'left' | 'right' {
  return direction === 'rtl' ? 'left' : 'right';
}
