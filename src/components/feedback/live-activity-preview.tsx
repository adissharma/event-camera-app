import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { CameraIcon } from '@/components/ui/icons';
import { colours, spacing, radii, layout } from '@/design';

interface LiveActivityPreviewProps {
  eventName: string;
  celebrationId: string;
  photosLeft: number;
  endTimeIso: string | null;
}

/**
 * A minimalistic Live Activity iOS Preview widget.
 * Styled to match the Ink & Ivory dark theme with a clean visual presentation.
 */
export function LiveActivityPreview({
  eventName,
  celebrationId,
  photosLeft,
  endTimeIso,
}: LiveActivityPreviewProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState('00:00:00');

  useEffect(() => {
    if (!endTimeIso) return;

    const updateTimer = () => {
      const diffMs = new Date(endTimeIso).getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft('00:00:00');
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      const pad = (num: number) => String(num).padStart(2, '0');
      setTimeLeft(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTimeIso]);

  return (
    <View style={styles.widgetContainer}>
      <View style={styles.widgetHeader}>
        <AppText variant="caption" tone="secondary" style={styles.headerLabel}>
          iOS Live Activity Preview
        </AppText>
      </View>

      <View style={styles.activityBody}>
        {/* 1. App Logo Container */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBadge}>
            <AppText style={styles.logoText}>📸</AppText>
          </View>
        </View>

        {/* 2. Event Title and Info */}
        <View style={styles.infoArea}>
          <AppText style={styles.eventName} numberOfLines={1}>
            {eventName}
          </AppText>
          <View style={styles.metaRow}>
            <AppText style={styles.metaText}>{photosLeft} photos left</AppText>
            <AppText style={styles.bullet}>•</AppText>
            <AppText style={styles.timerText}>{timeLeft}</AppText>
          </View>
        </View>

        {/* 3. Camera / Shutter Deep-Link CTA Button */}
        <Pressable
          onPress={() => router.push(`/celebration/${celebrationId}/camera`)}
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
        >
          <CameraIcon size={12} color="#0B0B0C" />
          <AppText style={styles.ctaText}>Shoot</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widgetContainer: {
    backgroundColor: '#050506', // Lock screen widget black background
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.base,
    marginVertical: spacing.md,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  widgetHeader: {
    marginBottom: spacing.xs,
    paddingLeft: spacing.xxs,
  },
  headerLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colours.textSecondary,
  },
  activityBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colours.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 14,
  },
  infoArea: {
    flex: 1,
    gap: 2,
  },
  eventName: {
    fontSize: 14,
    fontWeight: '700',
    color: colours.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: colours.textSecondary,
  },
  bullet: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.2)',
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: colours.textSecondary,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFE9E0', // Cream primary
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  ctaButtonPressed: {
    opacity: 0.85,
    backgroundColor: '#D8D2C8',
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0B0B0C', // Dark text on cream background
  },
});
