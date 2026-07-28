/**
 * Database types.
 *
 * Hand-written to match `supabase/migrations/` exactly, because the Supabase
 * CLI cannot run here yet (no Docker, no linked project). Once either is
 * available this file should be REPLACED by generated output:
 *
 *   supabase gen types typescript --local > src/types/database.ts
 *
 * Until then, treat a mismatch between this file and the migrations as a bug in
 * this file — the SQL is the source of truth.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export type WorkspaceKind = 'personal' | 'partner';
export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type CelebrationStatus = 'draft' | 'published' | 'archived';

export type CelebrationType =
  | 'wedding' | 'birthday' | 'party' | 'corporate'
  | 'religious' | 'graduation' | 'anniversary' | 'other';

export type InspirationPack =
  | 'universal' | 'south_asian' | 'classic' | 'modern'
  | 'black_tie' | 'garden' | 'custom';

export type EventStatus = 'draft' | 'published' | 'closed' | 'revealed' | 'archived';
export type CaptureMode = 'camera_only' | 'library_only' | 'camera_and_library';
export type MediaType = 'photo' | 'video' | 'audio';
export type RevealMode = 'instant' | 'scheduled' | 'manual';
export type GalleryVisibility = 'all_guests' | 'own_only' | 'hosts_only';
export type PhotoTreatment = 'original' | 'disposable' | 'black_and_white' | 'warm_film';
export type CollaboratorRole = 'owner' | 'cohost' | 'moderator' | 'viewer';
export type AccessLinkKind = 'guest' | 'host_preview' | 'cohost_invite';

export type MediaSource = 'camera' | 'library' | 'recording' | 'host_upload' | 'system_generated';

export type MediaStatus =
  | 'local_pending'
  | 'upload_authorising'
  | 'queued'
  | 'uploading'
  | 'paused'
  | 'uploaded'
  | 'verifying'
  | 'processing'
  | 'ready'
  | 'retryable_failed'
  | 'permanent_failed'
  | 'hidden'
  | 'deleted';

export type UploadProtocol = 'standard' | 'tus' | 'multipart';

export type MediaVariantType =
  | 'original' | 'thumbnail' | 'gallery_preview' | 'full_screen'
  | 'video_poster' | 'video_stream' | 'audio_preview' | 'audio_waveform';

export type JobStatus =
  | 'pending' | 'available' | 'running' | 'retrying'
  | 'completed' | 'failed' | 'cancelled';

export type ProcessingJobType =
  | 'verify_object' | 'extract_metadata' | 'generate_image_variants'
  | 'generate_video_poster' | 'transcode_video' | 'generate_audio_preview'
  | 'strip_derivative_metadata';

export type PurchasePlatform = 'apple_app_store' | 'google_play' | 'web';
export type PurchaseStatus = 'pending' | 'verified' | 'failed' | 'refunded' | 'revoked';

export type EntitlementValueKind =
  | 'boolean' | 'integer' | 'unlimited' | 'string' | 'string_array' | 'integer_array';

/** How a plan grant and add-on grants for one key are reconciled. */
export type EntitlementCombineStrategy =
  | 'max' | 'sum' | 'any_true' | 'union' | 'override';

/* -------------------------------------------------------------------------- */
/* Row shapes                                                                  */
/* -------------------------------------------------------------------------- */

export interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_path: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  kind: WorkspaceKind;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorkspaceMemberRow {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface ThemeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  inspiration_pack: InspirationPack;
  preview_asset_key: string | null;
  design_tokens: Json;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CelebrationRow {
  id: string;
  workspace_id: string;
  created_by: string;
  title: string;
  celebration_type: CelebrationType;
  inspiration_pack: InspirationPack;
  status: CelebrationStatus;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  location_name: string | null;
  location_address: string | null;
  cover_storage_path: string | null;
  default_theme_id: string | null;
  public_slug: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CelebrationCollaboratorRow {
  id: string;
  celebration_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: CollaboratorRole;
  invited_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface EventSessionRow {
  id: string;
  celebration_id: string;
  name: string;
  preset_key: string | null;
  sequence_number: number;
  status: EventStatus;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  location_name: string | null;
  location_address: string | null;
  theme_id: string | null;
  capture_mode: CaptureMode;
  allowed_media_types: MediaType[];
  /** `null` means unlimited — granted by entitlement, never hard-coded. */
  shot_limit_per_guest: number | null;
  camera_roll_upload_limit: number | null;
  camera_roll_uploads_after_close: boolean;
  allow_media_from_any_date: boolean;
  reveal_mode: RevealMode;
  reveal_at: string | null;
  gallery_visibility: GalleryVisibility;
  guest_downloads_enabled: boolean;
  moderation_enabled: boolean;
  pin_required: boolean;
  photo_treatment: PhotoTreatment;
  date_stamp_enabled: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AccessLinkRow {
  id: string;
  event_session_id: string;
  kind: AccessLinkKind;
  /** Digest only. The plaintext token is never readable from the database. */
  token_hash: string;
  pin_hash: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuestSessionRow {
  id: string;
  event_session_id: string;
  display_name: string | null;
  anonymous_token_hash: string;
  device_identifier_hash: string | null;
  consent_at: string | null;
  last_seen_at: string;
  created_at: string;
}

export interface MediaItemRow {
  id: string;
  event_session_id: string;
  guest_session_id: string | null;
  uploaded_by_user_id: string | null;
  client_media_id: string;
  media_type: MediaType;
  source: MediaSource;
  status: MediaStatus;
  original_storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  checksum_algorithm: string | null;
  checksum_value: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  captured_at: string | null;
  uploaded_at: string | null;
  verified_at: string | null;
  processing_started_at: string | null;
  ready_at: string | null;
  moderated_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MediaVariantRow {
  id: string;
  media_item_id: string;
  variant_type: MediaVariantType;
  storage_path: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  processing_status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface QrAssetRow {
  id: string;
  event_session_id: string;
  access_link_id: string;
  template_key: string;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  tier_rank: number;
  /** Minor units (pence). Never a float. */
  price_minor_units: number;
  currency: string;
  apple_product_id: string | null;
  google_product_id: string | null;
  web_product_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AddOnRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_minor_units: number;
  currency: string;
  apple_product_id: string | null;
  google_product_id: string | null;
  web_product_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EntitlementDefinitionRow {
  key: string;
  name: string;
  description: string | null;
  value_kind: EntitlementValueKind;
  default_value: Json;
  combine_strategy: EntitlementCombineStrategy;
  created_at: string;
}

export interface PlanEntitlementRow {
  plan_id: string;
  entitlement_key: string;
  value: Json;
}

export interface AddOnEntitlementRow {
  add_on_id: string;
  entitlement_key: string;
  value: Json;
}

export interface PurchaseRow {
  id: string;
  celebration_id: string;
  purchased_by: string | null;
  platform: PurchasePlatform;
  platform_product_id: string;
  platform_transaction_id: string;
  plan_id: string | null;
  add_on_id: string | null;
  status: PurchaseStatus;
  price_minor_units: number | null;
  currency: string | null;
  verified_at: string | null;
  revoked_at: string | null;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface CelebrationEntitlementRow {
  celebration_id: string;
  entitlement_key: string;
  value: Json;
  granted_by_plan_id: string | null;
  granted_by_add_on_id: string | null;
  granted_by_purchase_id: string | null;
  granted_at: string;
  expires_at: string | null;
}

/**
 * Return type of `create_celebration_with_default_session`.
 *
 * `guest_access_token` is the ONLY time the plaintext token is available.
 * Persist what you need immediately; it cannot be read back later.
 */
export interface CreatedCelebration {
  celebration_id: string;
  event_session_id: string;
  access_link_id: string;
  public_slug: string;
  guest_access_token: string;
}

/* -------------------------------------------------------------------------- */
/* Database shape for supabase-js                                              */
/* -------------------------------------------------------------------------- */

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow>;
      workspaces: TableDef<WorkspaceRow>;
      workspace_members: TableDef<WorkspaceMemberRow>;
      themes: TableDef<ThemeRow>;
      celebrations: TableDef<CelebrationRow>;
      celebration_collaborators: TableDef<CelebrationCollaboratorRow>;
      event_sessions: TableDef<EventSessionRow>;
      access_links: TableDef<AccessLinkRow>;
      guest_sessions: TableDef<GuestSessionRow>;
      media_items: TableDef<MediaItemRow>;
      media_variants: TableDef<MediaVariantRow>;
      qr_assets: TableDef<QrAssetRow>;
      plans: TableDef<PlanRow>;
      add_ons: TableDef<AddOnRow>;
      entitlement_definitions: TableDef<EntitlementDefinitionRow>;
      plan_entitlements: TableDef<PlanEntitlementRow>;
      add_on_entitlements: TableDef<AddOnEntitlementRow>;
      purchases: TableDef<PurchaseRow>;
      celebration_entitlements: TableDef<CelebrationEntitlementRow>;
    };
    Views: Record<string, never>;
    Functions: {
      ensure_personal_workspace: {
        Args: Record<string, never>;
        Returns: string;
      };
      create_celebration_with_default_session: {
        Args: {
          p_title: string;
          p_session_name?: string;
          p_celebration_type?: CelebrationType;
          p_inspiration_pack?: InspirationPack;
          p_timezone?: string;
          p_ends_at?: string | null;
          p_starts_at?: string | null;
          p_theme_id?: string | null;
          p_workspace_id?: string | null;
          p_capture_mode?: CaptureMode;
          p_shot_limit_per_guest?: number | null;
          p_camera_roll_upload_limit?: number | null;
          p_reveal_mode?: RevealMode;
          p_reveal_at?: string | null;
          p_gallery_visibility?: GalleryVisibility;
          p_photo_treatment?: PhotoTreatment;
        };
        Returns: CreatedCelebration;
      };
    };
    Enums: {
      workspace_kind: WorkspaceKind;
      workspace_role: WorkspaceRole;
      celebration_status: CelebrationStatus;
      celebration_type: CelebrationType;
      inspiration_pack: InspirationPack;
      event_status: EventStatus;
      capture_mode: CaptureMode;
      media_type: MediaType;
      reveal_mode: RevealMode;
      gallery_visibility: GalleryVisibility;
      photo_treatment: PhotoTreatment;
      collaborator_role: CollaboratorRole;
      access_link_kind: AccessLinkKind;
      media_source: MediaSource;
      media_status: MediaStatus;
      upload_protocol: UploadProtocol;
      media_variant_type: MediaVariantType;
      job_status: JobStatus;
      processing_job_type: ProcessingJobType;
      purchase_platform: PurchasePlatform;
      purchase_status: PurchaseStatus;
      entitlement_value_kind: EntitlementValueKind;
      entitlement_combine_strategy: EntitlementCombineStrategy;
    };
    CompositeTypes: Record<string, never>;
  };
}
