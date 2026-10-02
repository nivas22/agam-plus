import React, { Children, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './Text';
import { color, elevation, isIOS, radius, space } from '../tokens';

/**
 * iOS: an inset grouped card — rounded, white, hairline separators that stop
 * short of the left edge. Material: a flat surface whose rows are divided by
 * full-bleed lines. Same children, and callers never branch on platform.
 */
export function ListGroup({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const rows = Children.toArray(children).filter(Boolean);

  return (
    <View style={[isIOS ? styles.groupIOS : styles.groupMD, style]}>
      {rows.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <View style={isIOS ? styles.sepIOS : styles.sepMD} />
          ) : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

export interface RowProps {
  title: string;
  subtitle?: string;
  /** Rendered at the row's leading edge — a token badge, an avatar. */
  leading?: ReactNode;
  /** Rendered at the trailing edge, before any chevron. */
  trailing?: ReactNode;
  /** Right-aligned value text, the settings-list idiom. */
  value?: string;
  onPress?: () => void;
  /** iOS shows a disclosure chevron; Material relies on the tap itself. */
  chevron?: boolean;
  tone?: 'ink' | 'brand';
  below?: ReactNode;
  /** Spoken after the row's text — e.g. why the queue ranked it here. */
  accessibilityHint?: string;
}

export function Row({
  title,
  subtitle,
  leading,
  trailing,
  value,
  onPress,
  chevron = false,
  tone = 'ink',
  below,
  accessibilityHint,
}: RowProps) {
  const body = (
    <View style={styles.row}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}

      <View style={styles.rowBody}>
        <Txt variant="body" tone={tone} weight={tone === 'brand' ? '500' : undefined}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="secondary" tone="ink3">
            {subtitle}
          </Txt>
        ) : null}
        {below}
      </View>

      {trailing}
      {value ? (
        <Txt variant="body" weight="600">
          {value}
        </Txt>
      ) : null}
      {chevron && isIOS ? (
        <Ionicons name="chevron-forward" size={17} color={color.ink3} style={styles.chev} />
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      android_ripple={{ color: color.separator }}
      style={({ pressed }) => (pressed && isIOS ? styles.pressed : null)}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groupIOS: {
    backgroundColor: color.card,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...elevation(1),
  },
  groupMD: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  // Inset from the text, not the card edge — the iOS grouped-list signature.
  sepIOS: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: color.separator,
    marginLeft: space.lg,
  },
  sepMD: { height: 1, backgroundColor: color.separator },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: isIOS ? 11 : 14,
    minHeight: 48,
  },
  rowBody: { flex: 1, gap: 2 },
  leading: { justifyContent: 'center' },
  chev: { marginLeft: -space.xs },
  pressed: { backgroundColor: color.separator, opacity: 0.6 },
});
