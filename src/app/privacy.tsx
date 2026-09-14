import { Fragment } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Link } from 'expo-router';

import { AppText } from '@/components/ui/text';
import { colours, fontFamilies, layout, spacing } from '@/design';
import { BRAND_CONFIG } from '@/config/brand';
import { StillsLockup } from '@/components/brand/stills-lockup';
import {
  PRIVACY_POLICY,
  PRIVACY_LAST_UPDATED,
  type PolicyBlock,
} from '@/content/privacy-policy';

/**
 * The public privacy policy.
 *
 * Set in the app's own language — near-black canvas, the display serif for the
 * title, Instrument Sans at a readable measure for the body — so someone who
 * arrives here from the App Store listing lands somewhere that is recognisably
 * the same product.
 *
 * The text lives in `src/content/privacy-policy.ts` as data rather than markup,
 * so revising a clause does not mean editing a component, and so the same
 * content could be rendered in-app later without being transcribed twice.
 */
export default function PrivacyPolicyScreen() {
  return (
    <ScrollView
      style={S.page}
      contentContainerStyle={S.content}
      // Long-form reading: the scrollbar belongs to the page, not to a card.
      showsVerticalScrollIndicator
    >
      <View style={S.inner}>
        <Link href="/" asChild>
          <Pressable accessibilityRole="link" style={S.brandLink}>
            <StillsLockup size={30} />
          </Pressable>
        </Link>

        <AppText style={S.title} accessibilityRole="header">
          Privacy Policy
        </AppText>
        <AppText variant="bodySmall" tone="secondary" style={S.updated}>
          Last updated: {PRIVACY_LAST_UPDATED}
        </AppText>

        {PRIVACY_POLICY.map((block, index) => (
          <Fragment key={index}>{renderBlock(block)}</Fragment>
        ))}

        <View style={S.footer}>
          <Link href="/" asChild>
            <Pressable accessibilityRole="link">
              <AppText variant="caption" tone="secondary" style={S.footerLink}>
                {BRAND_CONFIG.guestDomain.replace(/^https?:\/\//, '')}
              </AppText>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

function renderBlock(block: PolicyBlock) {
  switch (block.kind) {
    case 'section':
      return (
        <AppText style={S.sectionHeading} accessibilityRole="header">
          {block.text}
        </AppText>
      );

    case 'lead':
      return (
        <AppText variant="bodyLarge" style={S.lead}>
          {block.text}
        </AppText>
      );

    case 'paragraph':
      return (
        <AppText variant="body" style={S.paragraph}>
          {block.label ? <AppText style={S.runIn}>{block.label} </AppText> : null}
          {block.text}
        </AppText>
      );

    case 'list':
      return (
        <View style={S.list}>
          {block.items.map((item, index) => (
            <View key={index} style={S.listRow}>
              {/* A dot rather than a bullet glyph: it sits on the text's
                  baseline reliably across platforms, where "•" does not. */}
              <View style={S.dot} />
              <AppText variant="body" style={S.listText}>
                {item.label ? <AppText style={S.runIn}>{item.label} </AppText> : null}
                {item.text}
              </AppText>
            </View>
          ))}
        </View>
      );

    case 'address':
      return (
        <View style={S.address}>
          {block.lines.map((line, index) => (
            <AppText key={index} variant="body" style={S.addressLine}>
              {line}
            </AppText>
          ))}
        </View>
      );
  }
}

const S = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colours.background,
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.huge,
    paddingBottom: spacing.giant,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    // A measure, not a container width. Long legal prose is unreadable at the
    // full width of a desktop window.
    maxWidth: 680,
  },
  brandLink: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xxl,
  },
  title: {
    fontFamily: fontFamilies.display,
    color: colours.textPrimary,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -0.6,
  },
  updated: {
    marginTop: spacing.sm,
  },
  lead: {
    marginTop: spacing.xl,
    color: colours.textSecondary,
  },
  sectionHeading: {
    fontFamily: fontFamilies.textSemiBold,
    color: colours.textPrimary,
    fontSize: 19,
    lineHeight: 26,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  paragraph: {
    color: colours.textSecondary,
    marginTop: spacing.md,
  },
  /** A bolded lead-in phrase, the way the source document sets its clauses. */
  runIn: {
    fontFamily: fontFamilies.textSemiBold,
    color: colours.textPrimary,
  },
  list: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colours.textSecondary,
    marginTop: 10,
  },
  listText: {
    flex: 1,
    color: colours.textSecondary,
  },
  address: {
    marginTop: spacing.md,
    gap: spacing.xxs,
  },
  addressLine: {
    color: colours.textSecondary,
  },
  footer: {
    marginTop: spacing.giant,
    paddingTop: spacing.xl,
    borderTopWidth: layout.hairline,
    borderTopColor: colours.borderSubtle,
    alignItems: 'center',
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
});
