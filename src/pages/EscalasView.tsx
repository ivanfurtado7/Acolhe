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

  const [activeTab, setActiveTab] = useState<'proximas' | 'anteriores'>('proximas')
  const [currentPage, setCurrentPage] = useState(1)

  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedMinistryId, setSelectedMinistryId] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [modalError, setModalError] = useState<string | null>(null)

  const [newMinistryName, setNewMinistryName] = useState('')
  const [editingMinistry, setEditingMinistry] = useState<{ id: string; name: string } | null>(null)
  const [ministryError, setMinistryError] = useState<string | null>(null)

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; rosterId: string; targetStatus: string; eventTitle: string } | null>(null)

  const userRole = userProfile?.role?.toLowerCase() || 'membro'
  const canManage = userRole === 'admin' || userRole === 'lider'

  useEffect(() => { if (churchId) fetchData() }, [churchId])

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

  const handleSaveMinistry = async (e: React.FormEvent) => {
    e.preventDefault()
    setMinistryError(null)
    if (!newMinistryName.trim()) return

    if (editingMinistry) {
      const { error } = await supabase.from('ministries').update({ name: newMinistryName.trim() }).eq('id', editingMinistry.id)
      if (error) setMinistryError(`Erro: ${error.message}`)
      else { setEditingMinistry(null); setNewMinistryName(''); fetchData() }
    } else {
      const { error } = await supabase.from('ministries').insert([{ church_id: churchId, name: newMinistryName.trim() }])
      if (error) setMinistryError(`Erro: ${error.message}`)
      else { setNewMinistryName(''); fetchData() }
    }
  }

  const handleDeleteMinistry = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir?')) { await supabase.from('ministries').delete().eq('id', id); fetchData() }
  }

  const membersInSelectedMinistry = members.filter(mem => {
    if (!selectedMinistryId) return true;
    const isLinked = userMinistries.some(um => um.user_id === mem.id && um.ministry_id === selectedMinistryId);
    const hasAnyLinkedToMinistry = userMinistries.some(um => um.ministry_id === selectedMinistryId);
    return !hasAnyLinkedToMinistry || isLinked;
  });

  const handleToggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId])
  }

  const handleAddRosters = async (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    if (!selectedEventId || !selectedMinistryId || selectedUserIds.length === 0) return

    const existing = rosters.filter(r => r.post_id === selectedEventId && r.ministry_id === selectedMinistryId)
    const recordsToInsert = selectedUserIds
      .filter(userId => !existing.some(r => r.user_id === userId))
      .map(userId => ({ church_id: churchId, post_id: selectedEventId, ministry_id: selectedMinistryId, user_id: userId, status: 'Pendente' }))

    if (recordsToInsert.length > 0) await supabase.from('rosters').insert(recordsToInsert)
    setIsModalOpen(false); setSelectedUserIds([]); fetchData()
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

  const now = new Date().getTime()
  const futureEvents = events.filter(ev => ev.event_date && new Date(ev.event_date).getTime() >= new Date().setHours(0,0,0,0))

  const groupedRostersMap = new Map<string, any>()
  rosters.forEach(r => {
    const eventDateMs = r.event?.event_date ? new Date(r.event.event_date).getTime() : 0
    const isPast = eventDateMs < now
    if (activeTab === 'proximas' && isPast) return
    if (activeTab === 'anteriores' && !isPast) return
    
    const key = `${r.post_id}_${r.ministry_id}`
    if (!groupedRostersMap.has(key)) groupedRostersMap.set(key, { ...r, membersList: [] })
    groupedRostersMap.get(key).membersList.push({ id: r.id, userId: r.user_id, name: r.user?.full_name, status: r.status })
  })

  const groups = Array.from(groupedRostersMap.values()).sort((a,b) => new Date(a.event?.event_date).getTime() - new Date(b.event?.event_date).getTime())
  const paginated = groups.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  return (
    <div className="space-y-6 pb-20 animate-in fade-in">
      <div className="bg-white border border-stone-200 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-stone-800 flex items-center gap-2"><CalendarCheck className="text-amber-600" /> Escalas</h2>
        </div>
        {canManage && <button onClick={() => setIsModalOpen(true)} className="w-full md:w-auto px-6 py-3 bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/20 active:scale-95 transition-all cursor-pointer"><Plus size={18} className="inline mr-2"/> Escalar</button>}
      </div>

      <div className="flex gap-2 bg-stone-100 p-1.5 rounded-2xl">
        {['proximas', 'anteriores'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab as any); setCurrentPage(1); }} className={`flex-1 py-3 text-xs md:text-sm font-bold rounded-xl capitalize cursor-pointer ${activeTab === tab ? 'bg-white text-amber-700 shadow-sm' : 'text-stone-500'}`}>{tab}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginated.map(g => (
          <div key={`${g.post_id}_${g.ministry_id}`} className="bg-white border border-stone-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-700 px-3 py-1 rounded-lg">{g.ministry?.name}</span>
              <span className="text-[10px] font-bold text-stone-400">{g.membersList.length} voluntários</span>
            </div>
            <div>
              <p className="font-bold text-stone-800 text-base leading-tight">{g.event?.title}</p>
              <p className="text-xs text-stone-500">{new Date(g.event?.event_date).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="space-y-2">
              {g.membersList.map((m: any) => (
                <div key={m.id} className="flex justify-between items-center bg-stone-50 p-3 rounded-xl border border-stone-100 text-xs">
                  <span className="font-semibold text-stone-700 truncate">{m.name}</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase ${m.status === 'Confirmado' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>{m.status}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-stone-900/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-[2rem] p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl text-stone-800">Escalar Voluntários</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-stone-400 hover:text-stone-700 rounded-full cursor-pointer"><XCircle size={20}/></button>
            </div>

            {modalError && <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200">{modalError}</div>}

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Evento *</label>
              <select className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold outline-none focus:border-amber-500" value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}>
                <option value="">Selecione o evento...</option>
                {futureEvents.map(e => <option key={e.id} value={e.id}>{e.title} ({new Date(e.event_date).toLocaleDateString('pt-BR')})</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Setor / Ministério *</label>
              <select className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold outline-none focus:border-amber-500" value={selectedMinistryId} onChange={e => { setSelectedMinistryId(e.target.value); setSelectedUserIds([]); }}>
                <option value="">Selecione o setor...</option>
                {ministries.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase mb-1.5">Voluntários (Clique para selecionar) *</label>
              <div className="max-h-52 overflow-y-auto border border-stone-200 rounded-xl p-3 bg-stone-50 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {!selectedMinistryId ? (
                  <p className="text-xs text-stone-400 text-center py-4 col-span-2">Selecione um setor primeiro.</p>
                ) : membersInSelectedMinistry.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-4 col-span-2">Nenhum membro encontrado.</p>
                ) : (
                  membersInSelectedMinistry.map(mem => {
                    const isSelected = selectedUserIds.includes(mem.id);
                    return (
                      <button
                        key={mem.id}
                        type="button"
                        onClick={() => handleToggleUserSelection(mem.id)}
                        className={`p-3.5 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                          isSelected 
                          ? 'bg-amber-600 text-white border-amber-600 shadow-md scale-[0.98]' 
                          : 'bg-white text-stone-700 border-stone-200 hover:border-amber-300'
                        }`}
                      >
                        {mem.full_name}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-2xl cursor-pointer text-sm">Cancelar</button>
              <button type="button" onClick={handleAddRosters} disabled={selectedUserIds.length === 0} className="flex-1 py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl shadow-lg shadow-amber-600/20 disabled:opacity-50 cursor-pointer text-sm">Confirmar ({selectedUserIds.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}