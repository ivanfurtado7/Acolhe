import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Users, MapPin, Calendar, Plus, X, Shield, Search, User, AlertCircle, Clock, CheckCircle2, XCircle, BellRing } from 'lucide-react'

type CellGroup = {
  id: string;
  name: string;
  description: string;
  meeting_day: string;
  meeting_time: string;
  neighborhood: string;
  leader_id: string | null;
  leader?: { full_name: string };
}

const DIAS_SEMANA = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

export function GruposView({ churchId, userProfile }: { churchId: string, userProfile: any }) {
  const [groups, setGroups] = useState<CellGroup[]>([])
  const [leaders, setLeaders] = useState<any[]>([])
  const [myMemberships, setMyMemberships] = useState<any[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<CellGroup>>({})

  // Permissões e Acessos
  const perms = userProfile?.computed_permissions;
  const canEdit = perms?.grupos?.edit || perms?.grupos?.create || false;

  useEffect(() => {
    if (churchId) {
      fetchGroups()
      if (canEdit) fetchLeaders()
    }
  }, [churchId])

  async function fetchGroups() {
    setLoading(true)
    
    // Busca os grupos
    const { data: groupsData } = await supabase
      .from('cell_groups')
      .select('*, leader:user_profiles!cell_groups_leader_id_fkey(full_name)')
      .eq('church_id', churchId)
      .order('name')

    // Busca os status de participação do usuário logado
    const { data: membershipsData } = await supabase
      .from('group_members')
      .select('*')
      .eq('user_id', userProfile.id)

    // Busca solicitações pendentes (para o painel de aprovação do líder/admin)
    const { data: allPending } = await supabase
      .from('group_members')
      .select('*, user:user_profiles(full_name), group:cell_groups(name, leader_id)')
      .eq('church_id', churchId)
      .eq('status', 'pendente')

    if (groupsData) setGroups(groupsData as unknown as CellGroup[])
    if (membershipsData) setMyMemberships(membershipsData)
    
    if (allPending) {
      // Filtra as pendências: mostra se o usuário for ADMIN (canEdit geral) ou se for o LÍDER do grupo
      const relevantPending = allPending.filter(req => canEdit || req.group?.leader_id === userProfile.id)
      setPendingRequests(relevantPending)
    }

    setLoading(false)
  }

  async function fetchLeaders() {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, role')
      .eq('church_id', churchId)
      .in('role', ['admin', 'lider'])
      .order('full_name')
      
    if (data) setLeaders(data)
  }

  const handleOpenModal = (group?: CellGroup) => {
    setErrorMessage(null)
    if (group) setFormData(group)
    else setFormData({ meeting_day: 'Quarta-feira', meeting_time: '19:30' })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setFormData({})
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    const payload = {
      church_id: churchId,
      name: formData.name,
      description: formData.description || '',
      leader_id: formData.leader_id || null,
      meeting_day: formData.meeting_day || 'Quarta-feira',
      meeting_time: formData.meeting_time || '19:30',
      neighborhood: formData.neighborhood || ''
    }

    let error = null;

    if (formData.id) {
      const res = await supabase.from('cell_groups').update(payload).eq('id', formData.id)
      error = res.error
    } else {
      const res = await supabase.from('cell_groups').insert([payload])
      error = res.error
    }

    setIsSubmitting(false)

    if (error) {
      setErrorMessage(`Erro ao salvar: ${error.message}`)
    } else {
      await fetchGroups()
      handleCloseModal()
    }
  }

  const handleJoinGroup = async (groupId: string) => {
    const { error } = await supabase.from('group_members').insert([{
      church_id: churchId,
      group_id: groupId,
      user_id: userProfile.id,
      status: 'pendente'
    }]);

    if (!error) {
      await fetchGroups(); 
    } else {
      alert("Houve um erro ao enviar sua solicitação. Tente novamente.");
    }
  }

  const handleResolveRequest = async (requestId: string, newStatus: 'aprovado' | 'recusado') => {
    await supabase.from('group_members').update({ status: newStatus }).eq('id', requestId)
    fetchGroups()
  }

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (g.neighborhood && g.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      {/* Cabeçalho */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-1 tracking-tight text-stone-800 flex items-center gap-3">
            <Users className="text-amber-600" size={28} /> Grupos de Cuidado
          </h2>
          <p className="text-stone-500 text-sm">Encontre uma célula, grupo pequeno ou grupo de estudo perto de você.</p>
        </div>
        {canEdit && (
          <button 
            onClick={() => handleOpenModal()}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap cursor-pointer"
          >
            <Plus size={18} /> Novo Grupo
          </button>
        )}
      </div>

      {/* PAINEL DE SOLICITAÇÕES PENDENTES (Visível para Líderes/Admins) */}
      {pendingRequests.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
          <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4">
            <BellRing size={18} className="text-amber-600" /> Solicitações Pendentes ({pendingRequests.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex justify-between items-center bg-stone-50 p-4 rounded-2xl border border-stone-100 shadow-sm">
                <div className="overflow-hidden pr-3">
                  <p className="text-sm font-bold text-stone-800 truncate">{req.user?.full_name}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">Deseja entrar em: <strong className="text-amber-700">{req.group?.name}</strong></p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => handleResolveRequest(req.id, 'aprovado')} className="p-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-xl transition-colors cursor-pointer" title="Aprovar">
                    <CheckCircle2 size={18}/>
                  </button>
                  <button onClick={() => handleResolveRequest(req.id, 'recusado')} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl transition-colors cursor-pointer" title="Recusar">
                    <XCircle size={18}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
        <input 
          type="text" 
          placeholder="Buscar por nome do grupo ou bairro..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-white border border-stone-200 rounded-2xl text-sm font-medium focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm"
        />
      </div>

      {/* Grid de Grupos */}
      {loading ? (
        <div className="text-center py-10 text-stone-400 font-medium animate-pulse">Carregando grupos...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 text-stone-400 shadow-sm">
          <Users size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-lg text-stone-600">Nenhum grupo encontrado</p>
          <p className="text-sm mt-1">Nenhum grupo cadastrado ou correspondente à busca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map(group => {
            const membership = myMemberships.find(m => m.group_id === group.id);
            const myStatus = membership ? membership.status : null;
            
            return (
              <div key={group.id} className={`bg-white border rounded-3xl overflow-hidden transition-all shadow-sm flex flex-col ${myStatus === 'aprovado' ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-stone-200 hover:border-amber-300'}`}>
                
                <div className="p-6 border-b border-stone-100 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-stone-800 tracking-tight leading-tight">{group.name}</h3>
                    {canEdit && (
                      <button onClick={() => handleOpenModal(group)} className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer shrink-0 ml-2">
                        Editar
                      </button>
                    )}
                  </div>
                  
                  {group.description && <p className="text-sm text-stone-500 mb-5 line-clamp-2">{group.description}</p>}
                  
                  <div className="space-y-3 mt-auto">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center shrink-0 border border-stone-100"><MapPin size={14} className="text-stone-500" /></div>
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Endereço / Bairro</p>
                        <p className="text-sm font-medium text-stone-700">{group.neighborhood || 'Não definido'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center shrink-0 border border-stone-100"><Calendar size={14} className="text-stone-500" /></div>
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Encontros</p>
                        <p className="text-sm font-medium text-stone-700">{group.meeting_day} às {group.meeting_time ? group.meeting_time.substring(0, 5) : '--:--'}</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-stone-50 px-5 py-4 flex items-center justify-between border-t border-stone-100 shrink-0">
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><User size={12} strokeWidth={3}/></div>
                    <span className="text-xs font-semibold text-stone-600 truncate">Líder: <span className="text-stone-800">{group.leader?.full_name?.split(' ')[0] || 'Não definido'}</span></span>
                  </div>

                  {/* AÇÕES DO USUÁRIO */}
                  <div className="shrink-0">
                    {!myStatus && (
                      <button 
                        onClick={() => handleJoinGroup(group.id)} 
                        className="text-[11px] font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
                      >
                        Participar
                      </button>
                    )}
                    {myStatus === 'pendente' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg">
                        <Clock size={12}/> Pendente
                      </span>
                    )}
                    {myStatus === 'aprovado' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-lg">
                        <CheckCircle2 size={12}/> Participando
                      </span>
                    )}
                    {myStatus === 'recusado' && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg">
                        Sem vaga
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO/EDIÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-xl font-bold text-stone-800">{formData.id ? 'Editar Grupo' : 'Novo Grupo de Cuidado'}</h3>
              <button type="button" onClick={handleCloseModal} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full transition-colors cursor-pointer"><X size={20}/></button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-stone-50/50 space-y-5">
                {errorMessage && (
                  <div className="p-4 bg-red-50 text-red-700 text-sm font-semibold rounded-xl border border-red-200 flex items-start gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Nome do Grupo *</label>
                  <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: GC Família Feliz" className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all shadow-sm" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Descrição / Foco do Grupo</label>
                  <textarea rows={3} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Ex: Grupo focado em casais jovens..." className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all shadow-sm resize-none" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Shield size={14}/> Líder do Grupo</label>
                  <select value={formData.leader_id || ''} onChange={e => setFormData({...formData, leader_id: e.target.value})} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 focus:border-amber-500 outline-none shadow-sm cursor-pointer transition-all">
                    <option value="">Sem líder definido</option>
                    {leaders.map(l => (
                      <option key={l.id} value={l.id}>{l.full_name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Dia do Encontro</label>
                    <select value={formData.meeting_day || ''} onChange={e => setFormData({...formData, meeting_day: e.target.value})} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 focus:border-amber-500 outline-none shadow-sm cursor-pointer">
                      {DIAS_SEMANA.map(dia => <option key={dia} value={dia}>{dia}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Horário</label>
                    <input type="time" value={formData.meeting_time?.substring(0, 5) || ''} onChange={e => setFormData({...formData, meeting_time: e.target.value})} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:border-amber-500 outline-none transition-all shadow-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Endereço ou Bairro</label>
                  <input type="text" value={formData.neighborhood || ''} onChange={e => setFormData({...formData, neighborhood: e.target.value})} placeholder="Ex: Rua das Flores, 123 - Centro" className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all shadow-sm" />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-stone-100 bg-white flex justify-end gap-3 shrink-0 rounded-b-3xl">
                <button type="button" onClick={handleCloseModal} className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl transition-colors cursor-pointer">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50 cursor-pointer">
                  {isSubmitting ? 'Salvando...' : 'Salvar Grupo'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}