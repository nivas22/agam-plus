import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './Text';
import { color, elevation, isIOS, radius, space } from '../tokens';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'onBrand' | 'plain';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * iOS: a 14pt-radius filled rectangle. Material: a full pill (radius 20 in
 * tokens). `onBrand` is the inverted variant that sits inside the purple
 * "with you now" card.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const off = disabled || loading;

  if (variant === 'plain') {
    return (
      <Pressable onPress={off ? undefined : onPress} style={[styles.plain, style]}>
        <Txt variant="body" tone="brand" weight="500">
          {label}
        </Txt>
      </Pressable>
    );
  }

  const onBrand = variant === 'onBrand';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      onPress={off ? undefined : onPress}
      android_ripple={{ color: onBrand ? color.brandSoft : '#FFFFFF33' }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: onBrand ? '#FFFFFF' : color.brand },
        !isIOS && !onBrand ? elevation(1) : null,
        { opacity: off ? 0.5 : pressed && isIOS ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={onBrand ? color.brand : '#FFFFFF'} />
      ) : (
        <Txt
          variant="body"
          weight={isIOS ? '600' : '500'}
          style={{ color: onBrand ? color.brand : '#FFFFFF' }}
        >
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

/**
 * Material's extended FAB. Renders nothing on iOS — the HIG has no equivalent,
 * where the same action belongs in the nav bar or a bottom button instead.
 */
export function ExtendedFab({
  label,
  icon = 'mic-outline',
  onPress,
  style,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  if (isIOS) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: color.brand + '22' }}
      style={[styles.fab, elevation(3), style]}
    >
      <Ionicons name={icon} size={20} color={color.onBrandSoft} />
      <Txt variant="secondary" weight="500" style={{ color: color.onBrandSoft }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Small circular icon button — the dictate control inside the notes field. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  accessibilityLabel: string;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.iconBtn, isIOS ? null : styles.iconBtnMD, style]}
    >
      <Ionicons name={icon} size={18} color={isIOS ? '#FFFFFF' : color.onBrandSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: isIOS ? 50 : 48,
    borderRadius: radius.button,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plain: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.fab,
    backgroundColor: color.brandSoft,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.brand,
  },
  iconBtnMD: { borderRadius: 10, backgroundColor: color.brandSoft },
});
