import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chromium } from 'playwright'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const { siteId } = await request.json()

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get site details
    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('*')
      .eq('id', siteId)
      .single()

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    // Create scan record
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        site_id: siteId,
        status: 'running'
      })
      .select()
      .single()

    if (scanError || !scan) {
      return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 })
    }

    // Launch Playwright
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    let findingsCount = 0

    try {
      const page = await browser.newPage()
      await page.goto(site.url, { waitUntil: 'networkidle' })

      // Take screenshot
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      })

      // Upload screenshot to Supabase Storage
      const screenshotPath = `${scan.id}/main.png`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('screenshots')
        .upload(screenshotPath, screenshot, {
          contentType: 'image/png'
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
      }

      // Basic broken images check
      const brokenImages = await page.evaluate(() => {
        return Array.from(document.images)
          .filter(img => !img.complete || img.naturalWidth === 0)
          .map(img => ({
            src: img.src,
            alt: img.alt || '',
            className: img.className || ''
          }))
      })


      // Save broken images findings
      if (brokenImages.length > 0) {
        const { error: findingError } = await supabase
          .from('findings')
          .insert({
            scan_id: scan.id,
            type: 'broken-images',
            severity: 'high',
            title: `${brokenImages.length} broken images found`,
            description: `Found ${brokenImages.length} images that failed to load properly`,
            evidence: {
              images: brokenImages,
              screenshot_url: uploadData?.path
            }
          })

        if (!findingError) {
          findingsCount++
        }
      }

      // Update scan status
      await supabase
        .from('scans')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          findings_count: findingsCount
        })
        .eq('id', scan.id)

      await page.close()

    } finally {
      await browser.close()
    }

    return NextResponse.json({
      scanId: scan.id,
      status: 'completed',
      findingsCount: findingsCount
    })

  } catch (error) {
    console.error('Scan error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}