import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { color } from '@agam/mobile-ui';
import { AuthProvider } from '@/lib/auth-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Clinic wifi is unreliable; avoid hammering a failing endpoint.
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/*
            The tokens in @agam/mobile-ui define a light palette only, so the
            status bar is pinned to dark content rather than following the
            system theme — "auto" would turn the glyphs white over a light
            background the moment the device switched to dark mode.
          */}
          <StatusBar style="dark" backgroundColor={color.bg} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
            <Stack.Screen name="visit/finish" options={{ presentation: 'modal' }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
