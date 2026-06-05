'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import Image from 'next/image'
import logo from '@/public/logo-mediend.png'
import { Eye, EyeOff, Download } from 'lucide-react'
import { getFirstNavUrl } from '@/lib/sidebar-nav'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<{ outcome: string }> } | null>(null)
  const { user, isLoading, login, isLoggingIn } = useAuth()

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(getFirstNavUrl(user))
    }
  }, [user, isLoading, router])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as unknown as { prompt: () => Promise<{ outcome: string }> })
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        setDeferredPrompt(null)
      } catch {
        setDeferredPrompt(null)
      }
      return
    }
    toast.info('To install: open your browser menu (⋮) and tap "Install App" or "Add to Home Screen".')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      await login({ email, password })
      // Success is handled by the hook (redirects to dashboard)
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message || 'Login failed')
      } else {
        toast.error('Login failed. Please check your credentials and try again.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <header className="w-full border-b border-white/10 bg-[#062D4C]">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
          <div className="relative h-8 w-32 shrink-0">
            <Image src={logo} alt="Mediend" fill className="object-contain" priority />
          </div>
          <div className="ml-auto text-xs font-medium tracking-wide text-white/70">
            CRM Workspace
          </div>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-slate-200/70 shadow-lg dark:border-white/10">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-semibold tracking-tight">Sign in</CardTitle>
              <CardDescription>Use your Mediend account credentials to continue.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoggingIn}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoggingIn}
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoggingIn}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#062D4C] text-white hover:bg-[#08385f]"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-4 space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={handleInstall}
            >
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Need access? Contact your admin.
          </p>
        </div>
      </main>
    </div>
  )
}
