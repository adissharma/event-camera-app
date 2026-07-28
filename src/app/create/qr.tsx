import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { OptionCard } from '@/components/forms/option-card';
import { AppText } from '@/components/ui/text';
import { CreationStepScreen } from '@/features/celebrations/creation/step-screen';
import { useCreationDraft } from '@/features/celebrations/draft/store';
import { fetchCatalogue, planKeys } from '@/services/plans';
import { spacing } from '@/design';
import { copy } from '@/i18n';

const TEMPLATES = [
  { key: 'digital_card', label: 'Digital card', description: 'For WhatsApp and messages.' },
  { key: 'a4_poster', label: 'A4 poster', description: 'For the entrance or the bar.' },
  { key: 'a5_sign', label: 'A5 sign', description: 'For a few around the room.' },
  { key: 'table_card', label: 'Table card', description: 'One per table.' },
  { key: 'square_social', label: 'Square image', description: 'For a story or a post.' },
  { key: 'venue_screen', label: 'Venue screen', description: 'For a projector or display.' },
];

/**
 * QR template choice.
 *
 * Availability comes from the chosen plan's entitlement, not from a hard-coded
 * tier check — so changing what a plan includes is a catalogue edit rather than
 * an app release. Unavailable templates are shown and labelled honestly rather
 * than hidden, so the host can see what the next tier would add.
 */
export default function QrStep() {
  const { draft, update } = useCreationDraft();
  const { data } = useQuery({ queryKey: planKeys.catalogue(), queryFn: fetchCatalogue });

  const plan = data?.plans.find((p) => p.key === draft.planKey);
  const allowed = Array.isArray(plan?.entitlements.qr_templates)
    ? (plan.entitlements.qr_templates as string[])
    : ['digital_card'];

  return (
    <CreationStepScreen
      step="qr"
      heading={copy.create.qrHeading}
      supporting={copy.create.qrSupporting}
    >
      <View style={{ gap: spacing.base }}>
        {TEMPLATES.map((template) => {
          const available = allowed.includes(template.key);
          return (
            <OptionCard
              key={template.key}
              label={template.label}
              description={template.description}
              selected={draft.qrTemplateKey === template.key}
              locked={!available}
              lockedReason={available ? undefined : 'Included with a higher package'}
              onPress={() => update({ qrTemplateKey: template.key })}
            />
          );
        })}

        <AppText variant="bodySmall" tone="secondary" style={{ paddingTop: spacing.sm }}>
          Every design points at the same link, so you can print several and share
          the digital card too.
        </AppText>
      </View>
    </CreationStepScreen>
  );
}
