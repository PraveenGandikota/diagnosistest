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
      campuses: {
        Row: {
          admin_access_code: string
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          admin_access_code: string
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          admin_access_code?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      levels: {
        Row: {
          created_at: string
          id: string
          name: string
          skill_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          skill_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          skill_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "levels_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          code: string
          correct_idx: number
          created_at: string
          explanation: string
          id: string
          kc: string
          kc_name: string
          level_id: string | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
          quiz_name: string
          quiz_number: number
          skill_id: string | null
          sub_topic: string
          topic: string
          type: string
          wrong_a: string
          wrong_b: string
          wrong_c: string
        }
        Insert: {
          code?: string
          correct_idx: number
          created_at?: string
          explanation?: string
          id?: string
          kc: string
          kc_name: string
          level_id?: string | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question: string
          quiz_name?: string
          quiz_number?: number
          skill_id?: string | null
          sub_topic?: string
          topic?: string
          type: string
          wrong_a?: string
          wrong_b?: string
          wrong_c?: string
        }
        Update: {
          code?: string
          correct_idx?: number
          created_at?: string
          explanation?: string
          id?: string
          kc?: string
          kc_name?: string
          level_id?: string | null
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question?: string
          quiz_name?: string
          quiz_number?: number
          skill_id?: string | null
          sub_topic?: string
          topic?: string
          type?: string
          wrong_a?: string
          wrong_b?: string
          wrong_c?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      students: {
        Row: {
          campus_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          student_id: string
        }
        Insert: {
          campus_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          student_id: string
        }
        Update: {
          campus_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          ai_report: string
          answers: Json
          campus_id: string | null
          created_at: string
          duration_sec: number
          id: string
          kc_scores: Json
          level_id: string | null
          mcq_correct: number
          mcq_total: number
          quiz_name: string
          quiz_number: number
          score_pct: number
          skill_id: string | null
          student_id: string
          student_name: string
          student_uuid: string | null
          weakest_kc: string
        }
        Insert: {
          ai_report?: string
          answers?: Json
          campus_id?: string | null
          created_at?: string
          duration_sec?: number
          id?: string
          kc_scores?: Json
          level_id?: string | null
          mcq_correct?: number
          mcq_total?: number
          quiz_name?: string
          quiz_number?: number
          score_pct?: number
          skill_id?: string | null
          student_id?: string
          student_name?: string
          student_uuid?: string | null
          weakest_kc?: string
        }
        Update: {
          ai_report?: string
          answers?: Json
          campus_id?: string | null
          created_at?: string
          duration_sec?: number
          id?: string
          kc_scores?: Json
          level_id?: string | null
          mcq_correct?: number
          mcq_total?: number
          quiz_name?: string
          quiz_number?: number
          score_pct?: number
          skill_id?: string | null
          student_id?: string
          student_name?: string
          student_uuid?: string | null
          weakest_kc?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_uuid_fkey"
            columns: ["student_uuid"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
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
