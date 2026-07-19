import type { Font, TextSize } from './store'

export const textSizes: Record<TextSize, string> = {
  small: '16px',
  medium: '18px',
  large: '21px',
  'extra-large': '24px',
}

export const fontStacks: Record<Font, string> = {
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", monospace',
}

export const buttonHeight: Record<TextSize, string> = {
  small: '52px',
  medium: '58px',
  large: '66px',
  'extra-large': '76px',
}

export const spacingMultiplier: Record<TextSize, number> = {
  small: 0.92,
  medium: 1,
  large: 1.12,
  'extra-large': 1.24,
}
