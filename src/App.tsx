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
import { ProfileManagement } from './pages/ProfileManagement'

import { 
  Home, Users, HeartHandshake, QrCode, User, LogOut, Settings, AlertCircle, Megaphone, CalendarCheck, X, Bell
} from 'lucide-react'
import logoAcolhe from './assets/logo-acolhe.png'

export function App() {
  const [session, setSession] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isCheckingProfile, setIsCheckingProfile] = useState(true)
  
  const [currentTab, setCurrentTab] = useState<'inicio' | 'mural' | 'acolhimento' | 'grupos' | 'escalas' | 'share' | 'settings' | 'profile'>('inicio')
  const [isAppsMenuOpen, setIsAppsMenuOpen] = useState(false)

  // Sistema de Notificações Global
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  
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
        
        // Carregar Notificações
        fetchGlobalNotifications(profile.church_id, profile.id, profile.role, perms)
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

  async function fetchGlobalNotifications(churchId: string, userId: string, role: string, perms: any) {
    const notifs: any[] = [];
    
    // 1. Escalas Pendentes
    const { data: rostersData } = await supabase.from('rosters').select('*, ministry:ministries(name), event:mural_posts(title, event_date)').eq('church_id', churchId).eq('user_id', userId).eq('status', 'Pendente');
    if (rostersData) {
      rostersData.forEach(r => notifs.push({
        id: `rost_${r.id}`, type: 'escala', title: 'Escala Pendente', description: `Você foi escalado(a) no setor ${r.ministry?.name} para o evento "${r.event?.title}".`, date: r.created_at
      }))
    }

    // 2. Solicitações de Grupo
    if (perms?.grupos?.edit || role === 'lider' || role === 'admin') {
      const { data: pendGroups } = await supabase.from('group_members').select('*, group:cell_groups(name, leader_id), user:user_profiles(full_name)').eq('church_id', churchId).eq('status', 'pendente');
      if (pendGroups) {
        pendGroups.forEach(g => {
           if (perms?.grupos?.edit || g.group?.leader_id === userId) {
               notifs.push({ id: `grp_${g.id}`, type: 'grupo', title: 'Solicitação de Grupo', description: `${g.user?.full_name} quer participar do grupo ${g.group?.name}.`, date: g.created_at })
           }
        })
      }
    }

    // 3. Cadastros Pendentes
    if (perms?.admin?.manage_requests || role === 'admin') {
      const { data: pendReqs } = await supabase.from('join_requests').select('*, user:user_profiles(full_name)').eq('church_id', churchId).eq('status', 'pending');
      if (pendReqs) {
        pendReqs.forEach(req => notifs.push({ id: `req_${req.id}`, type: 'admin', title: 'Novo Cadastro Pendente', description: `${req.user?.full_name || 'Um novo usuário'} solicitou acesso.`, date: req.created_at }))
      }
    }

    setNotifications(notifs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }

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
    { id: 'profile', label: 'Meu Perfil', icon: User, show: true },
  ]

  const navItems = allNavItems.filter(item => item.show)

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex font-sans pb-16 md:pb-0">
      
      {/* SIDEBAR DESKTOP */}
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
        </nav>

        <div className="p-4 shrink-0 border-t border-stone-100">
          <button onClick={() => supabase.auth.signOut()} className="flex items-center px-3 py-3 w-full text-left text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors font-semibold cursor-pointer">
            <LogOut size={22} className="min-w-[22px]" />
            <span className="ml-4 text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Sair</span>
          </button>
        </div>
      </aside>

      {/* NAVBAR MOBILE COM CORREÇÃO DE DUPLICAÇÃO */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-stone-200 flex items-center justify-around h-16 z-40 px-2 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.05)] print:hidden">
        {navItems
          .filter(item => item.id !== 'profile')
          .slice(0, 4)
          .map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentTab(item.id as any)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === item.id ? 'text-amber-700' : 'text-stone-400 hover:text-stone-700'}`}
          >
            <item.icon size={20} strokeWidth={currentTab === item.id ? 2.5 : 2} />
            <span className={`text-[9px] font-bold ${currentTab === item.id ? 'opacity-100' : 'opacity-70'}`}>{item.label}</span>
          </button>
        ))}
        
        {/* BOTÃO PERFIL FIXO NO FINAL */}
        <button onClick={() => setCurrentTab('profile')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentTab === 'profile' ? 'text-amber-700' : 'text-stone-400 hover:text-stone-700'}`}>
          <User size={20} strokeWidth={currentTab === 'profile' ? 2.5 : 2} />
          <span className={`text-[9px] font-bold ${currentTab === 'profile' ? 'opacity-100' : 'opacity-70'}`}>Perfil</span>
        </button>
      </nav>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 md:ml-[72px] flex flex-col min-h-screen w-full">
        
        {/* CABEÇALHO */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-stone-200 px-4 md:px-8 min-h-[64px] md:min-h-[72px] py-3 flex justify-between items-center sticky top-0 z-30 print:hidden w-full">
          <div className="flex-1 min-w-0 pr-4">
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
          
          {/* GRUPO DE BOTÕES À DIREITA COM POSIÇÃO RELATIVA */}
          <div className="flex items-center gap-2.5 shrink-0 relative">
            
            {/* SINO DE NOTIFICAÇÕES (AGORA COM A CORREÇÃO DE ALINHAMENTO) */}
            <button 
              onClick={() => setShowNotifications(!showNotifications)} 
              className="p-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 shadow-sm rounded-full text-stone-600 transition-colors relative cursor-pointer flex items-center justify-center"
              title="Notificações"
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white animate-pulse">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* PAINEL DE NOTIFICAÇÕES */}
            {showNotifications && (
              <div className="absolute top-[115%] right-0 w-[85vw] sm:w-80 max-w-[320px] bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 origin-top-right">
                <div className="p-4 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
                  <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wider">Notificações</h4>
                  <span className="text-[10px] font-bold text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full">{notifications.length}</span>
                </div>
                <div className="max-h-[350px] overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-stone-400 text-center py-6">Nenhuma notificação no momento.</p>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} onClick={() => {
                        if (n.type === 'escala') setCurrentTab('escalas');
                        if (n.type === 'grupo') setCurrentTab('grupos');
                        if (n.type === 'admin') setCurrentTab('settings');
                        setShowNotifications(false);
                      }} className="p-3 hover:bg-stone-50 rounded-2xl cursor-pointer transition-colors border border-transparent hover:border-stone-100">
                        <p className="text-xs font-bold text-amber-800">{n.title}</p>
                        <p className="text-[11px] text-stone-600 mt-0.5">{n.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* BOTÃO DO MENU TIPO APPLE (NOME) */}
            <button 
              onClick={() => setIsAppsMenuOpen(true)} 
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-stone-50 hover:bg-stone-100 rounded-full border border-stone-200 shadow-sm text-stone-700 transition-colors cursor-pointer"
            >
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
          {currentTab === 'profile' && <ProfileManagement churchId={userProfile.church_id} userProfile={userProfile} />}
        </main>
      </div>

      {/* MODAL MENU DE APLICATIVOS (ESTILO APPLE) */}
      {isAppsMenuOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in" 
          onClick={() => setIsAppsMenuOpen(false)}
        >
          <div 
            className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-[2.5rem] shadow-2xl p-6 sm:p-8 animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-stone-800 tracking-tight">Aplicativos</h3>
              <button onClick={() => setIsAppsMenuOpen(false)} className="p-2 bg-stone-100 text-stone-500 hover:text-stone-800 rounded-full cursor-pointer"><X size={20}/></button>
            </div>

            <div className="grid grid-cols-4 gap-y-7 gap-x-3">
              {navItems.map(item => {
                let gradient = 'from-stone-200 to-stone-300 text-stone-700'
                if (item.id === 'inicio') gradient = 'from-blue-400 to-blue-600 text-white shadow-blue-500/30'
                if (item.id === 'mural') gradient = 'from-amber-400 to-amber-600 text-white shadow-amber-500/30'
                if (item.id === 'acolhimento') gradient = 'from-rose-400 to-rose-600 text-white shadow-rose-500/30'
                if (item.id === 'grupos') gradient = 'from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30'
                if (item.id === 'escalas') gradient = 'from-orange-400 to-orange-600 text-white shadow-orange-500/30'
                if (item.id === 'share') gradient = 'from-indigo-400 to-indigo-600 text-white shadow-indigo-500/30'
                if (item.id === 'settings') gradient = 'from-stone-700 to-stone-900 text-white shadow-stone-800/30'
                if (item.id === 'profile') gradient = 'from-purple-400 to-purple-600 text-white shadow-purple-500/30'

                return (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentTab(item.id as any); setIsAppsMenuOpen(false); }}
                    className="flex flex-col items-center gap-2.5 group cursor-pointer"
                  >
                    <div className={`w-[60px] h-[60px] rounded-2xl flex items-center justify-center bg-gradient-to-br ${gradient} shadow-lg group-active:scale-95 transition-all duration-200 border border-white/20`}>
                      <item.icon size={26} strokeWidth={2} />
                    </div>
                    <span className="text-[10px] font-bold text-stone-700 text-center leading-tight truncate w-full px-1">
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-8 pt-6 border-t border-stone-200/50 flex justify-center">
               <button 
                onClick={() => { setIsAppsMenuOpen(false); supabase.auth.signOut(); }} 
                className="flex items-center gap-2 px-6 py-3.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-sm rounded-2xl transition-colors cursor-pointer w-full justify-center"
               >
                 <LogOut size={18} /> Sair do Aplicativo
               </button>
            </div>
          </div>
        </div>
      )}
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
    if (signInError) setError('E-mail ou senha incorretos.')
    setLoading(false)
  }

  if (isRegistering) return <Onboarding onBack={() => setIsRegistering(false)} />

  return (
    <div className="flex min-h-screen font-sans relative">
      <div className="absolute inset-0 z-0 bg-stone-50" style={{ backgroundImage: `url(${logoAcolhe})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }} />
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-[400px] bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-12 border border-white">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-white rounded-full shadow-lg border-4 border-white flex items-center justify-center overflow-hidden">
              <img src={logoAcolhe} alt="Logo" className="w-full h-full object-cover scale-110" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-stone-800 mb-2 text-center">Bem-vindo</h2>
          {error && <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 rounded-xl">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">E-mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-2">Senha</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 bg-amber-600 text-white font-bold rounded-xl mt-4">Entrar</button>
          </form>
          <div className="mt-8 text-center">
            <p className="text-xs text-stone-500">Não tem conta? <button onClick={() => setIsRegistering(true)} className="text-amber-700 font-bold">Registar</button></p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App