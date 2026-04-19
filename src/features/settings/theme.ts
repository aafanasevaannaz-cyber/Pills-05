import { Theme, TextSize, Font } from './store'

export const themeColors: Record<Theme, {
  bg: string
  card: string
  text: string
  textSecondary: string
  border: string
}> = {
  light: {
    bg: '#F5F5F5',
    card: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#666666',
    border: '#E0E0E0',
  },
  dark: {
    bg: '#121212',
    card: '#1E1E1E',
    text: '#EAEAEA',
    textSecondary: '#B0B0B0',
    border: '#333333',
  },
  'high-contrast': {
    bg: '#000000',
    card: '#FFFFFF',
    text: '#FFFFFF',
    textSecondary: '#CCCCCC',
    border: '#FFFFFF',
  },
}

export const accentColors = {
  success: '#2ECC71',
  error: '#FF4D4F',
  warning: '#FFA940',
  info: '#1890FF',
}

export const textSizes: Record<TextSize, string> = {
  small: '14px',
  medium: '16px',
  large: '20px',
  'extra-large': '24px',
}

export const fontStacks: Record<Font, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  inter: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  roboto: '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  'open-sans': '"Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  atkinson: '"Atkinson Hyperlegible", -apple-system, BlinkMacSystemFont, sans-serif',
}

export const buttonHeight: Record<TextSize, string> = {
  small: '48px',
  medium: '56px',
  large: '64px',
  'extra-large': '72px',
}

export const spacingMultiplier: Record<TextSize, number> = {
  small: 0.8,
  medium: 1,
  large: 1.2,
  'extra-large': 1.4,
}
