import React from 'react';
import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import { TabBar, type TabItem } from '@agam/mobile-ui';
import { useAuth } from '@/lib/auth-context';

const TABS: readonly TabItem[] = [
  { key: 'index', label: 'Today', icon: 'list-outline' },
  { key: 'patients', label: 'Patients', icon: 'happy-outline' },
  { key: 'schedule', label: 'Schedule', icon: 'time-outline' },
  { key: 'more', label: 'More', icon: 'ellipsis-horizontal-circle-outline' },
];

export default function TabsLayout() {
  const { session, bootstrapping } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Guards every tab at once — a dropped session (401) bounces to login.
  if (!bootstrapping && !session) return <Redirect href="/login" />;

  const active = TABS.find((t) => pathname.endsWith(`/${t.key}`))?.key ?? 'index';

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // A custom bar rather than the default: iOS wants an icon over a tinted
      // label, Material 3 wants the active icon inside a filled pill. The
      // stock React Navigation bar draws neither.
      tabBar={() => (
        <TabBar
          items={TABS}
          active={active}
          onSelect={(key) => router.replace(key === 'index' ? '/(tabs)' : `/(tabs)/${key}`)}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="patients" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
