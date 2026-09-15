import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const fromRoot = (path) => resolve(root, path);

const requiredRoutes = [
  'src/app-clip/j/[slug].tsx',
  'src/app-clip/e/[eventCode].tsx',
  'src/app-clip/celebration/[celebrationId]/index.tsx',
  'src/app-clip/celebration/[celebrationId]/camera.tsx',
  'src/app-clip/celebration/[celebrationId]/guestbook.tsx',
  'src/app-clip/celebration/[celebrationId]/challenges/index.tsx',
  'src/app-clip/celebration/[celebrationId]/challenges/[challengeId].tsx',
  'src/app-clip/celebration/[celebrationId]/photos/[photoId].tsx',
];

const forbiddenRoutes = [
  'src/app-clip/home.tsx',
  'src/app-clip/j/index.tsx',
  'src/app-clip/sign-in.tsx',
  'src/app-clip/create',
  'src/app-clip/celebration/[celebrationId]/edit',
  'src/app-clip/celebration/[celebrationId]/preview.tsx',
  'src/app-clip/e/[eventCode]/gallery.tsx',
];

const errors = [];

for (const path of requiredRoutes) {
  if (!existsSync(fromRoot(path))) errors.push(`Missing guest route: ${path}`);
}
for (const path of forbiddenRoutes) {
  if (existsSync(fromRoot(path))) errors.push(`Host/obsolete route crossed the Clip boundary: ${path}`);
}

const layout = readFileSync(fromRoot('src/app-clip/_layout.tsx'), 'utf8');
if (/OpenMoji/i.test(layout)) errors.push('The Clip layout must not load the OpenMoji font.');

const metro = readFileSync(fromRoot('metro.config.js'), 'utf8');
for (const moduleName of [
  '@/features/auth/context',
  '@/features/celebrations/challenge-icons',
  '@/features/celebrations/sample-event',
  '@/features/entitlements/upgrade-sheet',
  '@react-native-masked-view/masked-view',
]) {
  if (!metro.includes(moduleName)) errors.push(`Missing Clip runtime replacement: ${moduleName}`);
}

const pods = readFileSync(fromRoot('targets/clip/pods.rb'), 'utf8');
for (const packageName of [
  'expo-apple-authentication',
  'expo-dev-client',
  'expo-image',
  'expo-updates',
  'react-native-purchases',
]) {
  if (!pods.includes(`\"${packageName}\"`)) errors.push(`Missing native Clip exclusion: ${packageName}`);
}
if (!pods.includes("use_expo_modules!(exclude: clip_excluded_packages)")) {
  errors.push('Clip exclusions are not applied to Expo module autolinking.');
}
if (!pods.includes("config_command.concat(['--exclude', *clip_excluded_packages])")) {
  errors.push('Clip exclusions are not applied to unified React Native autolinking.');
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('App Clip boundary check passed.');
