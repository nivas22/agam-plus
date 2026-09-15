import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from './Text';
import { color, isIOS, space } from '../tokens';

export interface TabItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * iOS tab bar: icon over label, the whole item tinted when active, hairline
 * top border. Material navigation bar: the active icon sits inside a filled
 * pill indicator, and the label stays dark rather than taking the brand tint.
 */
export function TabBar({
  items,
  active,
  onSelect,
}: {
  items: readonly TabItem[];
  active: string;
  onSelect: (key: string) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {items.map((item) => {
        const on = item.key === active;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={item.label}
            onPress={() => onSelect(item.key)}
            style={styles.item}
          >
            <View style={[styles.iconSlot, !isIOS && on ? styles.pill : null]}>
              <Ionicons
                name={item.icon}
                size={isIOS ? 25 : 22}
                color={on ? (isIOS ? color.brand : color.onBrandSoft) : color.ink3}
              />
            </View>
            <Txt
              variant="caption"
              weight={!isIOS && on ? '600' : '400'}
              style={{ color: on ? (isIOS ? color.brand : color.ink) : color.ink3 }}
            >
              {item.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: isIOS ? 6 : space.sm,
    backgroundColor: isIOS ? '#F9F9F9' : color.surface,
    borderTopWidth: isIOS ? StyleSheet.hairlineWidth : 0,
    borderTopColor: color.separator,
  },
  item: { flex: 1, alignItems: 'center', gap: isIOS ? 2 : 4 },
  iconSlot: {
    height: isIOS ? 28 : 32,
    minWidth: isIOS ? 28 : 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { backgroundColor: color.brandSoft, borderRadius: 16 },
});
