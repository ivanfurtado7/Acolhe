import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { CalendarDays, CheckCircle, HeartHandshake, ShieldAlert, CheckCircle2, XCircle, Shield, Users } from 'lucide-react'

export function DashboardHome({ churchId, userProfile }: { churchId: string, userProfile: any }) {
  const [feedChegando, setFeedChegando] = useState<any[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])
  const [myRosters, setMyRosters] = useState<any[]>([])
  const [myGroup, setMyGroup] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState<'resumo' | 'agenda'>('resumo')

  const firstName = userProfile?.full_name?.split(' ')[0] || 'Membro'
  
  // Descobre o nome do cargo do usuário
  const userRoleName = userProfile?.role === 'admin' 
    ? 'Administrador Master' 
    : userProfile?.role === 'lider' 
    ? (userProfile?.custom_role?.name || 'Liderança') 
    : 'Membro';

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true)
      const [postsRes, rostersRes, groupRes] = await Promise.all([
        supabase.from('mural_posts').select('*, mural_rsvps(user_id), mural_likes(user_id)').eq('church_id', churchId).order('event_date', { ascending: false }).limit(50),
        supabase.from('rosters').select('*, ministry:ministries(name), event:mural_posts(title, event_date, status)').eq('church_id', churchId).eq('user_id', userProfile.id),
        supabase.from('group_members').select('group:cell_groups(name)').eq('user_id', userProfile.id).eq('status', 'aprovado').maybeSingle()
      ])

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
        setFeedChegando(activeUpcoming.slice(0, 4))
        setUpcomingEvents(processedPosts.filter(p => p.type === 'evento'))
      }

      if (rostersRes.data) setMyRosters(rostersRes.data)
      if (groupRes.data && groupRes.data.group) setMyGroup(groupRes.data.group)

      setLoading(false)
    }

    if (churchId && userProfile) fetchDashboard()
  }, [churchId, userProfile])

  const handleUpdateRosterStatus = async (rosterId: string, status: string) => {
    await supabase.from('rosters').update({ status }).eq('id', rosterId)
    setMyRosters(prev => prev.map(r => r.id === rosterId ? { ...r, status } : r))
  }

  if (loading) return <div className="py-16 text-center text-amber-700 font-bold animate-pulse text-sm">Carregando painel...</div>

  const myConfirmedEvents = upcomingEvents.filter(ev => ev.mural_rsvps?.some((rsvp: any) => rsvp.user_id === userProfile.id) && (ev.status === 'Ativo' || ev.status === 'Em breve' || ev.status === 'Adiado'))

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      
      {/* PAINEL COMUNIDADE (Com Cargo e Grupo Integrados) */}
      <div className="bg-gradient-to-br from-amber-600 to-amber-700 rounded-[2.5rem] p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Comunidade</span>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-black/20 text-amber-100 px-3 py-1 rounded-full flex items-center gap-1.5">
              <Shield size={12} /> {userRoleName}
            </span>
            {myGroup && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white px-3 py-1 rounded-full flex items-center gap-1.5">
                <Users size={12} /> GC: {myGroup.name}
              </span>
            )}
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-1">Olá, {firstName}!</h2>
            <p className="text-amber-100 text-xs sm:text-sm font-medium">Que bom ter você conectado com a nossa igreja hoje.</p>
          </div>
        </div>
      </div>

      {/* ABAS DE NAVEGAÇÃO INTERNA */}
      <div className="flex gap-2 bg-stone-100 p-1.5 rounded-2xl">
        <button onClick={() => setActiveSubTab('resumo')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeSubTab === 'resumo' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500'}`}>Meu Painel</button>
        <button onClick={() => setActiveSubTab('agenda')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${activeSubTab === 'agenda' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500'}`}>Agenda & Avisos</button>
      </div>

      {/* ABA 1: MEU PAINEL */}
      {activeSubTab === 'resumo' && (
        <div className="space-y-5 animate-in fade-in">
          
          {myRosters.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-lg flex items-center gap-1"><HeartHandshake size={14}/> Voluntariado</span>
                <span className="text-xs text-stone-400 font-semibold">{myRosters.filter(r => r.status === 'Pendente').length} pendente(s)</span>
              </div>
              <div className="space-y-3">
                {myRosters.slice(0, 3).map(r => (
                  <div key={r.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-stone-50 p-4 rounded-2xl border border-stone-100 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-stone-500 uppercase">{r.ministry?.name}</span>
                      <h4 className="font-bold text-stone-800 text-sm">{r.event?.title}</h4>
                      <p className="text-xs text-stone-400">{new Date(r.event?.event_date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    {r.status === 'Pendente' ? (
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button onClick={() => handleUpdateRosterStatus(r.id, 'Confirmado')} className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl cursor-pointer shadow-sm">Confirmar</button>
                        <button onClick={() => handleUpdateRosterStatus(r.id, 'Indisponível')} className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl cursor-pointer">Recusar</button>
                      </div>
                    ) : (
                      <span className={`text-xs font-bold px-3 py-1 rounded-lg uppercase ${r.status === 'Confirmado' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{r.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {myConfirmedEvents.length > 0 && (
            <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-sm">
              <h4 className="font-bold text-stone-800 text-sm mb-3 flex items-center gap-1.5"><CalendarDays size={16} className="text-amber-600"/> Suas Inscrições Confirmadas</h4>
              <div className="space-y-2">
                {myConfirmedEvents.map(ev => (
                  <div key={ev.id} className="flex items-center justify-between bg-stone-50 p-3.5 rounded-2xl border border-stone-100">
                    <span className="font-bold text-sm text-stone-800 truncate">{ev.title}</span>
                    <span className="text-xs text-stone-500 font-semibold">{new Date(ev.event_date).toLocaleDateString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {myRosters.length === 0 && myConfirmedEvents.length === 0 && (
            <div className="bg-white border border-stone-200 rounded-3xl p-8 text-center text-stone-400 space-y-2">
              <ShieldAlert size={36} className="mx-auto opacity-30" />
              <p className="text-sm font-semibold text-stone-600">Nenhum evento ou escala recente.</p>
              <p className="text-xs">Explore o menu lateral para conferir o mural e grupos.</p>
            </div>
          )}
        </div>
      )}

      {/* ABA 2: AGENDA & AVISOS */}
      {activeSubTab === 'agenda' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white border border-stone-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-stone-800 text-base mb-2">Últimos Avisos e Eventos</h4>
            {feedChegando.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">Nenhum aviso no momento.</p>
            ) : (
              feedChegando.map(item => (
                <div key={item.id} className="bg-stone-50 border border-stone-100 p-4 rounded-2xl space-y-2">
                  <div className="flex justify-between items-start">
                    <h5 className="font-bold text-stone-800 text-sm">{item.title}</h5>
                    <span className="text-[10px] font-bold text-stone-400 uppercase">{new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <p className="text-xs text-stone-600 line-clamp-2">{item.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  )
}