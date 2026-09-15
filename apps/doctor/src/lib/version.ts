import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { formatVersion, type VersionInfo } from '@agam/shared';

/**
 * The app carries three separate version numbers. Support calls need all of
 * them, because they answer different questions:
 *
 *   marketing  "0.1.0"  — app.json `version`, bumped by hand. What the store
 *                         listing and the user call the version.
 *   build      "14"     — iOS buildNumber / Android versionCode. NOT in
 *                         app.json: eas.json sets appVersionSource "remote",
 *                         so EAS holds the counter and `autoIncrement` bumps
 *                         it on each production build. This is the number
 *                         that identifies one specific binary.
 *   channel    "preview"— which eas.json build profile produced it, and so
 *                         which API the build is pointing at.
 */
export function getAppVersion(): VersionInfo {
  // nativeApplicationVersion reads the installed binary rather than the JS
  // bundle's idea of itself, so it stays correct after an OTA update ships a
  // newer bundle onto an older binary.
  const marketing =
    Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'unknown';

  // Null in Expo Go and on the simulator's dev client — there is no store
  // build number to report there.
  const build = Application.nativeBuildVersion ?? 'dev';

  // Set per profile in eas.json so a tester can tell a preview build from a
  // production one without opening the API URL.
  const channel = process.env.EXPO_PUBLIC_BUILD_PROFILE ?? 'development';

  // Same formatter as apps/web and apps/www, so a bug report from the phone
  // reads in the same shape as one from the browser.
  return formatVersion({
    app: 'doctor',
    release: marketing,
    build,
    environment: channel,
  });
}
