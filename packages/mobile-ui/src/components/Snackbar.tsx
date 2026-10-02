import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from './Text';
import { elevation, isIOS, space } from '../tokens';

/**
 * Material snackbar with a single action. Renders nothing on iOS, where a
 * transient bar over the content isn't a platform pattern — the iOS screens
 * confirm the same save through the nav bar's Done instead.
 */
export function Snackbar({
  message,
  actionLabel,
  onAction,
  onDismiss,
  visible,
  duration = 4000,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  visible: boolean;
  duration?: number;
}) {
  useEffect(() => {
    if (!visible || !onDismiss) return;
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [visible, duration, onDismiss]);

  if (isIOS || !visible) return null;

  return (
    <View style={[styles.bar, elevation(3)]} accessibilityLiveRegion="polite">
      <Txt variant="secondary" style={styles.message}>
        {message}
      </Txt>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Txt variant="secondary" weight="500" style={styles.action}>
            {actionLabel.toUpperCase()}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: 48,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: 4,
    backgroundColor: '#2E2E33',
  },
  message: { flex: 1, color: '#F2F0F4' },
  action: { color: '#CFC6FF' },
});
