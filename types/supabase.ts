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
      sites: {
        Row: {
          id: string
          url: string
          name: string
          webflow_site_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          url: string
          name: string
          webflow_site_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          url?: string
          name?: string
          webflow_site_id?: string | null
          created_at?: string
        }
      }
      scans: {
        Row: {
          id: string
          site_id: string
          status: 'pending' | 'running' | 'completed' | 'failed'
          started_at: string
          completed_at: string | null
          findings_count: number
        }
        Insert: {
          id?: string
          site_id: string
          status?: 'pending' | 'running' | 'completed' | 'failed'
          started_at?: string
          completed_at?: string | null
          findings_count?: number
        }
        Update: {
          id?: string
          site_id?: string
          status?: 'pending' | 'running' | 'completed' | 'failed'
          started_at?: string
          completed_at?: string | null
          findings_count?: number
        }
      }
      findings: {
        Row: {
          id: string
          scan_id: string
          type: string
          severity: 'high' | 'medium' | 'low'
          title: string
          description: string | null
          evidence: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          scan_id: string
          type: string
          severity: 'high' | 'medium' | 'low'
          title: string
          description?: string | null
          evidence?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          scan_id?: string
          type?: string
          severity?: 'high' | 'medium' | 'low'
          title?: string
          description?: string | null
          evidence?: Json | null
          created_at?: string
        }
      }
      baselines: {
        Row: {
          id: string
          site_id: string
          url: string
          viewport: string
          screenshot_url: string
          created_at: string
        }
        Insert: {
          id?: string
          site_id: string
          url: string
          viewport: string
          screenshot_url: string
          created_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          url?: string
          viewport?: string
          screenshot_url?: string
          created_at?: string
        }
      }
    }
  }
}

export type Site = Database['public']['Tables']['sites']['Row']
export type Scan = Database['public']['Tables']['scans']['Row']
export type Finding = Database['public']['Tables']['findings']['Row']
export type Baseline = Database['public']['Tables']['baselines']['Row']