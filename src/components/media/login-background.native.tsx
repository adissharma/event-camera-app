import { StyleSheet, View } from 'react-native';

import { colours } from '@/design';

export function LoginBackground() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colours.background }]} />;
}
