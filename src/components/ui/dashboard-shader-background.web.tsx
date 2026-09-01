import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function DashboardShaderBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#121519', '#080A0C', '#010203', '#000000']}
        locations={[0, 0.18, 0.42, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 0.65 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
