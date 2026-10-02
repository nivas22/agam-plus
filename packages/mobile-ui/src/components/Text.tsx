import React from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { color, font, sectionHeader, type } from '../tokens';

type Variant = keyof typeof type;

export interface TxtProps extends TextProps {
  variant?: Variant;
  tone?: 'ink' | 'ink2' | 'ink3' | 'brand' | 'stop' | 'flag' | 'clinic' | 'onBrand';
  weight?: TextStyle['fontWeight'];
  mono?: boolean;
}

const tones = {
  ink: color.ink,
  ink2: color.ink2,
  ink3: color.ink3,
  brand: color.brand,
  stop: color.stop,
  flag: color.flag,
  clinic: color.clinic,
  onBrand: '#FFFFFF',
};

/**
 * Every string in the app goes through here so the platform type ramp in
 * tokens.ts is applied in one place — iOS's tight negative tracking vs
 * Material's positive tracking is the single loudest cue that an app was
 * built for the platform rather than ported to it.
 */
export function Txt({
  variant = 'body',
  tone = 'ink',
  weight,
  mono,
  style,
  ...rest
}: TxtProps) {
  return (
    <RNText
      {...rest}
      style={[
        type[variant] as TextStyle,
        { color: tones[tone], fontFamily: mono ? font.mono : font.family },
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
}

export function SectionHeader({ children, style }: { children: string; style?: TextStyle }) {
  return <RNText style={[styles.section, style]}>{children}</RNText>;
}

const styles = StyleSheet.create({
  section: { ...sectionHeader, marginBottom: 6 },
});
