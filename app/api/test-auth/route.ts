/**
 * Test Authentication Bypass
 * Для быстрого тестирования Webflow OAuth без регистрации
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Создаем или входим как тестовый пользователь
    const testUser = {
      email: 'test@qasentinel.local',
      password: 'TestPassword123!',
    }

    // Попробуем войти, если не получится - создадим
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword(testUser)

    if (signInError && signInError.message.includes('Invalid login credentials')) {
      // Пользователь не существует, создаем
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        ...testUser,
        options: {
          emailRedirectTo: undefined, // Пропускаем email confirmation для тестирования
        }
      })

      if (signUpError) {
        console.error('Sign up error:', signUpError)
        return NextResponse.json({ error: signUpError.message }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'Test user created and signed in',
        user: signUpData.user
      })
    } else if (signInError) {
      console.error('Sign in error:', signInError)
      return NextResponse.json({ error: signInError.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Test user signed in',
      user: signInData.user
    })

  } catch (error) {
    console.error('Test auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}