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
          connection_id: string | null
          sync_enabled: boolean
          last_webflow_sync: string | null
          created_at: string
        }
        Insert: {
          id?: string
          url: string
          name: string
          webflow_site_id?: string | null
          connection_id?: string | null
          sync_enabled?: boolean
          last_webflow_sync?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          url?: string
          name?: string
          webflow_site_id?: string | null
          connection_id?: string | null
          sync_enabled?: boolean
          last_webflow_sync?: string | null
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
      oauth_states: {
        Row: {
          id: string
          user_id: string
          state: string
          provider: string
          created_at: string
          expires_at: string
          used_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          state: string
          provider: string
          created_at?: string
          expires_at: string
          used_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          state?: string
          provider?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
        }
      }
      webflow_connections: {
        Row: {
          id: string
          user_id: string
          webflow_user_id: string
          webflow_user_email: string
          access_token: string
          token_type: string
          scope: string
          connected_at: string
          updated_at: string
          last_sync_at: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          user_id: string
          webflow_user_id: string
          webflow_user_email: string
          access_token: string
          token_type?: string
          scope: string
          connected_at?: string
          updated_at?: string
          last_sync_at?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          webflow_user_id?: string
          webflow_user_email?: string
          access_token?: string
          token_type?: string
          scope?: string
          connected_at?: string
          updated_at?: string
          last_sync_at?: string | null
          is_active?: boolean
        }
      }
      webflow_sites: {
        Row: {
          id: string
          connection_id: string
          webflow_site_id: string
          display_name: string
          short_name: string | null
          domain: string
          workspace_id: string
          preview_url: string | null
          custom_domains: Json
          timezone: string | null
          locales: Json
          created_on: string | null
          last_updated: string | null
          published_on: string | null
          synced_at: string
          is_accessible: boolean
        }
        Insert: {
          id?: string
          connection_id: string
          webflow_site_id: string
          display_name: string
          short_name?: string | null
          domain: string
          workspace_id: string
          preview_url?: string | null
          custom_domains?: Json
          timezone?: string | null
          locales?: Json
          created_on?: string | null
          last_updated?: string | null
          published_on?: string | null
          synced_at?: string
          is_accessible?: boolean
        }
        Update: {
          id?: string
          connection_id?: string
          webflow_site_id?: string
          display_name?: string
          short_name?: string | null
          domain?: string
          workspace_id?: string
          preview_url?: string | null
          custom_domains?: Json
          timezone?: string | null
          locales?: Json
          created_on?: string | null
          last_updated?: string | null
          published_on?: string | null
          synced_at?: string
          is_accessible?: boolean
        }
      }
      webflow_pages: {
        Row: {
          id: string
          site_id: string
          webflow_page_id: string
          webflow_site_id: string
          title: string
          slug: string
          parent_id: string | null
          locale_id: string
          created_on: string | null
          last_updated: string | null
          last_published: string | null
          can_branch: boolean
          seo_title: string | null
          seo_description: string | null
          og_title: string | null
          og_description: string | null
          synced_at: string
        }
        Insert: {
          id?: string
          site_id: string
          webflow_page_id: string
          webflow_site_id: string
          title: string
          slug: string
          parent_id?: string | null
          locale_id: string
          created_on?: string | null
          last_updated?: string | null
          last_published?: string | null
          can_branch?: boolean
          seo_title?: string | null
          seo_description?: string | null
          og_title?: string | null
          og_description?: string | null
          synced_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          webflow_page_id?: string
          webflow_site_id?: string
          title?: string
          slug?: string
          parent_id?: string | null
          locale_id?: string
          created_on?: string | null
          last_updated?: string | null
          last_published?: string | null
          can_branch?: boolean
          seo_title?: string | null
          seo_description?: string | null
          og_title?: string | null
          og_description?: string | null
          synced_at?: string
        }
      }
      webflow_forms: {
        Row: {
          id: string
          site_id: string
          webflow_form_id: string
          webflow_site_id: string
          name: string
          page_id: string
          workflow_id: string | null
          created_on: string | null
          fields: Json
          synced_at: string
        }
        Insert: {
          id?: string
          site_id: string
          webflow_form_id: string
          webflow_site_id: string
          name: string
          page_id: string
          workflow_id?: string | null
          created_on?: string | null
          fields?: Json
          synced_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          webflow_form_id?: string
          webflow_site_id?: string
          name?: string
          page_id?: string
          workflow_id?: string | null
          created_on?: string | null
          fields?: Json
          synced_at?: string
        }
      }
    }
  }
}

export type Site = Database['public']['Tables']['sites']['Row']
export type Scan = Database['public']['Tables']['scans']['Row']
export type Finding = Database['public']['Tables']['findings']['Row']
export type Baseline = Database['public']['Tables']['baselines']['Row']

// Webflow OAuth types
export type OAuthState = Database['public']['Tables']['oauth_states']['Row']
export type WebflowConnection = Database['public']['Tables']['webflow_connections']['Row']
export type WebflowSite = Database['public']['Tables']['webflow_sites']['Row']
export type WebflowPage = Database['public']['Tables']['webflow_pages']['Row']
export type WebflowForm = Database['public']['Tables']['webflow_forms']['Row']

// Insert types for new records
export type WebflowConnectionInsert = Database['public']['Tables']['webflow_connections']['Insert']
export type WebflowSiteInsert = Database['public']['Tables']['webflow_sites']['Insert']
export type WebflowPageInsert = Database['public']['Tables']['webflow_pages']['Insert']
export type WebflowFormInsert = Database['public']['Tables']['webflow_forms']['Insert']