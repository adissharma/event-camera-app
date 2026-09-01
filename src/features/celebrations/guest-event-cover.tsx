import type { RefObject } from 'react';
import type { ImageSourcePropType, TextInput, ViewStyle } from 'react-native';

import { GuestJoinScreen } from './join/guest-join-screen';
import type { CoverTemplateKey } from './cover-templates';

/**
 * Compatibility adapter for the older `/e` entry route.
 *
 * The renderer is intentionally owned by `GuestJoinScreen`. Keeping this
 * adapter thin means the preview, `/j`, and the older event-code route cannot
 * grow separate cover layouts again.
 */
export interface GuestEventCoverProps {
  template?: CoverTemplateKey;
  coverSource: ImageSourcePropType;
  interactive?: boolean;
  title: string;
  countdownLabel: string;
  shotsLeftLabel: string;
  shotsLeftDetailLabel?: string;
  accent?: string | null;
  height?: ViewStyle['height'];
  coverHeight?: ViewStyle['height'];
  preview?: boolean;
  welcomeName?: string | null;
  welcomePrefix?: 'Welcome' | 'Welcome back';
  onChangeNamePress?: () => void;
  nameInputRef?: RefObject<TextInput | null>;
  nameValue?: string;
  onNameChange?: (value: string) => void;
  showNameInput?: boolean;
  showValidation?: boolean;
  error?: string | null;
  isNameValid?: boolean;
  isJoining?: boolean;
  ctaLabel?: string;
  onCtaPress?: () => void;
}

export function GuestEventCover({
  coverSource,
  title,
  countdownLabel,
  shotsLeftLabel,
  shotsLeftDetailLabel,
  accent,
  template,
  interactive,
  welcomeName,
  welcomePrefix,
  onChangeNamePress,
  nameInputRef,
  nameValue,
  onNameChange,
  showNameInput,
  showValidation,
  error,
  isNameValid,
  isJoining,
  ctaLabel,
  onCtaPress,
}: GuestEventCoverProps) {
  return (
    <GuestJoinScreen
      template={template}
      coverSource={coverSource}
      title={title}
      countdownLabel={countdownLabel}
      shotsLeftLabel={shotsLeftLabel}
      shotsLeftDetailLabel={shotsLeftDetailLabel}
      accent={accent}
      name={nameValue}
      onNameChange={onNameChange}
      nameInputRef={nameInputRef}
      showNameInput={showNameInput}
      welcomeName={welcomeName}
      welcomePrefix={welcomePrefix}
      onChangeNamePress={onChangeNamePress}
      showValidation={showValidation}
      error={error}
      isNameValid={isNameValid}
      isJoining={isJoining}
      ctaLabel={ctaLabel}
      onJoin={onCtaPress}
      interactive={interactive}
      scrollable={false}
    />
  );
}
