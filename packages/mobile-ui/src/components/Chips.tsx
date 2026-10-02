import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from './Text';
import { color, isIOS, radius, space } from '../tokens';

/**
 * Material assist chip. On iOS the same affordance is drawn as a soft
 * capsule — iOS has no chip component, but the "tap to insert" idea survives.
 */
export function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      android_ripple={{ color: color.separator }}
      style={[
        styles.chip,
        selected ? styles.chipOn : styles.chipOff,
        !isIOS && !selected ? styles.chipOutlined : null,
      ]}
    >
      <Txt variant="secondary" weight="500" style={{ color: selected ? color.brand : color.ink2 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/**
 * Follow-up interval picker.
 *
 * iOS draws a true segmented control: one grey track, the selection a white
 * raised pill. Material has no segmented-button-in-a-track of this shape at
 * this size, so the same options render as a wrapping row of choice chips —
 * which is why the Android layout takes two lines and the iOS one does not.
 */
export function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  if (isIOS) {
    return (
      <View style={styles.track}>
        {options.map((option) => {
          const on = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(option)}
              style={[styles.segment, on ? styles.segmentOn : null]}
            >
              <Txt variant="secondary" weight={on ? '600' : '400'} numberOfLines={1}>
                {option}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={option === value}
          onPress={() => onChange(option)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: isIOS ? 16 : 8,
    paddingHorizontal: space.md,
    paddingVertical: isIOS ? 7 : 8,
    minHeight: isIOS ? 32 : 32,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: color.brandSoft },
  chipOff: { backgroundColor: isIOS ? '#EFEFF4' : 'transparent' },
  chipOutlined: { borderWidth: 1, borderColor: color.outline },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  track: {
    flexDirection: 'row',
    backgroundColor: '#EFEFF4',
    borderRadius: 9,
    padding: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 7,
  },
  segmentOn: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
