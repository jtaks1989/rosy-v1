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
  public: {
    Tables: {
      action_comments: {
        Row: {
          action_id: string
          author: string | null
          author_name: string | null
          body: string
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          action_id: string
          author?: string | null
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          org_id: string
        }
        Update: {
          action_id?: string
          author?: string | null
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_comments_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "rosy_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_comments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          detail: string | null
          due_date: string | null
          evidence: Json
          id: string
          kind: string
          location_id: string | null
          org_id: string
          owner_name: string | null
          severity: string
          source_freshness: string | null
          status: Database["public"]["Enums"]["alert_status"]
          title: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          due_date?: string | null
          evidence?: Json
          id?: string
          kind: string
          location_id?: string | null
          org_id: string
          owner_name?: string | null
          severity?: string
          source_freshness?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          due_date?: string | null
          evidence?: Json
          id?: string
          kind?: string
          location_id?: string | null
          org_id?: string
          owner_name?: string | null
          severity?: string
          source_freshness?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          detail: Json
          id: string
          org_id: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          detail?: Json
          id?: string
          org_id?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          detail?: Json
          id?: string
          org_id?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          id: string
          name: string
          org_id: string
          workspace_id: string | null
        }
        Insert: {
          id?: string
          name: string
          org_id: string
          workspace_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_preferences: {
        Row: {
          channels: string[]
          created_at: string
          daily_enabled: boolean
          delivery_time: string
          detail_level: string
          id: string
          language: string
          locations: string[]
          monthly_enabled: boolean
          org_id: string
          paused: boolean
          quiet_from: string | null
          quiet_to: string | null
          timezone: string
          topics: string[]
          updated_at: string
          user_id: string
          weekly_enabled: boolean
        }
        Insert: {
          channels?: string[]
          created_at?: string
          daily_enabled?: boolean
          delivery_time?: string
          detail_level?: string
          id?: string
          language?: string
          locations?: string[]
          monthly_enabled?: boolean
          org_id: string
          paused?: boolean
          quiet_from?: string | null
          quiet_to?: string | null
          timezone?: string
          topics?: string[]
          updated_at?: string
          user_id: string
          weekly_enabled?: boolean
        }
        Update: {
          channels?: string[]
          created_at?: string
          daily_enabled?: boolean
          delivery_time?: string
          detail_level?: string
          id?: string
          language?: string
          locations?: string[]
          monthly_enabled?: boolean
          org_id?: string
          paused?: boolean
          quiet_from?: string | null
          quiet_to?: string | null
          timezone?: string
          topics?: string[]
          updated_at?: string
          user_id?: string
          weekly_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "briefing_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_snapshots: {
        Row: {
          channel: string
          completeness: string
          created_at: string
          delivery_status: string
          generated_at: string
          id: string
          org_id: string
          payload: Json
          period_from: string
          period_to: string
          role_preset: string | null
          scope_label: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          completeness?: string
          created_at?: string
          delivery_status?: string
          generated_at?: string
          id?: string
          org_id: string
          payload?: Json
          period_from: string
          period_to: string
          role_preset?: string | null
          scope_label?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          completeness?: string
          created_at?: string
          delivery_status?: string
          generated_at?: string
          id?: string
          org_id?: string
          payload?: Json
          period_from?: string
          period_to?: string
          role_preset?: string | null
          scope_label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          id: string
          location_id: string
          net_sales_target: number
          org_id: string
          period_month: string
        }
        Insert: {
          id?: string
          location_id: string
          net_sales_target: number
          org_id: string
          period_month: string
        }
        Update: {
          id?: string
          location_id?: string
          net_sales_target?: number
          org_id?: string
          period_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      canonical_orders: {
        Row: {
          authoritative_source: string
          business_date: string
          channel: string
          charge_total: number
          counts_in_revenue: boolean
          covers: number | null
          customer_total: number
          discount_total: number
          fulfilment_type: string
          guest_id: string | null
          id: string
          location_id: string
          net_sales_ex_tax: number
          occurred_at: string
          org_id: string
          reconciliation_status: Database["public"]["Enums"]["recon_status"]
          refund_total: number
          status: Database["public"]["Enums"]["order_lifecycle"]
          tax_total: number
        }
        Insert: {
          authoritative_source: string
          business_date: string
          channel: string
          charge_total?: number
          counts_in_revenue?: boolean
          covers?: number | null
          customer_total?: number
          discount_total?: number
          fulfilment_type: string
          guest_id?: string | null
          id?: string
          location_id: string
          net_sales_ex_tax?: number
          occurred_at: string
          org_id: string
          reconciliation_status?: Database["public"]["Enums"]["recon_status"]
          refund_total?: number
          status?: Database["public"]["Enums"]["order_lifecycle"]
          tax_total?: number
        }
        Update: {
          authoritative_source?: string
          business_date?: string
          channel?: string
          charge_total?: number
          counts_in_revenue?: boolean
          covers?: number | null
          customer_total?: number
          discount_total?: number
          fulfilment_type?: string
          guest_id?: string | null
          id?: string
          location_id?: string
          net_sales_ex_tax?: number
          occurred_at?: string
          org_id?: string
          reconciliation_status?: Database["public"]["Enums"]["recon_status"]
          refund_total?: number
          status?: Database["public"]["Enums"]["order_lifecycle"]
          tax_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "canonical_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_commitments: {
        Row: {
          committed_amount: number
          currency: string
          effective_from: string
          id: string
          instrument_type: string
          investor_id: string
          legal_entity_id: string
          org_id: string
          ownership_pct: number | null
          share_class: string | null
          tranche_label: string | null
        }
        Insert: {
          committed_amount: number
          currency?: string
          effective_from: string
          id?: string
          instrument_type?: string
          investor_id: string
          legal_entity_id: string
          org_id: string
          ownership_pct?: number | null
          share_class?: string | null
          tranche_label?: string | null
        }
        Update: {
          committed_amount?: number
          currency?: string
          effective_from?: string
          id?: string
          instrument_type?: string
          investor_id?: string
          legal_entity_id?: string
          org_id?: string
          ownership_pct?: number | null
          share_class?: string | null
          tranche_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "capital_commitments_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_commitments_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_commitments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          evidence: Json
          id: string
          org_id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          evidence?: Json
          id?: string
          org_id: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          evidence?: Json
          id?: string
          org_id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          org_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contribution_entries: {
        Row: {
          amount: number
          commitment_id: string
          id: string
          org_id: string
          paid_on: string
          reference: string | null
        }
        Insert: {
          amount: number
          commitment_id: string
          id?: string
          org_id: string
          paid_on: string
          reference?: string | null
        }
        Update: {
          amount?: number
          commitment_id?: string
          id?: string
          org_id?: string
          paid_on?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contribution_entries_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "capital_commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contribution_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_quality_issues: {
        Row: {
          created_at: string
          detail: string
          id: string
          kind: string
          location_id: string | null
          org_id: string
          severity: string
          status: string
        }
        Insert: {
          created_at?: string
          detail: string
          id?: string
          kind: string
          location_id?: string | null
          org_id: string
          severity?: string
          status?: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          kind?: string
          location_id?: string | null
          org_id?: string
          severity?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_issues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_issues_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_entries: {
        Row: {
          amount: number
          commitment_id: string
          id: string
          kind: string
          org_id: string
          paid_on: string
          reference: string | null
        }
        Insert: {
          amount: number
          commitment_id: string
          id?: string
          kind?: string
          org_id: string
          paid_on: string
          reference?: string | null
        }
        Update: {
          amount?: number
          commitment_id?: string
          id?: string
          kind?: string
          org_id?: string
          paid_on?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_entries_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "capital_commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          department: string | null
          display_name: string
          id: string
          joined_on: string | null
          left_on: string | null
          legal_entity_id: string | null
          location_id: string | null
          manager_name: string | null
          org_id: string
          role_title: string | null
          source_ref: string | null
          status: string
        }
        Insert: {
          department?: string | null
          display_name: string
          id?: string
          joined_on?: string | null
          left_on?: string | null
          legal_entity_id?: string | null
          location_id?: string | null
          manager_name?: string | null
          org_id: string
          role_title?: string | null
          source_ref?: string | null
          status?: string
        }
        Update: {
          department?: string | null
          display_name?: string
          id?: string
          joined_on?: string | null
          left_on?: string | null
          legal_entity_id?: string | null
          location_id?: string | null
          manager_name?: string | null
          org_id?: string
          role_title?: string | null
          source_ref?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      external_entity_mappings: {
        Row: {
          effective_from: string
          effective_to: string | null
          external_id: string
          id: string
          location_id: string | null
          org_id: string
          provider: string
        }
        Insert: {
          effective_from?: string
          effective_to?: string | null
          external_id: string
          id?: string
          location_id?: string | null
          org_id: string
          provider: string
        }
        Update: {
          effective_from?: string
          effective_to?: string | null
          external_id?: string
          id?: string
          location_id?: string | null
          org_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_entity_mappings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_entity_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_contacts: {
        Row: {
          consent_source: string | null
          guest_id: string
          id: string
          masked_email: string | null
          masked_phone: string | null
          opted_out_at: string | null
          org_id: string
        }
        Insert: {
          consent_source?: string | null
          guest_id: string
          id?: string
          masked_email?: string | null
          masked_phone?: string | null
          opted_out_at?: string | null
          org_id: string
        }
        Update: {
          consent_source?: string | null
          guest_id?: string
          id?: string
          masked_email?: string | null
          masked_phone?: string | null
          opted_out_at?: string | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_contacts_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guest_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_profiles: {
        Row: {
          behaviour_tag: string | null
          consent_marketing: boolean
          first_seen_on: string | null
          id: string
          is_identifiable: boolean
          label: string
          org_id: string
        }
        Insert: {
          behaviour_tag?: string | null
          consent_marketing?: boolean
          first_seen_on?: string | null
          id?: string
          is_identifiable?: boolean
          label: string
          org_id: string
        }
        Update: {
          behaviour_tag?: string | null
          consent_marketing?: boolean
          first_seen_on?: string | null
          id?: string
          is_identifiable?: boolean
          label?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_reviews: {
        Row: {
          author_alias: string | null
          body: string | null
          created_at: string
          external_id: string | null
          id: string
          is_complaint: boolean
          is_demo: boolean
          location_id: string
          org_id: string
          rating: number | null
          rating_scale: number
          responded_at: string | null
          response_note: string | null
          review_date: string
          sentiment: string
          source: string
          source_label: string
          status: string
          title: string | null
          topics: string[]
          updated_at: string
        }
        Insert: {
          author_alias?: string | null
          body?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          is_complaint?: boolean
          is_demo?: boolean
          location_id: string
          org_id: string
          rating?: number | null
          rating_scale?: number
          responded_at?: string | null
          response_note?: string | null
          review_date: string
          sentiment?: string
          source: string
          source_label?: string
          status?: string
          title?: string | null
          topics?: string[]
          updated_at?: string
        }
        Update: {
          author_alias?: string | null
          body?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          is_complaint?: boolean
          is_demo?: boolean
          location_id?: string
          org_id?: string
          rating?: number | null
          rating_scale?: number
          responded_at?: string | null
          response_note?: string | null
          review_date?: string
          sentiment?: string
          source?: string
          source_label?: string
          status?: string
          title?: string | null
          topics?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_reviews_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_reviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          id: string
          name: string
          org_id: string
          unit: string
        }
        Insert: {
          id?: string
          name: string
          org_id: string
          unit: string
        }
        Update: {
          id?: string
          name?: string
          org_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          api_version: string | null
          auth_type: string
          capability_notes: string | null
          connection_verified: boolean
          created_at: string
          credential_secret_name: string | null
          credentials_saved: boolean
          environment: Database["public"]["Enums"]["workspace_environment"]
          error_summary: string | null
          health: Database["public"]["Enums"]["integration_health"]
          historical_from: string | null
          id: string
          label: string
          last_attempt_at: string | null
          last_success_at: string | null
          legacy_integration_id: string | null
          location_id: string | null
          mode: string
          next_attempt_at: string | null
          org_id: string
          provider_id: string
          records_accepted: number
          records_received: number
          records_rejected: number
          status: Database["public"]["Enums"]["integration_status"]
          sync_cursor: string | null
          updated_at: string
          webhook_secret_name: string | null
          webhook_status: string
          workspace_id: string | null
        }
        Insert: {
          api_version?: string | null
          auth_type?: string
          capability_notes?: string | null
          connection_verified?: boolean
          created_at?: string
          credential_secret_name?: string | null
          credentials_saved?: boolean
          environment?: Database["public"]["Enums"]["workspace_environment"]
          error_summary?: string | null
          health?: Database["public"]["Enums"]["integration_health"]
          historical_from?: string | null
          id?: string
          label: string
          last_attempt_at?: string | null
          last_success_at?: string | null
          legacy_integration_id?: string | null
          location_id?: string | null
          mode?: string
          next_attempt_at?: string | null
          org_id: string
          provider_id: string
          records_accepted?: number
          records_received?: number
          records_rejected?: number
          status?: Database["public"]["Enums"]["integration_status"]
          sync_cursor?: string | null
          updated_at?: string
          webhook_secret_name?: string | null
          webhook_status?: string
          workspace_id?: string | null
        }
        Update: {
          api_version?: string | null
          auth_type?: string
          capability_notes?: string | null
          connection_verified?: boolean
          created_at?: string
          credential_secret_name?: string | null
          credentials_saved?: boolean
          environment?: Database["public"]["Enums"]["workspace_environment"]
          error_summary?: string | null
          health?: Database["public"]["Enums"]["integration_health"]
          historical_from?: string | null
          id?: string
          label?: string
          last_attempt_at?: string | null
          last_success_at?: string | null
          legacy_integration_id?: string | null
          location_id?: string | null
          mode?: string
          next_attempt_at?: string | null
          org_id?: string
          provider_id?: string
          records_accepted?: number
          records_received?: number
          records_rejected?: number
          status?: Database["public"]["Enums"]["integration_status"]
          sync_cursor?: string | null
          updated_at?: string
          webhook_secret_name?: string | null
          webhook_status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_legacy_integration_id_fkey"
            columns: ["legacy_integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_cursors: {
        Row: {
          connection_id: string
          cursor_kind: string
          cursor_value: string | null
          entity_type: string
          id: string
          page_token: string | null
          updated_at: string
          watermark_at: string | null
        }
        Insert: {
          connection_id: string
          cursor_kind?: string
          cursor_value?: string | null
          entity_type: string
          id?: string
          page_token?: string | null
          updated_at?: string
          watermark_at?: string | null
        }
        Update: {
          connection_id?: string
          cursor_kind?: string
          cursor_value?: string | null
          entity_type?: string
          id?: string
          page_token?: string | null
          updated_at?: string
          watermark_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_cursors_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_dead_letter_events: {
        Row: {
          attempts: number
          connection_id: string | null
          created_at: string
          entity_type: string
          external_id: string | null
          failure_reason: string
          id: string
          org_id: string | null
          payload: Json
          replayable: boolean
          replayed_at: string | null
          sync_run_id: string | null
        }
        Insert: {
          attempts?: number
          connection_id?: string | null
          created_at?: string
          entity_type: string
          external_id?: string | null
          failure_reason: string
          id?: string
          org_id?: string | null
          payload?: Json
          replayable?: boolean
          replayed_at?: string | null
          sync_run_id?: string | null
        }
        Update: {
          attempts?: number
          connection_id?: string | null
          created_at?: string
          entity_type?: string
          external_id?: string | null
          failure_reason?: string
          id?: string
          org_id?: string | null
          payload?: Json
          replayable?: boolean
          replayed_at?: string | null
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_dead_letter_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_dead_letter_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_dead_letter_events_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "integration_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_entity_mappings: {
        Row: {
          connection_id: string | null
          created_at: string
          entity_type: string
          external_id: string
          external_name: string | null
          first_seen_at: string
          id: string
          internal_id: string | null
          internal_table: string
          is_primary_source: boolean
          last_seen_at: string
          match_confidence: string
          match_method: string
          org_id: string
          provider_key: string
          raw_status: string | null
          source_created_at: string | null
          source_updated_at: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          entity_type: string
          external_id: string
          external_name?: string | null
          first_seen_at?: string
          id?: string
          internal_id?: string | null
          internal_table: string
          is_primary_source?: boolean
          last_seen_at?: string
          match_confidence?: string
          match_method?: string
          org_id: string
          provider_key: string
          raw_status?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          entity_type?: string
          external_id?: string
          external_name?: string | null
          first_seen_at?: string
          id?: string
          internal_id?: string | null
          internal_table?: string
          is_primary_source?: boolean
          last_seen_at?: string
          match_confidence?: string
          match_method?: string
          org_id?: string
          provider_key?: string
          raw_status?: string | null
          source_created_at?: string | null
          source_updated_at?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_entity_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_entity_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_entity_mappings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_errors: {
        Row: {
          connection_id: string
          entity_type: string | null
          error_code: string | null
          error_message: string
          external_id: string | null
          id: string
          occurred_at: string
          org_id: string
          resolved_at: string | null
          retryable: boolean
          severity: string
          sync_run_id: string | null
        }
        Insert: {
          connection_id: string
          entity_type?: string | null
          error_code?: string | null
          error_message: string
          external_id?: string | null
          id?: string
          occurred_at?: string
          org_id: string
          resolved_at?: string | null
          retryable?: boolean
          severity?: string
          sync_run_id?: string | null
        }
        Update: {
          connection_id?: string
          entity_type?: string | null
          error_code?: string | null
          error_message?: string
          external_id?: string | null
          id?: string
          occurred_at?: string
          org_id?: string
          resolved_at?: string | null
          retryable?: boolean
          severity?: string
          sync_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_errors_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_errors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_errors_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "integration_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_providers: {
        Row: {
          adapter_status: string
          aliases: string[]
          api_version: string | null
          auth_type: string
          category: string
          created_at: string
          display_name: string
          docs_url: string | null
          id: string
          key: string
          owns_domains: string[]
          supports_backfill: boolean
          supports_webhooks: boolean
          updated_at: string
        }
        Insert: {
          adapter_status?: string
          aliases?: string[]
          api_version?: string | null
          auth_type?: string
          category: string
          created_at?: string
          display_name: string
          docs_url?: string | null
          id?: string
          key: string
          owns_domains?: string[]
          supports_backfill?: boolean
          supports_webhooks?: boolean
          updated_at?: string
        }
        Update: {
          adapter_status?: string
          aliases?: string[]
          api_version?: string | null
          auth_type?: string
          category?: string
          created_at?: string
          display_name?: string
          docs_url?: string | null
          id?: string
          key?: string
          owns_domains?: string[]
          supports_backfill?: boolean
          supports_webhooks?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      integration_rate_limits: {
        Row: {
          backoff_until: string | null
          connection_id: string
          consecutive_failures: number
          id: string
          limit_per_window: number | null
          remaining: number | null
          resets_at: string | null
          scope: string
          updated_at: string
          window_seconds: number | null
        }
        Insert: {
          backoff_until?: string | null
          connection_id: string
          consecutive_failures?: number
          id?: string
          limit_per_window?: number | null
          remaining?: number | null
          resets_at?: string | null
          scope?: string
          updated_at?: string
          window_seconds?: number | null
        }
        Update: {
          backoff_until?: string | null
          connection_id?: string
          consecutive_failures?: number
          id?: string
          limit_per_window?: number | null
          remaining?: number | null
          resets_at?: string | null
          scope?: string
          updated_at?: string
          window_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_rate_limits_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_jobs: {
        Row: {
          connection_id: string
          created_at: string
          enabled: boolean
          entity_type: string
          id: string
          job_kind: string
          last_run_at: string | null
          next_run_at: string | null
          org_id: string
          priority: number
          schedule_cron: string | null
          updated_at: string
          window_from: string | null
          window_to: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          enabled?: boolean
          entity_type: string
          id?: string
          job_kind?: string
          last_run_at?: string | null
          next_run_at?: string | null
          org_id: string
          priority?: number
          schedule_cron?: string | null
          updated_at?: string
          window_from?: string | null
          window_to?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          enabled?: boolean
          entity_type?: string
          id?: string
          job_kind?: string
          last_run_at?: string | null
          next_run_at?: string | null
          org_id?: string
          priority?: number
          schedule_cron?: string | null
          updated_at?: string
          window_from?: string | null
          window_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_jobs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_runs: {
        Row: {
          attempt: number
          connection_id: string
          created_at: string
          cursor_after: string | null
          cursor_before: string | null
          duration_ms: number | null
          entity_type: string
          error_summary: string | null
          finished_at: string | null
          id: string
          idempotency_key: string | null
          job_id: string | null
          org_id: string
          records_accepted: number
          records_received: number
          records_rejected: number
          run_kind: string
          started_at: string
          status: Database["public"]["Enums"]["sync_run_status"]
          window_from: string | null
          window_to: string | null
        }
        Insert: {
          attempt?: number
          connection_id: string
          created_at?: string
          cursor_after?: string | null
          cursor_before?: string | null
          duration_ms?: number | null
          entity_type: string
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          org_id: string
          records_accepted?: number
          records_received?: number
          records_rejected?: number
          run_kind?: string
          started_at?: string
          status?: Database["public"]["Enums"]["sync_run_status"]
          window_from?: string | null
          window_to?: string | null
        }
        Update: {
          attempt?: number
          connection_id?: string
          created_at?: string
          cursor_after?: string | null
          cursor_before?: string | null
          duration_ms?: number | null
          entity_type?: string
          error_summary?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          org_id?: string
          records_accepted?: number
          records_received?: number
          records_rejected?: number
          run_kind?: string
          started_at?: string
          status?: Database["public"]["Enums"]["sync_run_status"]
          window_from?: string | null
          window_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "integration_sync_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_sync_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_venue_mappings: {
        Row: {
          confidence: string
          connection_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          external_venue_id: string
          external_venue_name: string | null
          id: string
          location_id: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          confidence?: string
          connection_id: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          external_venue_id: string
          external_venue_name?: string | null
          id?: string
          location_id?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          confidence?: string
          connection_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          external_venue_id?: string
          external_venue_name?: string | null
          id?: string
          location_id?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_venue_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_venue_mappings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_venue_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhook_events: {
        Row: {
          connection_id: string | null
          dedupe_key: string
          event_type: string | null
          external_event_id: string | null
          id: string
          org_id: string | null
          payload: Json
          processed_at: string | null
          processing_status: string
          provider_key: string
          received_at: string
          signature_verified: boolean
        }
        Insert: {
          connection_id?: string | null
          dedupe_key: string
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          org_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider_key: string
          received_at?: string
          signature_verified?: boolean
        }
        Update: {
          connection_id?: string | null
          dedupe_key?: string
          event_type?: string | null
          external_event_id?: string | null
          id?: string
          org_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          provider_key?: string
          received_at?: string
          signature_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhook_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_webhook_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          capability_notes: string | null
          connection_verified: boolean
          credentials_saved: boolean
          data_reconciled: boolean
          dependency_note: string | null
          failure_reason: string | null
          historical_from: string | null
          id: string
          last_success_at: string | null
          location_id: string | null
          mode: string
          next_attempt_at: string | null
          org_id: string
          provider: string
          row_count: number | null
          status: Database["public"]["Enums"]["integration_status"]
        }
        Insert: {
          capability_notes?: string | null
          connection_verified?: boolean
          credentials_saved?: boolean
          data_reconciled?: boolean
          dependency_note?: string | null
          failure_reason?: string | null
          historical_from?: string | null
          id?: string
          last_success_at?: string | null
          location_id?: string | null
          mode?: string
          next_attempt_at?: string | null
          org_id: string
          provider: string
          row_count?: number | null
          status?: Database["public"]["Enums"]["integration_status"]
        }
        Update: {
          capability_notes?: string | null
          connection_verified?: boolean
          credentials_saved?: boolean
          data_reconciled?: boolean
          dependency_note?: string | null
          failure_reason?: string | null
          historical_from?: string | null
          id?: string
          last_success_at?: string | null
          location_id?: string | null
          mode?: string
          next_attempt_at?: string | null
          org_id?: string
          provider?: string
          row_count?: number | null
          status?: Database["public"]["Enums"]["integration_status"]
        }
        Relationships: [
          {
            foreignKeyName: "integrations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      investors: {
        Row: {
          contact_note: string | null
          display_name: string
          id: string
          org_id: string
        }
        Insert: {
          contact_note?: string | null
          display_name: string
          id?: string
          org_id: string
        }
        Update: {
          contact_note?: string | null
          display_name?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_entities: {
        Row: {
          id: string
          jurisdiction: string | null
          name: string
          org_id: string
          workspace_id: string | null
        }
        Insert: {
          id?: string
          jurisdiction?: string | null
          name: string
          org_id: string
          workspace_id?: string | null
        }
        Update: {
          id?: string
          jurisdiction?: string | null
          name?: string
          org_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_entities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_entities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          brand_id: string
          business_day_cutoff: string
          city: string | null
          currency: string
          id: string
          legal_entity_id: string | null
          manager_name: string | null
          name: string
          opened_on: string | null
          org_id: string
          timezone: string
          workspace_id: string | null
        }
        Insert: {
          brand_id: string
          business_day_cutoff?: string
          city?: string | null
          currency?: string
          id?: string
          legal_entity_id?: string | null
          manager_name?: string | null
          name: string
          opened_on?: string | null
          org_id: string
          timezone?: string
          workspace_id?: string | null
        }
        Update: {
          brand_id?: string
          business_day_cutoff?: string
          city?: string | null
          currency?: string
          id?: string
          legal_entity_id?: string | null
          manager_name?: string | null
          name?: string
          opened_on?: string | null
          org_id?: string
          timezone?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          active: boolean
          created_at: string
          id: string
          org_id: string
          role_preset: Database["public"]["Enums"]["role_preset"]
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          org_id: string
          role_preset: Database["public"]["Enums"]["role_preset"]
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          org_id?: string
          role_preset?: Database["public"]["Enums"]["role_preset"]
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_definitions: {
        Row: {
          formula: string
          key: string
          label: string
          notes: string | null
          version: number
        }
        Insert: {
          formula: string
          key: string
          label: string
          notes?: string | null
          version?: number
        }
        Update: {
          formula?: string
          key?: string
          label?: string
          notes?: string | null
          version?: number
        }
        Relationships: []
      }
      monitoring_rule_events: {
        Row: {
          action_id: string | null
          baseline_value: number | null
          channel: string
          created_at: string
          dedupe_key: string
          delivery_status: string
          detail: Json
          id: string
          observed_value: number | null
          occurred_at: string
          org_id: string
          rule_id: string
          sample_size: number | null
        }
        Insert: {
          action_id?: string | null
          baseline_value?: number | null
          channel?: string
          created_at?: string
          dedupe_key: string
          delivery_status?: string
          detail?: Json
          id?: string
          observed_value?: number | null
          occurred_at?: string
          org_id: string
          rule_id: string
          sample_size?: number | null
        }
        Update: {
          action_id?: string | null
          baseline_value?: number | null
          channel?: string
          created_at?: string
          dedupe_key?: string
          delivery_status?: string
          detail?: Json
          id?: string
          observed_value?: number | null
          occurred_at?: string
          org_id?: string
          rule_id?: string
          sample_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_rule_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "rosy_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_rule_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_rule_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "monitoring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_rules: {
        Row: {
          baseline: string
          channel: string
          cooldown_hours: number
          created_at: string
          created_by: string
          escalate_after_hours: number | null
          frequency: string
          id: string
          last_evaluated_at: string | null
          last_triggered_at: string | null
          metric: string
          min_sample: number
          name: string
          operator: string
          org_id: string
          recipients: string[]
          request_text: string | null
          scope_ref: string | null
          scope_type: string
          status: Database["public"]["Enums"]["monitoring_rule_status"]
          threshold: number | null
          updated_at: string
        }
        Insert: {
          baseline?: string
          channel?: string
          cooldown_hours?: number
          created_at?: string
          created_by: string
          escalate_after_hours?: number | null
          frequency?: string
          id?: string
          last_evaluated_at?: string | null
          last_triggered_at?: string | null
          metric: string
          min_sample?: number
          name: string
          operator?: string
          org_id: string
          recipients?: string[]
          request_text?: string | null
          scope_ref?: string | null
          scope_type?: string
          status?: Database["public"]["Enums"]["monitoring_rule_status"]
          threshold?: number | null
          updated_at?: string
        }
        Update: {
          baseline?: string
          channel?: string
          cooldown_hours?: number
          created_at?: string
          created_by?: string
          escalate_after_hours?: number | null
          frequency?: string
          id?: string
          last_evaluated_at?: string | null
          last_triggered_at?: string | null
          metric?: string
          min_sample?: number
          name?: string
          operator?: string
          org_id?: string
          recipients?: string[]
          request_text?: string | null
          scope_ref?: string | null
          scope_type?: string
          status?: Database["public"]["Enums"]["monitoring_rule_status"]
          threshold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_lines: {
        Row: {
          discount_amount: number
          gross_ex_tax: number
          id: string
          net_ex_tax: number
          order_id: string
          org_id: string
          product_id: string | null
          quantity: number
        }
        Insert: {
          discount_amount?: number
          gross_ex_tax?: number
          id?: string
          net_ex_tax?: number
          order_id: string
          org_id: string
          product_id?: string | null
          quantity?: number
        }
        Update: {
          discount_amount?: number
          gross_ex_tax?: number
          id?: string
          net_ex_tax?: number
          order_id?: string
          org_id?: string
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "canonical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mart_menu_engineering"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mart_menu_engineering_daily"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_source_links: {
        Row: {
          external_id: string
          id: string
          ingested_at: string
          order_id: string
          org_id: string
          provider: string
          raw_status: string | null
        }
        Insert: {
          external_id: string
          id?: string
          ingested_at?: string
          order_id: string
          org_id: string
          provider: string
          raw_status?: string | null
        }
        Update: {
          external_id?: string
          id?: string
          ingested_at?: string
          order_id?: string
          org_id?: string
          provider?: string
          raw_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_source_links_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "canonical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_source_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          base_currency: string
          created_at: string
          environment: Database["public"]["Enums"]["workspace_environment"]
          id: string
          is_demo: boolean
          name: string
          workspace_id: string | null
        }
        Insert: {
          base_currency?: string
          created_at?: string
          environment?: Database["public"]["Enums"]["workspace_environment"]
          id?: string
          is_demo?: boolean
          name: string
          workspace_id?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string
          environment?: Database["public"]["Enums"]["workspace_environment"]
          id?: string
          is_demo?: boolean
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_entries: {
        Row: {
          amount: number
          id: string
          order_id: string
          org_id: string
          tender: string
        }
        Insert: {
          amount: number
          id?: string
          order_id: string
          org_id: string
          tender: string
        }
        Update: {
          amount?: number
          id?: string
          order_id?: string
          org_id?: string
          tender?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "canonical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          id: string
          is_available: boolean
          location_id: string
          name: string
          org_id: string
          pos_item_id: string
        }
        Insert: {
          category: string
          id?: string
          is_available?: boolean
          location_id: string
          name: string
          org_id: string
          pos_item_id: string
        }
        Update: {
          category?: string
          id?: string
          is_available?: boolean
          location_id?: string
          name?: string
          org_id?: string
          pos_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      published_reports: {
        Row: {
          body: string | null
          id: string
          legal_entity_id: string | null
          org_id: string
          period_close_status: string
          period_end: string | null
          period_start: string | null
          published_at: string | null
          revision: number
          title: string
        }
        Insert: {
          body?: string | null
          id?: string
          legal_entity_id?: string | null
          org_id: string
          period_close_status?: string
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          revision?: number
          title: string
        }
        Update: {
          body?: string | null
          id?: string
          legal_entity_id?: string | null
          org_id?: string
          period_close_status?: string
          period_end?: string | null
          period_start?: string | null
          published_at?: string | null
          revision?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_reports_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_versions: {
        Row: {
          effective_from: string
          id: string
          ingredient_cost: number | null
          org_id: string
          product_id: string
          source: string
          version: number
        }
        Insert: {
          effective_from: string
          id?: string
          ingredient_cost?: number | null
          org_id: string
          product_id: string
          source?: string
          version?: number
        }
        Update: {
          effective_from?: string
          id?: string
          ingredient_cost?: number | null
          org_id?: string
          product_id?: string
          source?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mart_menu_engineering"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mart_menu_engineering_daily"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "recipe_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_tasks: {
        Row: {
          created_at: string
          document_id: string
          due_date: string
          id: string
          notes: string | null
          org_id: string
          owner_name: string | null
          status: string
          threshold_days: number
        }
        Insert: {
          created_at?: string
          document_id: string
          due_date: string
          id?: string
          notes?: string | null
          org_id: string
          owner_name?: string | null
          status?: string
          threshold_days: number
        }
        Update: {
          created_at?: string
          document_id?: string
          due_date?: string
          id?: string
          notes?: string | null
          org_id?: string
          owner_name?: string | null
          status?: string
          threshold_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "renewal_tasks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "restricted_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          business_date: string
          expected_covers: number
          guest_id: string | null
          id: string
          location_id: string
          match_confidence: string
          matched_order_id: string | null
          org_id: string
          party_size: number
          scheduled_at: string
          seated_covers: number | null
          source: string
          status: string
        }
        Insert: {
          business_date: string
          expected_covers: number
          guest_id?: string | null
          id?: string
          location_id: string
          match_confidence?: string
          matched_order_id?: string | null
          org_id: string
          party_size: number
          scheduled_at: string
          seated_covers?: number | null
          source?: string
          status: string
        }
        Update: {
          business_date?: string
          expected_covers?: number
          guest_id?: string | null
          id?: string
          location_id?: string
          match_confidence?: string
          matched_order_id?: string | null
          org_id?: string
          party_size?: number
          scheduled_at?: string
          seated_covers?: number | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guest_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_matched_order_id_fkey"
            columns: ["matched_order_id"]
            isOneToOne: false
            referencedRelation: "canonical_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      restricted_documents: {
        Row: {
          doc_type: string
          document_ref: string | null
          employee_id: string
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_authority: string | null
          jurisdiction: string | null
          masked_number: string | null
          org_id: string
          owner_name: string | null
          renewal_target_date: string | null
          source_timestamp: string | null
          status: Database["public"]["Enums"]["doc_status"]
          verification_status: string
          verified_legal_deadline: string | null
        }
        Insert: {
          doc_type: string
          document_ref?: string | null
          employee_id: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          jurisdiction?: string | null
          masked_number?: string | null
          org_id: string
          owner_name?: string | null
          renewal_target_date?: string | null
          source_timestamp?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          verification_status?: string
          verified_legal_deadline?: string | null
        }
        Update: {
          doc_type?: string
          document_ref?: string | null
          employee_id?: string
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          jurisdiction?: string | null
          masked_number?: string | null
          org_id?: string
          owner_name?: string | null
          renewal_target_date?: string | null
          source_timestamp?: string | null
          status?: Database["public"]["Enums"]["doc_status"]
          verification_status?: string
          verified_legal_deadline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restricted_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restricted_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: string
          role_preset: Database["public"]["Enums"]["role_preset"]
        }
        Insert: {
          permission: string
          role_preset: Database["public"]["Enums"]["role_preset"]
        }
        Update: {
          permission?: string
          role_preset?: Database["public"]["Enums"]["role_preset"]
        }
        Relationships: []
      }
      rosy_actions: {
        Row: {
          baseline_note: string | null
          baseline_value: number | null
          confounders: string | null
          created_at: string
          created_by: string | null
          department: string | null
          due_date: string | null
          evaluation_window: string | null
          evidence: Json
          id: string
          legal_entity_id: string | null
          location_id: string | null
          org_id: string
          outcome_note: string | null
          outcome_review_date: string | null
          outcome_value: number | null
          outcome_verdict: string | null
          owner_name: string | null
          owner_user_id: string | null
          severity: string
          snoozed_until: string | null
          source_kind: string
          source_ref: string | null
          status: Database["public"]["Enums"]["action_status"]
          success_metric: string | null
          title: string
          updated_at: string
          why_it_matters: string | null
        }
        Insert: {
          baseline_note?: string | null
          baseline_value?: number | null
          confounders?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          due_date?: string | null
          evaluation_window?: string | null
          evidence?: Json
          id?: string
          legal_entity_id?: string | null
          location_id?: string | null
          org_id: string
          outcome_note?: string | null
          outcome_review_date?: string | null
          outcome_value?: number | null
          outcome_verdict?: string | null
          owner_name?: string | null
          owner_user_id?: string | null
          severity?: string
          snoozed_until?: string | null
          source_kind?: string
          source_ref?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          success_metric?: string | null
          title: string
          updated_at?: string
          why_it_matters?: string | null
        }
        Update: {
          baseline_note?: string | null
          baseline_value?: number | null
          confounders?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          due_date?: string | null
          evaluation_window?: string | null
          evidence?: Json
          id?: string
          legal_entity_id?: string | null
          location_id?: string | null
          org_id?: string
          outcome_note?: string | null
          outcome_review_date?: string | null
          outcome_value?: number | null
          outcome_verdict?: string | null
          owner_name?: string | null
          owner_user_id?: string | null
          severity?: string
          snoozed_until?: string | null
          source_kind?: string
          source_ref?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          success_metric?: string | null
          title?: string
          updated_at?: string
          why_it_matters?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rosy_actions_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosy_actions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rosy_actions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          page: string
          params: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          page: string
          params?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          page?: string
          params?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_grants: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          membership_id: string
          org_id: string
          ref_id: string | null
          scope_type: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_id: string
          org_id: string
          ref_id?: string | null
          scope_type: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          membership_id?: string
          org_id?: string
          ref_id?: string | null
          scope_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_grants_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_grants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_snapshots: {
        Row: {
          as_of_date: string
          days_cover: number | null
          expiry_date: string | null
          id: string
          ingredient_id: string
          location_id: string
          org_id: string
          quantity: number
          reorder_threshold: number | null
          source: string
          unit: string
          value_aed: number
        }
        Insert: {
          as_of_date: string
          days_cover?: number | null
          expiry_date?: string | null
          id?: string
          ingredient_id: string
          location_id: string
          org_id: string
          quantity: number
          reorder_threshold?: number | null
          source?: string
          unit: string
          value_aed: number
        }
        Update: {
          as_of_date?: string
          days_cover?: number | null
          expiry_date?: string | null
          id?: string
          ingredient_id?: string
          location_id?: string
          org_id?: string
          quantity?: number
          reorder_threshold?: number | null
          source?: string
          unit?: string
          value_aed?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_snapshots_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      valuations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assumptions: string | null
          basis: string | null
          currency: string
          equity_value: number | null
          evidence_ref: string | null
          id: string
          legal_entity_id: string
          method: string | null
          org_id: string
          per_share_value: number | null
          prepared_by: string | null
          published_at: string | null
          share_class: string | null
          status: Database["public"]["Enums"]["valuation_status"]
          valuation_date: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: string | null
          basis?: string | null
          currency?: string
          equity_value?: number | null
          evidence_ref?: string | null
          id?: string
          legal_entity_id: string
          method?: string | null
          org_id: string
          per_share_value?: number | null
          prepared_by?: string | null
          published_at?: string | null
          share_class?: string | null
          status?: Database["public"]["Enums"]["valuation_status"]
          valuation_date: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assumptions?: string | null
          basis?: string | null
          currency?: string
          equity_value?: number | null
          evidence_ref?: string | null
          id?: string
          legal_entity_id?: string
          method?: string | null
          org_id?: string
          per_share_value?: number | null
          prepared_by?: string | null
          published_at?: string | null
          share_class?: string | null
          status?: Database["public"]["Enums"]["valuation_status"]
          valuation_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuations_legal_entity_id_fkey"
            columns: ["legal_entity_id"]
            isOneToOne: false
            referencedRelation: "legal_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_entries: {
        Row: {
          id: string
          ingredient_id: string | null
          location_id: string
          occurred_on: string
          org_id: string
          quantity: number
          reason: string
          unit: string
          value_aed: number
        }
        Insert: {
          id?: string
          ingredient_id?: string | null
          location_id: string
          occurred_on: string
          org_id: string
          quantity: number
          reason: string
          unit: string
          value_aed: number
        }
        Update: {
          id?: string
          ingredient_id?: string | null
          location_id?: string
          occurred_on?: string
          org_id?: string
          quantity?: number
          reason?: string
          unit?: string
          value_aed?: number
        }
        Relationships: [
          {
            foreignKeyName: "waste_entries_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_entries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          base_currency: string
          created_at: string
          environment: Database["public"]["Enums"]["workspace_environment"]
          id: string
          is_active: boolean
          name: string
          notes: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          environment?: Database["public"]["Enums"]["workspace_environment"]
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          environment?: Database["public"]["Enums"]["workspace_environment"]
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      mart_menu_engineering: {
        Row: {
          brand_name: string | null
          business_date: string | null
          category: string | null
          channel: string | null
          cost_effective_from: string | null
          cost_source: string | null
          day_type: string | null
          daypart: string | null
          discounts: number | null
          fulfilment_type: string | null
          gross_revenue: number | null
          is_available: boolean | null
          item_name: string | null
          location_id: string | null
          location_name: string | null
          net_revenue: number | null
          order_id: string | null
          order_line_id: string | null
          org_id: string | null
          pos_item_id: string | null
          product_id: string | null
          recipe_cost_per_unit: number | null
          reconciliation_status:
            | Database["public"]["Enums"]["recon_status"]
            | null
          source_system: string | null
          units: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canonical_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "canonical_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      mart_menu_engineering_daily: {
        Row: {
          brand_name: string | null
          business_date: string | null
          category: string | null
          channel: string | null
          cost_effective_from: string | null
          cost_source: string | null
          day_type: string | null
          daypart: string | null
          discounts: number | null
          fulfilment_type: string | null
          gross_revenue: number | null
          is_available: boolean | null
          item_name: string | null
          location_id: string | null
          location_name: string | null
          net_revenue: number | null
          org_id: string | null
          pos_item_id: string | null
          product_id: string | null
          recipe_cost_per_unit: number | null
          source_system: string | null
          units: number | null
        }
        Relationships: [
          {
            foreignKeyName: "canonical_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canonical_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_location_access: { Args: { _loc: string }; Returns: boolean }
      has_permission: { Args: { _perm: string }; Returns: boolean }
      integration_upsert_mapping: {
        Args: {
          p_connection?: string
          p_entity_type: string
          p_external_id: string
          p_external_name?: string
          p_internal_id: string
          p_internal_table: string
          p_is_primary?: boolean
          p_match_confidence?: string
          p_match_method?: string
          p_org: string
          p_provider_key: string
        }
        Returns: string
      }
      is_member: { Args: { _org: string }; Returns: boolean }
      my_entitled_entity_ids: { Args: never; Returns: string[] }
      my_investor_ids: { Args: never; Returns: string[] }
      refresh_mart_menu_engineering_daily: { Args: never; Returns: undefined }
      rosy_channel_mix: {
        Args: { p_from: string; p_locations?: string[]; p_to: string }
        Returns: {
          channel: string
          fulfilment_type: string
          net_sales: number
          orders: number
        }[]
      }
      rosy_channel_mix_by_location: {
        Args: { p_from: string; p_locations?: string[]; p_to: string }
        Returns: {
          brand_name: string
          channel: string
          covers: number
          fulfilment_type: string
          location_id: string
          location_name: string
          net_sales: number
          orders: number
        }[]
      }
      rosy_demand_heatmap: {
        Args: { p_from: string; p_locations?: string[]; p_to: string }
        Returns: {
          hour: number
          reservations: number
          seated_covers: number
          weekday: number
        }[]
      }
      rosy_eod_by_location: {
        Args: { p_from: string; p_locations?: string[]; p_to: string }
        Returns: {
          amount: number
          amount_is_null: boolean
          brand_name: string
          line_order: number
          location_id: string
          location_name: string
          name: string
          quantity: number
          section: string
          section_order: number
        }[]
      }
      rosy_guest_cohorts: {
        Args: { p_from: string; p_locations?: string[]; p_to: string }
        Returns: {
          cancellations: number
          expected_covers: number
          identifiable_contacts: number
          identification_coverage_pct: number
          matched_reservations: number
          no_show_rate: number
          no_shows: number
          repeat_rate: number
          reservations: number
          returning_contacts: number
          seated_covers: number
          unmatched_seated: number
        }[]
      }
      rosy_inventory_risk: {
        Args: { p_locations?: string[] }
        Returns: {
          as_of_date: string
          days_cover: number
          expiry_date: string
          ingredient_id: string
          ingredient_name: string
          location_id: string
          location_name: string
          low_stock: boolean
          quantity: number
          reorder_threshold: number
          source: string
          unit: string
          value_aed: number
        }[]
      }
      rosy_menu_engineering: {
        Args: {
          p_categories?: string[]
          p_channels?: string[]
          p_consolidated?: boolean
          p_day_type?: string
          p_dayparts?: string[]
          p_fixed_threshold?: number
          p_from: string
          p_fulfilment?: string[]
          p_locations?: string[]
          p_min_days?: number
          p_min_units?: number
          p_peer_scope?: string
          p_pop_factor?: number
          p_prev_from?: string
          p_prev_to?: string
          p_profit_method?: string
          p_to: string
        }
        Returns: {
          active_days: number
          avg_price: number
          brand_name: string
          category: string
          confidence: string
          contribution_pct: number
          contribution_per_unit: number
          cost_coverage_pct: number
          cost_effective_from: string
          cost_source: string
          discounts: number
          exclusion_reason: string
          first_sale: string
          item_key: string
          item_name: string
          last_sale: string
          location_id: string
          location_name: string
          mix_pct: number
          net_revenue: number
          peer_items: number
          peer_label: string
          popularity_threshold_pct: number
          pos_item_id: string
          prev_avg_price: number
          prev_contribution_per_unit: number
          prev_mix_pct: number
          prev_quadrant: string
          prev_recipe_cost: number
          prev_total_contribution: number
          prev_units: number
          product_id: string
          profit_method: string
          profit_threshold: number
          quadrant: string
          recipe_cost: number
          source_systems: string
          total_contribution: number
          units: number
        }[]
      }
      rosy_menu_engineering_period: {
        Args: {
          p_categories?: string[]
          p_channels?: string[]
          p_consolidated?: boolean
          p_day_type?: string
          p_dayparts?: string[]
          p_fixed_threshold?: number
          p_from: string
          p_fulfilment?: string[]
          p_locations?: string[]
          p_min_days?: number
          p_min_units?: number
          p_peer_scope?: string
          p_pop_factor?: number
          p_profit_method?: string
          p_to: string
        }
        Returns: {
          active_days: number
          avg_price: number
          brand_name: string
          category: string
          confidence: string
          contribution_pct: number
          contribution_per_unit: number
          cost_coverage_pct: number
          cost_effective_from: string
          cost_source: string
          discounts: number
          exclusion_reason: string
          first_sale: string
          item_key: string
          item_name: string
          last_sale: string
          location_id: string
          location_name: string
          mix_pct: number
          net_revenue: number
          peer_items: number
          peer_label: string
          popularity_threshold_pct: number
          pos_item_id: string
          product_id: string
          profit_method: string
          profit_threshold: number
          quadrant: string
          recipe_cost: number
          source_systems: string
          total_contribution: number
          units: number
        }[]
      }
      rosy_menu_item_channels: {
        Args: { p_from: string; p_product: string; p_to: string }
        Returns: {
          avg_price: number
          channel: string
          contribution_per_unit: number
          fulfilment_type: string
          net_revenue: number
          recipe_cost: number
          units: number
        }[]
      }
      rosy_menu_item_trend: {
        Args: {
          p_from: string
          p_locations?: string[]
          p_product: string
          p_to: string
        }
        Returns: {
          avg_price: number
          business_date: string
          contribution_per_unit: number
          net_revenue: number
          recipe_cost: number
          total_contribution: number
          units: number
        }[]
      }
      rosy_menu_item_venues: {
        Args: {
          p_from: string
          p_item_name: string
          p_locations?: string[]
          p_to: string
        }
        Returns: {
          avg_price: number
          brand_name: string
          category_mix_pct: number
          contribution_per_unit: number
          location_id: string
          location_name: string
          net_revenue: number
          recipe_cost: number
          units: number
        }[]
      }
      rosy_menu_performance: {
        Args: { p_from: string; p_locations?: string[]; p_to: string }
        Returns: {
          available: boolean
          avg_price: number
          category: string
          contribution_pct: number
          contribution_per_unit: number
          discounts: number
          item_name: string
          location_id: string
          location_name: string
          margin_available: boolean
          net_revenue: number
          pos_item_id: string
          product_id: string
          recipe_cost: number
          sales_mix_pct: number
          units: number
        }[]
      }
      rosy_my_investments: {
        Args: never
        Returns: {
          commitment_id: string
          committed: number
          distributions: number
          distributions_dividend: number
          distributions_return_of_capital: number
          entity_name: string
          equity_value: number
          funded: number
          indicative_stake_value: number
          instrument_type: string
          investor_name: string
          ownership_pct: number
          share_class: string
          stake_value_note: string
          unfunded: number
          valuation_date: string
          valuation_status: string
        }[]
      }
      rosy_renewal_queue: {
        Args: { p_days?: number }
        Returns: {
          days_to_expiry: number
          doc_type: string
          document_id: string
          employee_name: string
          expiry_date: string
          location_name: string
          masked_number: string
          owner_name: string
          status: Database["public"]["Enums"]["doc_status"]
          task_due_date: string
          task_status: string
          task_threshold: number
          verification_status: string
        }[]
      }
      rosy_sales_summary: {
        Args: { p_from: string; p_locations?: string[]; p_to: string }
        Returns: {
          aov: number
          cancelled_orders: number
          charges: number
          cover_coverage_pct: number
          covers: number
          customer_total: number
          discounts: number
          excluded_amount: number
          excluded_orders: number
          matched_covers: number
          matched_sales: number
          net_sales: number
          orders: number
          refunds: number
          spend_per_cover: number
          tax: number
        }[]
      }
      rosy_sales_trend: {
        Args: { p_from: string; p_locations?: string[]; p_to: string }
        Returns: {
          business_date: string
          net_sales: number
          orders: number
        }[]
      }
      rosy_scope_locations: {
        Args: { _locations?: string[]; _perm: string }
        Returns: string[]
      }
      rosy_venue_comparison: {
        Args: {
          p_from: string
          p_prev_from: string
          p_prev_to: string
          p_to: string
        }
        Returns: {
          aov: number
          brand_name: string
          comparable: boolean
          covers: number
          excluded_orders: number
          growth_pct: number
          last_source_refresh: string
          location_id: string
          location_name: string
          net_sales: number
          opened_on: string
          orders: number
          prev_net_sales: number
          recipe_coverage_pct: number
          target: number
          theoretical_cost_pct: number
          waste_cost: number
        }[]
      }
    }
    Enums: {
      action_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "blocked"
        | "completed"
        | "under_review"
        | "closed"
      alert_status: "open" | "acknowledged" | "snoozed" | "resolved"
      doc_status:
        | "valid"
        | "upcoming"
        | "action_required"
        | "in_progress"
        | "submitted"
        | "renewed"
        | "expired"
        | "verification_needed"
        | "waived"
      integration_health:
        | "unknown"
        | "healthy"
        | "degraded"
        | "failing"
        | "disabled"
      integration_status:
        | "demo"
        | "not_configured"
        | "pending_access"
        | "testing"
        | "healthy"
        | "syncing"
        | "partial"
        | "stale"
        | "expired_credentials"
        | "failed"
      monitoring_rule_status: "draft" | "active" | "paused" | "archived"
      order_lifecycle:
        | "open"
        | "completed"
        | "cancelled"
        | "rejected"
        | "refunded"
        | "partially_refunded"
      recon_status:
        | "single_source"
        | "matched"
        | "duplicate_excluded"
        | "unmatched"
        | "review"
      role_preset:
        | "leadership"
        | "finance"
        | "investor_relations"
        | "restaurant_manager"
        | "inventory_procurement"
        | "marketing"
        | "hr_pro"
        | "investor"
        | "tech_admin"
      sync_run_status:
        | "queued"
        | "running"
        | "succeeded"
        | "partial"
        | "failed"
        | "cancelled"
      valuation_status: "draft" | "review" | "approved" | "published"
      workspace_environment: "demo" | "sandbox" | "production"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_status: [
        "open",
        "assigned",
        "in_progress",
        "blocked",
        "completed",
        "under_review",
        "closed",
      ],
      alert_status: ["open", "acknowledged", "snoozed", "resolved"],
      doc_status: [
        "valid",
        "upcoming",
        "action_required",
        "in_progress",
        "submitted",
        "renewed",
        "expired",
        "verification_needed",
        "waived",
      ],
      integration_health: [
        "unknown",
        "healthy",
        "degraded",
        "failing",
        "disabled",
      ],
      integration_status: [
        "demo",
        "not_configured",
        "pending_access",
        "testing",
        "healthy",
        "syncing",
        "partial",
        "stale",
        "expired_credentials",
        "failed",
      ],
      monitoring_rule_status: ["draft", "active", "paused", "archived"],
      order_lifecycle: [
        "open",
        "completed",
        "cancelled",
        "rejected",
        "refunded",
        "partially_refunded",
      ],
      recon_status: [
        "single_source",
        "matched",
        "duplicate_excluded",
        "unmatched",
        "review",
      ],
      role_preset: [
        "leadership",
        "finance",
        "investor_relations",
        "restaurant_manager",
        "inventory_procurement",
        "marketing",
        "hr_pro",
        "investor",
        "tech_admin",
      ],
      sync_run_status: [
        "queued",
        "running",
        "succeeded",
        "partial",
        "failed",
        "cancelled",
      ],
      valuation_status: ["draft", "review", "approved", "published"],
      workspace_environment: ["demo", "sandbox", "production"],
    },
  },
} as const
