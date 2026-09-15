import React, { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from './Text';
import { color, isIOS, space, type } from '../tokens';

export interface BarAction {
  label: string;
  onPress?: () => void;
  /** Material draws destructive/confirm bar actions in caps; iOS does not. */
  emphasis?: 'normal' | 'strong';
}

export interface ScreenProps {
  children: ReactNode;
  /** Large title. iOS renders it inside the scroll view; Material in the bar. */
  title?: string;
  subtitle?: string;
  /** Back affordance. iOS shows "‹ Label"; Material shows a bare arrow. */
  back?: { label: string; onPress: () => void };
  /** Right-hand bar action — iOS "History"/"Edit", Material overflow menu. */
  action?: BarAction;
  /** Modal bar: iOS Cancel/Title/Done, Material ✕/Title/SAVE. */
  modal?: { cancel: BarAction; confirm: BarAction; title: string };
  /** Pinned below the scroll area, above the tab bar. */
  footer?: ReactNode;
  /** Floating layer — extended FAB, snackbar. */
  overlay?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
}

export function Screen({
  children,
  title,
  subtitle,
  back,
  action,
  modal,
  footer,
  overlay,
  scroll = true,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const content = (
    <View style={[styles.content, contentStyle]}>
      {/*
        iOS keeps the large title in the scroll content so it collapses into
        the nav bar as the user scrolls — the platform's signature behaviour.
        Material's large top app bar already carries the title, so repeating
        it here would print it twice.
      */}
      {isIOS && title ? (
        <View style={styles.iosTitleBlock}>
          <Txt style={type.largeTitle}>{title}</Txt>
          {subtitle ? (
            <Txt variant="secondary" tone="ink3">
              {subtitle}
            </Txt>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {modal ? (
        <ModalBar {...modal} />
      ) : (
        <NavBar title={title} subtitle={subtitle} back={back} action={action} />
      )}

      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={isIOS}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}

      {footer ? (
        <View style={[styles.footer, { paddingBottom: space.sm }]}>{footer}</View>
      ) : null}
      {overlay}
    </View>
  );
}

function NavBar({
  title,
  subtitle,
  back,
  action,
}: Pick<ScreenProps, 'title' | 'subtitle' | 'back' | 'action'>) {
  if (isIOS) {
    // Nothing to draw when a screen has only a large title — it lives in the
    // scroll content, and an empty bar would add a stray 44pt band.
    if (!back && !action) return null;
    return (
      <View style={styles.barIOS}>
        {back ? (
          <Pressable onPress={back.onPress} style={styles.backIOS} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={color.brand} />
            <Txt variant="body" tone="brand">
              {back.label}
            </Txt>
          </Pressable>
        ) : (
          <View style={styles.flex} />
        )}
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={8}>
            <Txt variant="body" tone="brand">
              {action.label}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // Material large top app bar: navigation icon and overflow on the same line,
  // the title on the line beneath.
  return (
    <View style={styles.barMD}>
      <View style={styles.barMDTop}>
        {back ? (
          <Pressable
            onPress={back.onPress}
            accessibilityLabel="Navigate up"
            android_ripple={{ color: color.separator, borderless: true, radius: 22 }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color={color.ink} />
          </Pressable>
        ) : (
          <View style={styles.flex} />
        )}
        {back ? <Txt variant="title" style={styles.barMDLabel}>{back.label}</Txt> : null}
        <View style={styles.flex} />
        {action ? (
          <Pressable
            onPress={action.onPress}
            accessibilityLabel={action.label}
            android_ripple={{ color: color.separator, borderless: true, radius: 22 }}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={color.ink} />
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <View style={styles.barMDTitle}>
          <Txt style={type.largeTitle}>{title}</Txt>
          {subtitle ? (
            <Txt variant="secondary" tone="ink3">
              {subtitle}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ModalBar({ cancel, confirm, title }: NonNullable<ScreenProps['modal']>) {
  return (
    <View style={styles.barIOS}>
      {isIOS ? (
        <Pressable onPress={cancel.onPress} hitSlop={8}>
          <Txt variant="body" tone="brand">
            {cancel.label}
          </Txt>
        </Pressable>
      ) : (
        <Pressable onPress={cancel.onPress} accessibilityLabel={cancel.label} hitSlop={8}>
          <Ionicons name="close" size={24} color={color.ink} />
        </Pressable>
      )}

      <Txt variant="title" weight={isIOS ? '600' : '400'} style={isIOS ? styles.modalTitleIOS : styles.modalTitleMD}>
        {title}
      </Txt>

      <Pressable onPress={confirm.onPress} hitSlop={8}>
        <Txt variant="body" tone="brand" weight="600">
          {isIOS ? confirm.label : confirm.label.toUpperCase()}
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  content: { paddingHorizontal: space.lg, gap: space.lg, paddingBottom: space.lg },
  iosTitleBlock: { paddingTop: space.sm, gap: 2 },

  barIOS: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    height: 44,
  },
  backIOS: { flexDirection: 'row', alignItems: 'center', marginLeft: -6 },
  modalTitleIOS: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  modalTitleMD: { marginLeft: space.lg, flex: 1 },

  barMD: { paddingBottom: space.sm },
  barMDTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.lg,
    height: 56,
  },
  barMDLabel: { marginLeft: -space.sm },
  barMDTitle: { paddingHorizontal: space.lg, paddingTop: space.xs, gap: 2 },

  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.sm,
    backgroundColor: color.bg,
  },
});
