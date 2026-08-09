import { useState, useEffect } from 'react';
import {
  ActivityIndicator, 
  Pressable, 
  View, 
  ScrollView, 
  StyleSheet, 
  Modal, 
  Alert, 
  Image, 
  Dimensions,
  Animated,
  TextInput
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { BrandLogo } from '@/components/brand/brand-logo';
import { AppText } from '@/components/ui/text';
import { useAuth } from '@/features/auth/context';
import { celebrationKeys, listCelebrations, type CelebrationSummary } from '@/services/celebrations';
import { listThemes, themeKeys } from '@/services/themes';
import { fetchMyProfile, profileKeys, firstNameFrom } from '@/services/profile';
import { colours, layout, radii, spacing, fontFamilies } from '@/design';
import { copy } from '@/i18n';
import { LOCALE_CONFIG, STORAGE_BUCKETS } from '@/config/app-config';
import { requireSupabase } from '@/lib/supabase/client';
import { useCoverSource, FALLBACK_COVER } from '@/features/celebrations/cover-source';
import type { ThemeRow } from '@/types/database';

const { width } = Dimensions.get('window');

// Multi-image placeholders for a visual grid (4 distinct photography covers)
const PLACEHOLDERS = [
  require('../../assets/images/placeholders/christian_wedding.png'),
  require('../../assets/images/placeholders/hindu_wedding.png'),
  require('../../assets/images/placeholders/treatment_preview_1.png'),
  require('../../assets/images/placeholders/treatment_preview_2.png'),
];

// QR Code Icon
function QrCodeIcon({ size = 20, color = colours.textPrimary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M3 3h6v6H3V3zm12 0h6v6h-6V3zM3 15h6v6H3v-6zm15 0h3v3h-3v-3zm3 3h3v3h-3v-3zm0-3h3v3h-3v-3zm-3 3h-3v3h3v-3zm-3-3h3v3h-3v-3z" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <Path 
        d="M6 6h.01M18 6h.01M6 18h.01M15 15h.01M18 18h.01" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  );
}

function UserIcon({ size = 20, color = colours.textPrimary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <Path 
        d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  );
}

function ArrowUpRightIcon({ size = 20, color = colours.textPrimary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M7 17L17 7M17 7H7M17 7V17" 
        stroke={color} 
        strokeWidth={2.5} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  );
}

function PlusIcon({ size = 22, color = '#0B0B0C' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M12 5v14M5 12h14" 
        stroke={color} 
        strokeWidth={3} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  );
}

function ChevronRightIcon({ size = 16, color = colours.textSecondary }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path 
        d="M9 6l6 6-6 6" 
        stroke={color} 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </Svg>
  );
}

function ProfileSettingsRow({
  title,
  value,
  tone = 'default',
  onPress,
}: {
  title: string;
  value: string;
  tone?: 'default' | 'danger';
  onPress: () => void;
}) {
  const isDanger = tone === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.profileActionRow, pressed && styles.profileActionRowPressed]}
    >
      <View style={styles.profileActionText}>
        <AppText
          variant="labelLarge"
          style={[styles.profileActionLabel, isDanger && styles.profileActionLabelDanger]}
        >
          {title}
        </AppText>
        <AppText
          variant="bodySmall"
          style={[styles.profileActionValue, isDanger && styles.profileActionValueDanger]}
          numberOfLines={1}
        >
          {value}
        </AppText>
      </View>
      <ChevronRightIcon color={isDanger ? colours.error : colours.textSecondary} />
    </Pressable>
  );
}

// Helper to resolve status label (UPCOMING, completed hides label)
function getStatusLabel(celebration: CelebrationSummary) {
  const endsAt = celebration.primarySession?.ends_at ?? celebration.endsAt;
  if (endsAt && new Date(endsAt).getTime() < Date.now()) {
    return null; // Completed ones hide the status label above the title
  }
  return 'UPCOMING'; // Both upcoming and live events show "Upcoming"
}

