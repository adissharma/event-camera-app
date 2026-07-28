/**
 * Database types — ergonomic aliases over the generated schema.
 *
 * `database.generated.ts` is the source of truth and is produced directly from
 * the live database:
 *
 *   npx supabase gen types typescript --linked > src/types/database.generated.ts
 *
 * Never edit that file. Regenerate it after every migration.
 *
 * This module exists only to give the generated shapes readable names, so
 * application code writes `CelebrationRow` rather than
 * `Database['public']['Tables']['celebrations']['Row']`. Because every alias is
 * derived rather than restated, a schema change that breaks an assumption
 * surfaces as a type error here instead of drifting silently — which is exactly
 * what the previous hand-written version could not do.
 */

import type { Database, Json } from './database.generated';

export type { Database, Json };

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];
type Functions = Database['public']['Functions'];
type Composites = Database['public']['CompositeTypes'];

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export type WorkspaceKind = Enums['workspace_kind'];
export type WorkspaceRole = Enums['workspace_role'];
export type CelebrationStatus = Enums['celebration_status'];
export type CelebrationType = Enums['celebration_type'];
export type InspirationPack = Enums['inspiration_pack'];
export type EventStatus = Enums['event_status'];
export type CaptureMode = Enums['capture_mode'];
export type MediaType = Enums['media_type'];
export type RevealMode = Enums['reveal_mode'];
export type GalleryVisibility = Enums['gallery_visibility'];
export type PhotoTreatment = Enums['photo_treatment'];
export type CollaboratorRole = Enums['collaborator_role'];
export type AccessLinkKind = Enums['access_link_kind'];
export type MediaSource = Enums['media_source'];
export type MediaStatus = Enums['media_status'];
export type UploadProtocol = Enums['upload_protocol'];
export type MediaVariantType = Enums['media_variant_type'];
export type JobStatus = Enums['job_status'];
export type ProcessingJobType = Enums['processing_job_type'];
export type PurchasePlatform = Enums['purchase_platform'];
export type PurchaseStatus = Enums['purchase_status'];
export type EntitlementValueKind = Enums['entitlement_value_kind'];
export type EntitlementCombineStrategy = Enums['entitlement_combine_strategy'];

/* -------------------------------------------------------------------------- */
/* Rows                                                                        */
/* -------------------------------------------------------------------------- */

export type ProfileRow = Tables['profiles']['Row'];
export type WorkspaceRow = Tables['workspaces']['Row'];
export type WorkspaceMemberRow = Tables['workspace_members']['Row'];
export type ThemeRow = Tables['themes']['Row'];
export type CelebrationRow = Tables['celebrations']['Row'];
export type CelebrationCollaboratorRow = Tables['celebration_collaborators']['Row'];
export type EventSessionRow = Tables['event_sessions']['Row'];
export type AccessLinkRow = Tables['access_links']['Row'];
export type GuestSessionRow = Tables['guest_sessions']['Row'];
export type MediaItemRow = Tables['media_items']['Row'];
export type MediaVariantRow = Tables['media_variants']['Row'];
export type QrAssetRow = Tables['qr_assets']['Row'];
export type PlanRow = Tables['plans']['Row'];
export type AddOnRow = Tables['add_ons']['Row'];
export type EntitlementDefinitionRow = Tables['entitlement_definitions']['Row'];
export type PlanEntitlementRow = Tables['plan_entitlements']['Row'];
export type AddOnEntitlementRow = Tables['add_on_entitlements']['Row'];
export type PurchaseRow = Tables['purchases']['Row'];
export type CelebrationEntitlementRow = Tables['celebration_entitlements']['Row'];

export type CelebrationInsert = Tables['celebrations']['Insert'];
export type CelebrationUpdate = Tables['celebrations']['Update'];
export type EventSessionInsert = Tables['event_sessions']['Insert'];
export type EventSessionUpdate = Tables['event_sessions']['Update'];

/* -------------------------------------------------------------------------- */
/* Functions                                                                   */
/* -------------------------------------------------------------------------- */

export type CreateCelebrationArgs =
  Functions['create_celebration_with_default_session']['Args'];

/**
 * Raw return of the creation RPC.
 *
 * Every field is `string | null` because Postgres composite types are nullable
 * by definition — the generator cannot know the function always populates them.
 * Use `assertCreatedCelebration` at the boundary rather than asserting
 * non-null at each use site.
 */
export type CreatedCelebrationRaw = Composites['created_celebration'];

/** The same shape, once validated. */
export interface CreatedCelebration {
  celebrationId: string;
  eventSessionId: string;
  accessLinkId: string;
  publicSlug: string;
  /**
   * The ONLY moment the plaintext guest token exists. Only its digest is
   * stored, so it cannot be read back — persist what you need immediately.
   * Regenerating the link is the recovery path.
   */
  guestAccessToken: string;
}

/**
 * Validates and camel-cases the RPC result.
 *
 * Throwing here rather than propagating nulls means a partially-populated
 * response fails at the boundary, instead of surfacing later as an event with
 * no joinable link.
 */
export function assertCreatedCelebration(raw: CreatedCelebrationRaw): CreatedCelebration {
  const { celebration_id, event_session_id, access_link_id, public_slug, guest_access_token } = raw;

  if (
    !celebration_id ||
    !event_session_id ||
    !access_link_id ||
    !public_slug ||
    !guest_access_token
  ) {
    throw new Error('Celebration creation returned an incomplete result');
  }

  return {
    celebrationId: celebration_id,
    eventSessionId: event_session_id,
    accessLinkId: access_link_id,
    publicSlug: public_slug,
    guestAccessToken: guest_access_token,
  };
}
