import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Txt } from './Text';
import { color, isIOS, space } from '../tokens';

/**
 * iOS renders the system green switch; Material 3 renders a brand-coloured
 * track with a tick on the thumb. RN's Switch maps to each platform's native
 * control, so this only has to supply the right colours per platform.
 */
export function SwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <Txt variant="body">{title}</Txt>
        {subtitle ? (
          <Txt variant="secondary" tone="ink3">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
        trackColor={{ false: isIOS ? '#E9E9EA' : color.separator, true: isIOS ? '#34C759' : color.brand }}
        thumbColor={isIOS ? '#FFFFFF' : value ? '#FFFFFF' : '#FDFBFF'}
        ios_backgroundColor="#E9E9EA"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: isIOS ? 11 : 14,
    minHeight: 52,
  },
  body: { flex: 1, gap: 2 },
});
