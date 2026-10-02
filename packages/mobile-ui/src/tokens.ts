import { Platform } from 'react-native';

/** Brand tokens shared with the web app. */
export const color = {
  brand: '#4F3FD6',
  brandSoft: '#EEECFF',
  onBrandSoft: '#1B0090',

  clinic: '#0D8F7C',
  clinicSoft: '#E2F4F0',
  clinicInk: '#08624F',

  flag: '#B4600B',
  flagSoft: '#FDF1DE',

  stop: '#C33A52',
  stopSoft: '#FDECEF',

  pack: '#7A3FD0',
  packSoft: '#F2EBFD',

  // iOS uses systemGroupedBackground; Android uses Material surface tones.
  bg: Platform.select({ ios: '#F2F2F7', default: '#FDFBFF' })!,
  surface: Platform.select({ ios: '#FFFFFF', default: '#F5F3FA' })!,
  card: '#FFFFFF',

  ink: Platform.select({ ios: '#000000', default: '#1B1B1F' })!,
  ink2: Platform.select({ ios: '#3C3C43', default: '#45464F' })!,
  ink3: Platform.select({ ios: '#8A8A8E', default: '#767680' })!,
  separator: Platform.select({ ios: '#D1D1D6', default: '#E3E2E9' })!,
  outline: '#C6C6D0',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = {
  card: Platform.select({ ios: 11, default: 12 })!,
  button: Platform.select({ ios: 14, default: 20 })!, // Material buttons are pills
  chip: Platform.select({ ios: 16, default: 8 })!,
  fab: 16,
};

export const font = {
  family: Platform.select({ ios: 'System', default: 'Roboto' })!,
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' })!,
};

export const type = {
  largeTitle: Platform.select({
    ios: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -1.1 },
    default: { fontSize: 28, fontWeight: '400' as const, letterSpacing: 0 },
  })!,
  title: Platform.select({
    ios: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.4 },
    default: { fontSize: 22, fontWeight: '400' as const, letterSpacing: 0 },
  })!,
  body: Platform.select({
    ios: { fontSize: 17, letterSpacing: -0.4 },
    default: { fontSize: 16, letterSpacing: 0.15 },
  })!,
  secondary: Platform.select({
    ios: { fontSize: 15, letterSpacing: -0.2 },
    default: { fontSize: 14, letterSpacing: 0.25 },
  })!,
  caption: Platform.select({
    ios: { fontSize: 13, letterSpacing: -0.1 },
    default: { fontSize: 12, letterSpacing: 0.4 },
  })!,
};

/** Section headers: iOS uppercase grey, Material sentence-case brand. */
export const sectionHeader = Platform.select({
  ios: {
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    color: '#8A8A8E',
    fontWeight: '400' as const,
  },
  default: {
    fontSize: 14,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
    color: '#4F3FD6',
    textTransform: 'none' as const,
  },
})!;

/** iOS uses soft shadows, Android uses elevation. Never both. */
export const elevation = (level: 1 | 2 | 3) =>
  Platform.select({
    ios: {
      shadowColor: '#161A2E',
      shadowOpacity: 0.06 * level,
      shadowRadius: 6 * level,
      shadowOffset: { width: 0, height: 2 * level },
    },
    default: { elevation: level },
  })!;

export const isIOS = Platform.OS === 'ios';
