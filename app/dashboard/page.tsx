import { createClient } from '@/lib/supabase/server'
import { AddSiteForm } from './components/AddSiteForm'
import { SitesList } from './components/SitesList'
import { WebflowConnection } from './components/WebflowConnection'
import { ConnectionNotification } from './components/ConnectionNotification'
import { LogoutButton } from './components/LogoutButton'

export default async function Dashboard() {
  const supabase = await createClient()

  const { data: sites, error } = await supabase
    .from('sites')
    .select(`
      *,
      scans(
        id,
        status,
        started_at,
        completed_at,
        findings_count
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching sites:', error)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">QA Sentinel Dashboard</h1>
            <p className="text-gray-600">Monitor your websites for quality issues</p>
          </div>
          <LogoutButton />
        </div>

        <ConnectionNotification />

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-8">
            <WebflowConnection />
            <AddSiteForm />
          </div>

          <div className="lg:col-span-2">
            <SitesList sites={sites || []} />
          </div>
        </div>
      </div>
    </div>
  )
}