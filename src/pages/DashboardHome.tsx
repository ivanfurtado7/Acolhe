import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { CalendarDays, Megaphone, ThumbsUp, CheckCircle, ChevronLeft, ChevronRight, Activity, Users, HeartHandshake, ShieldAlert, ArrowRight, CheckCircle2, XCircle, Bell } from 'lucide-react'

export function DashboardHome({ 
  churchId, 
  userProfile
}: { 
  churchId: string, 
  userProfile: any
}) {
  const [feedChegando, setFeedChegando] = useState<any[]>([])
  const [feedPassados, setFeedPassados] = useState<any[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [myRosters, setMyRosters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Sistema de Notificações
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  const [feedTab, setFeedTab] = useState<'chegando' | 'passados'>('chegando')

  const today = new Date()
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const perms = userProfile?.computed_permissions;

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true)
      
      const [postsRes, rostersRes] = await Promise.all([
        supabase
          .from('mural_posts')
          .select('*, mural_rsvps(user_id), mural_likes(user_id)')
          .eq('church_id', churchId)
          .order('event_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('rosters')
          .select('*, ministry:ministries(name), event:mural_posts(title, event_date, status)')
          .eq('church_id', churchId)
          .eq('user_id', userProfile.id)
      ])

      // 1. Processar Mural
      if (postsRes.data) {
        const allPosts = postsRes.data
        const nowMs = new Date().getTime()

        const processedPosts = allPosts.map(post => {
          let currentStatus = post.status
          if (post.type === 'evento' && post.event_date && post.status !== 'Concluído' && post.status !== 'Cancelado') {
            const eventTimeMs = new Date(post.event_date).getTime()
            const diffHours = (nowMs - eventTimeMs) / (1000 * 60 * 60)

            if (diffHours >= 24) currentStatus = 'Concluído'
            else if (diffHours >= 0 && diffHours < 24) currentStatus = 'Ativo'
          }
          return { ...post, status: currentStatus }
        })

        const activeUpcoming = processedPosts.filter(p => p.type === 'aviso' || (p.type === 'evento' && ['Em breve', 'Ativo', 'Adiado'].includes(p.status)))
        const past = processedPosts.filter(p => p.type === 'evento' && ['Concluído', 'Cancelado'].includes(p.status))

        activeUpcoming.sort((a, b) => {
          if (a.status === 'Ativo' && b.status !== 'Ativo') return -1
          if (b.status === 'Ativo' && a.status !== 'Ativo') return 1
          
          const dateA = a.event_date ? new Date(a.event_date).getTime() : new Date(a.created_at).getTime()
          const dateB = b.event_date ? new Date(b.event_date).getTime() : new Date(b.created_at).getTime()
          return dateA - dateB
        })

        setFeedChegando(activeUpcoming.slice(0, 6))
        setFeedPassados(past.slice(0, 6))
        setUpcomingEvents(processedPosts.filter(p => p.type === 'evento'))
      }

      if (rostersRes.data) setMyRosters(rostersRes.data)

      // 2. Compilar Notificações Globais
      const notifs: any[] = [];
      
      // 2.1 Escalas Pendentes (Para o próprio usuário)
      if (rostersRes.data) {
        const pendRosters = rostersRes.data.filter(r => r.status === 'Pendente')
        pendRosters.forEach(r => notifs.push({
          id: `rost_${r.id}`, type: 'escala',
          title: 'Escala Pendente',
          description: `Você foi escalado(a) no setor ${r.ministry?.name} para o evento "${r.event?.title}".`,
          date: r.created_at
        }))
      }

      // 2.2 Solicitações de Grupo (Se líder ou admin)
      if (perms?.grupos?.edit || userProfile.role === 'lider' || userProfile.role === 'admin') {
        const { data: pendGroups } = await supabase.from('group_members').select('*, group:cell_groups(name, leader_id), user:user_profiles(full_name)').eq('church_id', churchId).eq('status', 'pendente');
        if (pendGroups) {
          pendGroups.forEach(g => {
             if (perms?.grupos?.edit || g.group?.leader_id === userProfile.id) {
                 notifs.push({
                     id: `grp_${g.id}`, type: 'grupo',
                     title: 'Solicitação de Grupo',
                     description: `${g.user?.full_name} quer participar do grupo ${g.group?.name}.`,
                     date: g.created_at
                 })
             }
          })
        }
      }

      // 2.3 Cadastros de Novos Usuários (Se admin)
      if (perms?.admin?.manage_requests || userProfile.role === 'admin') {
        const { data: pendReqs } = await supabase.from('join_requests').select('*, user:user_profiles(full_name)').eq('church_id', churchId).eq('status', 'pending');
        if (pendReqs) {
          pendReqs.forEach(req => notifs.push({
              id: `req_${req.id}`, type: 'admin',
              title: 'Novo Cadastro Pendente',
              description: `${req.user?.full_name || 'Um novo usuário'} solicitou acesso à comunidade.`,
              date: req.created_at
          }))
        }
      }

      setNotifications(notifs.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false)
    }

    if (churchId && userProfile) fetchDashboard()
  }, [churchId, userProfile])

  const handleUpdateRosterStatus = async (rosterId: string, status: string) => {
    await supabase.from('rosters').update({ status }).eq('id', rosterId)
    setMyRosters(prev => prev.map(r => r.id === rosterId ? { ...r, status } : r))
    setNotifications(prev => prev.filter(n => n.id !== `rost_${rosterId}`))
  }

  const prevMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))
  const daysInMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate()
  const firstDayIndex = currentMonthDate.getDay()
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  
  const getEventsForDay = (day: number) => {
    return upcomingEvents.filter(p => {
      if (!p.event_date) return false
      const d = new Date(p.event_date)
      return d.getDate() === day && d.getMonth() === currentMonthDate.getMonth() && d.getFullYear() === currentMonthDate.getFullYear()
    })
  }

  const getDotColor = (status: string) => {
    if (status === 'Ativo') return 'bg-emerald-500'
    if (status === 'Cancelado') return 'bg-red-500'
    if (status === 'Adiado') return 'bg-orange-500'
    if (status === 'Concluído') return 'bg-stone-300'
    return 'bg-blue-500' 
  }

  if (loading) return <div className="py-10 text-center text-amber-700 font-bold animate-pulse">Carregando Início...</div>

  const currentFeed = feedTab === 'chegando' ? feedChegando : feedPassados;

  const myConfirmedEvents = upcomingEvents.filter(ev => 
    ev.mural_rsvps?.some((rsvp: any) => rsvp.user_id === userProfile.id) &&
    (ev.status === 'Ativo' || ev.status === 'Em breve' || ev.status === 'Adiado')
  ).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

  // Navegação simulada via cliques nos botões da barra lateral
  const navigateToTab = (tabName: string) => {
    const button = Array.from(document.querySelectorAll('aside button')).find(el => el.textContent?.includes(tabName)) as HTMLButtonElement;
    if (button) button.click();
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 pb-10 relative">
      
      {/* HEADER DE NOTIFICAÇÕES (SINO FLUTUANTE) */}
      <div className="flex justify-end mb-4 md:absolute md:-top-16 md:right-0 md:mb-0 z-50">
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)} 
            className="p-3 bg-white border border-stone-200 shadow-sm rounded-full hover:bg-stone-50 transition-colors relative cursor-pointer"
          >
            <Bell size={22} className="text-stone-600" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute top-14 right-0 w-80 sm:w-96 bg-white border border-stone-200 rounded-3xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
              <div className="p-4 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
                <h4 className="font-bold text-stone-800">Notificações</h4>
                <span className="text-xs font-bold text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full">{notifications.length}</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-stone-200">
                {notifications.length === 0 ? (
                  <div className="text-center py-8 text-stone-400">
                    <Bell size={32} className="mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-semibold">Nenhuma novidade por aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {notifications.map(n => (
                      <div key={n.id} className="p-3 hover:bg-stone-50 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-stone-100" onClick={() => {
                        if (n.type === 'grupo') navigateToTab('Grupos de Cuidado');
                        if (n.type === 'admin') navigateToTab('Administração');
                        if (n.type === 'escala') navigateToTab('Escalas');
                        setShowNotifications(false);
                      }}>
                        <div className="flex justify-between items-start mb-1">
                          <h5 className={`text-xs font-bold ${n.type === 'escala' ? 'text-amber-700' : n.type === 'grupo' ? 'text-emerald-700' : 'text-purple-700'}`}>{n.title}</h5>
                          <span className="text-[9px] text-stone-400 font-medium whitespace-nowrap ml-2">{new Date(n.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <p className="text-xs text-stone-600 leading-snug">{n.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
        
        {/* COLUNA ESQUERDA/CENTRAL: MEU ENGAJAMENTO */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="bg-white rounded-[2rem] border border-stone-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
            
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60"></div>
            
            <div className="relative z-10 mb-8">
              <h3 className="text-2xl font-black text-stone-800 tracking-tight">Meu Engajamento</h3>
              <p className="text-stone-500 font-medium mt-1">Acompanhe suas inscrições, grupos e escalas na comunidade.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
              
              {/* BLOCO 1: EVENTOS CONFIRMADOS */}
              <div className="bg-stone-50 rounded-3xl p-6 border border-stone-100 flex flex-col hover:border-amber-200 transition-colors">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                    <CalendarDays size={20} />
                  </div>
                  <h4 className="font-bold text-stone-800 text-lg">Inscrições</h4>
                </div>
                
                <div className="flex-1 flex flex-col gap-3">
                  {myConfirmedEvents.length > 0 ? (
                    myConfirmedEvents.slice(0, 2).map(ev => (
                      <div key={ev.id} className="bg-white border border-stone-200 p-3 rounded-2xl flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 bg-stone-50 rounded-xl flex flex-col items-center justify-center shrink-0 border border-stone-100">
                          <span className="text-[8px] font-bold text-red-500 uppercase">{new Date(ev.event_date).toLocaleString('pt-BR', { month: 'short' })}</span>
                          <span className="text-sm font-black text-stone-700 leading-none">{new Date(ev.event_date).getDate()}</span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-bold text-sm text-stone-800 line-clamp-1">{ev.title}</p>
                          <p className="text-xs text-stone-500">{new Date(ev.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-4 opacity-70">
                      <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mb-2"><CheckCircle size={20} className="text-stone-300" /></div>
                      <p className="text-xs font-bold text-stone-500">Nenhum evento confirmado.</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">Acesse o Mural para confirmar presença.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* BLOCO 2: GRUPOS DE CUIDADO */}
              <div className="bg-stone-50 rounded-3xl p-6 border border-stone-100 flex flex-col hover:border-purple-200 transition-colors">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center shrink-0">
                    <Users size={20} />
                  </div>
                  <h4 className="font-bold text-stone-800 text-lg">Meu Grupo</h4>
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center text-center bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
                  <p className="text-sm font-bold text-stone-700 mb-1">Explore os encontros.</p>
                  <p className="text-xs text-stone-500 mb-4 px-2">Pequenos grupos são essenciais para comunhão e crescimento.</p>
                  <button 
                    onClick={() => navigateToTab('Grupos de Cuidado')}
                    className="text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-4 py-2 rounded-xl transition-colors border border-purple-100 flex items-center gap-1.5 cursor-pointer"
                  >
                    Ir para Grupos <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {/* BLOCO 3: PRÓXIMAS ESCALAS REFLETINDO PENDÊNCIAS */}
              <div className="md:col-span-2 bg-stone-50 rounded-3xl p-6 border border-stone-100 flex flex-col hover:border-blue-200 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center shrink-0">
                      <HeartHandshake size={20} />
                    </div>
                    <h4 className="font-bold text-stone-800 text-lg">Próximas Escalas</h4>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Voluntariado</span>
                </div>
                
                <div className="space-y-3">
                  {myRosters.length > 0 ? (
                    myRosters.map(r => (
                      <div key={r.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 text-stone-700">
                            <span className="text-[8px] uppercase">{new Date(r.event?.event_date).toLocaleString('pt-BR', { month: 'short' })}</span>
                            <span className="text-sm leading-none">{new Date(r.event?.event_date).getDate()}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold uppercase bg-stone-100 text-stone-600 px-2 py-0.5 rounded">{r.ministry?.name}</span>
                              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                                r.status === 'Confirmado' ? 'bg-emerald-100 text-emerald-800' :
                                r.status === 'Indisponível' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                              }`}>{r.status}</span>
                            </div>
                            <h5 className="font-bold text-stone-800 text-sm mt-1">{r.event?.title}</h5>
                          </div>
                        </div>

                        {r.status === 'Pendente' && (
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button 
                              onClick={() => handleUpdateRosterStatus(r.id, 'Confirmado')}
                              className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <CheckCircle2 size={14} /> Confirmar
                            </button>
                            <button 
                              onClick={() => handleUpdateRosterStatus(r.id, 'Indisponível')}
                              className="flex-1 sm:flex-none px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <XCircle size={14} /> Recusar
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-4 bg-white border border-stone-200 p-4 sm:p-5 rounded-2xl shadow-sm">
                      <div className="w-12 h-12 bg-stone-50 rounded-full flex items-center justify-center shrink-0">
                        <ShieldAlert className="text-stone-300" size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-stone-800 mb-0.5">Nenhuma escala programada</p>
                        <p className="text-xs text-stone-500">Você está livre nos próximos dias. Aproveite para cultuar!</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: CALENDÁRIO E FEED */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
          
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-stone-800">Agenda</h3>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1 text-stone-400 hover:text-amber-600 transition-colors cursor-pointer"><ChevronLeft size={16} /></button>
                <span className="font-bold text-xs text-stone-600 w-16 text-center uppercase">
                  {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear().toString().substring(2)}
                </span>
                <button onClick={nextMonth} className="p-1 text-stone-400 hover:text-amber-600 transition-colors cursor-pointer"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 mb-2 gap-1 text-center text-[10px] font-bold text-stone-400 uppercase">
              <div>D</div><div>S</div><div>T</div><div>Q</div><div>Q</div><div>S</div><div>S</div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square bg-stone-50/50 rounded-lg"></div>
              ))}
              
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const isToday = day === today.getDate() && currentMonthDate.getMonth() === today.getMonth() && currentMonthDate.getFullYear() === today.getFullYear()
                const dayEvents = getEventsForDay(day)

                return (
                  <div key={day} className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all ${isToday ? 'bg-amber-100 border border-amber-300 shadow-sm' : 'bg-stone-50 border border-transparent'}`}>
                    <span className={`text-[10px] font-bold ${isToday ? 'text-amber-800' : 'text-stone-600'}`}>{day}</span>
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center px-1">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div key={ev.id} className={`w-1.5 h-1.5 rounded-full ${getDotColor(ev.status)}`} title={ev.title}></div>
                      ))}
                      {dayEvents.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-stone-300"></div>}
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="mt-5 pt-4 border-t border-stone-100 flex flex-wrap justify-center gap-3">
               <div className="flex items-center gap-1 text-[8px] font-bold text-stone-500 uppercase"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Ao vivo</div>
               <div className="flex items-center gap-1 text-[8px] font-bold text-stone-500 uppercase"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Em breve</div>
               <div className="flex items-center gap-1 text-[8px] font-bold text-stone-500 uppercase"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Adiado</div>
               <div className="flex items-center gap-1 text-[8px] font-bold text-stone-500 uppercase"><span className="w-2 h-2 rounded-full bg-red-500"></span> Cancel</div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 flex flex-col h-[450px]">
            <h3 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
              <Megaphone size={18} className="text-amber-600" /> Fique Ligado
            </h3>

            <div className="flex gap-2 bg-stone-100 p-1.5 rounded-xl mb-4 shrink-0 overflow-x-auto scrollbar-hide">
              <button onClick={() => setFeedTab('chegando')} className={`flex-1 py-2 px-3 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${feedTab === 'chegando' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                Tá chegando
              </button>
              <button onClick={() => setFeedTab('passados')} className={`flex-1 py-2 px-3 text-[11px] font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${feedTab === 'passados' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>
                O culto ta acabando...
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent">
              {currentFeed.length === 0 ? (
                <p className="text-stone-400 text-sm text-center mt-10">Nenhum registro para exibir.</p>
              ) : (
                currentFeed.map(item => {
                  const isAtivo = item.status === 'Ativo';
                  
                  if (item.type === 'evento') {
                    const date = new Date(item.event_date)
                    return (
                      <div key={item.id} className={`p-4 rounded-2xl border flex flex-col gap-3 group relative transition-all ${isAtivo ? 'bg-emerald-50 border-emerald-400 shadow-md' : 'bg-stone-50 border-stone-100'}`}>
                        {isAtivo && <span className="absolute top-2 right-2 flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md animate-pulse"><Activity size={10}/> Ao Vivo</span>}
                        
                        <div className="flex items-center gap-3 pr-16">
                          <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 border ${isAtivo ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                            <span className="text-[8px] uppercase leading-none">{date.toLocaleString('pt-BR', { month: 'short' })}</span>
                            <span className="text-sm leading-none mt-0.5">{date.getDate()}</span>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h4 className={`font-bold text-sm line-clamp-1 ${isAtivo ? 'text-emerald-900' : 'text-stone-800'}`}>{item.title}</h4>
                            <div className={`flex items-center gap-1 text-[10px] mt-0.5 font-bold uppercase tracking-wider ${isAtivo ? 'text-emerald-600' : 'text-stone-500'}`}>
                              <CalendarDays size={10} /> Evento {item.status !== 'Em breve' && item.status !== 'Ativo' ? `• ${item.status}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className={`flex items-center gap-3 text-[10px] font-bold ${isAtivo ? 'text-emerald-700/70' : 'text-stone-400'}`}>
                           <span className="flex items-center gap-1"><ThumbsUp size={12} /> {item.mural_likes?.length || 0}</span>
                           <span className="flex items-center gap-1"><CheckCircle size={12} /> {item.mural_rsvps?.length || 0} confirmados</span>
                        </div>
                      </div>
                    )
                  } else {
                    return (
                      <div key={item.id} className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex flex-col gap-3 group">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-white text-stone-400 rounded-xl flex flex-col items-center justify-center font-bold shrink-0 border border-stone-200">
                            <Megaphone size={16} />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <h4 className="font-bold text-stone-800 text-sm line-clamp-1">{item.title}</h4>
                            <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">{item.content}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-stone-400">
                           <span className="flex items-center gap-1"><ThumbsUp size={12} /> {item.mural_likes?.length || 0}</span>
                        </div>
                      </div>
                    )
                  }
                })
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}