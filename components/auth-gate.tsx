'use client'

import type { ReactNode } from 'react'
import { Home, Loader2 } from 'lucide-react'
import { KindeProvider, useKindeBrowserClient } from '@kinde-oss/kinde-auth-nextjs'
import { LoginLink, RegisterLink } from '@kinde-oss/kinde-auth-nextjs/components'

/** Shows the app only to signed-in users; everyone else gets the Kinde sign-in screen. */
export function AuthGate({ children }: { children: ReactNode }) {
  return <KindeProvider><Gate>{children}</Gate></KindeProvider>
}

function Gate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useKindeBrowserClient()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] text-sm text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" />Checking your sign-in…
      </div>
    )
  }
  if (isAuthenticated) return <>{children}</>

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f9fc] px-5">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-950 text-white"><Home className="size-5" /></div>
        <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">Sign in to rentwise</h1>
        <p className="mt-1 text-sm text-slate-500">Manage houses, tenants, rent and payments.</p>
        <LoginLink className="mt-7 flex h-11 w-full items-center justify-center rounded-xl bg-slate-950 text-sm font-medium text-white hover:bg-slate-800">Sign in</LoginLink>
        <RegisterLink className="mt-2 flex h-11 w-full items-center justify-center rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">Create an account</RegisterLink>
      </div>
    </div>
  )
}