// Staggered animated Event card tile component (9:16 aspect ratio, no arrow icon)
function EventCardTile({ celebration, index, themes, onPress }) {
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 120, // Staggered entry
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, index]);

  // The host's own cover, resolved the same way every other surface resolves
  // it. This used to call `getPublicUrl` against `celebration-covers`, which
  // is a private bucket — the URL it produced could never load, so a real
  // uploaded cover rendered as a broken image behind the card's gradient.
  const resolvedCover = useCoverSource(celebration.coverStoragePath);

  // Fallbacks assigned by list index for visual diversity.
  let coverSource = PLACEHOLDERS[index % PLACEHOLDERS.length];
  if (celebration.coverStoragePath && resolvedCover !== FALLBACK_COVER) {
    coverSource = resolvedCover as typeof coverSource;
  } else if (!celebration.coverStoragePath) {
    // Custom overrides based on event title text for rich wedding layout previews
    const titleLower = celebration.title.toLowerCase();
    if (titleLower.includes('wedding') || titleLower.includes('marriage')) {
      coverSource = PLACEHOLDERS[1]; // hindu_wedding or christian_wedding
    }
  }

  // Resolve theme design tokens
  const theme = (themes ?? []).find(
    (t: ThemeRow) => t.id === celebration.defaultThemeId || t.slug === celebration.defaultThemeId,
  );
  const accentColor = theme?.design_tokens?.accent || colours.textPrimary;

  const statusLabel = getStatusLabel(celebration);
  const isCompleted = !statusLabel;

  const formattedDate = celebration.endsAt
    ? new Intl.DateTimeFormat(LOCALE_CONFIG.locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(new Date(celebration.endsAt))
    : null;

  let dateSubtext = 'No closing time';
  if (isCompleted) {
    dateSubtext = formattedDate ?? 'Completed';
  } else {
    dateSubtext = formattedDate ? `Closes ${formattedDate}` : 'Upcoming';
  }

  return (
    <Animated.View style={{ opacity: fadeAnim, width: '100%' }}>
      <Pressable style={styles.eventCard} onPress={onPress}>
        <Image 
          source={coverSource} 
          style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]} 
          resizeMode="cover" 
        />
        
        {/* Cinematic readability scrim: transparent at top, rapid dark fade in bottom of card */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.60)', 'rgba(0,0,0,0.92)']}
          locations={[0, 0.40, 1]}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '60%',
            zIndex: 1,
          }}
        />

        <View style={[styles.cardContent, { zIndex: 2 }]}>
          <View style={styles.cardLeft}>
            {statusLabel ? (
              <AppText variant="eyebrow" tone="secondary" style={styles.cardStatus}>
                {statusLabel}
              </AppText>
            ) : null}
            <AppText variant="titleMedium" style={[styles.cardTitle, { color: accentColor }]} numberOfLines={3}>
              {celebration.title}
            </AppText>
            {dateSubtext ? (
              <AppText variant="caption" tone="secondary" style={styles.cardDate}>
                {dateSubtext}
              </AppText>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { session, signOut, isBackendConfigured } = useAuth();
  
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [scannerModalVisible, setScannerModalVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Scanning laser animation
  const scanLineAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (scannerModalVisible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 248,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [scannerModalVisible, scanLineAnim]);

  // Queries
  const { data: celebrations, isLoading } = useQuery({
    queryKey: celebrationKeys.list(),
    queryFn: listCelebrations,
    enabled: isBackendConfigured,
  });

  const { data: themes } = useQuery({
    queryKey: themeKeys.list(),
    queryFn: listThemes,
    enabled: isBackendConfigured,
  });

  const { data: profile } = useQuery({
    queryKey: profileKeys.me(),
    queryFn: fetchMyProfile,
    enabled: isBackendConfigured,
  });

  // Calculate filtered events
  const isCompletedHelper = (c: CelebrationSummary) => {
    const endsAt = c.primarySession?.ends_at ?? c.endsAt;
    return endsAt && new Date(endsAt).getTime() < Date.now();
  };
  const list = celebrations ?? [];
  const getFilteredCelebrations = () => {
    const now = new Date();

    let result = list;
    if (filter === 'upcoming') {
      result = list.filter(c => !c.endsAt || new Date(c.endsAt) >= now);
    } else if (filter === 'past') {
      result = list.filter(c => c.endsAt && new Date(c.endsAt) < now);
    }

    // Sort: Upcoming (and live) first, completed ones last.
    return [...result].sort((a, b) => {
      const aComp = isCompletedHelper(a) ? 1 : 0;
      const bComp = isCompletedHelper(b) ? 1 : 0;
      return aComp - bComp;
    });
  };

  const filteredEvents = getFilteredCelebrations();
  const firstName = firstNameFrom(profile);

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const handleJoinSubmit = () => {
    const code = manualCode.trim();
    if (code.length > 0) {
      setScannerModalVisible(false);
      setManualCode('');
      router.push(`/celebration/${code}`);
    } else {
      Alert.alert('Empty Code', 'Please enter a valid event code to join.');
    }
  };

  const handleMockScan = () => {
    const randomCode = 'mock-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    setScannerModalVisible(false);
    Alert.alert('Scan Successful 📸', `Detected invitation QR code for ${randomCode}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Go to Event', onPress: () => router.push(`/celebration/${randomCode}`) }
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure you want to delete your account? This action is irreversible and all your hosted events will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const client = requireSupabase();
              const { data: auth } = await client.auth.getUser();
              if (auth.user) {
                await client.from('profiles').delete().eq('id', auth.user.id);
                await signOut();
                setProfileModalVisible(false);
                router.replace('/');
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            }
          }
        }
      ]
    );
  };

  const userInitials = profile?.display_name
    ? profile.display_name.trim().slice(0, 1).toUpperCase()
    : null;
  const profileName = profile?.display_name?.trim() || firstName || 'Host';
  const profileEmail = session?.user?.email ?? 'Host account';

  return (
    <View style={styles.container}>
      {/* 1. Header Toolbar (Separator border line removed) */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerLeft}>
          <Pressable 
            onPress={() => setProfileModalVisible(true)} 
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Profile settings"
          >
            {userInitials ? (
              <AppText style={{ fontWeight: '700', fontSize: 14, color: colours.textPrimary }}>
                {userInitials}
              </AppText>
            ) : (
              <UserIcon color={colours.textPrimary} />
            )}
          </Pressable>
          <Pressable 
            onPress={() => setScannerModalVisible(true)} 
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Scan QR invitation"
          >
            <QrCodeIcon color={colours.textPrimary} />
          </Pressable>
        </View>

        {/* Right side of header: circular plus button */}
        <Pressable
          onPress={() => router.push('/create')}
          style={styles.headerPlusBtn}
          accessibilityRole="button"
          accessibilityLabel="Create new event"
        >
          <PlusIcon size={24} color="#0B0B0C" />
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContainer, 
          { paddingBottom: insets.bottom + 40 } // Reduced bottom padding since FAB is removed
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Inspirational Title */}
        <View style={styles.titleSection}>
          <AppText variant="displayHero" style={styles.inspirationalTitle}>
            {firstName ? `${getGreeting()},\n${firstName}` : 'Capture the\nmagic'}
          </AppText>
          <AppText variant="bodySmall" tone="secondary" style={styles.subtitle}>
            Your beautiful chapters, locked memories, and shared galleries.
          </AppText>
        </View>

        {/* 3. Filters Row - Pills are larger and much more prominent */}
        <View style={styles.filtersContainer}>
          {(['all', 'upcoming', 'past'] as const).map((type) => {
            const selected = filter === type;
            const label = type === 'all' ? 'All' : type === 'upcoming' ? 'Upcoming' : 'Completed';
            return (
              <Pressable
                key={type}
                onPress={() => setFilter(type)}
                style={[styles.filterPill, selected && styles.filterPillSelected]}
              >
                <AppText
                  variant="caption"
                  style={[styles.filterPillText, selected && styles.filterPillTextSelected]}
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {/* 4. Event Tiles List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colours.brandPrimary} />
          </View>
        ) : filteredEvents.length > 0 ? (
          <View style={styles.eventsGrid}>
            {/* Left column */}
            <View style={styles.gridColumn}>
              {filteredEvents
                .filter((_, i) => i % 2 === 0)
                .map((celebration, index) => (
                  <EventCardTile
                    key={celebration.id}
                    celebration={celebration}
                    index={index}
                    themes={themes}
                    onPress={() => router.push(`/celebration/${celebration.id}`)}
                  />
                ))}
            </View>
            {/* Right column */}
            <View style={[styles.gridColumn, { marginLeft: 16 }]}>
              {filteredEvents
                .filter((_, i) => i % 2 === 1)
                .map((celebration, index) => (
                  <EventCardTile
                    key={celebration.id}
                    celebration={celebration}
                    index={index}
                    themes={themes}
                    onPress={() => router.push(`/celebration/${celebration.id}`)}
                  />
                ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <AppText variant="heading" tone="secondary" style={styles.emptyText}>
              No events found
            </AppText>
            <AppText variant="bodySmall" tone="secondary" align="center">
              Tap the button below to capture the memories of your first celebration.
            </AppText>
          </View>
        )}
      </ScrollView>


      {/* 6. QR Scanner Invitation Modal */}
      <Modal
        visible={scannerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setScannerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={StyleSheet.absoluteFillObject} 
            onPress={() => setScannerModalVisible(false)} 
          />
          
          <View style={styles.scannerSheet}>
            <View style={styles.drawerHandle} />

            <View style={styles.drawerHeader}>
              <AppText variant="heading" style={{ fontSize: 24, textAlign: 'center' }}>
                Scan Invitation QR
              </AppText>
              <AppText variant="bodySmall" tone="secondary" align="center">
                Scan the code from a friend's device to join their celebration
              </AppText>
            </View>

            {/* Viewfinder Mockup with Laser Scanning Line */}
            <View style={styles.viewfinderContainer}>
              <View style={styles.viewfinderFrame}>
                {/* Camera View Simulation */}
                <Image 
                  source={require('../../assets/images/placeholders/gallery_blurred_half.png')} 
                  style={StyleSheet.absoluteFillObject} 
                  opacity={0.4} 
                />
                
                {/* Neon scanning laser line */}
                <Animated.View 
                  style={[
                    styles.scannerLaser, 
                    { transform: [{ translateY: scanLineAnim }] }
                  ]} 
                />
                
                {/* Viewfinder Corner Frames */}
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                
                <Pressable onPress={handleMockScan} style={styles.mockScanTapArea}>
                  <AppText variant="caption" style={{ color: '#00FF66', fontWeight: 'bold' }}>
                    [ Simulate Scan ]
                  </AppText>
                </Pressable>
              </View>
            </View>

            {/* Manual Code Input Option */}
            <View style={styles.manualInputSection}>
              <AppText variant="caption" tone="secondary" align="center" style={{ marginBottom: spacing.xs }}>
                Or type the invitation code manually
              </AppText>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.manualCodeInput}
                  placeholder="EVENT-CODE"
                  placeholderTextColor={colours.textSecondary}
                  value={manualCode}
                  onChangeText={setManualCode}
                  autoCapitalize="characters"
                  maxLength={15}
                  onSubmitEditing={handleJoinSubmit}
                />
                <Pressable onPress={handleJoinSubmit} style={styles.joinCodeButton}>
                  <AppText variant="caption" style={{ color: colours.textOnBrand, fontWeight: '700' }}>
                    Join
                  </AppText>
                </Pressable>
              </View>
            </View>

            <Pressable 
              onPress={() => setScannerModalVisible(false)}
              style={styles.closeDrawerButton}
            >
              <AppText variant="button" tone="onBrand">Cancel</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 7. Profile Bottom Sheet Drawer */}
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={StyleSheet.absoluteFillObject} 
            onPress={() => setProfileModalVisible(false)} 
          />
          
          <View style={[styles.drawerSheet, styles.profileDrawerSheet]}>
            <View style={styles.drawerHandle} />

            <View style={styles.profileDrawerHeader}>
              <View style={styles.profileAvatarLarge}>
                {userInitials ? (
                  <AppText style={styles.profileAvatarInitial}>{userInitials}</AppText>
                ) : (
                  <UserIcon size={22} color={colours.textPrimary} />
                )}
              </View>
              <View style={styles.profileHeaderText}>
                <AppText variant="bodyLarge" style={styles.profileHeaderTitle}>Profile Settings</AppText>
                <AppText variant="bodySmall" style={styles.profileHeaderSubtitle} numberOfLines={1}>
                  {profileName} · {profileEmail}
                </AppText>
              </View>
            </View>

            <View style={styles.profileSection}>
              <AppText variant="eyebrow" tone="secondary" style={styles.profileSectionHeader}>
                Account settings
              </AppText>

              <View style={styles.profileSettingsCard}>
                <ProfileSettingsRow
                  title="Change your name"
                  value={profileName}
                  onPress={() => {
                    setProfileModalVisible(false);
                    router.push('/your-name');
                  }}
                />

                <View style={styles.profileSeparator} />

                <ProfileSettingsRow
                  title="Contact support"
                  value="Get help with your account"
                  onPress={() => {
                    Alert.alert('Contact Support', 'Need help? Get in touch with our team at support@eventcamera.app');
                  }}
                />

                <View style={styles.profileSeparator} />

                <ProfileSettingsRow
                  title="Log out"
                  value={profileEmail}
                  onPress={async () => {
                    await signOut();
                    setProfileModalVisible(false);
                    router.replace('/');
                  }}
                />
              </View>
            </View>

            <View style={styles.profileSection}>
              <AppText variant="eyebrow" tone="secondary" style={styles.profileSectionHeader}>
                Danger Zone
              </AppText>

              <View style={styles.profileSettingsCard}>
                <ProfileSettingsRow
                  title="Delete account"
                  value="Permanently remove your account"
                  tone="danger"
                  onPress={handleDeleteAccount}
                />
              </View>
            </View>

            <Pressable
              onPress={() => setProfileModalVisible(false)}
              style={styles.profileCloseButton}
            >
              <AppText variant="button" tone="onBrand">Close</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colours.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingBottom: spacing.sm,
    // Separator line removed from header as requested
    borderBottomWidth: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerPlusBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFE9E0', // warm ivory, makes the create action pop
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colours.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  scrollContainer: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.base,
  },
  titleSection: {
    marginVertical: spacing.md,
    gap: spacing.xs,
  },
  inspirationalTitle: {
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    maxWidth: width * 0.75,
  },
  filtersContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  filterPill: {
    paddingHorizontal: spacing.lg,  // Increased size of pills
    paddingVertical: spacing.sm,    // Increased size of pills
    borderRadius: radii.pill,
    backgroundColor: colours.surface,
    borderWidth: 1.5,
    borderColor: colours.borderSubtle,
  },
  filterPillSelected: {
    backgroundColor: colours.brandPrimary,
    borderColor: colours.brandPrimary,
  },
  filterPillText: {
    color: colours.textSecondary,
    fontSize: 16,                   // Made text label larger
    fontWeight: '600',              // Made font weight bolder
  },
  filterPillTextSelected: {
    color: colours.textOnBrand,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: spacing.giant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventsGrid: {
    flexDirection: 'row',
  },
  gridColumn: {
    flex: 1,
    gap: 16,
  },
  eventCard: {
    width: '100%',
    height: Math.round(((width - 40 - 16) / 2) * (16 / 9)),
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: colours.surface,
    position: 'relative',
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
  },
  cardLeft: {
    flex: 1,
    gap: 2,
  },
  cardStatus: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  cardTitle: {
    fontFamily: fontFamilies.display,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
  },
  cardDate: {
    marginTop: 4,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.giant,
    gap: spacing.sm,
  },
  emptyText: {
    color: colours.textSecondary,
  },
  floatingMenuContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingButton: {
    backgroundColor: colours.brandPrimary,
    borderRadius: radii.pill,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 6, 0.85)',
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    backgroundColor: colours.surfaceRaised,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    borderTopWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  profileDrawerSheet: {
    gap: spacing.base,
    paddingBottom: spacing.xxl,
  },
  scannerSheet: {
    backgroundColor: colours.surfaceRaised,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    borderTopWidth: layout.hairline,
    borderColor: colours.borderSubtle,
  },
  drawerHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  drawerHeader: {
    gap: 4,
    marginBottom: spacing.xs,
  },
  profileDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  profileAvatarLarge: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colours.surface,
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
  },
  profileAvatarInitial: {
    color: colours.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  profileHeaderText: {
    flex: 1,
    gap: 3,
  },
  profileHeaderTitle: {
    color: colours.textPrimary,
  },
  profileHeaderSubtitle: {
    color: colours.textSecondary,
  },
  profileSection: {
    gap: spacing.xs,
  },
  profileSectionHeader: {
    paddingLeft: spacing.xs,
  },
  profileSettingsCard: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    borderWidth: layout.hairline,
    borderColor: colours.borderStrong,
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
    gap: spacing.md,
  },
  profileActionRowPressed: {
    backgroundColor: colours.surfaceMuted,
  },
  profileActionText: {
    flex: 1,
    gap: 4,
  },
  profileActionLabel: {
    color: colours.textPrimary,
  },
  profileActionLabelDanger: {
    color: colours.error,
  },
  profileActionValue: {
    color: colours.textSecondary,
  },
  profileActionValueDanger: {
    color: colours.error,
    opacity: 0.78,
  },
  profileSeparator: {
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
    marginHorizontal: spacing.base,
  },
  profileCloseButton: {
    backgroundColor: colours.brandPrimary,
    borderRadius: radii.pill,
    paddingVertical: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
  },
  viewfinderFrame: {
    width: 250,
    height: 250,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colours.borderSubtle,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerLaser: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#00FF66',
    shadowColor: '#00FF66',
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 2,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#00FF66',
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  mockScanTapArea: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radii.sm,
  },
  manualInputSection: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    backgroundColor: colours.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colours.borderSubtle,
    overflow: 'hidden',
    alignItems: 'center',
  },
  manualCodeInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: spacing.lg,
    color: colours.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  joinCodeButton: {
    backgroundColor: colours.brandPrimary,
    height: 48,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerActions: {
    backgroundColor: colours.surface,
    borderRadius: radii.xl,
    borderWidth: layout.hairline,
    borderColor: colours.borderSubtle,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.lg,
  },
  drawerDivider: {
    height: layout.hairline,
    backgroundColor: colours.borderSubtle,
  },
  closeDrawerButton: {
    backgroundColor: colours.brandPrimary,
    borderRadius: radii.pill,
    paddingVertical: spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
});
