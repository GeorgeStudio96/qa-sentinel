import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  // TEMPORARILY DISABLED - Endpoint does nothing
  return NextResponse.json(
    {
      success: false,
      error: 'Scanning functionality temporarily disabled',
      message: 'This endpoint is currently inactive while we rebuild the system'
    },
    { status: 503 } // Service Unavailable
  )

  // try {
  //   const body = await request.json()

  //   // Proxy to Fastify API server
  //   const apiServerUrl = process.env.API_SERVER_URL || 'http://localhost:3001'

  //   const response = await fetch(`${apiServerUrl}/api/scan/forms`, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //     body: JSON.stringify(body)
  //   })

  //   const result = await response.json()

  //   if (!response.ok) {
  //     return NextResponse.json(result, { status: response.status })
  //   }

  //   return NextResponse.json(result)

  // } catch (error) {
  //   console.error('Proxy error:', error)
  //   return NextResponse.json(
  //     { error: 'Failed to connect to scanning service' },
  //     { status: 500 }
  //   )
  // }
}