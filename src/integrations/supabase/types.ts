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
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          total_documents_sent: number
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          label: string
          last_used_at?: string | null
          revoked_at?: string | null
          total_documents_sent?: number
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          total_documents_sent?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          created_at: string
          detail: Json | null
          event: string
          id: string
          outbox_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event: string
          id?: string
          outbox_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event?: string
          id?: string
          outbox_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_outbox_id_fkey"
            columns: ["outbox_id"]
            isOneToOne: false
            referencedRelation: "outbox"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_status: {
        Row: {
          id: number
          last_connected_at: string | null
          qr_code: string | null
          sidecar_last_heartbeat_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          id?: number
          last_connected_at?: string | null
          qr_code?: string | null
          sidecar_last_heartbeat_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          id?: number
          last_connected_at?: string | null
          qr_code?: string | null
          sidecar_last_heartbeat_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      emudhra_credentials: {
        Row: {
          api_key: string | null
          api_secret: string | null
          id: number
          last_rotated_at: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          id?: number
          last_rotated_at?: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          id?: number
          last_rotated_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      outbox: {
        Row: {
          api_key_id: string | null
          attempts: number
          created_at: string
          customer_name: string | null
          customer_phone: string
          delivered_at: string | null
          id: string
          idempotency_key: string
          last_error: string | null
          merge_data: Json | null
          password_override: string | null
          password_protected: boolean
          raw_pdf_url: string | null
          read_at: string | null
          sent_at: string | null
          signed_pdf_hash: string | null
          source: string
          status: string
          template_id: string | null
          template_version: number | null
          timestamp_token: string | null
          updated_at: string
        }
        Insert: {
          api_key_id?: string | null
          attempts?: number
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          delivered_at?: string | null
          id?: string
          idempotency_key: string
          last_error?: string | null
          merge_data?: Json | null
          password_override?: string | null
          password_protected?: boolean
          raw_pdf_url?: string | null
          read_at?: string | null
          sent_at?: string | null
          signed_pdf_hash?: string | null
          source: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          timestamp_token?: string | null
          updated_at?: string
        }
        Update: {
          api_key_id?: string | null
          attempts?: number
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          delivered_at?: string | null
          id?: string
          idempotency_key?: string
          last_error?: string | null
          merge_data?: Json | null
          password_override?: string | null
          password_protected?: boolean
          raw_pdf_url?: string | null
          read_at?: string | null
          sent_at?: string | null
          signed_pdf_hash?: string | null
          source?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          timestamp_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbox_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          default_sender_label: string | null
          emudhra_enabled: boolean
          id: number
          lock_pdfs_enabled: boolean
          password_fixed_value: string | null
          password_rule: string
          retention_years: number
          updated_at: string
        }
        Insert: {
          default_sender_label?: string | null
          emudhra_enabled?: boolean
          id?: number
          lock_pdfs_enabled?: boolean
          password_fixed_value?: string | null
          password_rule?: string
          retention_years?: number
          updated_at?: string
        }
        Update: {
          default_sender_label?: string | null
          emudhra_enabled?: boolean
          id?: number
          lock_pdfs_enabled?: boolean
          password_fixed_value?: string | null
          password_rule?: string
          retention_years?: number
          updated_at?: string
        }
        Relationships: []
      }
      system_health: {
        Row: {
          emudhra_circuit_state: string
          emudhra_consecutive_failures: number
          emudhra_last_failure_at: string | null
          id: number
          queue_depth: number
          updated_at: string
        }
        Insert: {
          emudhra_circuit_state?: string
          emudhra_consecutive_failures?: number
          emudhra_last_failure_at?: string | null
          id?: number
          queue_depth?: number
          updated_at?: string
        }
        Update: {
          emudhra_circuit_state?: string
          emudhra_consecutive_failures?: number
          emudhra_last_failure_at?: string | null
          id?: number
          queue_depth?: number
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          active: boolean
          created_at: string
          fields_schema: Json | null
          file_url: string
          id: string
          name: string
          template_type: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          fields_schema?: Json | null
          file_url: string
          id?: string
          name: string
          template_type?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          fields_schema?: Json | null
          file_url?: string
          id?: string
          name?: string
          template_type?: string
          version?: number
        }
        Relationships: []
      }
      whatsapp_sessions: {
        Row: {
          created_at: string
          data: string
          id: string
        }
        Insert: {
          created_at?: string
          data: string
          id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const
