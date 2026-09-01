import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colours, layout, radii, spacing } from '@/design';
import { AppText } from '@/components/ui/text';

export type UploadPhase = 'processing' | 'uploading' | 'complete';
export type UploadMediaType = 'photo' | 'video' | 'audio';

export interface UploadStatusProps {
  phase: UploadPhase;
  mediaType: UploadMediaType;
  mode?: 'inline' | 'overlay';
}

const nounFor = (mediaType: UploadMediaType) => (mediaType === 'audio' ? 'recording' : mediaType);

export function UploadStatus({ phase, mediaType, mode = 'inline' }: UploadStatusProps) {
  const noun = nounFor(mediaType);
  const message =
    phase === 'processing'
      ? `Processing your ${noun}`
      : phase === 'uploading'
        ? `Uploading your ${noun}`
        : `${noun[0].toUpperCase()}${noun.slice(1)} uploaded`;
  const detail =
    phase === 'processing'
      ? 'Getting it ready to share.'
      : phase === 'uploading'
        ? 'Keep this screen open until it finishes.'
        : 'It is now in the event gallery.';

  return (
    <View
      accessible
      accessibilityLabel={`${message}. ${detail}`}
      accessibilityLiveRegion="polite"
      style={[S.root, mode === 'overlay' && S.overlay]}
    >
      {phase === 'complete' ? (
        <View style={S.completeMark}>
          <AppText variant="labelLarge" style={S.completeMarkText}>Done</AppText>
        </View>
      ) : (
        <ActivityIndicator color={colours.textOnBrand} />
      )}
      <View style={S.copy}>
        <AppText variant="labelLarge" style={S.title}>{message}</AppText>
        <AppText variant="caption" style={S.detail}>{detail}</AppText>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(11, 11, 12, 0.90)',
    borderWidth: layout.hairline,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  overlay: {
    position: 'absolute',
    top: spacing.xl,
    left: layout.gutter,
    right: layout.gutter,
    zIndex: 500,
    elevation: 500,
  },
  copy: { flex: 1, gap: 2 },
  title: { color: '#FFFFFF' },
  detail: { color: 'rgba(255, 255, 255, 0.72)' },
  completeMark: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.accentWarm,
  },
  completeMarkText: { color: colours.textOnBrand, fontSize: 11 },
});
