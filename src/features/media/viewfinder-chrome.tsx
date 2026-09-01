import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { QrCodeIcon } from '@/components/ui/icons';
import { AppText } from '@/components/ui/text';

import {
  VIEWFINDER_PILL_HEIGHT,
  VIEWFINDER_PILL_PADDING,
  VIEWFINDER_PILL_RADIUS,
} from './viewfinder-shot-counter';

const PILL_INNER_HEIGHT = VIEWFINDER_PILL_HEIGHT - VIEWFINDER_PILL_PADDING * 2;

export interface ViewfinderZoomOption<T> {
  label: string;
  value: T;
}

export function ViewfinderZoomPill<T>({
  options,
  activeLabel,
  onSelect,
}: {
  options: readonly ViewfinderZoomOption<T>[];
  activeLabel: string;
  onSelect?: (value: T) => void;
}) {
  return (
    <View style={S.zoomPill} pointerEvents={onSelect ? 'auto' : 'none'}>
      {options.map((option) => {
        const active = option.label === activeLabel;
        return (
          <Pressable
            key={option.label}
            disabled={!onSelect}
            style={[S.zoomOption, active && S.zoomOptionActive]}
            onPress={() => onSelect?.(option.value)}
          >
            <AppText style={[S.zoomOptionText, active && S.zoomOptionTextActive]}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ViewfinderCameraRollPlusIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export interface ViewfinderBottomControlsProps {
  flashMode?: 'off' | 'on' | 'auto';
  onFlash?: () => void;
  showFlip?: boolean;
  flipDisabled?: boolean;
  onFlip?: () => void;
  captureType?: 'photo' | 'video' | 'audio';
  recording?: boolean;
  captureDisabled?: boolean;
  onCapture?: () => void;
  showInvite?: boolean;
  onInvite?: () => void;
  showGallery?: boolean;
  gallerySource?: ImageSourcePropType;
  onGallery?: () => void;
  interactive?: boolean;
}

export function ViewfinderBottomControls({
  flashMode,
  onFlash,
  showFlip = true,
  flipDisabled = false,
  onFlip,
  captureType = 'photo',
  recording = false,
  captureDisabled = false,
  onCapture,
  showInvite = true,
  onInvite,
  showGallery = true,
  gallerySource,
  onGallery,
  interactive = true,
}: ViewfinderBottomControlsProps) {
  const controlsDisabled = !interactive;

  return (
    <View style={S.bottomControlsRow} pointerEvents={interactive ? 'auto' : 'none'}>
      {flashMode ? (
        <Pressable
          disabled={controlsDisabled}
          onPress={onFlash}
          style={S.controlBtn}
          accessibilityRole="button"
          accessibilityLabel="Toggle flash"
        >
          <FlashIcon mode={flashMode} />
        </Pressable>
      ) : <View style={S.controlBtn} />}

      {showFlip ? (
        <Pressable
          disabled={controlsDisabled || flipDisabled}
          onPress={onFlip}
          style={[S.controlBtn, flipDisabled && { opacity: 0.35 }]}
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
        >
          <FlipIcon />
        </Pressable>
      ) : <View style={S.controlBtn} />}

      <Pressable
        disabled={controlsDisabled || captureDisabled}
        onPress={onCapture}
        style={({ pressed }) => [
          S.shutterBtn,
          captureType !== 'photo' && S.shutterBtnVideoMode,
          recording && S.shutterBtnRecording,
          pressed && { opacity: 0.8 },
          captureDisabled && { opacity: 0.4 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          captureType === 'photo'
            ? 'Take photo'
            : recording
              ? `Stop ${captureType} recording`
              : `Start ${captureType} recording`
        }
      >
        <View
          style={[
            S.shutterBtnInner,
            captureType !== 'photo' && S.shutterBtnInnerVideoMode,
            recording && S.shutterBtnInnerRecording,
          ]}
        />
      </Pressable>

      {showInvite ? (
        <Pressable
          disabled={controlsDisabled}
          onPress={onInvite}
          style={S.controlBtn}
          accessibilityRole="button"
          accessibilityLabel="Invite guests"
        >
          <QrCodeIcon size={24} color="#FFFFFF" />
        </Pressable>
      ) : <View style={S.controlBtnSpacer} />}

      {showGallery ? (
        <Pressable
          disabled={controlsDisabled}
          onPress={onGallery}
          style={S.photosBtn}
          accessibilityRole="button"
          accessibilityLabel="Open gallery"
        >
          {gallerySource ? (
            <Image source={gallerySource} style={S.photosBtnThumb} />
          ) : (
            <View style={S.photosBtnPlaceholder}>
              <View style={S.photosBtnPlaceholderDot} />
            </View>
          )}
        </Pressable>
      ) : <View style={S.controlBtnSpacer} />}
    </View>
  );
}

function FlashIcon({ mode }: { mode: 'off' | 'on' | 'auto' }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={mode === 'on' ? '#FFFFFF' : 'none'}
      />
      {mode === 'auto' ? (
        <View style={S.flashAutoBadge}>
          <AppText style={S.flashAutoText}>A</AppText>
        </View>
      ) : null}
    </Svg>
  );
}

function FlipIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const S = StyleSheet.create({
  zoomPill: {
    flexDirection: 'row',
    backgroundColor: 'rgba(11, 11, 12, 0.6)',
    height: VIEWFINDER_PILL_HEIGHT,
    borderRadius: VIEWFINDER_PILL_RADIUS,
    padding: VIEWFINDER_PILL_PADDING,
    gap: 4,
    alignItems: 'center',
  },
  zoomOption: {
    width: 38,
    height: PILL_INNER_HEIGHT,
    borderRadius: PILL_INNER_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomOptionActive: { backgroundColor: '#FFFFFF' },
  zoomOptionText: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 12,
    color: '#FFFFFF',
  },
  zoomOptionTextActive: { color: '#0B0B0C' },
  bottomControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnSpacer: { width: 44, height: 44 },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterBtnVideoMode: { borderColor: 'rgba(255, 255, 255, 0.92)' },
  shutterBtnRecording: { borderColor: 'rgba(255, 59, 48, 0.72)' },
  shutterBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  shutterBtnInnerVideoMode: { backgroundColor: '#FF453A' },
  shutterBtnInnerRecording: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FF453A',
  },
  photosBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  photosBtnThumb: { width: '100%', height: '100%' },
  photosBtnPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photosBtnPlaceholderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  flashAutoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0B0B0C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  flashAutoText: {
    fontSize: 7,
    color: '#FFFFFF',
    fontWeight: '900',
  },
});
