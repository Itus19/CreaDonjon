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
    PostgrestVersion: "14.5"
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
      ai_proposals: {
        Row: {
          applied_at: string | null
          auto_applied: boolean
          campaign_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          reviewed_by: string | null
          session_event_id: string | null
          status: string
          target_entity_id: string | null
          validation_errors: Json | null
          world_id: string
        }
        Insert: {
          applied_at?: string | null
          auto_applied?: boolean
          campaign_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload: Json
          reviewed_by?: string | null
          session_event_id?: string | null
          status?: string
          target_entity_id?: string | null
          validation_errors?: Json | null
          world_id: string
        }
        Update: {
          applied_at?: string | null
          auto_applied?: boolean
          campaign_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          reviewed_by?: string | null
          session_event_id?: string | null
          status?: string
          target_entity_id?: string | null
          validation_errors?: Json | null
          world_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_proposals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_proposals_session_event_id_fkey"
            columns: ["session_event_id"]
            isOneToOne: false
            referencedRelation: "session_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_proposals_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_proposals_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          cached_tokens: number
          campaign_id: string | null
          cost_micros: number
          created_at: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          purpose: string
          user_id: string | null
        }
        Insert: {
          cached_tokens?: number
          campaign_id?: string | null
          cost_micros?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          purpose: string
          user_id?: string | null
        }
        Update: {
          cached_tokens?: number
          campaign_id?: string | null
          cost_micros?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          purpose?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          alt_text: string | null
          byte_size: number
          created_at: string
          height: number | null
          id: string
          mime_type: string
          storage_path: string
          uploaded_by: string | null
          visibility_level: string
          visibility_scope_id: string | null
          width: number | null
          world_id: string
        }
        Insert: {
          alt_text?: string | null
          byte_size: number
          created_at?: string
          height?: number | null
          id?: string
          mime_type: string
          storage_path: string
          uploaded_by?: string | null
          visibility_level?: string
          visibility_scope_id?: string | null
          width?: number | null
          world_id: string
        }
        Update: {
          alt_text?: string | null
          byte_size?: number
          created_at?: string
          height?: number | null
          id?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string | null
          visibility_level?: string
          visibility_scope_id?: string | null
          width?: number | null
          world_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      attitude_events: {
        Row: {
          campaign_id: string
          created_at: string
          deltas: Json
          id: string
          is_public: boolean
          occurred_at_ingame: Json | null
          origin: string
          session_event_id: string | null
          source_entity_id: string
          summary: string
          target_entity_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          deltas?: Json
          id?: string
          is_public?: boolean
          occurred_at_ingame?: Json | null
          origin: string
          session_event_id?: string | null
          source_entity_id: string
          summary: string
          target_entity_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          deltas?: Json
          id?: string
          is_public?: boolean
          occurred_at_ingame?: Json | null
          origin?: string
          session_event_id?: string | null
          source_entity_id?: string
          summary?: string
          target_entity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attitude_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attitude_events_session_event_id_fkey"
            columns: ["session_event_id"]
            isOneToOne: false
            referencedRelation: "session_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attitude_events_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attitude_events_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      background_images: {
        Row: {
          available_modes: string[]
          backdrop_image: string
          chroma: number
          created_at: string
          hue: number
          id: string
          owner_id: string
          thumb_data_url: string
        }
        Insert: {
          available_modes: string[]
          backdrop_image: string
          chroma: number
          created_at?: string
          hue: number
          id?: string
          owner_id: string
          thumb_data_url: string
        }
        Update: {
          available_modes?: string[]
          backdrop_image?: string
          chroma?: number
          created_at?: string
          hue?: number
          id?: string
          owner_id?: string
          thumb_data_url?: string
        }
        Relationships: []
      }
      block_images: {
        Row: {
          available_modes: string[] | null
          block_id: string
          chroma: number | null
          created_at: string
          height: number
          hue: number | null
          image: string
          mime_type: string
          width: number
        }
        Insert: {
          available_modes?: string[] | null
          block_id: string
          chroma?: number | null
          created_at?: string
          height: number
          hue?: number | null
          image: string
          mime_type: string
          width: number
        }
        Update: {
          available_modes?: string[] | null
          block_id?: string
          chroma?: number | null
          created_at?: string
          height?: number
          hue?: number | null
          image?: string
          mime_type?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "block_images_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: true
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          block_type: string
          created_at: string
          created_by: string | null
          data: Json
          display: Json
          display_order: number
          entity_id: string
          id: string
          updated_at: string
          version: number
          visibility_level: string
          visibility_scope_id: string | null
        }
        Insert: {
          block_type: string
          created_at?: string
          created_by?: string | null
          data?: Json
          display?: Json
          display_order?: number
          entity_id: string
          id?: string
          updated_at?: string
          version?: number
          visibility_level?: string
          visibility_scope_id?: string | null
        }
        Update: {
          block_type?: string
          created_at?: string
          created_by?: string | null
          data?: Json
          display?: Json
          display_order?: number
          entity_id?: string
          id?: string
          updated_at?: string
          version?: number
          visibility_level?: string
          visibility_scope_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_characters: {
        Row: {
          campaign_id: string
          entity_id: string
          is_pc: boolean
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          entity_id: string
          is_pc?: boolean
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          entity_id?: string
          is_pc?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_characters_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_encounters: {
        Row: {
          band: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          participants: Json
          party_level: number
          party_size: number
          updated_at: string
        }
        Insert: {
          band?: string | null
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          participants?: Json
          party_level: number
          party_size: number
          updated_at?: string
        }
        Update: {
          band?: string | null
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          participants?: Json
          party_level?: number
          party_size?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_encounters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_entity_snapshots: {
        Row: {
          campaign_id: string
          entity_id: string
          mechanical_revision_id: string
          pinned_at: string
        }
        Insert: {
          campaign_id: string
          entity_id: string
          mechanical_revision_id: string
          pinned_at?: string
        }
        Update: {
          campaign_id?: string
          entity_id?: string
          mechanical_revision_id?: string
          pinned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_entity_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_entity_snapshots_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_entity_snapshots_revision_fk"
            columns: ["mechanical_revision_id"]
            isOneToOne: false
            referencedRelation: "entity_mechanical_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          deleted_at: string | null
          gm_user_id: string | null
          id: string
          mode: string
          name: string
          party_entity_id: string | null
          rng_seed: string
          ruleset_id: string
          updated_at: string
          world_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          gm_user_id?: string | null
          id?: string
          mode: string
          name: string
          party_entity_id?: string | null
          rng_seed?: string
          ruleset_id: string
          updated_at?: string
          world_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          gm_user_id?: string | null
          id?: string
          mode?: string
          name?: string
          party_entity_id?: string | null
          rng_seed?: string
          ruleset_id?: string
          updated_at?: string
          world_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_party_entity_id_fkey"
            columns: ["party_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_ruleset_id_fkey"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "rulesets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          content: string
          content_hash: string
          created_at: string
          embedded_at: string | null
          embedding: string | null
          embedding_model: string | null
          id: string
          source_id: string
          source_kind: string
          token_count: number | null
          visibility_level: string
          visibility_scope_id: string | null
          world_id: string
        }
        Insert: {
          content: string
          content_hash: string
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          source_id: string
          source_kind: string
          token_count?: number | null
          visibility_level?: string
          visibility_scope_id?: string | null
          world_id: string
        }
        Update: {
          content?: string
          content_hash?: string
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          id?: string
          source_id?: string
          source_kind?: string
          token_count?: number | null
          visibility_level?: string
          visibility_scope_id?: string | null
          world_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chunks_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_participants: {
        Row: {
          ac: number | null
          combat_id: string
          concentration: Json | null
          conditions: Json
          created_at: string
          display_order: number
          entity_id: string | null
          hp_current: number | null
          hp_max: number | null
          id: string
          initiative: number | null
          is_ally: boolean
          label: string
          rule_key: string | null
          source_kind: string
          temp_hp: number
        }
        Insert: {
          ac?: number | null
          combat_id: string
          concentration?: Json | null
          conditions?: Json
          created_at?: string
          display_order?: number
          entity_id?: string | null
          hp_current?: number | null
          hp_max?: number | null
          id?: string
          initiative?: number | null
          is_ally?: boolean
          label: string
          rule_key?: string | null
          source_kind: string
          temp_hp?: number
        }
        Update: {
          ac?: number | null
          combat_id?: string
          concentration?: Json | null
          conditions?: Json
          created_at?: string
          display_order?: number
          entity_id?: string | null
          hp_current?: number | null
          hp_max?: number | null
          id?: string
          initiative?: number | null
          is_ally?: boolean
          label?: string
          rule_key?: string | null
          source_kind?: string
          temp_hp?: number
        }
        Relationships: [
          {
            foreignKeyName: "combat_participants_combat_id_fkey"
            columns: ["combat_id"]
            isOneToOne: false
            referencedRelation: "combats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combat_participants_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      combats: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          name: string | null
          round: number
          session_id: string | null
          status: string
          turn_index: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          name?: string | null
          round?: number
          session_id?: string | null
          status?: string
          turn_index?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          name?: string | null
          round?: number
          session_id?: string | null
          status?: string
          turn_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "combats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combats_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dice_rolls: {
        Row: {
          ast: Json
          campaign_id: string
          context: Json
          created_at: string
          detail: Json
          expression: string
          id: string
          result: number
          rolled_by: string
          seed_step: number | null
          session_id: string | null
        }
        Insert: {
          ast: Json
          campaign_id: string
          context?: Json
          created_at?: string
          detail: Json
          expression: string
          id?: string
          result: number
          rolled_by: string
          seed_step?: number | null
          session_id?: string | null
        }
        Update: {
          ast?: Json
          campaign_id?: string
          context?: Json
          created_at?: string
          detail?: Json
          expression?: string
          id?: string
          result?: number
          rolled_by?: string
          seed_step?: number | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dice_rolls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dice_rolls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_queue: {
        Row: {
          attempts: number
          chunk_id: string
          enqueued_at: string
          id: number
          last_error: string | null
        }
        Insert: {
          attempts?: number
          chunk_id: string
          enqueued_at?: string
          id?: number
          last_error?: string | null
        }
        Update: {
          attempts?: number
          chunk_id?: string
          enqueued_at?: string
          id?: number
          last_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embedding_queue_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          aliases: string[]
          created_at: string
          created_by: string | null
          current_mechanical_revision_id: string | null
          deleted_at: string | null
          display_order: number
          entity_kind: string
          id: string
          is_public: boolean
          name: string
          search_fr: unknown
          slug: string
          updated_at: string
          version: number
          world_id: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          current_mechanical_revision_id?: string | null
          deleted_at?: string | null
          display_order?: number
          entity_kind?: string
          id?: string
          is_public?: boolean
          name: string
          search_fr?: unknown
          slug: string
          updated_at?: string
          version?: number
          world_id: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          created_by?: string | null
          current_mechanical_revision_id?: string | null
          deleted_at?: string | null
          display_order?: number
          entity_kind?: string
          id?: string
          is_public?: boolean
          name?: string
          search_fr?: unknown
          slug?: string
          updated_at?: string
          version?: number
          world_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entities_current_revision_fk"
            columns: ["current_mechanical_revision_id"]
            isOneToOne: false
            referencedRelation: "entity_mechanical_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entities_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_active_effects: {
        Row: {
          applied_at_event: string | null
          campaign_id: string
          created_at: string
          duration: Json
          entity_id: string
          expires_at_event: string | null
          id: string
          label: string
          modifiers: Json
          source_key: string | null
          source_kind: string
        }
        Insert: {
          applied_at_event?: string | null
          campaign_id: string
          created_at?: string
          duration?: Json
          entity_id: string
          expires_at_event?: string | null
          id?: string
          label: string
          modifiers?: Json
          source_key?: string | null
          source_kind: string
        }
        Update: {
          applied_at_event?: string | null
          campaign_id?: string
          created_at?: string
          duration?: Json
          entity_id?: string
          expires_at_event?: string | null
          id?: string
          label?: string
          modifiers?: Json
          source_key?: string | null
          source_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_active_effects_applied_at_event_fkey"
            columns: ["applied_at_event"]
            isOneToOne: false
            referencedRelation: "session_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_active_effects_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_active_effects_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_active_effects_expires_at_event_fkey"
            columns: ["expires_at_event"]
            isOneToOne: false
            referencedRelation: "session_events"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_assets: {
        Row: {
          asset_id: string
          display_order: number
          entity_id: string
          role: string
        }
        Insert: {
          asset_id: string
          display_order?: number
          entity_id: string
          role: string
        }
        Update: {
          asset_id?: string
          display_order?: number
          entity_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_assets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_assets_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_attitudes: {
        Row: {
          axes: Json
          campaign_id: string
          id: string
          source_entity_id: string
          target_entity_id: string
          updated_at: string
        }
        Insert: {
          axes?: Json
          campaign_id: string
          id?: string
          source_entity_id: string
          target_entity_id: string
          updated_at?: string
        }
        Update: {
          axes?: Json
          campaign_id?: string
          id?: string
          source_entity_id?: string
          target_entity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_attitudes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_attitudes_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_attitudes_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_discoveries: {
        Row: {
          campaign_id: string
          detail_level: string
          discovered_at: string
          entity_id: string
          id: string
          source_event_id: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          detail_level?: string
          discovered_at?: string
          entity_id: string
          id?: string
          source_event_id?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          detail_level?: string
          discovered_at?: string
          entity_id?: string
          id?: string
          source_event_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_discoveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_discoveries_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_discoveries_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "session_events"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_grants: {
        Row: {
          entity_id: string
          granted_at: string
          granted_by: string
          user_id: string
        }
        Insert: {
          entity_id: string
          granted_at?: string
          granted_by: string
          user_id: string
        }
        Update: {
          entity_id?: string
          granted_at?: string
          granted_by?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_grants_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_mechanical_revisions: {
        Row: {
          based_on_ruleset_entry_id: string | null
          change_note: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          id: string
          mechanical_data: Json
          revision_number: number
        }
        Insert: {
          based_on_ruleset_entry_id?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          id?: string
          mechanical_data: Json
          revision_number: number
        }
        Update: {
          based_on_ruleset_entry_id?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          id?: string
          mechanical_data?: Json
          revision_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_mechanical_revisions_based_on_ruleset_entry_id_fkey"
            columns: ["based_on_ruleset_entry_id"]
            isOneToOne: false
            referencedRelation: "ruleset_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_mechanical_revisions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_mentions: {
        Row: {
          created_at: string
          id: string
          origin: string
          source_entity_id: string
          source_path: string
          target_entity_id: string | null
          target_kind: string
          target_rule_key: string | null
          visibility_level: string
          visibility_scope_id: string | null
          world_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          origin: string
          source_entity_id: string
          source_path: string
          target_entity_id?: string | null
          target_kind: string
          target_rule_key?: string | null
          visibility_level?: string
          visibility_scope_id?: string | null
          world_id: string
        }
        Update: {
          created_at?: string
          id?: string
          origin?: string
          source_entity_id?: string
          source_path?: string
          target_entity_id?: string | null
          target_kind?: string
          target_rule_key?: string | null
          visibility_level?: string
          visibility_scope_id?: string | null
          world_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_mentions_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_mentions_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_mentions_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_portraits: {
        Row: {
          align: string
          created_at: string
          display_size_pct: number
          entity_id: string
          height: number
          image: string
          mime_type: string
          width: number
        }
        Insert: {
          align?: string
          created_at?: string
          display_size_pct?: number
          entity_id: string
          height: number
          image: string
          mime_type: string
          width: number
        }
        Update: {
          align?: string
          created_at?: string
          display_size_pct?: number
          entity_id?: string
          height?: number
          image?: string
          mime_type?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "entity_portraits_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_revisions: {
        Row: {
          change_note: string | null
          change_source: string
          changed_by: string | null
          created_at: string
          entity_id: string
          id: string
          revision_number: number
          snapshot: Json
        }
        Insert: {
          change_note?: string | null
          change_source: string
          changed_by?: string | null
          created_at?: string
          entity_id: string
          id?: string
          revision_number: number
          snapshot: Json
        }
        Update: {
          change_note?: string | null
          change_source?: string
          changed_by?: string | null
          created_at?: string
          entity_id?: string
          id?: string
          revision_number?: number
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "entity_revisions_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_runtime_state: {
        Row: {
          campaign_id: string | null
          entity_id: string
          id: string
          state: Json
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          entity_id: string
          id?: string
          state?: Json
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          entity_id?: string
          id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_runtime_state_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_runtime_state_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_templates: {
        Row: {
          blocks: Json
          created_at: string
          entity_kind: string
          icon: string | null
          id: string
          is_builtin: boolean
          name: string
          world_id: string | null
        }
        Insert: {
          blocks?: Json
          created_at?: string
          entity_kind: string
          icon?: string | null
          id?: string
          is_builtin?: boolean
          name: string
          world_id?: string | null
        }
        Update: {
          blocks?: Json
          created_at?: string
          entity_kind?: string
          icon?: string | null
          id?: string
          is_builtin?: boolean
          name?: string
          world_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_templates_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      personality_events: {
        Row: {
          created_at: string
          deltas: Json
          entity_id: string
          id: string
          is_public: boolean
          occurred_at_ingame: Json | null
          origin: string
          session_event_id: string | null
          summary: string
        }
        Insert: {
          created_at?: string
          deltas?: Json
          entity_id: string
          id?: string
          is_public?: boolean
          occurred_at_ingame?: Json | null
          origin: string
          session_event_id?: string | null
          summary: string
        }
        Update: {
          created_at?: string
          deltas?: Json
          entity_id?: string
          id?: string
          is_public?: boolean
          occurred_at_ingame?: Json | null
          origin?: string
          session_event_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "personality_events_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personality_events_session_event_id_fkey"
            columns: ["session_event_id"]
            isOneToOne: false
            referencedRelation: "session_events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_role: string
          created_at: string
          display_name: string
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          account_role?: string
          created_at?: string
          display_name?: string
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          account_role?: string
          created_at?: string
          display_name?: string
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      relations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metadata: Json
          relation_type: string
          source_entity_id: string
          target_entity_id: string
          visibility_level: string
          visibility_scope_id: string | null
          world_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          relation_type: string
          source_entity_id: string
          target_entity_id: string
          visibility_level?: string
          visibility_scope_id?: string | null
          world_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json
          relation_type?: string
          source_entity_id?: string
          target_entity_id?: string
          visibility_level?: string
          visibility_scope_id?: string | null
          world_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relations_source_entity_id_fkey"
            columns: ["source_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_target_entity_id_fkey"
            columns: ["target_entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relations_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      ruleset_entries: {
        Row: {
          ai_digest: string | null
          ai_digest_generated_at: string | null
          created_at: string
          entry_key: string
          entry_type: string
          id: string
          ruleset_id: string
          source_attribution: string | null
          source_raw: Json | null
          updated_at: string
        }
        Insert: {
          ai_digest?: string | null
          ai_digest_generated_at?: string | null
          created_at?: string
          entry_key: string
          entry_type: string
          id?: string
          ruleset_id: string
          source_attribution?: string | null
          source_raw?: Json | null
          updated_at?: string
        }
        Update: {
          ai_digest?: string | null
          ai_digest_generated_at?: string | null
          created_at?: string
          entry_key?: string
          entry_type?: string
          id?: string
          ruleset_id?: string
          source_attribution?: string | null
          source_raw?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruleset_entries_ruleset_id_fkey"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
      ruleset_entry_blocks: {
        Row: {
          block_type: string
          created_at: string
          data: Json
          display: Json
          display_order: number
          entry_id: string
          id: string
          schema_version: number
          updated_at: string
        }
        Insert: {
          block_type: string
          created_at?: string
          data?: Json
          display?: Json
          display_order?: number
          entry_id: string
          id?: string
          schema_version?: number
          updated_at?: string
        }
        Update: {
          block_type?: string
          created_at?: string
          data?: Json
          display?: Json
          display_order?: number
          entry_id?: string
          id?: string
          schema_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruleset_entry_blocks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "ruleset_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      ruleset_entry_refs: {
        Row: {
          created_at: string
          id: string
          note: string | null
          origin: string
          path: string | null
          ref_kind: string
          source_entry_id: string
          target_entry_id: string | null
          target_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          origin: string
          path?: string | null
          ref_kind: string
          source_entry_id: string
          target_entry_id?: string | null
          target_key: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          origin?: string
          path?: string | null
          ref_kind?: string
          source_entry_id?: string
          target_entry_id?: string | null
          target_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruleset_entry_refs_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "ruleset_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ruleset_entry_refs_target_entry_id_fkey"
            columns: ["target_entry_id"]
            isOneToOne: false
            referencedRelation: "ruleset_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      ruleset_entry_translations: {
        Row: {
          blocks: Json
          entry_id: string
          locale: string
          name: string
          source: string
        }
        Insert: {
          blocks?: Json
          entry_id: string
          locale: string
          name: string
          source: string
        }
        Update: {
          blocks?: Json
          entry_id?: string
          locale?: string
          name?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruleset_entry_translations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "ruleset_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      ruleset_overrides: {
        Row: {
          action: string
          block_type: string | null
          created_at: string
          created_by: string | null
          entry_key: string
          id: string
          note: string | null
          patch: Json | null
          payload: Json | null
          ruleset_id: string
        }
        Insert: {
          action: string
          block_type?: string | null
          created_at?: string
          created_by?: string | null
          entry_key: string
          id?: string
          note?: string | null
          patch?: Json | null
          payload?: Json | null
          ruleset_id: string
        }
        Update: {
          action?: string
          block_type?: string | null
          created_at?: string
          created_by?: string | null
          entry_key?: string
          id?: string
          note?: string | null
          patch?: Json | null
          payload?: Json | null
          ruleset_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ruleset_overrides_ruleset_id_fkey"
            columns: ["ruleset_id"]
            isOneToOne: false
            referencedRelation: "rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
      rulesets: {
        Row: {
          base_system: string
          content_origin: string
          created_at: string
          created_by: string | null
          id: string
          is_official_base: boolean
          lineage_id: string
          name: string
          parent_ruleset_id: string | null
          published_at: string | null
          version: number
        }
        Insert: {
          base_system: string
          content_origin?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_official_base?: boolean
          lineage_id?: string
          name: string
          parent_ruleset_id?: string | null
          published_at?: string | null
          version?: number
        }
        Update: {
          base_system?: string
          content_origin?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_official_base?: boolean
          lineage_id?: string
          name?: string
          parent_ruleset_id?: string | null
          published_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "rulesets_parent_ruleset_id_fkey"
            columns: ["parent_ruleset_id"]
            isOneToOne: false
            referencedRelation: "rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
      session_events: {
        Row: {
          actor: string
          actor_user_id: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          seq: number
          session_id: string
        }
        Insert: {
          actor: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          seq: number
          session_id: string
        }
        Update: {
          actor?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          seq?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          campaign_id: string
          ended_at: string | null
          id: string
          started_at: string
          summary: string | null
          title: string | null
        }
        Insert: {
          campaign_id: string
          ended_at?: string | null
          id?: string
          started_at?: string
          summary?: string | null
          title?: string | null
        }
        Update: {
          campaign_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          summary?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          password_attempts: number
          password_hash: string | null
          revoked_at: string | null
          scope: string
          token: string | null
          token_hash: string
          world_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          password_attempts?: number
          password_hash?: string | null
          revoked_at?: string | null
          scope: string
          token?: string | null
          token_hash: string
          world_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          password_attempts?: number
          password_hash?: string | null
          revoked_at?: string | null
          scope?: string
          token?: string | null
          token_hash?: string
          world_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_links_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      world_members: {
        Row: {
          added_at: string
          role: string
          user_id: string
          world_id: string
        }
        Insert: {
          added_at?: string
          role: string
          user_id: string
          world_id: string
        }
        Update: {
          added_at?: string
          role?: string
          user_id?: string
          world_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "world_members_world_id_fkey"
            columns: ["world_id"]
            isOneToOne: false
            referencedRelation: "worlds"
            referencedColumns: ["id"]
          },
        ]
      }
      worlds: {
        Row: {
          calendar: Json
          created_at: string
          default_ruleset_id: string | null
          deleted_at: string | null
          entity_kind_order: Json
          id: string
          name: string
          owner_id: string
          slug: string
          updated_at: string
          wiki_welcome_message: string | null
        }
        Insert: {
          calendar?: Json
          created_at?: string
          default_ruleset_id?: string | null
          deleted_at?: string | null
          entity_kind_order?: Json
          id?: string
          name: string
          owner_id: string
          slug: string
          updated_at?: string
          wiki_welcome_message?: string | null
        }
        Update: {
          calendar?: Json
          created_at?: string
          default_ruleset_id?: string | null
          deleted_at?: string | null
          entity_kind_order?: Json
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
          wiki_welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worlds_default_ruleset_fk"
            columns: ["default_ruleset_id"]
            isOneToOne: false
            referencedRelation: "rulesets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_own_account: { Args: never; Returns: undefined }
      entity_blocks_full: {
        Args: { p_entity_id: string }
        Returns: {
          block_type: string
          created_at: string
          created_by: string | null
          data: Json
          display: Json
          display_order: number
          entity_id: string
          id: string
          updated_at: string
          version: number
          visibility_level: string
          visibility_scope_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "blocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      import_prune_stale_entries: {
        Args: { p_ruleset_id: string; p_valid_keys: string[] }
        Returns: number
      }
      import_srd_entries: {
        Args: { p_entries: Json; p_ruleset_id: string }
        Returns: number
      }
      import_upsert_ruleset: {
        Args: { p_base_system: string; p_name: string }
        Returns: string
      }
      insert_entity_revision: {
        Args: {
          p_change_note: string
          p_change_source: string
          p_changed_by: string
          p_entity_id: string
          p_snapshot: Json
        }
        Returns: {
          change_note: string | null
          change_source: string
          changed_by: string | null
          created_at: string
          entity_id: string
          id: string
          revision_number: number
          snapshot: Json
        }
        SetofOptions: {
          from: "*"
          to: "entity_revisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_ruleset: { Args: { p_ruleset_id: string }; Returns: undefined }
      record_share_link_password_attempt: {
        Args: { p_success: boolean; p_token: string }
        Returns: undefined
      }
      resolve_share_link: {
        Args: { p_token: string }
        Returns: {
          password_attempts: number
          password_hash: string
          scope: string
          world_id: string
          world_name: string
          world_slug: string
        }[]
      }
      restore_entity_blocks: {
        Args: { p_blocks: Json; p_entity_id: string }
        Returns: undefined
      }
      search_entities: {
        Args: { p_query: string; p_world_id: string }
        Returns: {
          entity_kind: string
          id: string
          name: string
          slug: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_ruleset_override: {
        Args: {
          p_action: string
          p_block_type: string
          p_entry_key: string
          p_note: string
          p_patch: Json
          p_payload: Json
          p_ruleset_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
