import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Phone, MapPin, CalendarDays, ChevronDown, ChevronUp, History, User, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'

export function VisitorsManagement() {
  const [visitors, setVisitors] = useState<any[]>([])
  const [statuses, setStatuses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [churchId, setChurchId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Controle de Tela (Kanban vs Ficha Completa)
  const [selectedVisitor, setSelectedVisitor] = useState<any>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    setCurrentUserId(userData.user.id)

    const { data: profile } = await supabase.from('user_profiles').select('church_id').eq('id', userData.user.id).single()
    
    if (profile?.church_id) {
      setChurchId(profile.church_id)
      
      let { data: statusesData } = await supabase
        .from('visitor_statuses')
        .select('*')
        .eq('church_id', profile.church_id)
        .order('sequence_order', { ascending: true })

      if (!statusesData || statusesData.length === 0) {
        const defaultStatuses = [
          { church_id: profile.church_id, name: 'Novos', color: 'blue', sequence_order: 1 },
          { church_id: profile.church_id, name: 'Em Contato', color: 'amber', sequence_order: 2 },
          { church_id: profile.church_id, name: 'Consolidados', color: 'green', sequence_order: 3 }
        ]
        const { data: newStatuses } = await supabase.from('visitor_statuses').insert(defaultStatuses).select().order('sequence_order')
        if (newStatuses) statusesData = newStatuses
      }
      
      setStatuses(statusesData || [])

      const { data: visitorsData } = await supabase
        .from('visitors')
        .select('*')
        .eq('church_id', profile.church_id)
        .order('created_at', { ascending: false })
      
      if (visitorsData && statusesData && statusesData.length > 0) {
        const firstStatusId = statusesData[0].id
        const orphans = visitorsData.filter(v => !v.status_id)
        
        for (const orphan of orphans) {
          await supabase.from('visitors').update({ status_id: firstStatusId }).eq('id', orphan.id)
          orphan.status_id = firstStatusId
        }
        
        setVisitors(visitorsData)
      }
    }
    setLoading(false)
  }

  const changeStatus = async (visitorId: string, oldStatusId: string, newStatusId: string) => {
    if (oldStatusId === newStatusId) return

    setVisitors(prev => prev.map(v => v.id === visitorId ? { ...v, status_id: newStatusId } : v))
    
    if (selectedVisitor && selectedVisitor.id === visitorId) {
      setSelectedVisitor({ ...selectedVisitor, status_id: newStatusId })
    }

    await supabase.from('visitors').update({ status_id: newStatusId }).eq('id', visitorId)

    if (churchId && currentUserId) {
      await supabase.from('visitor_history').insert([{
        church_id: churchId,
        visitor_id: visitorId,
        old_status_id: oldStatusId,
        new_status_id: newStatusId,
        changed_by: currentUserId
      }])
    }
  }

  const getColorClass = (colorName: string) => {
    const colors: any = {
      blue: 'bg-blue-500',
      amber: 'bg-amber-500',
      green: 'bg-green-500',
      red: 'bg-red-500',
      purple: 'bg-purple-500'
    }
    return colors[colorName] || 'bg-stone-500'
  }

  const openWhatsApp = (phone: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const cleanPhone = phone.replace(/\D/g, '')
    window.open(`https://wa.me/55${cleanPhone}?text=Olá! Somos da equipe de acolhimento da igreja. Que alegria ter você com a gente!`, '_blank')
  }

  // ================= TELA 1: O COMPONENTE DO CARD (Resumo) =================
  const VisitorCard = ({ visitor, statusColorClass }: { visitor: any, statusColorClass: string }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const [history, setHistory] = useState<any[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)

    useEffect(() => {
      if (isExpanded) {
        setLoadingHistory(true)
        supabase.from('visitor_history')
          .select('*, user_profiles(full_name)')
          .eq('visitor_id', visitor.id)
          .order('created_at', { ascending: false })
          .limit(3) // LIMITA A 3 ALTERAÇÕES NO CARD!
          .then(({ data }) => {
            if (data) setHistory(data)
            setLoadingHistory(false)
          })
      }
    }, [isExpanded, visitor.id, visitor.status_id])

    return (
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColorClass}`}></div>

        <div onClick={() => setIsExpanded(!isExpanded)} className="p-4 pl-5 cursor-pointer flex justify-between items-center bg-white hover:bg-stone-50 transition-colors">
          <h4 className="font-bold text-stone-800 text-sm truncate pr-2">{visitor.full_name}</h4>
          <div className="text-stone-400">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 pl-5 border-t border-stone-100 animate-in slide-in-from-top-2">
            <div className="mt-4 space-y-2">
              <button onClick={(e) => openWhatsApp(visitor.whatsapp, e)} className="flex items-center gap-2 text-xs text-stone-600 hover:text-green-600 font-medium transition-colors">
                <Phone size={14} className="text-stone-400" /> {visitor.whatsapp}
              </button>
              <div className="flex items-center gap-2 text-xs text-stone-600">
                <MapPin size={14} className="text-stone-400" /> Bairro: {visitor.neighborhood}
              </div>
            </div>

            <div className="mt-5 bg-stone-50 p-3 rounded-xl border border-stone-200">
              <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5">Mover Visitante</label>
              <select 
                value={visitor.status_id}
                onChange={(e) => changeStatus(visitor.id, visitor.status_id, e.target.value)}
                className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600"
              >
                {statuses.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="mt-5">
              <h5 className="flex items-center justify-between text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1.5"><History size={12} /> Últimas Ações (3)</span>
              </h5>
              
              {loadingHistory ? (
                <p className="text-xs text-stone-400 italic">Carregando...</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-stone-400 italic">Nenhuma movimentação.</p>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[9px] before:-translate-x-px before:h-full before:w-0.5 before:bg-stone-200">
                  {history.map(log => {
                    const newStatusName = statuses.find(s => s.id === log.new_status_id)?.name || 'Desconhecido'
                    return (
                      <div key={log.id} className="relative flex items-center group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-amber-100 shadow shrink-0 z-10">
                          <div className="w-1.5 h-1.5 bg-amber-600 rounded-full"></div>
                        </div>
                        <div className="ml-3 w-full bg-stone-50 p-2 rounded-lg border border-stone-200">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-700 text-[11px]">{newStatusName}</span>
                            <span className="text-[9px] font-medium text-stone-400">{new Date(log.created_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* BOTÃO PARA A FICHA COMPLETA */}
            <button 
              onClick={() => setSelectedVisitor(visitor)}
              className="w-full mt-5 py-2.5 bg-stone-800 text-white text-xs font-bold rounded-xl hover:bg-stone-900 transition-colors flex items-center justify-center gap-2"
            >
              Abrir Ficha Completa <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    )
  }

  // ================= TELA 2: O PERFIL COMPLETO DO VISITANTE =================
  const VisitorProfile = ({ visitor }: { visitor: any }) => {
    const [fullHistory, setFullHistory] = useState<any[]>([])
    const [loadingFullHistory, setLoadingFullHistory] = useState(true)
    const currentStatus = statuses.find(s => s.id === visitor.status_id)

    useEffect(() => {
      supabase.from('visitor_history')
        .select('*, user_profiles(full_name)')
        .eq('visitor_id', visitor.id)
        .order('created_at', { ascending: false }) // Busca o histórico infinito
        .then(({ data }) => {
          if (data) setFullHistory(data)
          setLoadingFullHistory(false)
        })
    }, [visitor.id, visitor.status_id])

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4">
        <button 
          onClick={() => setSelectedVisitor(null)} 
          className="mb-6 flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-stone-800 transition-colors bg-white px-4 py-2 rounded-xl border border-stone-200 shadow-sm w-fit"
        >
          <ArrowLeft size={16} /> Voltar ao Painel
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Coluna 1: Dados Cadastrais */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-sm relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-2 ${getColorClass(currentStatus?.color)}`}></div>
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-stone-800">{visitor.full_name}</h2>
                  <p className="text-sm text-stone-500 mt-1">Status Atual: <span className="font-bold text-stone-700">{currentStatus?.name}</span></p>
                </div>
                <button onClick={() => openWhatsApp(visitor.whatsapp)} className="p-3 bg-green-50 text-green-600 rounded-2xl hover:bg-green-100 transition-colors tooltip" title="Chamar no WhatsApp">
                  <Phone size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Contato</label>
                  <p className="text-stone-800 font-medium">{visitor.whatsapp}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Bairro</label>
                  <p className="text-stone-800 font-medium">{visitor.neighborhood}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Nascimento</label>
                  <p className="text-stone-800 font-medium">{new Date(visitor.birth_date).toLocaleDateString('pt-BR')} (Idade: {new Date().getFullYear() - new Date(visitor.birth_date).getFullYear()} anos)</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Data da Primeira Visita</label>
                  <p className="text-stone-800 font-medium flex items-center gap-2">
                    <CalendarDays size={16} className="text-amber-600"/> {new Date(visitor.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <hr className="my-6 border-stone-100" />

              <div>
                <label className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">Informações Ministeriais</label>
                <div className="space-y-4">
                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <span className="text-xs font-bold text-stone-500 uppercase">Origem:</span>
                    <p className="text-sm font-semibold text-stone-800 mt-1">{visitor.origin}</p>
                  </div>
                  
                  {visitor.prayer_requests && (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <span className="text-xs font-bold text-amber-700 uppercase">Pedidos de Oração / Decisão:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {visitor.prayer_requests.split(' | ').map((tag: string, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-white border border-amber-200 text-amber-800 text-xs font-bold rounded-lg uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 2: Ações e Histórico Completo */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
              <h3 className="font-bold text-stone-800 mb-4">Gerenciar Status</h3>
              <select 
                value={visitor.status_id}
                onChange={(e) => changeStatus(visitor.id, visitor.status_id, e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-600"
              >
                {statuses.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
              <h3 className="font-bold text-stone-800 mb-6 flex items-center gap-2">
                <History size={18} className="text-amber-600" /> Histórico Completo
              </h3>
              
              {loadingFullHistory ? (
                <p className="text-sm text-stone-400 italic">Carregando...</p>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-stone-200">
                  {fullHistory.map(log => {
                    const newStatusName = statuses.find(s => s.id === log.new_status_id)?.name || 'Desconhecido'
                    return (
                      <div key={log.id} className="relative flex items-start group">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-white bg-amber-100 shadow-sm shrink-0 z-10 mt-1">
                          <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                        </div>
                        <div className="ml-4 w-full bg-stone-50 p-3 rounded-xl border border-stone-200">
                          <div className="flex flex-col">
                            <span className="font-bold text-stone-800 text-sm">{newStatusName}</span>
                            <span className="text-[10px] text-stone-500 mt-1 flex items-center gap-1">
                              <User size={12} /> {log.user_profiles?.full_name || 'Sistema'}
                            </span>
                            <span className="text-[10px] font-medium text-stone-400 mt-1">
                              {new Date(log.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    )
  }

  if (loading) return <div className="p-8 text-center text-sm text-stone-500 animate-pulse">Carregando painel de visitantes...</div>

  // Renderiza a Ficha Completa se houver um visitante selecionado
  if (selectedVisitor) {
    return <VisitorProfile visitor={selectedVisitor} />
  }

  // Renderiza o Kanban Board padrão
  return (
    <div className="animate-in fade-in h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-stone-800">Workflow de Integração</h2>
        <p className="text-sm text-stone-500">Mova os visitantes pelo funil e acompanhe o histórico.</p>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        {statuses.map((status, index) => {
          const columnVisitors = visitors.filter(v => v.status_id === status.id)
          const statusColorClass = getColorClass(status.color)

          return (
            <div key={status.id} className="bg-stone-100 rounded-2xl p-4 flex flex-col min-w-[320px] w-[320px] border border-stone-200 shrink-0">
              <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="font-bold text-stone-700 text-sm flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColorClass}`}></div> 
                  {index + 1}. {status.name} ({columnVisitors.length})
                </h3>
              </div>
              
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {columnVisitors.length === 0 && <p className="text-xs text-stone-400 italic text-center mt-4">Nenhum visitante nesta etapa.</p>}
                
                {columnVisitors.map(v => (
                  <VisitorCard key={v.id} visitor={v} statusColorClass={statusColorClass} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}