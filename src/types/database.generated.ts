export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_links: {
        Row: {
          created_at: string
          event_session_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["access_link_kind"]
          pin_hash: string | null
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_session_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["access_link_kind"]
          pin_hash?: string | null
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_session_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["access_link_kind"]
          pin_hash?: string | null
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_links_event_session_id_fkey"
            columns: ["event_session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      add_on_entitlements: {
        Row: {
          add_on_id: string
          entitlement_key: string
          value: Json
        }
        Insert: {
          add_on_id: string
          entitlement_key: string
          value: Json
        }
        Update: {
          add_on_id?: string
          entitlement_key?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "add_on_entitlements_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "add_on_entitlements_entitlement_key_fkey"
            columns: ["entitlement_key"]
            isOneToOne: false
            referencedRelation: "entitlement_definitions"
            referencedColumns: ["key"]
          },
        ]
      }
      add_ons: {
        Row: {
          apple_product_id: string | null
          created_at: string
          currency: string
          description: string | null
          google_product_id: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          price_minor_units: number
          sort_order: number
          updated_at: string
          web_product_id: string | null
        }
        Insert: {
          apple_product_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          google_product_id?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          price_minor_units?: number
          sort_order?: number
          updated_at?: string
          web_product_id?: string | null
        }
        Update: {
          apple_product_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          google_product_id?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          price_minor_units?: number
          sort_order?: number
          updated_at?: string
          web_product_id?: string | null
        }
        Relationships: []
      }
      celebration_collaborators: {
        Row: {
          accepted_at: string | null
          celebration_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_email: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["collaborator_role"]
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          celebration_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["collaborator_role"]
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          celebration_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_email?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["collaborator_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "celebration_collaborators_celebration_id_fkey"
            columns: ["celebration_id"]
            isOneToOne: false
            referencedRelation: "celebrations"
            referencedColumns: ["id"]
          },
        ]
      }
      celebration_entitlements: {
        Row: {
          celebration_id: string
          entitlement_key: string
          expires_at: string | null
          granted_at: string
          granted_by_add_on_id: string | null
          granted_by_plan_id: string | null
          granted_by_purchase_id: string | null
          value: Json
        }
        Insert: {
          celebration_id: string
          entitlement_key: string
          expires_at?: string | null
          granted_at?: string
          granted_by_add_on_id?: string | null
          granted_by_plan_id?: string | null
          granted_by_purchase_id?: string | null
          value: Json
        }
        Update: {
          celebration_id?: string
          entitlement_key?: string
          expires_at?: string | null
          granted_at?: string
          granted_by_add_on_id?: string | null
          granted_by_plan_id?: string | null
          granted_by_purchase_id?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "celebration_entitlements_celebration_id_fkey"
            columns: ["celebration_id"]
            isOneToOne: false
            referencedRelation: "celebrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celebration_entitlements_entitlement_key_fkey"
            columns: ["entitlement_key"]
            isOneToOne: false
            referencedRelation: "entitlement_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "celebration_entitlements_granted_by_add_on_id_fkey"
            columns: ["granted_by_add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celebration_entitlements_granted_by_plan_id_fkey"
            columns: ["granted_by_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celebration_entitlements_granted_by_purchase_id_fkey"
            columns: ["granted_by_purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      celebrations: {
        Row: {
          celebration_type: Database["public"]["Enums"]["celebration_type"]
          cover_storage_path: string | null
          created_at: string
          created_by: string
          default_theme_id: string | null
          deleted_at: string | null
          description: string | null
          ends_at: string | null
          event_code: string | null
          id: string
          inspiration_pack: Database["public"]["Enums"]["inspiration_pack"]
          location_address: string | null
          location_name: string | null
          public_slug: string
          published_at: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["celebration_status"]
          timezone: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          celebration_type?: Database["public"]["Enums"]["celebration_type"]
          cover_storage_path?: string | null
          created_at?: string
          created_by: string
          default_theme_id?: string | null
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_code?: string | null
          id?: string
          inspiration_pack?: Database["public"]["Enums"]["inspiration_pack"]
          location_address?: string | null
          location_name?: string | null
          public_slug: string
          published_at?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["celebration_status"]
          timezone?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          celebration_type?: Database["public"]["Enums"]["celebration_type"]
          cover_storage_path?: string | null
          created_at?: string
          created_by?: string
          default_theme_id?: string | null
          deleted_at?: string | null
          description?: string | null
          ends_at?: string | null
          event_code?: string | null
          id?: string
          inspiration_pack?: Database["public"]["Enums"]["inspiration_pack"]
          location_address?: string | null
          location_name?: string | null
          public_slug?: string
          published_at?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["celebration_status"]
          timezone?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "celebrations_default_theme_id_fkey"
            columns: ["default_theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "celebrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlement_definitions: {
        Row: {
          combine_strategy: Database["public"]["Enums"]["entitlement_combine_strategy"]
          created_at: string
          default_value: Json
          description: string | null
          key: string
          name: string
          value_kind: Database["public"]["Enums"]["entitlement_value_kind"]
        }
        Insert: {
          combine_strategy?: Database["public"]["Enums"]["entitlement_combine_strategy"]
          created_at?: string
          default_value: Json
          description?: string | null
          key: string
          name: string
          value_kind: Database["public"]["Enums"]["entitlement_value_kind"]
        }
        Update: {
          combine_strategy?: Database["public"]["Enums"]["entitlement_combine_strategy"]
          created_at?: string
          default_value?: Json
          description?: string | null
          key?: string
          name?: string
          value_kind?: Database["public"]["Enums"]["entitlement_value_kind"]
        }
        Relationships: []
      }
      event_challenges: {
        Row: {
          celebration_id: string
          created_at: string
          deleted_at: string | null
          icon: string
          id: string
          instructions: string | null
          label: string
          photo_uri: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          celebration_id: string
          created_at?: string
          deleted_at?: string | null
          icon: string
          id?: string
          instructions?: string | null
          label: string
          photo_uri?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          celebration_id?: string
          created_at?: string
          deleted_at?: string | null
          icon?: string
          id?: string
          instructions?: string | null
          label?: string
          photo_uri?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_challenges_celebration_id_fkey"
            columns: ["celebration_id"]
            isOneToOne: false
            referencedRelation: "celebrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_guestbooks: {
        Row: {
          celebration_id: string
          created_at: string
          guestbook_icon: string
          id: string
          instructions: string
          updated_at: string
        }
        Insert: {
          celebration_id: string
          created_at?: string
          guestbook_icon?: string
          id?: string
          instructions?: string
          updated_at?: string
        }
        Update: {
          celebration_id?: string
          created_at?: string
          guestbook_icon?: string
          id?: string
          instructions?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_guestbooks_celebration_id_fkey"
            columns: ["celebration_id"]
            isOneToOne: true
            referencedRelation: "celebrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sessions: {
        Row: {
          allow_media_from_any_date: boolean
          allowed_media_types: Database["public"]["Enums"]["media_type"][]
          camera_roll_upload_limit: number | null
          camera_roll_uploads_after_close: boolean
          capture_mode: Database["public"]["Enums"]["capture_mode"]
          celebration_id: string
          created_at: string
          date_stamp_enabled: boolean
          deleted_at: string | null
          ends_at: string | null
          gallery_visibility: Database["public"]["Enums"]["gallery_visibility"]
          guest_downloads_enabled: boolean
          id: string
          location_address: string | null
          location_name: string | null
          moderation_enabled: boolean
          name: string
          photo_treatment: Database["public"]["Enums"]["photo_treatment"]
          pin_required: boolean
          preset_key: string | null
          reveal_at: string | null
          reveal_mode: Database["public"]["Enums"]["reveal_mode"]
          sequence_number: number
          shot_limit_per_guest: number | null
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          theme_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          allow_media_from_any_date?: boolean
          allowed_media_types?: Database["public"]["Enums"]["media_type"][]
          camera_roll_upload_limit?: number | null
          camera_roll_uploads_after_close?: boolean
          capture_mode?: Database["public"]["Enums"]["capture_mode"]
          celebration_id: string
          created_at?: string
          date_stamp_enabled?: boolean
          deleted_at?: string | null
          ends_at?: string | null
          gallery_visibility?: Database["public"]["Enums"]["gallery_visibility"]
          guest_downloads_enabled?: boolean
          id?: string
          location_address?: string | null
          location_name?: string | null
          moderation_enabled?: boolean
          name: string
          photo_treatment?: Database["public"]["Enums"]["photo_treatment"]
          pin_required?: boolean
          preset_key?: string | null
          reveal_at?: string | null
          reveal_mode?: Database["public"]["Enums"]["reveal_mode"]
          sequence_number?: number
          shot_limit_per_guest?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          theme_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          allow_media_from_any_date?: boolean
          allowed_media_types?: Database["public"]["Enums"]["media_type"][]
          camera_roll_upload_limit?: number | null
          camera_roll_uploads_after_close?: boolean
          capture_mode?: Database["public"]["Enums"]["capture_mode"]
          celebration_id?: string
          created_at?: string
          date_stamp_enabled?: boolean
          deleted_at?: string | null
          ends_at?: string | null
          gallery_visibility?: Database["public"]["Enums"]["gallery_visibility"]
          guest_downloads_enabled?: boolean
          id?: string
          location_address?: string | null
          location_name?: string | null
          moderation_enabled?: boolean
          name?: string
          photo_treatment?: Database["public"]["Enums"]["photo_treatment"]
          pin_required?: boolean
          preset_key?: string | null
          reveal_at?: string | null
          reveal_mode?: Database["public"]["Enums"]["reveal_mode"]
          sequence_number?: number
          shot_limit_per_guest?: number | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          theme_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sessions_celebration_id_fkey"
            columns: ["celebration_id"]
            isOneToOne: false
            referencedRelation: "celebrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sessions_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sessions: {
        Row: {
          anonymous_token_hash: string
          consent_at: string | null
          created_at: string
          device_identifier_hash: string | null
          display_name: string | null
          event_session_id: string
          id: string
          last_seen_at: string
        }
        Insert: {
          anonymous_token_hash: string
          consent_at?: string | null
          created_at?: string
          device_identifier_hash?: string | null
          display_name?: string | null
          event_session_id: string
          id?: string
          last_seen_at?: string
        }
        Update: {
          anonymous_token_hash?: string
          consent_at?: string | null
          created_at?: string
          device_identifier_hash?: string | null
          display_name?: string | null
          event_session_id?: string
          id?: string
          last_seen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_sessions_event_session_id_fkey"
            columns: ["event_session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          captured_at: string | null
          checksum_algorithm: string | null
          checksum_value: string | null
          client_media_id: string
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          event_session_id: string
          failure_code: string | null
          failure_message: string | null
          file_size_bytes: number | null
          guest_session_id: string | null
          height: number | null
          id: string
          is_pinned: boolean
          media_type: Database["public"]["Enums"]["media_type"]
          metadata: Json
          mime_type: string | null
          moderated_at: string | null
          original_filename: string | null
          original_storage_path: string | null
          pinned_at: string | null
          processing_started_at: string | null
          ready_at: string | null
          source: Database["public"]["Enums"]["media_source"]
          status: Database["public"]["Enums"]["media_status"]
          thumbnail_storage_path: string | null
          updated_at: string
          uploaded_at: string | null
          uploaded_by_user_id: string | null
          verified_at: string | null
          width: number | null
        }
        Insert: {
          captured_at?: string | null
          checksum_algorithm?: string | null
          checksum_value?: string | null
          client_media_id: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          event_session_id: string
          failure_code?: string | null
          failure_message?: string | null
          file_size_bytes?: number | null
          guest_session_id?: string | null
          height?: number | null
          id?: string
          is_pinned?: boolean
          media_type?: Database["public"]["Enums"]["media_type"]
          metadata?: Json
          mime_type?: string | null
          moderated_at?: string | null
          original_filename?: string | null
          original_storage_path?: string | null
          pinned_at?: string | null
          processing_started_at?: string | null
          ready_at?: string | null
          source?: Database["public"]["Enums"]["media_source"]
          status?: Database["public"]["Enums"]["media_status"]
          thumbnail_storage_path?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by_user_id?: string | null
          verified_at?: string | null
          width?: number | null
        }
        Update: {
          captured_at?: string | null
          checksum_algorithm?: string | null
          checksum_value?: string | null
          client_media_id?: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          event_session_id?: string
          failure_code?: string | null
          failure_message?: string | null
          file_size_bytes?: number | null
          guest_session_id?: string | null
          height?: number | null
          id?: string
          is_pinned?: boolean
          media_type?: Database["public"]["Enums"]["media_type"]
          metadata?: Json
          mime_type?: string | null
          moderated_at?: string | null
          original_filename?: string | null
          original_storage_path?: string | null
          pinned_at?: string | null
          processing_started_at?: string | null
          ready_at?: string | null
          source?: Database["public"]["Enums"]["media_source"]
          status?: Database["public"]["Enums"]["media_status"]
          thumbnail_storage_path?: string | null
          updated_at?: string
          uploaded_at?: string | null
          uploaded_by_user_id?: string | null
          verified_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_items_event_session_id_fkey"
            columns: ["event_session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_items_guest_session_id_fkey"
            columns: ["guest_session_id"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      media_variants: {
        Row: {
          created_at: string
          duration_ms: number | null
          file_size_bytes: number | null
          height: number | null
          id: string
          media_item_id: string
          mime_type: string | null
          processing_status: Database["public"]["Enums"]["job_status"]
          storage_path: string
          updated_at: string
          variant_type: Database["public"]["Enums"]["media_variant_type"]
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          media_item_id: string
          mime_type?: string | null
          processing_status?: Database["public"]["Enums"]["job_status"]
          storage_path: string
          updated_at?: string
          variant_type: Database["public"]["Enums"]["media_variant_type"]
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          media_item_id?: string
          mime_type?: string | null
          processing_status?: Database["public"]["Enums"]["job_status"]
          storage_path?: string
          updated_at?: string
          variant_type?: Database["public"]["Enums"]["media_variant_type"]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_variants_media_item_id_fkey"
            columns: ["media_item_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          entitlement_key: string
          plan_id: string
          value: Json
        }
        Insert: {
          entitlement_key: string
          plan_id: string
          value: Json
        }
        Update: {
          entitlement_key?: string
          plan_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_entitlement_key_fkey"
            columns: ["entitlement_key"]
            isOneToOne: false
            referencedRelation: "entitlement_definitions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          apple_product_id: string | null
          created_at: string
          currency: string
          description: string | null
          google_product_id: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          price_minor_units: number
          sort_order: number
          tier_rank: number
          updated_at: string
          web_product_id: string | null
        }
        Insert: {
          apple_product_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          google_product_id?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          price_minor_units?: number
          sort_order?: number
          tier_rank: number
          updated_at?: string
          web_product_id?: string | null
        }
        Update: {
          apple_product_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          google_product_id?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          price_minor_units?: number
          sort_order?: number
          tier_rank?: number
          updated_at?: string
          web_product_id?: string | null
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          job_type: Database["public"]["Enums"]["processing_job_type"]
          lease_expires_at: string | null
          locked_by: string | null
          max_attempts: number
          media_item_id: string
          priority: number
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          job_type: Database["public"]["Enums"]["processing_job_type"]
          lease_expires_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          media_item_id: string
          priority?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          job_type?: Database["public"]["Enums"]["processing_job_type"]
          lease_expires_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          media_item_id?: string
          priority?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_jobs_media_item_id_fkey"
            columns: ["media_item_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          display_name: string | null
          id: string
          onboarding_completed_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          onboarding_completed_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          onboarding_completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          add_on_id: string | null
          celebration_id: string
          created_at: string
          currency: string | null
          failure_code: string | null
          id: string
          plan_id: string | null
          platform: Database["public"]["Enums"]["purchase_platform"]
          platform_product_id: string
          platform_transaction_id: string
          price_minor_units: number | null
          purchased_by: string | null
          revoked_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          add_on_id?: string | null
          celebration_id: string
          created_at?: string
          currency?: string | null
          failure_code?: string | null
          id?: string
          plan_id?: string | null
          platform: Database["public"]["Enums"]["purchase_platform"]
          platform_product_id: string
          platform_transaction_id: string
          price_minor_units?: number | null
          purchased_by?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          add_on_id?: string | null
          celebration_id?: string
          created_at?: string
          currency?: string | null
          failure_code?: string | null
          id?: string
          plan_id?: string | null
          platform?: Database["public"]["Enums"]["purchase_platform"]
          platform_product_id?: string
          platform_transaction_id?: string
          price_minor_units?: number | null
          purchased_by?: string | null
          revoked_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_add_on_id_fkey"
            columns: ["add_on_id"]
            isOneToOne: false
            referencedRelation: "add_ons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_celebration_id_fkey"
            columns: ["celebration_id"]
            isOneToOne: false
            referencedRelation: "celebrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_assets: {
        Row: {
          access_link_id: string
          created_at: string
          event_session_id: string
          id: string
          storage_path: string | null
          template_key: string
          updated_at: string
        }
        Insert: {
          access_link_id: string
          created_at?: string
          event_session_id: string
          id?: string
          storage_path?: string | null
          template_key: string
          updated_at?: string
        }
        Update: {
          access_link_id?: string
          created_at?: string
          event_session_id?: string
          id?: string
          storage_path?: string | null
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_assets_access_link_id_fkey"
            columns: ["access_link_id"]
            isOneToOne: false
            referencedRelation: "access_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_assets_event_session_id_fkey"
            columns: ["event_session_id"]
            isOneToOne: false
            referencedRelation: "event_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_deletion_jobs: {
        Row: {
          attempt_count: number
          available_at: string
          bucket: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          id: string
          media_item_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          storage_path: string
          storage_provider: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          bucket: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          media_item_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          storage_path: string
          storage_provider?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          bucket?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          id?: string
          media_item_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          storage_path?: string
          storage_provider?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storage_deletion_jobs_media_item_id_fkey"
            columns: ["media_item_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      themes: {
        Row: {
          created_at: string
          description: string | null
          design_tokens: Json
          id: string
          inspiration_pack: Database["public"]["Enums"]["inspiration_pack"]
          is_active: boolean
          name: string
          preview_asset_key: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          design_tokens?: Json
          id?: string
          inspiration_pack?: Database["public"]["Enums"]["inspiration_pack"]
          is_active?: boolean
          name: string
          preview_asset_key?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          design_tokens?: Json
          id?: string
          inspiration_pack?: Database["public"]["Enums"]["inspiration_pack"]
          is_active?: boolean
          name?: string
          preview_asset_key?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      upload_attempts: {
        Row: {
          app_version: string | null
          attempt_number: number
          browser: string | null
          bytes_expected: number | null
          bytes_transferred: number | null
          created_at: string
          ended_at: string | null
          error_code: string | null
          http_status: number | null
          id: string
          media_item_id: string
          network_type: string | null
          outcome: string | null
          platform: string | null
          started_at: string
          upload_intent_id: string | null
        }
        Insert: {
          app_version?: string | null
          attempt_number?: number
          browser?: string | null
          bytes_expected?: number | null
          bytes_transferred?: number | null
          created_at?: string
          ended_at?: string | null
          error_code?: string | null
          http_status?: number | null
          id?: string
          media_item_id: string
          network_type?: string | null
          outcome?: string | null
          platform?: string | null
          started_at?: string
          upload_intent_id?: string | null
        }
        Update: {
          app_version?: string | null
          attempt_number?: number
          browser?: string | null
          bytes_expected?: number | null
          bytes_transferred?: number | null
          created_at?: string
          ended_at?: string | null
          error_code?: string | null
          http_status?: number | null
          id?: string
          media_item_id?: string
          network_type?: string | null
          outcome?: string | null
          platform?: string | null
          started_at?: string
          upload_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upload_attempts_media_item_id_fkey"
            columns: ["media_item_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upload_attempts_upload_intent_id_fkey"
            columns: ["upload_intent_id"]
            isOneToOne: false
            referencedRelation: "upload_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_intents: {
        Row: {
          bucket: string
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          expected_mime_type: string | null
          expected_size_bytes: number | null
          expires_at: string
          id: string
          media_item_id: string
          protocol: Database["public"]["Enums"]["upload_protocol"]
          resumable_url: string | null
          storage_path: string
          storage_provider: string
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          bucket: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          expected_mime_type?: string | null
          expected_size_bytes?: number | null
          expires_at: string
          id?: string
          media_item_id: string
          protocol?: Database["public"]["Enums"]["upload_protocol"]
          resumable_url?: string | null
          storage_path: string
          storage_provider?: string
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          bucket?: string
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          expected_mime_type?: string | null
          expected_size_bytes?: number | null
          expires_at?: string
          id?: string
          media_item_id?: string
          protocol?: Database["public"]["Enums"]["upload_protocol"]
          resumable_url?: string | null
          storage_path?: string
          storage_provider?: string
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "upload_intents_media_item_id_fkey"
            columns: ["media_item_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["workspace_kind"]
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["workspace_kind"]
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["workspace_kind"]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_celebration_with_default_session:
        | {
            Args: {
              p_allowed_media_types?: Database["public"]["Enums"]["media_type"][]
              p_camera_roll_upload_limit?: number
              p_capture_mode?: Database["public"]["Enums"]["capture_mode"]
              p_celebration_type?: Database["public"]["Enums"]["celebration_type"]
              p_ends_at?: string
              p_gallery_visibility?: Database["public"]["Enums"]["gallery_visibility"]
              p_inspiration_pack?: Database["public"]["Enums"]["inspiration_pack"]
              p_photo_treatment?: Database["public"]["Enums"]["photo_treatment"]
              p_reveal_at?: string
              p_reveal_mode?: Database["public"]["Enums"]["reveal_mode"]
              p_session_name?: string
              p_shot_limit_per_guest?: number
              p_starts_at?: string
              p_theme_id?: string
              p_timezone?: string
              p_title: string
              p_workspace_id?: string
            }
            Returns: Database["public"]["CompositeTypes"]["created_celebration"]
            SetofOptions: {
              from: "*"
              to: "created_celebration"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_camera_roll_upload_limit?: number
              p_capture_mode?: Database["public"]["Enums"]["capture_mode"]
              p_celebration_type?: Database["public"]["Enums"]["celebration_type"]
              p_ends_at?: string
              p_gallery_visibility?: Database["public"]["Enums"]["gallery_visibility"]
              p_inspiration_pack?: Database["public"]["Enums"]["inspiration_pack"]
              p_photo_treatment?: Database["public"]["Enums"]["photo_treatment"]
              p_reveal_at?: string
              p_reveal_mode?: Database["public"]["Enums"]["reveal_mode"]
              p_session_name?: string
              p_shot_limit_per_guest?: number
              p_starts_at?: string
              p_theme_id?: string
              p_timezone?: string
              p_title: string
              p_workspace_id?: string
            }
            Returns: Database["public"]["CompositeTypes"]["created_celebration"]
            SetofOptions: {
              from: "*"
              to: "created_celebration"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      create_guest_media_upload_intent: {
        Args: {
          p_captured_at?: string
          p_client_media_id: string
          p_event_code: string
          p_file_size_bytes?: number
          p_guest_token: string
          p_media_type: Database["public"]["Enums"]["media_type"]
          p_metadata?: Json
          p_mime_type: string
          p_source: Database["public"]["Enums"]["media_source"]
        }
        Returns: Json
      }
      create_host_media_upload_intent: {
        Args: {
          p_captured_at?: string
          p_celebration_id: string
          p_client_media_id: string
          p_file_size_bytes?: number
          p_media_type: Database["public"]["Enums"]["media_type"]
          p_metadata?: Json
          p_mime_type: string
          p_source: Database["public"]["Enums"]["media_source"]
        }
        Returns: Json
      }
      create_media_upload_intent: {
        Args: {
          p_captured_at?: string
          p_client_media_id: string
          p_event_session_id: string
          p_file_extension?: string
          p_guest_token?: string
          p_media_type?: Database["public"]["Enums"]["media_type"]
          p_mime_type?: string
          p_size_bytes?: number
          p_source?: Database["public"]["Enums"]["media_source"]
        }
        Returns: Database["public"]["CompositeTypes"]["media_upload_intent"]
        SetofOptions: {
          from: "*"
          to: "media_upload_intent"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_guest_media_item: {
        Args: { p_guest_token: string; p_media_item_id: string }
        Returns: Json
      }
      delete_host_media_item: {
        Args: { p_media_item_id: string }
        Returns: Json
      }
      ensure_personal_workspace: { Args: never; Returns: string }
      finalise_media_upload: {
        Args: {
          p_actual_size_bytes?: number
          p_checksum_algorithm?: string
          p_checksum_value?: string
          p_guest_token?: string
          p_media_item_id: string
          p_upload_intent_id: string
        }
        Returns: {
          captured_at: string | null
          checksum_algorithm: string | null
          checksum_value: string | null
          client_media_id: string
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          event_session_id: string
          failure_code: string | null
          failure_message: string | null
          file_size_bytes: number | null
          guest_session_id: string | null
          height: number | null
          id: string
          is_pinned: boolean
          media_type: Database["public"]["Enums"]["media_type"]
          metadata: Json
          mime_type: string | null
          moderated_at: string | null
          original_filename: string | null
          original_storage_path: string | null
          pinned_at: string | null
          processing_started_at: string | null
          ready_at: string | null
          source: Database["public"]["Enums"]["media_source"]
          status: Database["public"]["Enums"]["media_status"]
          thumbnail_storage_path: string | null
          updated_at: string
          uploaded_at: string | null
          uploaded_by_user_id: string | null
          verified_at: string | null
          width: number | null
        }
        SetofOptions: {
          from: "*"
          to: "media_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finalize_guest_media_upload:
        | {
            Args: {
              p_checksum_algorithm?: string
              p_checksum_value?: string
              p_file_size_bytes: number
              p_guest_token: string
              p_height?: number
              p_media_item_id: string
              p_mime_type?: string
              p_width?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_checksum_algorithm?: string
              p_checksum_value?: string
              p_duration_ms?: number
              p_file_size_bytes: number
              p_guest_token: string
              p_height?: number
              p_media_item_id: string
              p_mime_type?: string
              p_width?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_checksum_algorithm?: string
              p_checksum_value?: string
              p_duration_ms?: number
              p_file_size_bytes: number
              p_guest_token: string
              p_height?: number
              p_media_item_id: string
              p_mime_type?: string
              p_thumbnail_uploaded?: boolean
              p_width?: number
            }
            Returns: Json
          }
      finalize_host_media_upload:
        | {
            Args: {
              p_checksum_algorithm?: string
              p_checksum_value?: string
              p_file_size_bytes: number
              p_height?: number
              p_media_item_id: string
              p_mime_type?: string
              p_width?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_checksum_algorithm?: string
              p_checksum_value?: string
              p_duration_ms?: number
              p_file_size_bytes: number
              p_height?: number
              p_media_item_id: string
              p_mime_type?: string
              p_width?: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_checksum_algorithm?: string
              p_checksum_value?: string
              p_duration_ms?: number
              p_file_size_bytes: number
              p_height?: number
              p_media_item_id: string
              p_mime_type?: string
              p_thumbnail_uploaded?: boolean
              p_width?: number
            }
            Returns: Json
          }
      get_event_preview_by_code: {
        Args: { p_event_code: string }
        Returns: Database["public"]["CompositeTypes"]["guest_event_preview"]
        SetofOptions: {
          from: "*"
          to: "guest_event_preview"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_guest_access_link: {
        Args: { p_event_session_id: string }
        Returns: {
          access_link_id: string
          expires_at: string
          is_active: boolean
        }[]
      }
      get_guest_challenge_photos: {
        Args: { p_event_code: string; p_guest_token: string }
        Returns: Json
      }
      get_guest_challenges: {
        Args: { p_event_code: string; p_guest_token: string }
        Returns: Json
      }
      get_guest_gallery: {
        Args: { p_event_code: string; p_guest_token: string }
        Returns: Json
      }
      get_guest_guestbook: {
        Args: { p_event_code: string; p_guest_token: string }
        Returns: Json
      }
      get_guest_joined_guests: {
        Args: { p_celebration_id: string; p_guest_token: string }
        Returns: {
          created_at: string
          display_name: string
          id: string
          last_seen_at: string
        }[]
      }
      get_host_challenge_photos: {
        Args: { p_celebration_id: string }
        Returns: Json
      }
      get_host_guestbook: { Args: { p_celebration_id: string }; Returns: Json }
      join_event_by_code: {
        Args: {
          p_device_fingerprint?: string
          p_display_name: string
          p_event_code: string
        }
        Returns: Database["public"]["CompositeTypes"]["joined_guest_session"]
        SetofOptions: {
          from: "*"
          to: "joined_guest_session"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      join_event_session: {
        Args: {
          p_access_token: string
          p_device_fingerprint?: string
          p_display_name?: string
          p_pin?: string
        }
        Returns: Database["public"]["CompositeTypes"]["joined_guest_session"]
        SetofOptions: {
          from: "*"
          to: "joined_guest_session"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pin_host_media_item: { Args: { p_media_item_id: string }; Returns: Json }
      publish_celebration: {
        Args: {
          p_add_on_keys?: string[]
          p_celebration_id: string
          p_plan_key?: string
        }
        Returns: Database["public"]["CompositeTypes"]["published_celebration"]
        SetofOptions: {
          from: "*"
          to: "published_celebration"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seed_event_challenges_if_empty: {
        Args: { p_celebration_id: string; p_challenges: Json }
        Returns: Json
      }
      unpin_host_media_item: {
        Args: { p_media_item_id: string }
        Returns: Json
      }
      upsert_event_guestbook:
        | {
            Args: { p_celebration_id: string; p_instructions: string }
            Returns: {
              celebration_id: string
              created_at: string
              guestbook_icon: string
              id: string
              instructions: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "event_guestbooks"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_celebration_id: string
              p_icon?: string
              p_instructions: string
            }
            Returns: {
              celebration_id: string
              created_at: string
              guestbook_icon: string
              id: string
              instructions: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "event_guestbooks"
              isOneToOne: true
              isSetofReturn: false
            }
          }
    }
    Enums: {
      access_link_kind: "guest" | "host_preview" | "cohost_invite"
      capture_mode: "camera_only" | "library_only" | "camera_and_library"
      celebration_status: "draft" | "published" | "archived"
      celebration_type:
        | "wedding"
        | "birthday"
        | "party"
        | "corporate"
        | "religious"
        | "graduation"
        | "anniversary"
        | "other"
      collaborator_role: "owner" | "cohost" | "moderator" | "viewer"
      entitlement_combine_strategy:
        | "max"
        | "sum"
        | "any_true"
        | "union"
        | "override"
      entitlement_value_kind:
        | "boolean"
        | "integer"
        | "unlimited"
        | "string"
        | "string_array"
        | "integer_array"
      event_status: "draft" | "published" | "closed" | "revealed" | "archived"
      gallery_visibility: "all_guests" | "own_only" | "hosts_only"
      inspiration_pack:
        | "universal"
        | "south_asian"
        | "classic"
        | "modern"
        | "black_tie"
        | "garden"
        | "custom"
      job_status:
        | "pending"
        | "available"
        | "running"
        | "retrying"
        | "completed"
        | "failed"
        | "cancelled"
      media_source:
        | "camera"
        | "library"
        | "recording"
        | "host_upload"
        | "system_generated"
      media_status:
        | "local_pending"
        | "upload_authorising"
        | "queued"
        | "uploading"
        | "paused"
        | "uploaded"
        | "verifying"
        | "processing"
        | "ready"
        | "retryable_failed"
        | "permanent_failed"
        | "hidden"
        | "deleted"
      media_type: "photo" | "video" | "audio"
      media_variant_type:
        | "original"
        | "thumbnail"
        | "gallery_preview"
        | "full_screen"
        | "video_poster"
        | "video_stream"
        | "audio_preview"
        | "audio_waveform"
      photo_treatment:
        | "original"
        | "disposable"
        | "black_and_white"
        | "warm_film"
      processing_job_type:
        | "verify_object"
        | "extract_metadata"
        | "generate_image_variants"
        | "generate_video_poster"
        | "transcode_video"
        | "generate_audio_preview"
        | "strip_derivative_metadata"
      purchase_platform: "apple_app_store" | "google_play" | "web"
      purchase_status:
        | "pending"
        | "verified"
        | "failed"
        | "refunded"
        | "revoked"
      reveal_mode: "instant" | "scheduled" | "manual"
      upload_protocol: "standard" | "tus" | "multipart"
      workspace_kind: "personal" | "partner"
      workspace_role: "owner" | "admin" | "member"
    }
    CompositeTypes: {
      created_celebration: {
        celebration_id: string | null
        event_session_id: string | null
        access_link_id: string | null
        public_slug: string | null
        guest_access_token: string | null
      }
      guest_event_preview: {
        celebration_id: string | null
        title: string | null
        ends_at: string | null
        shot_limit_per_guest: number | null
        cover_storage_path: string | null
        theme_accent: string | null
        photo_count: number | null
      }
      joined_guest_session: {
        guest_session_id: string | null
        event_session_id: string | null
        celebration_id: string | null
        guest_token: string | null
        display_name: string | null
        shot_limit_per_guest: number | null
        shots_used: number | null
      }
      media_upload_intent: {
        media_item_id: string | null
        upload_intent_id: string | null
        bucket: string | null
        storage_path: string | null
        protocol: Database["public"]["Enums"]["upload_protocol"] | null
        expires_at: string | null
        is_existing: boolean | null
      }
      published_celebration: {
        celebration_id: string | null
        event_session_id: string | null
        public_slug: string | null
        published_at: string | null
        was_already_published: boolean | null
        event_code: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_link_kind: ["guest", "host_preview", "cohost_invite"],
      capture_mode: ["camera_only", "library_only", "camera_and_library"],
      celebration_status: ["draft", "published", "archived"],
      celebration_type: [
        "wedding",
        "birthday",
        "party",
        "corporate",
        "religious",
        "graduation",
        "anniversary",
        "other",
      ],
      collaborator_role: ["owner", "cohost", "moderator", "viewer"],
      entitlement_combine_strategy: [
        "max",
        "sum",
        "any_true",
        "union",
        "override",
      ],
      entitlement_value_kind: [
        "boolean",
        "integer",
        "unlimited",
        "string",
        "string_array",
        "integer_array",
      ],
      event_status: ["draft", "published", "closed", "revealed", "archived"],
      gallery_visibility: ["all_guests", "own_only", "hosts_only"],
      inspiration_pack: [
        "universal",
        "south_asian",
        "classic",
        "modern",
        "black_tie",
        "garden",
        "custom",
      ],
      job_status: [
        "pending",
        "available",
        "running",
        "retrying",
        "completed",
        "failed",
        "cancelled",
      ],
      media_source: [
        "camera",
        "library",
        "recording",
        "host_upload",
        "system_generated",
      ],
      media_status: [
        "local_pending",
        "upload_authorising",
        "queued",
        "uploading",
        "paused",
        "uploaded",
        "verifying",
        "processing",
        "ready",
        "retryable_failed",
        "permanent_failed",
        "hidden",
        "deleted",
      ],
      media_type: ["photo", "video", "audio"],
      media_variant_type: [
        "original",
        "thumbnail",
        "gallery_preview",
        "full_screen",
        "video_poster",
        "video_stream",
        "audio_preview",
        "audio_waveform",
      ],
      photo_treatment: [
        "original",
        "disposable",
        "black_and_white",
        "warm_film",
      ],
      processing_job_type: [
        "verify_object",
        "extract_metadata",
        "generate_image_variants",
        "generate_video_poster",
        "transcode_video",
        "generate_audio_preview",
        "strip_derivative_metadata",
      ],
      purchase_platform: ["apple_app_store", "google_play", "web"],
      purchase_status: ["pending", "verified", "failed", "refunded", "revoked"],
      reveal_mode: ["instant", "scheduled", "manual"],
      upload_protocol: ["standard", "tus", "multipart"],
      workspace_kind: ["personal", "partner"],
      workspace_role: ["owner", "admin", "member"],
    },
  },
} as const
