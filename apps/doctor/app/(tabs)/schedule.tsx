import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ListGroup,
  Row,
  Screen,
  SectionHeader,
  SwitchRow,
  Txt,
  isIOS,
  space,
} from '@agam/mobile-ui';
import { schedule } from '@/data/demo';

export default function Schedule() {
  const [bookings, setBookings] = useState(true);
  const [walkIns, setWalkIns] = useState(true);
  const [notify, setNotify] = useState(false);

  return (
    <Screen title="Schedule" subtitle={schedule.doctor} action={{ label: 'Edit' }}>
      <View style={styles.section}>
        <SectionHeader>Availability</SectionHeader>
        <ListGroup>
          <SwitchRow
            title="Accepting bookings"
            subtitle="Patients can book you online"
            value={bookings}
            onValueChange={setBookings}
          />
          <SwitchRow
            title="Accept walk-ins"
            subtitle="2 slots held per session"
            value={walkIns}
            onValueChange={setWalkIns}
          />
          {/*
            Android only. iOS delivers the same thing through the system
            notification settings, so surfacing a second switch here would
            leave two places claiming to control one setting.
          */}
          {!isIOS ? (
            <SwitchRow
              title="Notify me when a patient checks in"
              subtitle="Push notification"
              value={notify}
              onValueChange={setNotify}
            />
          ) : null}
        </ListGroup>
      </View>

      <View style={styles.section}>
        <SectionHeader>This week</SectionHeader>
        <ListGroup>
          {schedule.week.map((d) => (
            <Row key={d.day} title={d.day} value={d.hours} />
          ))}
        </ListGroup>
      </View>

      <View style={styles.section}>
        <SectionHeader>Time off</SectionHeader>
        <ListGroup>
          {schedule.timeOff.map((t) => (
            <Row key={t.dates} title={t.dates} value={t.reason} />
          ))}
          <Row title="Apply for time off" tone="brand" chevron onPress={() => {}} />
        </ListGroup>
        <Txt variant="secondary" tone="ink3" style={styles.footnote}>
          Leave needs an admin's approval. They'll see how many appointments would need
          moving.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  footnote: { paddingHorizontal: isIOS ? space.xs : 0, marginTop: space.xs },
});
