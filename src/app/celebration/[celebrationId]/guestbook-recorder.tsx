import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  PanResponder,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
const nativeAudioModule = Platform.OS === 'web' ? null : (() => {
  try {
    return require('expo-audio');
  } catch {
    return null;
  }
})();

const RecordingPresets = nativeAudioModule?.RecordingPresets ?? { HIGH_QUALITY: {} };
const requestRecordingPermissionsAsync = nativeAudioModule?.requestRecordingPermissionsAsync ?? (async () => ({ granted: false }));
const setAudioModeAsync = nativeAudioModule?.setAudioModeAsync ?? (async () => {});
const useAudioPlayer = nativeAudioModule?.useAudioPlayer ?? (() => ({ replace: () => {}, play: () => {}, pause: () => {}, seekTo: async () => {} }));
const useAudioPlayerStatus = nativeAudioModule?.useAudioPlayerStatus ?? (() => ({ playing: false, didJustFinish: false, currentTime: 0, duration: 0 }));
const useAudioRecorder = nativeAudioModule?.useAudioRecorder ?? (() => null);
const useAudioRecorderState = nativeAudioModule?.useAudioRecorderState ?? (() => ({ isRecording: false, metering: -160, durationMillis: 0 }));
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { File } from 'expo-file-system';

let CameraView: any = null;
let useCameraPermissions: any = () => [null, () => {}];
let hasNativeCamera = false;

try {
  const expoCamera = require('expo-camera');
  CameraView = expoCamera.CameraView;
  useCameraPermissions = expoCamera.useCameraPermissions;
  hasNativeCamera = true;
} catch (error) {
  console.warn('Native camera module is missing in this build.', error);
}

import { AppText } from '@/components/ui/text';
import { colours, layout, radii, spacing } from '@/design';
import {
  celebrationDetailKeys,
  fetchCelebrationDetail,
} from '@/services/celebration-detail';
import { loadStoredGuestSessionByCelebrationId } from '@/services/guest-session';
import { uploadGuestMedia } from '@/services/guest-media-upload';
import { uploadHostMedia } from '@/services/host-media-upload';
import { queryClient } from '@/lib/query-client';
import { celebrationKeys } from '@/services/celebrations';
import { normaliseMimeType } from '@/features/media/storage-paths';

type RecorderMode = 'audio' | 'video';

type AudioPreview = {
  uri: string;
  mimeType: string;
  durationMs: number;
};

type VideoPreview = {
  uri: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  durationMs: number;
};

const MAX_DURATION_MS = 30_000;

function CloseChevron({ size = 20, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FlipIcon({ size = 22, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l.73-.73"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MicIcon({ size = 24, color = '#FFFFFF' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} strokeWidth={2} />
      <Path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlayIcon({ size = 18, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 6.5v11l9-5.5-9-5.5Z" fill={color} />
    </Svg>
  );
}

function PauseIcon({ size = 16, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={7} y={6} width={3.5} height={12} rx={1.2} fill={color} />
      <Rect x={13.5} y={6} width={3.5} height={12} rx={1.2} fill={color} />
    </Svg>
  );
}

function InlineVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.loop = false;
    instance.pause();
  });

  return (
    <View style={styles.previewFill}>
      <VideoView player={player} style={styles.previewFill} nativeControls contentFit="contain" />
    </View>
  );
}

function formatSecondsFromMs(durationMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(durationMs / 1000));
  return `00:${String(totalSeconds).padStart(2, '0')}`;
}

