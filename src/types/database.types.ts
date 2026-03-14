export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chore_history: {
        Row: {
          completed_at: string | null
          id: string
          task_id: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          id?: string
          task_id?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          task_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chore_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chore_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      events: {
        Row: {
          end_time: string
          id: string
          start_time: string
          title: string
          user_id: string | null
        }
        Insert: {
          end_time: string
          id?: string
          start_time: string
          title: string
          user_id?: string | null
        }
        Update: {
          end_time?: string
          id?: string
          start_time?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      inventory: {
        Row: {
          added_date: string | null
          category: string | null
          expiry_date: string | null
          id: string
          product_name: string
          status: string | null
          quantity: number | null
          unit: string | null
          canonical_name: string | null
        }
        Insert: {
          added_date?: string | null
          category?: string | null
          expiry_date?: string | null
          id?: string
          product_name: string
          status?: string | null
          quantity?: number | null
          unit?: string | null
          canonical_name?: string | null
        }
        Update: {
          added_date?: string | null
          category?: string | null
          expiry_date?: string | null
          id?: string
          product_name?: string
          status?: string | null
          quantity?: number | null
          unit?: string | null
          canonical_name?: string | null
        }
        Relationships: []
      }
      sos_items: {
        Row: {
          id: string
          name: string
          icon: string
        }
        Insert: {
          id?: string
          name: string
          icon: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string
        }
        Relationships: []
      }
      disliked_foods: {
        Row: {
          id: string
          name: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      planned_meals: {
        Row: {
          id: string
          title: string
          description: string | null
          ingredients_json: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          ingredients_json?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          ingredients_json?: Json | null
          created_at?: string | null
        }
        Relationships: []
      }
      shopping_list: {
        Row: {
          id: string
          product_name: string
          added_date: string | null
          is_bought: boolean | null
          category: string | null
          quantity: number | null
          unit: string | null
          canonical_name: string | null
        }
        Insert: {
          id?: string
          product_name: string
          added_date?: string | null
          is_bought?: boolean | null
          category?: string | null
          quantity?: number | null
          unit?: string | null
          canonical_name?: string | null
        }
        Update: {
          id?: string
          product_name?: string
          added_date?: string | null
          is_bought?: boolean | null
          category?: string | null
          quantity?: number | null
          unit?: string | null
          canonical_name?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          base_points: number
          frequency_days: number
          id: string
          name: string
          urgency_multiplier: number
        }
        Insert: {
          base_points: number
          frequency_days: number
          id?: string
          name: string
          urgency_multiplier: number
        }
        Update: {
          base_points?: number
          frequency_days?: number
          id?: string
          name?: string
          urgency_multiplier?: number
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          mercato_balance: number | null
          pseudo: string
          score: number | null
        }
        Insert: {
          id?: string
          mercato_balance?: number | null
          pseudo: string
          score?: number | null
        }
        Update: {
          id?: string
          mercato_balance?: number | null
          pseudo?: string
          score?: number | null
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
