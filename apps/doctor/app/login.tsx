import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import {
  Button,
  Screen,
  Txt,
  color,
  isIOS,
  space,
  type as typeScale,
} from '@agam/mobile-ui';
import { useAuth } from '@/lib/auth-context';

export default function Login() {
  const { session, signIn } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) return <Redirect href="/(tabs)" />;

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const field = [
    styles.input,
    typeScale.body,
    isIOS ? styles.inputIOS : styles.inputMD,
    { color: color.ink },
  ];

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <Txt variant="largeTitle">Agam Doctor</Txt>
        <Txt variant="body" tone="ink3">
          Sign in with your clinic credentials.
        </Txt>
      </View>

      <View style={styles.form}>
        <TextInput
          style={field}
          placeholder="Username"
          placeholderTextColor={color.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={field}
          placeholder="Password"
          placeholderTextColor={color.ink3}
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
        />

        {error ? (
          <Txt variant="secondary" tone="stop">
            {error}
          </Txt>
        ) : null}

        <Button
          label="Sign in"
          onPress={onSubmit}
          loading={submitting}
          disabled={!username || !password}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', gap: space.xl },
  header: { gap: space.xs },
  form: { gap: space.md },
  input: { minHeight: 48, paddingHorizontal: space.md },
  inputIOS: {
    backgroundColor: color.card,
    borderRadius: 10,
  },
  // Material filled field: tinted surface, underline instead of a full border.
  inputMD: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: color.outline,
  },
});
