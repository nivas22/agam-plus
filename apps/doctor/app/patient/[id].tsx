import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Banner,
  Button,
  ExtendedFab,
  ListGroup,
  Row,
  Screen,
  SectionHeader,
  Txt,
  color,
  isIOS,
  space,
} from '@agam/mobile-ui';
import { DEMO_NOW, patientDetail, todayAppointments } from '@/data/demo';
import { waitedMinutes } from '@/domain/queue';

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export default function PatientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const appointment = todayAppointments.find((a) => a.id === id) ?? todayAppointments[0];
  const waited = waitedMinutes(appointment, DEMO_NOW);
  const firstName = appointment.name.split(' ')[0];

  const meta = [
    appointment.ageSex,
    appointment.weightKg ? `${appointment.weightKg} kg` : null,
    `token ${appointment.token}`,
    appointment.scheduledStart ? `booked ${appointment.scheduledStart.slice(11, 16)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      // iOS names the destination in the back affordance; Material shows a
      // bare arrow and labels the screen instead, leaving "up" to the system.
      back={{ label: isIOS ? 'Today' : 'Patient', onPress: () => router.back() }}
      action={{ label: 'History' }}
      footer={
        isIOS ? (
          <>
            <Button label={`Call in ${firstName}`} />
            <Button label="Send back to desk" variant="plain" />
          </>
        ) : null
      }
      overlay={<ExtendedFab label="Call in" icon="play" />}
    >
      <View style={styles.head}>
        <Txt variant="largeTitle">{appointment.name}</Txt>
        <Txt variant="secondary" tone="ink3">
          {meta}
        </Txt>
      </View>

      {appointment.checkedInAt ? (
        <Banner tone="stop">
          <Txt variant="title" weight="700" tone="stop" mono>
            {`${waited} min`}
          </Txt>
          <Txt variant="secondary" tone="ink2">
            {`waiting since ${appointment.checkedInAt.slice(11, 16)}`}
          </Txt>
        </Banner>
      ) : null}

      {appointment.allergy ? (
        <Banner
          tone="stop"
          icon={<Ionicons name="warning-outline" size={18} color={color.stop} />}
        >
          <Txt variant="body" tone="stop" weight="500">
            {`Allergic to ${appointment.allergy.toLowerCase()}`}
          </Txt>
        </Banner>
      ) : null}

      {appointment.unpaidAmount ? (
        <Banner tone="flag" icon={<Txt variant="body" tone="flag">₹</Txt>}>
          <Txt variant="body" tone="flag">
            {`${rupees(appointment.unpaidAmount)} unpaid — the desk knows`}
          </Txt>
        </Banner>
      ) : null}

      <View style={styles.section}>
        <SectionHeader>Why he's here</SectionHeader>
        <View style={styles.quote}>
          <Txt variant="caption" tone="ink3" weight="600" style={styles.quoteKicker}>
            TOLD TO THE DESK
          </Txt>
          <Txt variant="body">{patientDetail.toldToTheDesk}</Txt>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader>{`Last visit · ${patientDetail.lastVisit.date}`}</SectionHeader>
        <View style={styles.quote}>
          <Txt variant="caption" tone="ink3" weight="600" style={styles.quoteKicker}>
            {`${patientDetail.lastVisit.author.toUpperCase()} WROTE`}
          </Txt>
          <Txt variant="body">{patientDetail.lastVisit.note}</Txt>
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader>Background</SectionHeader>
        <ListGroup>
          {patientDetail.background.map((item) => (
            <Row key={item.label} title={item.label} value={item.value} />
          ))}
        </ListGroup>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 2 },
  section: { gap: space.sm },
  // A recessed panel rather than a raised card: this is somebody else's words
  // being quoted back, not an action surface.
  quote: {
    backgroundColor: isIOS ? color.card : color.surface,
    borderRadius: 10,
    padding: space.lg,
    gap: space.sm,
  },
  quoteKicker: { letterSpacing: 0.5 },
});
