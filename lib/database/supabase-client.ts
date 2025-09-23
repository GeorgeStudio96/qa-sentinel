import { createClient } from '@supabase/supabase-js';
import { createLogger } from '../backend/utils/logger';

const logger = createLogger('supabase-client');

// Environment variables validation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database types (simplified)
export interface Site {
  id: string;
  url: string;
  name: string;
  webflow_site_id?: string;
  created_at: string;
}

export interface Scan {
  id: string;
  site_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  findings_count: number;
}

export interface Finding {
  id: string;
  scan_id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description?: string;
  evidence?: Record<string, unknown>;
  created_at: string;
}

// Database service functions
export class DatabaseService {
  // Sites
  async createSite(data: { url: string; name: string; webflow_site_id?: string }): Promise<Site> {
    logger.info('Creating site', { url: data.url, name: data.name });

    const { data: site, error } = await supabase
      .from('sites')
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create site', error);
      throw new Error(`Failed to create site: ${error.message}`);
    }

    return site;
  }

  async getSite(id: string): Promise<Site | null> {
    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Site not found
      }
      logger.error('Failed to get site', error);
      throw new Error(`Failed to get site: ${error.message}`);
    }

    return site;
  }

  async getSiteByUrl(url: string): Promise<Site | null> {
    const { data: site, error } = await supabase
      .from('sites')
      .select('*')
      .eq('url', url)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Site not found
      }
      logger.error('Failed to get site by URL', error);
      throw new Error(`Failed to get site by URL: ${error.message}`);
    }

    return site;
  }

  async listSites(): Promise<Site[]> {
    const { data: sites, error } = await supabase
      .from('sites')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to list sites', error);
      throw new Error(`Failed to list sites: ${error.message}`);
    }

    return sites || [];
  }

  // Scans
  async createScan(data: { site_id: string; status?: string }): Promise<Scan> {
    logger.info('Creating scan', { site_id: data.site_id });

    const { data: scan, error } = await supabase
      .from('scans')
      .insert({
        site_id: data.site_id,
        status: data.status || 'pending'
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create scan', error);
      throw new Error(`Failed to create scan: ${error.message}`);
    }

    return scan;
  }

  async updateScan(id: string, updates: Partial<Pick<Scan, 'status' | 'completed_at' | 'findings_count'>>): Promise<Scan> {
    logger.info('Updating scan', { id, updates });

    const { data: scan, error } = await supabase
      .from('scans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Failed to update scan', error);
      throw new Error(`Failed to update scan: ${error.message}`);
    }

    return scan;
  }

  async getScan(id: string): Promise<Scan | null> {
    const { data: scan, error } = await supabase
      .from('scans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      logger.error('Failed to get scan', error);
      throw new Error(`Failed to get scan: ${error.message}`);
    }

    return scan;
  }

  async listScans(siteId?: string): Promise<Scan[]> {
    let query = supabase
      .from('scans')
      .select('*')
      .order('started_at', { ascending: false });

    if (siteId) {
      query = query.eq('site_id', siteId);
    }

    const { data: scans, error } = await query;

    if (error) {
      logger.error('Failed to list scans', error);
      throw new Error(`Failed to list scans: ${error.message}`);
    }

    return scans || [];
  }

  // Findings
  async createFinding(data: {
    scan_id: string;
    type: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    description?: string;
    evidence?: Record<string, unknown>;
  }): Promise<Finding> {
    logger.info('Creating finding', { scan_id: data.scan_id, type: data.type, severity: data.severity });

    const { data: finding, error } = await supabase
      .from('findings')
      .insert(data)
      .select()
      .single();

    if (error) {
      logger.error('Failed to create finding', error);
      throw new Error(`Failed to create finding: ${error.message}`);
    }

    return finding;
  }

  async listFindings(scanId: string): Promise<Finding[]> {
    const { data: findings, error } = await supabase
      .from('findings')
      .select('*')
      .eq('scan_id', scanId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to list findings', error);
      throw new Error(`Failed to list findings: ${error.message}`);
    }

    return findings || [];
  }

  // Helper method to get or create site
  async getOrCreateSite(url: string, name?: string): Promise<Site> {
    let site = await this.getSiteByUrl(url);

    if (!site) {
      // Extract domain name if no name provided
      const siteName = name || new URL(url).hostname;
      site = await this.createSite({ url, name: siteName });
    }

    return site;
  }

  // Store scan results
  async storeScanResults(
    url: string,
    scanResult: {
      success: boolean;
      duration: number;
      errors?: string[];
      // Add other scan result properties as needed
    }
  ): Promise<{ site: Site; scan: Scan }> {
    // Get or create site
    const site = await this.getOrCreateSite(url);

    // Create scan record
    const scan = await this.createScan({
      site_id: site.id,
      status: 'running'
    });

    // Update scan with results
    const updatedScan = await this.updateScan(scan.id, {
      status: scanResult.success ? 'completed' : 'failed',
      completed_at: new Date().toISOString(),
      findings_count: 0 // Will be updated when findings are created
    });

    // Create findings for errors (simplified)
    if (scanResult.errors && scanResult.errors.length > 0) {
      let findingsCount = 0;
      for (const error of scanResult.errors) {
        await this.createFinding({
          scan_id: scan.id,
          type: 'error',
          severity: 'medium',
          title: 'Scan Error',
          description: error
        });
        findingsCount++;
      }

      // Update findings count
      await this.updateScan(scan.id, { findings_count: findingsCount });
    }

    return { site, scan: updatedScan };
  }
}

// Export singleton instance
export const db = new DatabaseService();