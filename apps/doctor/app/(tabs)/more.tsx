import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ListGroup, Row, Screen, SectionHeader, Txt, space } from '@agam/mobile-ui';
import { useAuth } from '@/lib/auth-context';
import { schedule } from '@/data/demo';

export default function More() {
  const { session, signOut } = useAuth();

  return (
    <Screen title="More">
      <View style={styles.section}>
        <SectionHeader>Account</SectionHeader>
        <ListGroup>
          <Row title={session?.user.name ?? schedule.doctor} subtitle={session?.user.email} />
          <Row title="Change password" chevron onPress={() => {}} />
        </ListGroup>
      </View>

      <View style={styles.section}>
        <SectionHeader>Session</SectionHeader>
        <ListGroup>
          <Row title="Sign out" tone="brand" onPress={signOut} />
        </ListGroup>
        <Txt variant="secondary" tone="ink3">
          Signing out clears the notes saved on this device.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: space.sm } });
