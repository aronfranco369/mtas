// Generated from the Supabase project schema. Regenerate after any migration:
//   npx supabase gen types typescript --project-id xriyvketoqomhsknmihc

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      assessment_areas: {
        Row: {
          area_number: number;
          id: string;
          is_active: boolean;
          section: Database['public']['Enums']['assessment_section'];
          title: string;
        };
        Insert: {
          area_number: number;
          id?: string;
          is_active?: boolean;
          section: Database['public']['Enums']['assessment_section'];
          title: string;
        };
        Update: {
          area_number?: number;
          id?: string;
          is_active?: boolean;
          section?: Database['public']['Enums']['assessment_section'];
          title?: string;
        };
        Relationships: [];
      };
      assessor_centres: {
        Row: { assessor_id: string; centre_id: string; created_at: string };
        Insert: { assessor_id: string; centre_id: string; created_at?: string };
        Update: { assessor_id?: string; centre_id?: string; created_at?: string };
        Relationships: [];
      };
      centres: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          region: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          region?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          region?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      intakes: {
        Row: {
          created_at: string;
          ends_on: string | null;
          id: string;
          is_active: boolean;
          name: string;
          slug: string;
          starts_on: string | null;
        };
        Insert: {
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          slug: string;
          starts_on?: string | null;
        };
        Update: {
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          slug?: string;
          starts_on?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database['public']['Enums']['user_role'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['user_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          centre_id: string;
          course: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          gender: string | null;
          id: string;
          intake_id: string;
          is_active: boolean;
          occupation: string | null;
          raw_registration_number: string | null;
          registration_number: string;
          updated_at: string;
        };
        Insert: {
          centre_id: string;
          course?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          gender?: string | null;
          id?: string;
          intake_id: string;
          is_active?: boolean;
          occupation?: string | null;
          raw_registration_number?: string | null;
          registration_number: string;
          updated_at?: string;
        };
        Update: {
          centre_id?: string;
          course?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          gender?: string | null;
          id?: string;
          intake_id?: string;
          is_active?: boolean;
          occupation?: string | null;
          raw_registration_number?: string | null;
          registration_number?: string;
          updated_at?: string;
        };
        // Required for PostgREST embedded-join type inference (students!inner (...)).
        Relationships: [
          {
            foreignKeyName: 'students_centre_id_fkey';
            columns: ['centre_id'];
            isOneToOne: false;
            referencedRelation: 'centres';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'students_intake_id_fkey';
            columns: ['intake_id'];
            isOneToOne: false;
            referencedRelation: 'intakes';
            referencedColumns: ['id'];
          },
        ];
      };
      sub_criteria: {
        Row: { area_id: string; display_order: number; id: string; text: string };
        Insert: { area_id: string; display_order?: number; id?: string; text: string };
        Update: { area_id?: string; display_order?: number; id?: string; text?: string };
        Relationships: [];
      };
      submission_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          detail: Json | null;
          event_type: string;
          id: string;
          submission_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          detail?: Json | null;
          event_type: string;
          id?: string;
          submission_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          detail?: Json | null;
          event_type?: string;
          id?: string;
          submission_id?: string;
        };
        Relationships: [];
      };
      submission_resets: {
        Row: {
          id: string;
          student_id: string;
          assessor_id: string | null;
          cleared_by: string | null;
          original_submission_id: string;
          assessed_on: string | null;
          theory_total: number | null;
          theory_percentage: number | null;
          practical_total: number | null;
          practical_percentage: number | null;
          email_status: string | null;
          pdf_object_key: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          assessor_id?: string | null;
          cleared_by?: string | null;
          original_submission_id: string;
          assessed_on?: string | null;
          theory_total?: number | null;
          theory_percentage?: number | null;
          practical_total?: number | null;
          practical_percentage?: number | null;
          email_status?: string | null;
          pdf_object_key?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          assessor_id?: string | null;
          cleared_by?: string | null;
          original_submission_id?: string;
          assessed_on?: string | null;
          theory_total?: number | null;
          theory_percentage?: number | null;
          practical_total?: number | null;
          practical_percentage?: number | null;
          email_status?: string | null;
          pdf_object_key?: string | null;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      submission_scores: {
        Row: { area_id: string; id: string; score: number; submission_id: string };
        Insert: { area_id: string; id?: string; score: number; submission_id: string };
        Update: { area_id?: string; id?: string; score?: number; submission_id?: string };
        Relationships: [
          {
            foreignKeyName: 'submission_scores_area_id_fkey';
            columns: ['area_id'];
            isOneToOne: false;
            referencedRelation: 'assessment_areas';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submission_scores_submission_id_fkey';
            columns: ['submission_id'];
            isOneToOne: false;
            referencedRelation: 'submissions';
            referencedColumns: ['id'];
          },
        ];
      };
      submissions: {
        Row: {
          assessed_on: string | null;
          assessor_id: string;
          assessor_signature: string | null;
          created_at: string;
          email_error: string | null;
          email_sent_at: string | null;
          email_status: Database['public']['Enums']['email_status'] | null;
          id: string;
          intake_id: string;
          locked_at: string | null;
          pdf_generated_at: string | null;
          pdf_object_key: string | null;
          practical_comments: string | null;
          practical_percentage: number | null;
          practical_total: number | null;
          status: Database['public']['Enums']['submission_status'];
          student_id: string;
          theory_comments: string | null;
          theory_percentage: number | null;
          theory_total: number | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          assessed_on?: string | null;
          assessor_id: string;
          assessor_signature?: string | null;
          created_at?: string;
          email_error?: string | null;
          email_sent_at?: string | null;
          email_status?: Database['public']['Enums']['email_status'] | null;
          id?: string;
          intake_id: string;
          locked_at?: string | null;
          pdf_generated_at?: string | null;
          pdf_object_key?: string | null;
          practical_comments?: string | null;
          practical_percentage?: number | null;
          practical_total?: number | null;
          status?: Database['public']['Enums']['submission_status'];
          student_id: string;
          theory_comments?: string | null;
          theory_percentage?: number | null;
          theory_total?: number | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          assessed_on?: string | null;
          assessor_id?: string;
          assessor_signature?: string | null;
          created_at?: string;
          email_error?: string | null;
          email_sent_at?: string | null;
          email_status?: Database['public']['Enums']['email_status'] | null;
          id?: string;
          intake_id?: string;
          locked_at?: string | null;
          pdf_generated_at?: string | null;
          pdf_object_key?: string | null;
          practical_comments?: string | null;
          practical_percentage?: number | null;
          practical_total?: number | null;
          status?: Database['public']['Enums']['submission_status'];
          student_id?: string;
          theory_comments?: string | null;
          theory_percentage?: number | null;
          theory_total?: number | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'submissions_assessor_id_fkey';
            columns: ['assessor_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_intake_id_fkey';
            columns: ['intake_id'];
            isOneToOne: false;
            referencedRelation: 'intakes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'submissions_student_id_fkey';
            columns: ['student_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      area_performance: {
        Row: {
          area_number: number | null;
          assessments: number | null;
          average_score: number | null;
          centre_id: string | null;
          centre_name: string | null;
          section: Database['public']['Enums']['assessment_section'] | null;
          title: string | null;
        };
        Relationships: [];
      };
      centre_progress: {
        Row: {
          centre_id: string | null;
          centre_name: string | null;
          region: string | null;
          trainees: number | null;
          assessed: number | null;
          remaining: number | null;
          drafts: number | null;
          emailed: number | null;
          failed: number | null;
          pending_delivery: number | null;
          percent_complete: number | null;
        };
        Relationships: [];
      };
      assessor_progress: {
        Row: {
          assessor_id: string | null;
          full_name: string | null;
          email: string | null;
          is_active: boolean | null;
          centre_id: string | null;
          centre_name: string | null;
          trainees_in_centre: number | null;
          submitted: number | null;
          drafts: number | null;
          failed: number | null;
          last_activity: string | null;
        };
        Relationships: [];
      };
      final_marks: {
        Row: {
          assessor_count: number | null;
          centre_id: string | null;
          centre_name: string | null;
          course: string | null;
          full_name: string | null;
          intake_id: string | null;
          occupation: string | null;
          practical_percentage: number | null;
          practical_total_avg: number | null;
          registration_number: string | null;
          student_id: string | null;
          theory_percentage: number | null;
          theory_total_avg: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      submit_assessment: {
        Args: { p_submission_id: string };
        Returns: Database['public']['Tables']['submissions']['Row'];
      };
      unlock_submission: {
        Args: { p_reason?: string; p_submission_id: string };
        Returns: Database['public']['Tables']['submissions']['Row'];
      };
    };
    Enums: {
      assessment_section: 'theory' | 'practical';
      email_status: 'pending' | 'sent' | 'bounced' | 'failed' | 'no_email_on_file';
      submission_status: 'draft' | 'submitted' | 'pdf_generated' | 'emailed' | 'failed';
      user_role: 'assessor' | 'admin';
    };
    CompositeTypes: Record<never, never>;
  };
};

type DefaultSchema = Database['public'];

export type Tables<T extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])> =
  (DefaultSchema['Tables'] & DefaultSchema['Views'])[T] extends { Row: infer R } ? R : never;

export type TablesInsert<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][T] extends { Update: infer U } ? U : never;

export type Enums<T extends keyof DefaultSchema['Enums']> = DefaultSchema['Enums'][T];

// ── Convenience aliases used across the app ───────────────────────────────
export type Profile = Tables<'profiles'>;
export type Student = Tables<'students'>;
export type Centre = Tables<'centres'>;
export type Intake = Tables<'intakes'>;
export type AssessmentArea = Tables<'assessment_areas'>;
export type Submission = Tables<'submissions'>;
export type SubmissionScore = Tables<'submission_scores'>;
export type FinalMark = Tables<'final_marks'>;
export type SubmissionStatus = Enums<'submission_status'>;
export type EmailStatus = Enums<'email_status'>;
export type UserRole = Enums<'user_role'>;
