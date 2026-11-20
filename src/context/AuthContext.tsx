import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

type Role = 'admin' | 'staff' | 'customer'

interface AuthState {
  user: Profile | null
  role: Role | null
  isAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<Profile>
  signInAdmin: (username: string, password: string) => Promise<Profile>
  signUp: (input: {
    email: string
    password: string
    fullName: string
    phone?: string
  }) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  updateProfile: (patch: Partial<Profile>) => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [profile, resolvedRole] = await Promise.all([api.auth.getUser(), api.auth.getRole()])
      setUser(profile)
      setRole(profile ? (resolvedRole ?? 'customer') : null)
    } catch {
      setUser(null)
      setRole(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()

    if (!supabase) return
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setRole(null)
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void load()
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [load])

  const signIn = useCallback(async (email: string, password: string) => {
    const profile = await api.auth.signIn(email, password)
    const resolvedRole = (await api.auth.getRole()) ?? 'customer'
    setUser(profile)
    setRole(resolvedRole as Role)
    return profile
  }, [])

  const signInAdmin = useCallback(async (username: string, password: string) => {
    if (!supabase) throw new Error('The live authentication service is not configured.')
    const { data, error } = await supabase.functions.invoke('admin-access', {
      body: { action: 'login', username, password },
    })
    if (error) throw error
    if (!data?.session) throw new Error(data?.error ?? 'Invalid username or password.')
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
    if (sessionError) throw sessionError
    const profile = await api.auth.getUser()
    const resolvedRole = await api.auth.getRole()
    if (!profile || resolvedRole !== 'admin') {
      await supabase.auth.signOut()
      throw new Error('This account does not have administrator access.')
    }
    setUser(profile)
    setRole('admin')
    return profile
  }, [])

  const signUp = useCallback<AuthState['signUp']>(async (input) => {
    // Demo + live backends return different shapes:
    //   demo → Profile, live → { needsConfirmation }
    // Discriminate on the presence of `id`.
    const result = (await api.auth.signUp(input)) as Profile | { needsConfirmation: boolean }
    if ('id' in result) {
      const resolvedRole = (await api.auth.getRole()) ?? 'customer'
      setUser(result)
      setRole(resolvedRole as Role)
      return { needsConfirmation: false }
    }
    if (!result.needsConfirmation) await load()
    return result
  }, [load])

  const signOut = useCallback(async () => {
    await api.auth.signOut()
    setUser(null)
    setRole(null)
  }, [])

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const profile = await api.auth.updateProfile(patch)
    setUser((prev) => (prev ? { ...prev, ...profile } : profile))
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      role,
      isAdmin: role === 'admin' || role === 'staff',
      loading,
      signIn,
      signInAdmin,
      signUp,
      signOut,
      updateProfile,
      refresh: load,
    }),
    [user, role, loading, signIn, signInAdmin, signUp, signOut, updateProfile, load],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
