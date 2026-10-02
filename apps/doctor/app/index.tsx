import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { color } from '@agam/mobile-ui';
import { useAuth } from '@/lib/auth-context';

/** Entry gate: waits for the stored token check, then routes accordingly. */
export default function Index() {
  const { session, bootstrapping } = useAuth();

  if (bootstrapping) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)' : '/login'} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg,
  },
});
