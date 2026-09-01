import { Switch, type SwitchProps } from 'react-native';

import { colours } from '@/design';

export type AppSwitchProps = Omit<
  SwitchProps,
  'trackColor' | 'thumbColor' | 'ios_backgroundColor'
>;

/** The single visual treatment for every binary switch in the app. */
export function AppSwitch(props: AppSwitchProps) {
  return (
    <Switch
      {...props}
      trackColor={{ false: colours.surfaceRaised, true: colours.success }}
      thumbColor={colours.textPrimary}
      ios_backgroundColor={colours.surfaceRaised}
    />
  );
}
