import { useState, useEffect } from 'react'
import { supabase } from './services/supabase'

import { VisitorForm } from './pages/VisitorForm'
import { Onboarding } from './pages/Onboarding'
import { DashboardHome } from './pages/DashboardHome'
import { MuralView } from './pages/MuralView'
import { SettingsManagement } from './pages/SettingsManagement'
import { AcolhimentoView } from './pages/AcolhimentoView'
import { QRCodeShareView } from './pages/QRCodeShareView'
import { GruposView } from './pages/GruposView'
import { EscalasView } from './pages/EscalasView'

import { 
  Home, Users, HeartHandshake, QrCode, User, LogOut, Settings, AlertCircle, Megaphone, CalendarCheck
} from 'lucide-react'
import logoAcolhe from './assets/logo-acolhe.png'

export function App() {
  const [session, setSession] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isCheckingProfile, setIsCheckingProfile] = useState(true)
  
  const [currentTab, setCurrentTab] = useState<'inicio' | 'mural' | 'acolhimento' | 'grupos' | 'escalas' | 'share' | 'settings' | 'profile'>('inicio')
  const isPublicRoute = window.location.pathname === '/ficha'

  useEffect(() => {
    const checkProfile = async (userId: string) => {
      setIsCheckingProfile(true)
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*, custom_roles(permissions), churches(member_permissions)')
        .eq('id', userId)
        .single()

      if (profile) {
        let perms = null;
        
        const customPerms = Array.isArray(profile.custom_roles) ? profile.custom_roles[0]?.permissions : profile.custom_roles?.permissions;
        const churchPerms = Array.isArray(profile.churches) ? profile.churches[0]?.member_permissions : profile.churches?.member_permissions;

        // NOVA MATRIZ DE PERMISSÕES GRANULARES
        if (profile.role === 'admin') {
          perms = {
            mural: { view: true, create: true, manage_status: true, delete: true },
            acolhimento: { view: true, manage_funnel: true, assign_leader: true, add_notes: true, delete: true },
            grupos: { view: true, create: true, edit: true, delete: true },
            escalas: { view: true, manage_sectors: true, assign: true, remove: true, respond: true },
            qrcode: { view: true },
            admin: { manage_requests: true, manage_members: true, manage_roles: true }
          }
        } else if (profile.role === 'lider' && customPerms) {
          perms = customPerms;
        } else if (churchPerms) {
          perms = churchPerms;
        }

        // PERMISSÕES PADRÃO DO MEMBRO (Caso não tenha customização)
        if (!perms) {
          perms = {
            mural: { view: true },
            acolhimento: { view: false },
            grupos: { view: true },
            escalas: { view: true, respond: true },
            qrcode: { view: false },
            admin: { manage_requests: false, manage_members: false, manage_roles: false }
          }
        }

        setUserProfile({ ...profile, computed_permissions: perms })
      } else {
        setUserProfile(null)
      }
      setIsCheckingProfile(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        checkProfile(session.user.id)
        setCurrentTab('inicio') 
      }
      else setIsCheckingProfile(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        checkProfile(session.user.id)
        setCurrentTab('inicio') 
      }
      else {
        setUserProfile(null)
        setIsCheckingProfile(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isCheckingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 flex-col gap-4">
        <img src={logoAcolhe} alt="Acolhe" className="w-20 h-20 animate-pulse rounded-full opacity-50" />
        <p className="text-sm text-amber-700 font-bold animate-pulse">Carregando...</p>
      </div>
    )
  }

  if (isPublicRoute) return <VisitorForm />
  if (!session) return <LoginForm />

  if (session && (!userProfile || !userProfile.church_id)) {
    return <Onboarding 
      currentUserId={session.user.id} 
      hasProfile={!!userProfile} 
      onBack={() => supabase.auth.signOut()} 
      onFinish={() => window.location.reload()} 
    />
  }

  const perms = userProfile?.computed_permissions;
  const canViewSettings = perms?.admin?.manage_requests || perms?.admin?.manage_members || perms?.admin?.manage_roles;
  const firstName = userProfile?.full_name?.split(' ')[0] || 'Membro'

  const allNavItems = [
    { id: 'inicio', label: 'Início', icon: Home, show: true },
    { id: 'mural', label: 'Mural & Agenda', icon: Megaphone, show: perms?.mural?.view },
    { id: 'acolhimento', label: 'Acolhimento', icon: HeartHandshake, show: perms?.acolhimento?.view },
    { id: 'grupos', label: 'Grupos', icon: Users, show: perms?.grupos?.view },
    { id: 'escalas', label: 'Escalas', icon: CalendarCheck, show: perms?.escalas?.view },
    { id: 'share', label: 'QR Code', icon: QrCode, show: perms?.qrcode?.view },
    { id: 'settings', label: 'Admin', icon: Settings, show: canViewSettings },
  ]

  const navItems = allNavItems.filter(item => item.show)

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex font-sans pb-16 md:pb-0"> {/* pb-16 dá espaço para a nav mobile no fundo */}
      
      {/* SIDEBAR DESKTOP (Escondida no Mobile) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen bg-white border-r border-stone-200 w-[72px] hover:w-64 transition-all duration-300 z-50 flex-col overflow-hidden group shadow-[4px_0_24px_rgba(0,0,0,0.02)] print:hidden">
        <div className="h-[72px] flex items-center px-4 border-b border-stone-100 shrink-0 cursor-pointer" onClick={() => setCurrentTab('inicio')}>
          <div className="w-10 h-10 min-w-[40px] rounded-full flex items-center justify-center overflow-hidden shadow-sm border border-stone-100 bg-white">
            <img src={logoAcolhe} alt="Acolhe Logo" className="w-full h-full object-cover scale-110" />
          </div>
          <div className="ml-4 flex flex-col whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <span className="font-bold text-stone-800 text-lg leading-tight tracking-tight">Acolhe</span>
          </div>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-2 overflow-y-auto overflow-x-hidden px-3 scrollbar-hide">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id as any)}
              className={`flex items-center px-3 py-3 w-full text-left transition-all rounded-xl relative
                ${currentTab === item.id ? 'text-amber-700 bg-amber-50 font-bold' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50 font-semibold'}
              `}
            >
              <item.icon size={22} className="min-w-[22px]" strokeWidth={currentTab === item.id ? 2.5 : 2} />
              <span className="ml-4 text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {item.label}
              </span>
            </button>
          ))}
          <button onClick={() => setCurrentTab('profile')} className={`flex items-center px-3 py-3 w-full text-left transition-all rounded-xl relative ${currentTab === 'profile' ? 'text-amber-700 bg-amber-50 font-bold' : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50 font-semibold'}`}>
            <User size={22} className="min-w-[22px]" strokeWidth={currentTab === 'profile' ? 2.5 : 2} />
            <span className="ml-4 text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Meu Perfil</span>
          </button>
        </nav>

        <div className="p-4 shrink-0 border-t border-stone-100">
          <button onClick={() => supabase.auth.signOut()} className="flex items-center px-3 py-3 w-full text-left text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold cursor-pointer">
            <LogOut size={22} className="min-w-[22px]" />
            <span className="ml-4 text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Sair</span>
          </button>
        </div>
      </aside>

      {/* NAVBAR MOBILE (Fixa na parte inferior) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-stone-200 flex items-center justify-around h-16 z-50 px-2 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.05)] print:hidden">
        {navItems.slice(0, 4).map(item => ( // Exibe os 4 principais no mobile
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id as any)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === item.id ? 'text-amber-700' : 'text-stone-400 hover:text-stone-700'}`}
          >
            <item.icon size={20} strokeWidth={currentTab === item.id ? 2.5 : 2} />
            <span className={`text-[9px] font-bold ${currentTab === item.id ? 'opacity-100' : 'opacity-70'}`}>{item.label}</span>
          </button>
        ))}
        {/* Menu Extra (Perfil) no Mobile */}
        <button onClick={() => setCurrentTab('profile')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'profile' ? 'text-amber-700' : 'text-stone-400 hover:text-stone-700'}`}>
          <User size={20} strokeWidth={currentTab === 'profile' ? 2.5 : 2} />
          <span className={`text-[9px] font-bold ${currentTab === 'profile' ? 'opacity-100' : 'opacity-70'}`}>Perfil</span>
        </button>
      </nav>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 md:ml-[72px] flex flex-col min-h-screen w-full">
        
        {/* CABEÇALHO (Ajustado para Mobile) */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-stone-200 px-4 md:px-8 min-h-[64px] md:min-h-[72px] py-3 flex justify-between items-center sticky top-0 z-40 print:hidden w-full">
          <div className="flex-1 min-w-0 pr-4"> {/* min-w-0 permite que o truncate funcione */}
            {currentTab === 'inicio' ? (
              <>
                <h1 className="text-xl md:text-2xl font-black text-stone-800 tracking-tight truncate">Olá, {firstName}</h1>
                <p className="text-stone-500 text-xs md:text-sm font-medium mt-0.5 hidden sm:block truncate">Bem-vindo(a) ao painel da sua congregação.</p>
              </>
            ) : (
              <h1 className="text-xl md:text-2xl font-bold text-stone-800 capitalize tracking-tight truncate">
                {navItems.find(i => i.id === currentTab)?.label || (currentTab === 'profile' ? 'Meu Perfil' : 'Painel')}
              </h1>
            )}
          </div>
          <div className="flex items-center shrink-0">
            <button onClick={() => setCurrentTab('profile')} className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-stone-50 hover:bg-stone-100 rounded-full border border-stone-200 shadow-sm text-stone-700 transition-colors cursor-pointer">
              <span className="text-xs md:text-sm font-bold truncate max-w-[100px] md:max-w-[200px]">{firstName}</span>
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 md:p-10 max-w-6xl mx-auto w-full flex-1 overflow-x-hidden">
          {currentTab === 'inicio' && <DashboardHome churchId={userProfile.church_id} userProfile={userProfile} />}
          {currentTab === 'mural' && perms?.mural?.view && <MuralView churchId={userProfile.church_id} userProfile={userProfile} />}
          {currentTab === 'acolhimento' && perms?.acolhimento?.view && <AcolhimentoView churchId={userProfile.church_id} userProfile={userProfile} />}
          {currentTab === 'grupos' && perms?.grupos?.view && <GruposView churchId={userProfile.church_id} userProfile={userProfile} />}
          {currentTab === 'escalas' && perms?.escalas?.view && <EscalasView churchId={userProfile.church_id} userProfile={userProfile} />}
          {currentTab === 'share' && perms?.qrcode?.view && <QRCodeShareView churchId={userProfile.church_id} />}
          {currentTab === 'settings' && canViewSettings && <SettingsManagement churchId={userProfile.church_id} currentUserRole={userProfile.role} currentPerms={perms} />}
        </main>
      </div>
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    
    if (signInError) {
      if (signInError.message === 'Invalid login credentials') setError('E-mail ou senha incorretos.')
      else setError('Ocorreu um erro ao tentar entrar. Tente novamente.')
    }
    setLoading(false)
  }

  if (isRegistering) return <Onboarding onBack={() => setIsRegistering(false)} />

  return (
    <div className="flex min-h-screen font-sans selection:bg-amber-100 selection:text-amber-900 relative">
      <div className="absolute inset-0 z-0 bg-stone-50" style={{ backgroundImage: `url(${logoAcolhe})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }} />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-stone-50/50 to-stone-100/90 backdrop-blur-[2px]"></div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-[400px] bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-stone-300/50 p-6 sm:p-12 border border-white">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white rounded-full shadow-lg border-4 border-white flex items-center justify-center overflow-hidden">
              <img src={logoAcolhe} alt="Acolhe Logo" className="w-full h-full object-cover scale-110" />
            </div>
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-black text-stone-800 mb-2 tracking-tight text-center">Bem-vindo</h2>
          <p className="text-sm sm:text-base text-stone-500 mb-8 font-medium text-center">Acesse sua conta para continuar.</p>
          
          {error && <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2"><AlertCircle size={18} className="shrink-0 mt-0.5" /> <span className="font-medium">{error}</span></div>}

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">E-mail</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(null); }} required className="w-full px-4 py-3 sm:py-3.5 bg-white border border-stone-200 rounded-xl text-sm sm:text-base focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
            </div>
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Senha</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(null); }} required className="w-full px-4 py-3 sm:py-3.5 bg-white border border-stone-200 rounded-xl text-sm sm:text-base focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3.5 sm:py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-base sm:text-lg rounded-xl transition-all shadow-lg shadow-amber-600/20 mt-4 active:scale-[0.98] disabled:opacity-70">
              {loading ? 'Autenticando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-stone-100 text-center">
            <p className="text-xs sm:text-sm text-stone-500 font-medium">Não tem uma conta? <button onClick={() => setIsRegistering(true)} className="text-amber-700 font-bold hover:underline ml-1">Registar agora</button></p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App