function getPreferredWebVideoMimeType(): string | undefined {
  if (Platform.OS !== 'web' || typeof MediaRecorder === 'undefined') return undefined;
  return [
    'video/mp4;codecs=h264,aac',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.4D002A,mp4a.40.2',
    'video/mp4',
  ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

export default function GuestbookRecorderScreen() {
  const { celebrationId } = useLocalSearchParams<{ celebrationId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cameraRef = useRef<any>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const { data: detail, isLoading } = useQuery({
    queryKey: celebrationDetailKeys.detail(String(celebrationId)),
    queryFn: () => fetchCelebrationDetail(String(celebrationId)),
    enabled: Boolean(celebrationId),
  });

  const isGuest = detail?.viewerRole === 'guest';
  const [guestAuth, setGuestAuth] = useState<{
    slug: string;
    guestToken: string;
  } | null>(null);
  const [recorderMode, setRecorderMode] = useState<RecorderMode>('audio');
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [videoPreview, setVideoPreview] = useState<VideoPreview | null>(null);
  const [audioPreview, setAudioPreview] = useState<AudioPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoRemainingMs, setVideoRemainingMs] = useState(MAX_DURATION_MS);
  const [audioPermissionGranted, setAudioPermissionGranted] = useState<boolean | null>(null);
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 20 }, () => 0.12));

  const audioRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
    keepAudioActiveHint: true,
  } as any);
  const audioState = useAudioRecorderState(audioRecorder, 100);
  const audioPlayer = useAudioPlayer(audioPreview?.uri ?? null, { updateInterval: 250 });
  const audioPlayerStatus = useAudioPlayerStatus(audioPlayer);

  const recordingStartRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webVideoMimeType = getPreferredWebVideoMimeType();

  useEffect(() => {
    if (!isGuest || !celebrationId) return;
    let cancelled = false;
    (async () => {
      const found = await loadStoredGuestSessionByCelebrationId(String(celebrationId));
      if (!cancelled && found) {
        setGuestAuth({
          slug: found.slug,
          guestToken: found.session.guestToken,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [celebrationId, isGuest]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (!cancelled) {
        setAudioPermissionGranted(permission.granted);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!audioState.isRecording) return;
    const metering = typeof audioState.metering === 'number' ? audioState.metering : -160;
    const normalized = Math.max(0.08, Math.min(1, (metering + 160) / 160));
    setWaveform((current) => [...current.slice(1), normalized]);
  }, [audioState.isRecording, audioState.metering]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      if (isRecordingVideo) {
        stopVideoRecording();
      }
      if (audioState.isRecording) {
        void stopAudioRecording();
      }
    });
    return () => subscription.remove();
  }, [audioState.isRecording, isRecordingVideo]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (Platform.OS === 'web') {
        webRecorderRef.current?.stop();
      } else if (isRecordingVideo) {
        cameraRef.current?.stopRecording?.();
      }
    };
  }, [isRecordingVideo]);

  useEffect(() => {
    if (!audioPreview?.uri) return;
    audioPlayer.replace(audioPreview.uri);
  }, [audioPlayer, audioPreview?.uri]);

  useEffect(() => {
    if (!audioPlayerStatus.didJustFinish) return;
    void audioPlayer.seekTo(0);
    audioPlayer.pause();
  }, [audioPlayer, audioPlayerStatus.didJustFinish]);

  const headerHeight = 84;
  const bottomPanelHeight = 132;
  const viewfinderHeight = screenHeight - insets.top - headerHeight - bottomPanelHeight - insets.bottom;

  const canShowCamera = hasNativeCamera && CameraView && recorderMode === 'video' && !videoPreview;
  const canRecordVideo = Platform.OS !== 'web';

  const viewfinderPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) =>
        Math.abs(gestureState.dx) > 16 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.35 &&
        !audioState.isRecording &&
        !isRecordingVideo,
      onPanResponderRelease: (_event, gestureState) => {
        if (gestureState.dx <= -24) {
          setRecorderMode('video');
          return;
        }
        if (gestureState.dx >= 24) {
          setRecorderMode('audio');
        }
      },
    }),
  ).current;

  function clearVideoTimer() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  async function startAudioRecording() {
    if (audioPermissionGranted === false) {
      Alert.alert('Microphone access required', 'Please allow microphone access to record a message.');
      return;
    }
    if (audioState.isRecording || isUploading) return;

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await audioRecorder.prepareToRecordAsync({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
        keepAudioActiveHint: true,
      } as any);
      setWaveform(Array.from({ length: 20 }, () => 0.12));
      audioRecorder.record({ forDuration: 30 });
    } catch (error) {
      console.error('[guestbook] failed to start audio recording', error);
      Alert.alert('Recording failed', 'We could not start recording this audio message.');
    }
  }

  async function stopAudioRecording() {
    if (!audioState.isRecording) return;

    try {
      await audioRecorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = audioRecorder.uri ?? audioRecorder.getStatus().url;
      if (!uri) {
        throw new Error('No audio file was created.');
      }
      setAudioPreview({
        uri,
        mimeType: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4',
        durationMs: Math.max(100, audioState.durationMillis),
      });
    } catch (error) {
      console.error('[guestbook] failed to stop audio recording', error);
      Alert.alert('Recording failed', 'We could not finish this audio message.');
    }
  }

  async function startVideoRecording() {
    if (isRecordingVideo || isUploading || !canRecordVideo) {
      if (!canRecordVideo && Platform.OS === 'web') {
        Alert.alert('Video not supported here', 'This browser cannot record a compatible video for the Guestbook yet.');
      }
      return;
    }

    recordingStartRef.current = Date.now();
    setVideoRemainingMs(MAX_DURATION_MS);
    setIsRecordingVideo(true);
    clearVideoTimer();
    recordingTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, MAX_DURATION_MS - (Date.now() - (recordingStartRef.current ?? Date.now())));
      setVideoRemainingMs(remaining);
      if (remaining === 0) {
        stopVideoRecording();
      }
    }, 100);

    try {
      if (Platform.OS === 'web') {
        const container = cameraRef.current as any;
        const previewElement = container?.querySelector?.('video');
        const previewStream = previewElement?.srcObject;
        if (!(previewStream instanceof MediaStream) || !webVideoMimeType) {
          throw new Error('The browser camera stream is not ready.');
        }

        const videoTrack = previewStream.getVideoTracks().find((track) => track.readyState === 'live');
        if (!videoTrack) throw new Error('No live camera track is available.');

        const clonedTracks = [
          videoTrack.clone(),
          ...previewStream.getAudioTracks().filter((track) => track.readyState === 'live').map((track) => track.clone()),
        ];
        const recorder = new MediaRecorder(new MediaStream(clonedTracks), { mimeType: webVideoMimeType });
        webRecorderRef.current = recorder;

        const preview = await new Promise<VideoPreview>((resolve, reject) => {
          const chunks: Blob[] = [];
          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) chunks.push(event.data);
          };
          recorder.onerror = () => reject(new Error('The browser could not finish recording this video.'));
          recorder.onstop = () => {
            try {
              clonedTracks.forEach((track) => track.stop());
              const mimeType = normaliseMimeType(recorder.mimeType || chunks[0]?.type || 'video/webm');
              const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
              resolve({
                uri: URL.createObjectURL(blob),
                mimeType: blob.type || 'video/webm',
                width: previewElement?.videoWidth ?? null,
                height: previewElement?.videoHeight ?? null,
                durationMs: Math.min(MAX_DURATION_MS, Math.max(100, Date.now() - (recordingStartRef.current ?? Date.now()))),
              });
            } catch (error) {
              reject(error instanceof Error ? error : new Error('Could not prepare this video.'));
            }
          };
          recorder.start(250);
        });

        setVideoPreview(preview);
        return;
      }

      const recording = await cameraRef.current?.recordAsync({
        maxDuration: 30,
        codec: Platform.OS === 'ios' ? 'avc1' : undefined,
      });
      if (!recording?.uri) throw new Error('The camera did not return a video file.');

      const localFile = new File(recording.uri);
      const fileInfo = localFile.info();
      if (!fileInfo.exists || !fileInfo.size || fileInfo.size <= 0) {
        throw new Error('The recorded video file is empty.');
      }

      setVideoPreview({
        uri: recording.uri,
        mimeType: Platform.OS === 'ios' ? 'video/quicktime' : 'video/mp4',
        width: null,
        height: null,
        durationMs: Math.min(MAX_DURATION_MS, Math.max(100, Date.now() - (recordingStartRef.current ?? Date.now()))),
      });
    } catch (error) {
      console.error('[guestbook] failed to record video', error);
      Alert.alert('Recording failed', 'We could not record this video message.');
    } finally {
      clearVideoTimer();
      recordingStartRef.current = null;
      setIsRecordingVideo(false);
    }
  }

  function stopVideoRecording() {
    if (Platform.OS === 'web') {
      webRecorderRef.current?.stop();
      webRecorderRef.current = null;
      clearVideoTimer();
      setIsRecordingVideo(false);
      return;
    }
    cameraRef.current?.stopRecording?.();
    clearVideoTimer();
    setIsRecordingVideo(false);
  }

  function discardPreviews() {
    if (Platform.OS === 'web') {
      if (videoPreview?.uri?.startsWith('blob:')) {
        URL.revokeObjectURL(videoPreview.uri);
      }
      if (audioPreview?.uri?.startsWith('blob:')) {
        URL.revokeObjectURL(audioPreview.uri);
      }
    }
    setVideoPreview(null);
    setAudioPreview(null);
    audioPlayer.pause();
  }

  async function postGuestbookMessage() {
    const message = recorderMode === 'audio' ? audioPreview : videoPreview;
    if (!message || isUploading) return;

    setIsUploading(true);
    try {
      const metadata = { submission_kind: 'guestbook' };
      const videoMessage = recorderMode === 'video' ? (message as VideoPreview) : null;
      const videoWidth = videoMessage?.width ?? undefined;
      const videoHeight = videoMessage?.height ?? undefined;
      if (isGuest && guestAuth) {
        await uploadGuestMedia({
          eventCode: guestAuth.slug,
          guestToken: guestAuth.guestToken,
          localUri: message.uri,
          source: recorderMode === 'audio' ? 'recording' : 'camera',
          mediaType: recorderMode,
          mimeType: message.mimeType,
          width: videoWidth,
          height: videoHeight,
          durationMs: message.durationMs,
          metadata,
        });
      } else if (!isGuest && celebrationId) {
        await uploadHostMedia({
          celebrationId: String(celebrationId),
          localUri: message.uri,
          source: recorderMode === 'audio' ? 'recording' : 'camera',
          mediaType: recorderMode,
          mimeType: message.mimeType,
          width: videoWidth,
          height: videoHeight,
          durationMs: message.durationMs,
          metadata,
        });
      } else {
        throw new Error('No identity is available for this upload yet.');
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: celebrationDetailKeys.detail(String(celebrationId)) }),
        queryClient.invalidateQueries({ queryKey: ['guestbook', 'guest', String(celebrationId)] }),
        queryClient.invalidateQueries({ queryKey: ['guestbook', 'host', String(celebrationId)] }),
        queryClient.invalidateQueries({ queryKey: celebrationKeys.list() }),
      ]);
      router.back();
    } catch (error) {
      console.error('[guestbook] failed to post guestbook message', error);
      Alert.alert('Upload failed', `Your ${recorderMode} message could not be uploaded. Please try again.`);
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePrimaryPress() {
    if (videoPreview || audioPreview) {
      await postGuestbookMessage();
      return;
    }

    if (recorderMode === 'audio') {
      if (audioState.isRecording) {
        await stopAudioRecording();
        return;
      }
      await startAudioRecording();
      return;
    }

    if (isRecordingVideo) {
      stopVideoRecording();
      return;
    }
    await startVideoRecording();
  }

  const isPreviewing = Boolean(videoPreview || audioPreview);
  const previewAudioPlaying = audioPlayerStatus.playing;

  if (isLoading || !detail) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator color={colours.textSecondary} />
      </View>
    );
  }

  if (!cameraPermission?.granted && recorderMode === 'video') {
    return (
      <View style={styles.permissionRoot}>
        <View style={styles.permissionContent}>
          <AppText variant="displayMedium" align="center" style={styles.permissionTitle}>
            Camera Access Required
          </AppText>
          <AppText variant="bodyMedium" align="center" tone="secondary" style={styles.permissionBody}>
            Allow camera access to record a video Guestbook message.
          </AppText>
          <Pressable style={styles.permissionBtn} onPress={requestCameraPermission}>
            <AppText style={styles.permissionBtnText}>Enable Camera</AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Close recorder">
          <CloseChevron />
        </Pressable>

        <View style={styles.headerTitleGroup}>
          <AppText style={styles.headerTitle}>Guestbook</AppText>
          <AppText style={styles.headerSubtitle}>
            {recorderMode === 'audio' ? 'Audio message' : 'Video message'}
          </AppText>
        </View>

        <View style={{ width: 38 }} />
      </View>

      <View
        style={[styles.viewfinderContainer, { height: viewfinderHeight, width: screenWidth - layout.gutter * 2 }]}
        {...viewfinderPanResponder.panHandlers}
      >
        {videoPreview ? (
          <InlineVideoPreview uri={videoPreview.uri} />
        ) : audioPreview ? (
          <View style={styles.audioPreviewSurface}>
            <MicIcon size={34} />
            <AppText variant="bodyLarge" style={styles.audioPreviewTitle}>
              Audio message ready
            </AppText>
            <Pressable
              onPress={() => {
                if (previewAudioPlaying) {
                  audioPlayer.pause();
                  return;
                }
                if (audioPlayerStatus.didJustFinish || audioPlayerStatus.currentTime >= audioPlayerStatus.duration) {
                  void audioPlayer.seekTo(0);
                }
                audioPlayer.play();
              }}
              style={styles.audioPlayBtn}
              accessibilityRole="button"
              accessibilityLabel={previewAudioPlaying ? 'Pause audio preview' : 'Play audio preview'}
            >
              {previewAudioPlaying ? <PauseIcon /> : <PlayIcon />}
            </Pressable>
            <AppText variant="caption" tone="secondary">
              {formatSecondsFromMs(audioPreview.durationMs)}
            </AppText>
          </View>
        ) : recorderMode === 'audio' ? (
          <View style={styles.audioModeSurface}>
            <MicIcon size={30} />
            <View style={styles.waveformRow}>
              {waveform.map((bar, index) => (
                <View
                  key={`${index}-${bar}`}
                  style={[
                    styles.waveformBar,
                    {
                      height: 24 + bar * 92,
                      opacity: 0.35 + bar * 0.65,
                    },
                  ]}
                />
              ))}
            </View>
            <AppText variant="bodyMedium" tone="secondary">
              {audioState.isRecording ? 'Recording…' : 'Tap to start recording'}
            </AppText>
          </View>
        ) : canShowCamera ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mirror={facing === 'front'}
            mode="video"
            mute={false}
          />
        ) : (
          <View style={styles.audioModeSurface}>
            <AppText variant="bodyMedium" tone="secondary">
              Video recording is not available in this browser yet.
            </AppText>
          </View>
        )}

        {recorderMode === 'video' && isRecordingVideo ? (
          <View style={styles.recordingPill}>
            <View style={styles.recordingDot} />
            <AppText style={styles.recordingText}>{formatSecondsFromMs(videoRemainingMs)}</AppText>
          </View>
        ) : null}

        {recorderMode === 'audio' && audioState.isRecording ? (
          <View style={styles.recordingPill}>
            <View style={styles.recordingDot} />
            <AppText style={styles.recordingText}>{formatSecondsFromMs(MAX_DURATION_MS - audioState.durationMillis)}</AppText>
          </View>
        ) : null}
      </View>

      {isPreviewing ? (
        <View style={[styles.previewTopActions, { top: insets.top + spacing.lg }]}>
          <Pressable
            onPress={discardPreviews}
            style={styles.previewCloseBtn}
            accessibilityRole="button"
            accessibilityLabel="Discard and record again"
          >
            <CloseChevron size={18} />
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + spacing.base }]}> 
        {isPreviewing ? (
          <View style={styles.previewActionsRow}>
            <Pressable
              onPress={discardPreviews}
              disabled={isUploading}
              style={({ pressed }) => [styles.retakeBtn, pressed && { opacity: 0.76 }]}
              accessibilityRole="button"
              accessibilityLabel="Retake message"
            >
              <AppText style={styles.retakeBtnText}>Retake</AppText>
            </Pressable>
            <Pressable
              onPress={() => void postGuestbookMessage()}
              disabled={isUploading}
              style={({ pressed }) => [styles.postBtn, pressed && { opacity: 0.86 }, isUploading && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Post message"
            >
              <AppText style={styles.postBtnText}>{isUploading ? 'Posting…' : 'Post'}</AppText>
            </Pressable>
          </View>
        ) : null}

        {!isPreviewing ? <View style={styles.bottomControlsRow}>
          <View style={styles.controlBtn}>
            {recorderMode === 'video' && !isPreviewing ? (
              <Pressable onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))} style={styles.controlBtn}>
                <FlipIcon />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => void handlePrimaryPress()}
            disabled={isUploading}
            style={({ pressed }) => [
              styles.shutterBtn,
              recorderMode === 'video' && styles.shutterBtnVideoMode,
              (audioState.isRecording || isRecordingVideo) && styles.shutterBtnRecording,
              pressed && { opacity: 0.82 },
              isUploading && { opacity: 0.45 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isPreviewing
                ? 'Post message'
                : recorderMode === 'audio'
                  ? audioState.isRecording
                    ? 'Stop audio recording'
                    : 'Start audio recording'
                  : isRecordingVideo
                    ? 'Stop video recording'
                    : 'Start video recording'
            }
          >
            <View
              style={[
                styles.shutterBtnInner,
                recorderMode === 'video' && styles.shutterBtnInnerVideoMode,
                (audioState.isRecording || isRecordingVideo) && styles.shutterBtnInnerRecording,
              ]}
            />
          </Pressable>

          <View style={styles.controlBtn}>
            {isPreviewing ? (
              <AppText variant="caption" tone="secondary">
                {isUploading ? 'Posting…' : 'Post'}
              </AppText>
            ) : null}
          </View>
        </View> : null}

        {!isPreviewing ? <View style={styles.captureModeRail}>
          <View style={styles.captureModeLabelRow}>
            <View
              style={[
                styles.captureModeSelection,
                { transform: [{ translateX: recorderMode === 'video' ? 74 : 0 }] },
              ]}
            />
            {([
              { key: 'audio', label: 'AUDIO' },
              { key: 'video', label: 'VIDEO' },
            ] as const).map((option) => (
              <Pressable
                key={option.key}
                onPress={() => {
                  if (audioState.isRecording || isRecordingVideo || isPreviewing) return;
                  setRecorderMode(option.key);
                }}
                style={styles.captureModeTapTarget}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${option.label.toLowerCase()} mode`}
              >
                <AppText
                  style={[
                    styles.captureModeLabel,
                    recorderMode === option.key && styles.captureModeLabelActive,
                  ]}
                >
                  {option.label}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: '#0B0B0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionRoot: {
    flex: 1,
    backgroundColor: '#0B0B0C',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
  },
  permissionContent: {
    alignItems: 'center',
  },
  permissionTitle: {
    color: '#FFFFFF',
    marginBottom: spacing.sm,
  },
  permissionBody: {
    marginBottom: spacing.xl,
  },
  permissionBtn: {
    backgroundColor: '#EFE9E0',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    width: '100%',
    alignItems: 'center',
  },
  permissionBtnText: {
    color: '#0B0B0C',
    fontWeight: '700',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    zIndex: 10,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleGroup: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  headerTitle: {
    fontFamily: 'InstrumentSerif_400Regular',
    fontSize: 24,
    lineHeight: 30,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontFamily: 'InstrumentSans_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  viewfinderContainer: {
    alignSelf: 'center',
    marginTop: spacing.lg,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
  },
  previewFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  audioModeSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: '#111113',
    paddingHorizontal: spacing.xl,
  },
  audioPreviewSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.base,
    backgroundColor: '#111113',
    paddingHorizontal: spacing.xl,
  },
  audioPreviewTitle: {
    color: '#FFFFFF',
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 128,
  },
  waveformBar: {
    width: 8,
    borderRadius: 999,
    backgroundColor: '#EFE9E0',
  },
  recordingPill: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(11, 11, 12, 0.78)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    height: 36,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#FF453A',
  },
  recordingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  previewTopActions: {
    position: 'absolute',
    right: layout.gutter,
    zIndex: 20,
  },
  previewCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 11, 12, 0.66)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  bottomPanel: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
  },
  bottomControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  previewActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  retakeBtn: {
    flex: 1,
    height: 52,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeBtnText: {
    color: '#FFFFFF',
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 15,
  },
  postBtn: {
    flex: 1,
    height: 52,
    borderRadius: radii.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: {
    color: '#000000',
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 15,
  },
  controlBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBtnVideoMode: {
    borderColor: '#FF453A',
  },
  shutterBtnRecording: {
    transform: [{ scale: 0.94 }],
  },
  shutterBtnInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
  },
  shutterBtnInnerVideoMode: {
    backgroundColor: '#FF453A',
  },
  shutterBtnInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  captureModeRail: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  captureModeLabelRow: {
    position: 'relative',
    width: 148,
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureModeSelection: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 74,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  captureModeTapTarget: {
    width: 74,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureModeLabel: {
    fontFamily: 'InstrumentSans_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.9,
    color: 'rgba(255,255,255,0.58)',
  },
  captureModeLabelActive: {
    color: '#FFFFFF',
  },
  audioPlayBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFE9E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
