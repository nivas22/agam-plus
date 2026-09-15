import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  ExtendedFab,
  ListGroup,
  Row,
  Screen,
  SectionHeader,
  Tag,
  TokenBadge,
  Txt,
  color,
  elevation,
  isIOS,
  radius,
  space,
} from '@agam/mobile-ui';
import { DEMO_NOW, todayAppointments, withYouNow } from '@/data/demo';
import { orderQueue, waitedMinutes } from '@/domain/queue';
import type { Appointment } from '@/types';

const mmss = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Waiting longer than this reads as a problem, not a number. */
const LATE_MINUTES = 20;

export default function Today() {
  const router = useRouter();
  const now = DEMO_NOW;

  // Only checked-in patients are queue candidates — orderQueue's precondition.
  const { waiting, later } = useMemo(() => {
    const checkedIn = todayAppointments.filter((a) => a.checkedInAt);
    const notArrived = todayAppointments
      .filter((a) => !a.checkedInAt)
      .sort((a, b) => (a.scheduledStart ?? '').localeCompare(b.scheduledStart ?? ''));
    return { waiting: orderQueue(checkedIn, now), later: notArrived };
  }, [now]);

  const open = (a: Appointment) => router.push(`/patient/${a.id}`);

  return (
    <Screen
      title="Today"
      subtitle="Friday 21 Aug · 14 patients"
      action={{ label: 'Edit' }}
      overlay={<ExtendedFab label="Dictate note" />}
    >
      <WithYouNow />

      <View style={styles.section}>
        <SectionHeader>{isIOS ? 'Waiting' : `Waiting · ${waiting.length}`}</SectionHeader>
        <ListGroup>
          {waiting.map(({ appointment: a, reason }) => {
            const waited = waitedMinutes(a, now);
            const late = waited >= LATE_MINUTES;
            return (
              <Row
                key={a.id}
                leading={<TokenBadge token={a.token} tone={late ? 'stop' : 'flag'} />}
                title={a.name}
                subtitle={`${a.ageSex} · ${a.reason}`}
                onPress={() => open(a)}
                chevron
                accessibilityHint={reason}
                below={
                  a.allergy ? (
                    <Tag label={a.allergy} tone="stop" />
                  ) : a.source === 'walk_in' ? (
                    <Tag label="Walk-in" tone="pack" />
                  ) : null
                }
                trailing={
                  <Txt variant="secondary" weight="600" tone={late ? 'stop' : 'flag'}>
                    {waited}m
                  </Txt>
                }
              />
            );
          })}
        </ListGroup>
      </View>

      <View style={styles.section}>
        <SectionHeader>
          {isIOS ? 'Later this morning' : `Later this morning · ${later.length}`}
        </SectionHeader>
        <ListGroup>
          {later.map((a) => (
            <Row
              key={a.id}
              leading={<TokenBadge token={a.token} />}
              title={a.name}
              subtitle={`${a.scheduledStart?.slice(11, 16)} · not arrived`}
              onPress={() => open(a)}
              chevron
              below={a.packageProgress ? <Tag label={a.packageProgress} tone="pack" /> : null}
            />
          ))}
        </ListGroup>
      </View>
    </Screen>
  );
}

/** The one patient in the room — the only card that ever takes the brand fill. */
function WithYouNow() {
  const { name, ageSex, bookedAt, room, elapsedSeconds, slotMinutes } = withYouNow;
  const over = elapsedSeconds > slotMinutes * 60;

  return (
    <View style={styles.now}>
      <Txt variant="caption" weight="600" style={styles.nowKicker}>
        WITH YOU NOW
      </Txt>
      <Txt variant="largeTitle" tone="onBrand" style={styles.nowName}>
        {name}
      </Txt>
      <Txt variant="secondary" style={styles.nowMeta}>
        {`${ageSex} · booked ${bookedAt} · ${room}`}
      </Txt>

      <View style={styles.timer}>
        <Txt variant="title" mono weight="700" tone="onBrand">
          {mmss(elapsedSeconds)}
        </Txt>
        <Txt variant="secondary" style={styles.nowMeta}>
          {over ? `over ${slotMinutes} min` : `of ${slotMinutes} min`}
        </Txt>
      </View>

      <Button label="Complete visit" variant="onBrand" style={styles.nowButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  now: {
    backgroundColor: color.brand,
    borderRadius: isIOS ? 14 : radius.card,
    padding: space.lg,
    gap: space.xs,
    ...elevation(1),
  },
  nowKicker: { color: '#FFFFFF', opacity: 0.75, letterSpacing: 0.6 },
  nowName: { color: '#FFFFFF', marginTop: 2 },
  nowMeta: { color: '#FFFFFF', opacity: 0.85 },
  timer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    backgroundColor: '#FFFFFF24',
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginTop: space.sm,
  },
  nowButton: { marginTop: space.sm },
});
