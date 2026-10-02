import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ListGroup, Row, Screen, SectionHeader, Txt, space } from '@agam/mobile-ui';
import { useAuth } from '@/lib/auth-context';
import { getAppVersion } from '@/lib/version';
import { schedule } from '@/data/demo';

export default function More() {
  const { session, signOut } = useAuth();
  const version = getAppVersion();

  // Tapping copies it — reading "0.1.0 (14) · preview" down a phone line is
  // exactly where support calls lose five minutes.
  const copyVersion = async () => {
    await Clipboard.setStringAsync(version.display);
    Alert.alert('Copied', version.display);
  };

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

      <View style={styles.section}>
        <SectionHeader>About</SectionHeader>
        <ListGroup>
          <Row
            title="Version"
            value={version.display}
            onPress={copyVersion}
            accessibilityHint="Copies the version to the clipboard"
          />
        </ListGroup>
        <Txt variant="secondary" tone="ink3">
          Quote this if you report a problem — it identifies the exact build.
        </Txt>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ section: { gap: space.sm } });
