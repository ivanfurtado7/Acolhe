import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { CalendarCheck, Plus, CheckCircle2, XCircle, Calendar, Shield, User, Trash2, AlertCircle, AlertTriangle, Edit3, ChevronLeft, ChevronRight, Filter } from 'lucide-react'

const ITEMS_PER_PAGE = 6;

export function EscalasView({ churchId, userProfile }: { churchId: string, userProfile: any }) {
  const [events, setEvents] = useState<any[]>([])
  const [ministries, setMinistries] = useState<any[]>([])
  const [rosters, setRosters] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [userMinistries, setUserMinistries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Abas e Paginação
  const [activeTab, setActiveTab] = useState<'proximas' | 'anteriores'>('proximas')
  const [currentPage, setCurrentPage] = useState(1)

  // Filtros de Data
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')

  // Modais e Múltipla Escolha
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedMinistryId, setSelectedMinistryId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [modalError, setModalError] = useState<string | null>(null)

  // Edição / Criação de Setor
  const [newMinistryName, setNewMinistryName] = useState('')
  const [editingMinistry, setEditingMinistry] = useState<{ id: string; name: string } | null>(null)
  const [ministryError, setMinistryError] = useState<string | null>(null)

  // Modal de Confirmação de Status
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; rosterId: string; targetStatus: string; eventTitle: string } | null>(null)

  const userRole = userProfile?.role?.toLowerCase() || 'membro'
  const canManage = userRole === 'admin' || userRole === 'lider'

  useEffect(() => {
    if (churchId) {
      fetchData()
    }
  }, [churchId])

  async function fetchData() {
    setLoading(true)
    const [eventsRes, ministriesRes, rostersRes, membersRes, userMinRes] = await Promise.all([
      supabase.from('mural_posts').select('*').eq('church_id', churchId).eq('type', 'evento').order('event_date'),
      supabase.from('ministries').select('*').eq('church_id', churchId).order('name'),
      supabase.from('rosters').select('*, ministry:ministries(name), user:user_profiles(full_name), event:mural_posts(title, event_date)').eq('church_id', churchId),
      supabase.from('user_profiles').select('id, full_name').eq('church_id', churchId).order('full_name'),
      supabase.from('user_ministries').select('*').eq('church_id', churchId)
    ])

    if (eventsRes.data) setEvents(eventsRes.data)
    if (ministriesRes.data) setMinistries(ministriesRes.data)
    if (rostersRes.data) setRosters(rostersRes.data)
    if (membersRes.data) setMembers(membersRes.data)
    if (userMinRes.data) setUserMinistries(userMinRes.data)
    setLoading(false)
  }

  // --- GERENCIAMENTO DE SETORES ---
  const handleSaveMinistry = async (e: React.FormEvent) => {
    e.preventDefault()
    setMinistryError(null)
    if (!newMinistryName.trim()) return

    if (editingMinistry) {
      const { error } = await supabase.from('ministries').update({ name: newMinistryName.trim() }).eq('id', editingMinistry.id)
      if (error) setMinistryError(`Erro ao atualizar setor: ${error.message}`)
      else {
        setEditingMinistry(null)
        setNewMinistryName('')
        fetchData()
      }
    } else {
      const { error } = await supabase.from('ministries').insert([{ church_id: churchId, name: newMinistryName.trim() }])
      if (error) setMinistryError(`Erro ao salvar setor: ${error.message}`)
      else {
        setNewMinistryName('')
        fetchData()
      }
    }
  }

  const handleDeleteMinistry = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este setor?')) {
      await supabase.from('ministries').delete().eq('id', id)
      fetchData()
    }
  }

  const handleStartEditMinistry = (m: { id: string; name: string }) => {
    setEditingMinistry(m)
    setNewMinistryName(m.name)
  }

  // --- FILTRO INTELIGENTE DE MEMBROS POR SETOR ---
  const membersInSelectedMinistry = members.filter(mem => {
    if (!selectedMinistryId) return true;
    const isLinked = userMinistries.some(um => um.user_id === mem.id && um.ministry_id === selectedMinistryId);
    const hasAnyLinkedToMinistry = userMinistries.some(um => um.ministry_id === selectedMinistryId);
    if (!hasAnyLinkedToMinistry) return true;
    return isLinked;
  });

  const handleToggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const handleAddRosters = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    if (!selectedEventId || !selectedMinistryId || selectedUserIds.length === 0) return

    const existingForEventAndMinistry = rosters.filter(
      r => r.post_id === selectedEventId && r.ministry_id === selectedMinistryId
    )
    const alreadyEscalatedNames: string[] = []

    const recordsToInsert: any[] = []
    for (const userId of selectedUserIds) {
      const alreadyExists = existingForEventAndMinistry.some(r => r.user_id === userId)
      if (alreadyExists) {
        const memberObj = members.find(m => m.id === userId)
        if (memberObj) alreadyEscalatedNames.push(memberObj.full_name)
      } else {
        recordsToInsert.push({
          church_id: churchId,
          post_id: selectedEventId,
          ministry_id: selectedMinistryId,
          user_id: userId,
          status: 'Pendente'
        })
      }
    }

    if (alreadyEscalatedNames.length > 0) {
      setModalError(`Os seguintes voluntários já estão escalados neste setor para este evento: ${alreadyEscalatedNames.join(', ')}`)
      return
    }

    if (recordsToInsert.length > 0) {
      await supabase.from('rosters').insert(recordsToInsert)
    }

    setIsModalOpen(false)
    setSelectedEventId('')
    setSelectedMinistryId('')
    setSelectedUserIds([])
    setModalError(null)
    fetchData()
  }

  const confirmAndUpdateStatus = async () => {
    if (!confirmModal) return
    await supabase.from('rosters').update({ status: confirmModal.targetStatus }).eq('id', confirmModal.rosterId)
    setConfirmModal(null)
    fetchData()
  }

  const handleDeleteRosterMember = async (rosterId: string) => {
    await supabase.from('rosters').delete().eq('id', rosterId)
    fetchData()
  }

  // --- AGRUPAMENTO CONCENTRADO POR EVENTO E SETOR ---
  const now = new Date().getTime()

  // Filtra apenas eventos futuros no select do modal
  const futureEvents = events.filter(ev => {
    if (!ev.event_date) return false
    return new Date(ev.event_date).getTime() >= new Date().setHours(0,0,0,0)
  })

  // Agrupa os registros de escalas por combinação única de (post_id + ministry_id)
  const groupedRostersMap = new Map<string, {
    post_id: string;
    ministry_id: string;
    event: any;
    ministry: any;
    membersList: any[];
  }>()

  rosters.forEach(r => {
    const eventDateMs = r.event?.event_date ? new Date(r.event.event_date).getTime() : 0
    const isPast = eventDateMs < now

    // Filtro por Aba
    if (activeTab === 'proximas' && isPast) return
    if (activeTab === 'anteriores' && !isPast) return

    // Filtro por Data Inicial / Final
    if (startDateFilter && r.event?.event_date) {
      if (new Date(r.event.event_date).getTime() < new Date(startDateFilter).getTime()) return
    }
    if (endDateFilter && r.event?.event_date) {
      const endLimit = new Date(endDateFilter)
      endLimit.setHours(23, 59, 59)
      if (new Date(r.event.event_date).getTime() > endLimit.getTime()) return
    }

    const groupKey = `${r.post_id}_${r.ministry_id}`
    if (!groupedRostersMap.has(groupKey)) {
      groupedRostersMap.set(groupKey, {
        post_id: r.post_id,
        ministry_id: r.ministry_id,
        event: r.event,
        ministry: r.ministry,
        membersList: []
      })
    }
    groupedRostersMap.get(groupKey)?.membersList.push({
      rosterId: r.id,
      userId: r.user_id,
      fullName: r.user?.full_name || 'Voluntário',
      status: r.status
    })
  })

  const groupedRostersList = Array.from(groupedRostersMap.values()).sort((a, b) => 
    new Date(a.event?.event_date || 0).getTime() - new Date(b.event?.event_date || 0).getTime()
  )

  const totalPages = Math.ceil(groupedRostersList.length / ITEMS_PER_PAGE) || 1
  const paginatedGroups = groupedRostersList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      {/* Cabeçalho */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-1 tracking-tight text-stone-800 flex items-center gap-3">
            <CalendarCheck className="text-amber-600" size={28} /> Escalas e Voluntariado
          </h2>
          <p className="text-stone-500 text-sm">Gerencie equipes para os cultos e eventos e confirme sua presença.</p>
        </div>
        {canManage && (
          <button 
            onClick={() => { setIsModalOpen(true); setModalError(null); }}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap cursor-pointer"
          >
            <Plus size={18} /> Escalar Voluntários
          </button>
        )}
      </div>

      {/* Gerenciar Setores */}
      {canManage && (
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold text-stone-800 mb-4 text-xs uppercase tracking-wider">Setores / Ministérios</h3>
          
          {ministryError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{ministryError}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            {ministries.length === 0 ? (
              <p className="text-xs text-stone-400 italic">Nenhum setor cadastrado ainda.</p>
            ) : (
              ministries.map(m => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 text-stone-700 text-xs font-semibold rounded-xl border border-stone-200 shadow-sm">
                  <span>{m.name}</span>
                  <button onClick={() => handleStartEditMinistry(m)} className="text-stone-400 hover:text-amber-600 cursor-pointer" title="Editar Setor">
                    <Edit3 size={13} />
                  </button>
                  <button onClick={() => handleDeleteMinistry(m.id)} className="text-stone-400 hover:text-red-600 cursor-pointer" title="Excluir Setor">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSaveMinistry} className="flex gap-2 max-w-md">
            <input 
              type="text" 
              placeholder={editingMinistry ? "Editar nome do setor..." : "Novo Setor (ex: Louvor, Mídia)..."} 
              value={newMinistryName}
              onChange={e => setNewMinistryName(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium outline-none focus:border-amber-500 shadow-sm"
            />
            <button type="submit" className="px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white text-xs font-bold rounded-xl transition-colors shadow-sm cursor-pointer whitespace-nowrap">
              {editingMinistry ? 'Atualizar' : 'Adicionar Setor'}
            </button>
            {editingMinistry && (
              <button type="button" onClick={() => { setEditingMinistry(null); setNewMinistryName(''); }} className="px-3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-bold rounded-xl cursor-pointer">
                Cancelar
              </button>
            )}
          </form>
        </div>
      )}

      {/* Listagem de Escalas Concentradas */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex gap-2 bg-stone-100 p-1.5 rounded-xl shrink-0">
            <button 
              onClick={() => { setActiveTab('proximas'); setCurrentPage(1); }} 
              className={`py-2 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'proximas' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Próximas Escalas
            </button>
            <button 
              onClick={() => { setActiveTab('anteriores'); setCurrentPage(1); }} 
              className={`py-2 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeTab === 'anteriores' ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Escalas Anteriores
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <Filter size={16} className="text-stone-400 shrink-0" />
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-bold text-stone-400 uppercase">De:</span>
              <input 
                type="date" 
                value={startDateFilter} 
                onChange={e => { setStartDateFilter(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-xs font-semibold text-stone-700 outline-none" 
              />
            </div>
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-bold text-stone-400 uppercase">Até:</span>
              <input 
                type="date" 
                value={endDateFilter} 
                onChange={e => { setEndDateFilter(e.target.value); setCurrentPage(1); }}
                className="bg-transparent text-xs font-semibold text-stone-700 outline-none" 
              />
            </div>
            {(startDateFilter || endDateFilter) && (
              <button 
                onClick={() => { setStartDateFilter(''); setEndDateFilter(''); setCurrentPage(1); }}
                className="text-xs font-bold text-amber-700 hover:underline px-2 cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-stone-400 font-medium">Carregando escalas...</div>
        ) : paginatedGroups.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400">
            <Shield size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-stone-600">Nenhuma escala encontrada nesta aba.</p>
            <p className="text-xs mt-1">Tente ajustar os filtros ou cadastrar novos voluntários.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedGroups.map(group => {
                const eventDate = group.event?.event_date ? new Date(group.event.event_date) : null;
                const isExpired = eventDate ? eventDate.getTime() < now : false;

                return (
                  <div key={`${group.post_id}_${group.ministry_id}`} className="border border-stone-200 bg-white rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:border-amber-300 transition-all">
                    <div>
                      {/* Topo do Card */}
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 px-2.5 py-1 rounded-md border border-amber-100">
                          {group.ministry?.name || 'Setor'}
                        </span>
                        <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                          {group.membersList.length} voluntário(s)
                        </span>
                      </div>

                      <h4 className="font-bold text-stone-800 text-base mb-1">{group.event?.title || 'Evento'}</h4>
                      <p className="text-xs text-stone-500 flex items-center gap-1 mb-4">
                        <Calendar size={12}/> {eventDate ? eventDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                      </p>

                      {/* Lista de Membros Concentrada */}
                      <div className="space-y-2 mb-4 max-h-44 overflow-y-auto pr-1">
                        {group.membersList.map((m: any) => {
                          const isMe = m.userId === userProfile.id;
                          return (
                            <div key={m.rosterId} className={`flex items-center justify-between p-2.5 rounded-xl border ${isMe ? 'bg-amber-50/60 border-amber-200' : 'bg-stone-50 border-stone-100'}`}>
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-stone-600 font-bold text-[10px] border border-stone-200 shrink-0">
                                  <User size={12} />
                                </div>
                                <span className="text-xs font-bold text-stone-800 truncate">{m.fullName} {isMe && '(Você)'}</span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  m.status === 'Confirmado' ? 'bg-emerald-100 text-emerald-800' :
                                  m.status === 'Indisponível' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                                }`}>
                                  {m.status}
                                </span>

                                {/* Ações Individuais (Confirmar/Recusar se for eu, ou Excluir se for gestor) */}
                                {isMe && !isExpired && (
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => setConfirmModal({ isOpen: true, rosterId: m.rosterId, targetStatus: 'Confirmado', eventTitle: group.event?.title })}
                                      className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                                      title="Confirmar Presença"
                                    >
                                      <CheckCircle2 size={12} />
                                    </button>
                                    <button 
                                      onClick={() => setConfirmModal({ isOpen: true, rosterId: m.rosterId, targetStatus: 'Indisponível', eventTitle: group.event?.title })}
                                      className="p-1 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                                      title="Marcar Indisponibilidade"
                                    >
                                      <XCircle size={12} />
                                    </button>
                                  </div>
                                )}

                                {canManage && (
                                  <button 
                                    onClick={() => handleDeleteRosterMember(m.rosterId)} 
                                    className="text-stone-300 hover:text-red-500 transition-colors cursor-pointer ml-1"
                                    title="Remover voluntário da escala"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-100 text-right">
                      {isExpired && <span className="text-[10px] font-semibold text-stone-400 italic">Evento Encerrado</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-stone-100">
                <p className="text-xs text-stone-500 font-medium">
                  Mostrando página <strong className="text-stone-800">{currentPage}</strong> de <strong className="text-stone-800">{totalPages}</strong> ({groupedRostersList.length} escalas no total)
                </p>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl disabled:opacity-30 transition-colors cursor-pointer"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* Modal de Confirmação de Status */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-xl font-bold text-stone-800">Confirmar alteração</h3>
            <p className="text-sm text-stone-600">
              Tem certeza que deseja alterar sua resposta para <strong className={confirmModal.targetStatus === 'Confirmado' ? 'text-emerald-600' : 'text-red-600'}>{confirmModal.targetStatus}</strong> no evento <strong>{confirmModal.eventTitle}</strong>?
            </p>
            <div className="flex justify-center gap-3 pt-4">
              <button onClick={() => setConfirmModal(null)} className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl cursor-pointer">Cancelar</button>
              <button onClick={confirmAndUpdateStatus} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-sm cursor-pointer">Sim, Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Escalar Voluntários (Filtrado com Eventos Futuros) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5">
            <h3 className="text-xl font-bold text-stone-800">Escalar Voluntários</h3>

            {modalError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddRosters} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Evento *</label>
                <select required value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium outline-none focus:border-amber-500">
                  <option value="">Selecione o evento futuro...</option>
                  {futureEvents.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title} ({new Date(ev.event_date).toLocaleDateString('pt-BR')})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Setor / Ministério *</label>
                <select 
                  required 
                  value={selectedMinistryId} 
                  onChange={e => { 
                    setSelectedMinistryId(e.target.value); 
                    setSelectedUserIds([]); 
                  }} 
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium outline-none focus:border-amber-500"
                >
                  <option value="">Selecione o setor...</option>
                  {ministries.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Membros / Voluntários (Do Setor Selecionado) *</label>
                <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-xl p-3 bg-stone-50 space-y-2">
                  {!selectedMinistryId ? (
                    <p className="text-xs text-stone-400 text-center py-2">Selecione um setor primeiro.</p>
                  ) : membersInSelectedMinistry.length === 0 ? (
                    <p className="text-xs text-stone-400 text-center py-2">Nenhum membro vinculado a este setor.</p>
                  ) : (
                    membersInSelectedMinistry.map(mem => {
                      const isChecked = selectedUserIds.includes(mem.id);
                      return (
                        <label key={mem.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-amber-50 border border-amber-200' : 'hover:bg-stone-100'}`}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => handleToggleUserSelection(mem.id)}
                            className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                          />
                          <span className="text-sm font-semibold text-stone-800">{mem.full_name}</span>
                        </label>
                      )
                    })
                  )}
                </div>
                <p className="text-[10px] text-stone-400 mt-1">O sistema bloqueará automaticamente se o membro já estiver escalado para este evento neste setor.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-stone-100 text-stone-700 font-bold text-sm rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" disabled={selectedUserIds.length === 0} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-sm cursor-pointer disabled:opacity-50">
                  Salvar Escalas ({selectedUserIds.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}