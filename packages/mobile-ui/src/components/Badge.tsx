import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from './Text';
import { color, isIOS, space } from '../tokens';

export type Tone = 'brand' | 'stop' | 'flag' | 'clinic' | 'pack' | 'neutral';

const fills: Record<Tone, { bg: string; fg: string }> = {
  brand: { bg: color.brandSoft, fg: color.onBrandSoft },
  stop: { bg: color.stopSoft, fg: color.stop },
  flag: { bg: color.flagSoft, fg: color.flag },
  clinic: { bg: color.clinicSoft, fg: color.clinicInk },
  pack: { bg: color.packSoft, fg: color.pack },
  neutral: { bg: '#EFEFF4', fg: color.ink3 },
};

/** The queue token number — a filled circle carrying the patient's token. */
export function TokenBadge({ token, tone = 'neutral' }: { token: number | string; tone?: Tone }) {
  const fill = fills[tone];
  return (
    <View style={[styles.token, { backgroundColor: fill.bg }]}>
      <Txt variant="secondary" weight="600" style={{ color: fill.fg }}>
        {String(token)}
      </Txt>
    </View>
  );
}

/**
 * Small inline label — "Penicillin", "Walk-in", "Package 5/10".
 * Material sets these in uppercase; iOS keeps the writer's casing.
 */
export function Tag({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const fill = fills[tone];
  return (
    <View style={[styles.tag, { backgroundColor: fill.bg }]}>
      <Txt variant="caption" weight={isIOS ? '600' : '500'} style={{ color: fill.fg }}>
        {isIOS ? label : label.toUpperCase()}
      </Txt>
    </View>
  );
}

/**
 * Full-width status strip — waiting time, allergy, unpaid balance.
 * Deliberately not a toast: these are standing facts about the patient, so
 * they stay on screen for as long as they are true.
 */
export function Banner({
  tone,
  children,
  icon,
}: {
  tone: Tone;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  const fill = fills[tone];
  return (
    <View style={[styles.banner, { backgroundColor: fill.bg }]}>
      {icon}
      <View style={styles.bannerBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  token: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: isIOS ? 5 : 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 3,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: isIOS ? 10 : 12,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  bannerBody: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
});
