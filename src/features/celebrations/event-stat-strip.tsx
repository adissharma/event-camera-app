import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/text';
import { LOCALE_CONFIG } from '@/config/app-config';
import { colours, fontFamilies } from '@/design';
import { copy } from '@/i18n';

import { countdownStat, type EventCountdown, type EventStat } from './event-countdown';

export function formatCount(value: number): string {
  try {
    return new Intl.NumberFormat(LOCALE_CONFIG.locale).format(value);
  } catch {
    return String(value);
  }
}

/**
 * The event page's three-column strip: photos, joined, and time remaining or elapsed.
 *
 * Deliberately quiet — small figures, muted labels, short hairline dividers —
 * because it sits directly under the event's title and must not compete
 * with it. Columns size to their content from a shared minimum, so a large
 * count widens its own column rather than overflowing the row.
 */
export function EventStatStrip({
  photoCount,
  joinedCount,
  countdown,
}: {
  photoCount: number;
  joinedCount: number;
  countdown: EventCountdown;
}) {
  const stats: EventStat[] = [
    {
      value: formatCount(photoCount),
      label: photoCount === 1 ? copy.eventPage.photo : copy.eventPage.photos,
    },
    { value: formatCount(joinedCount), label: copy.eventPage.joined },
    countdownStat(countdown),
  ];

  return (
    <View style={S.row}>
      {stats.map((stat, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={S.divider} /> : null}
          <View
            style={S.column}
            accessible
            accessibilityRole="text"
            accessibilityLabel={stat.label ? `${stat.value} ${stat.label}` : stat.value}
          >
            {/* Figures in the italic serif; a standalone word ("Soon") stays in the sans, since it is not a number. */}
            <AppText style={stat.label ? S.figure : S.value} numberOfLines={1}>
              {stat.value}
            </AppText>
            {stat.label ? (
              <AppText style={S.label} numberOfLines={1}>
                {stat.label}
              </AppText>
            ) : null}
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '100%',
  },
  column: {
    minWidth: 88,
    flexShrink: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // A figure plus its label, so "Soon" centres on the same axis as the
    // columns that carry one.
    minHeight: 42,
  },
  value: {
    color: colours.textPrimary,
    fontFamily: fontFamilies.textMedium,
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
  },
  /**
   * Cormorant sits small on its body (x-height 0.39 em against Instrument
   * Sans's ~0.53), so it is set larger to carry the same visual weight. The
   * small right padding keeps the italic's overhang from being clipped.
   */
  figure: {
    color: colours.textPrimary,
    fontFamily: fontFamilies.numeralItalic,
    fontSize: 24,
    lineHeight: 26,
    textAlign: 'center',
    paddingRight: 2,
  },
  label: {
    color: colours.textSecondary,
    fontFamily: fontFamilies.system,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
});
