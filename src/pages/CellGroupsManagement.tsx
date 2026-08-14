import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Users, MapPin, CalendarDays, Clock, Plus, Trash2, ArrowLeft, UserCircle } from 'lucide-react'

export function CellGroupsManagement({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true)
  const [churchId, setChurchId] = useState<string | null>(null)
  
  // Dados
  const [groups, setGroups] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([]) // Lista de pessoas
  
  // Controle de Formulário
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [leaderId, setLeaderId] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [meetingDay, setMeetingDay] = useState('Quinta-feira')
  const [meetingTime, setMeetingTime] = useState('19:30')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data: profile } = await supabase.from('user_profiles').select('church_id').eq('id', userData.user.id).single()
    
    if (profile?.church_id) {
      setChurchId(profile.church_id)
      
      // 1. Busca os Grupos (Sem pedir o join pro banco para evitar o erro de duplo relacionamento)
      const { data: groupsData } = await supabase
        .from('cell_groups')
        .select('*')
        .eq('church_id', profile.church_id)
        .order('created_at', { ascending: false })
      
      // 2. Busca os usuários da igreja
      const { data: membersData } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('church_id', profile.church_id)
        .order('full_name', { ascending: true })

      if (groupsData) setGroups(groupsData)
      if (membersData) setMembers(membersData)
    }
    setLoading(false)
  }

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!churchId) return
    
    setSaving(true)
    setError(null)

    // Insere e retorna apenas os dados da tabela (sem join)
    const { data, error: insertError } = await supabase
      .from('cell_groups')
      .insert([{
        church_id: churchId,
        name,
        leader_id: leaderId || null,
        neighborhood,
        meeting_day: meetingDay,
        meeting_time: meetingTime
      }])
      .select('*')
      .single()

    setSaving(false)

    if (insertError) {
      setError('Erro ao salvar grupo: ' + insertError.message)
    } else if (data) {
      setGroups(prev => [data, ...prev])
      setShowForm(false)
      // Limpa os campos
      setName('')
      setLeaderId('')
      setNeighborhood('')
      setMeetingTime('19:30')
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este Grupo de Crescimento?')) {
      const { error } = await supabase.from('cell_groups').delete().eq('id', id)
      if (!error) {
        setGroups(prev => prev.filter(g => g.id !== id))
      } else {
        alert('Erro ao excluir: ' + error.message)
      }
    }
  }

  if (loading) return <div className="p-8 text-center text-sm text-stone-500 animate-pulse">Carregando grupos de crescimento...</div>

  return (
    <div className="animate-in fade-in space-y-8">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors bg-white border border-stone-200 shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-stone-800">Grupos de Crescimento</h2>
            <p className="text-sm text-stone-500">Gerencie os locais, líderes e horários.</p>
          </div>
        </div>
        
        {!showForm && (
          <button 
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-amber-700 text-white text-sm font-bold rounded-xl hover:bg-amber-800 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus size={18} /> Novo Grupo
          </button>
        )}
      </div>

      {error && <div className="p-3 text-sm text-red-600 bg-red-50 rounded-xl border border-red-100">{error}</div>}

      {/* FORMULÁRIO DE CRIAÇÃO */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm animate-in slide-in-from-top-4">
          <h3 className="text-lg font-bold text-stone-800 mb-4">Cadastrar Novo Grupo</h3>
          <form onSubmit={handleSaveGroup} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Nome do Grupo *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: GC Esperança" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Líder Responsável</label>
                <select value={leaderId} onChange={e => setLeaderId(e.target.value)} className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none text-stone-700">
                  <option value="">Selecione um líder (opcional)...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Bairro / Região *</label>
                <input type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} required placeholder="Ex: Centro" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Dia do Encontro *</label>
                <select value={meetingDay} onChange={e => setMeetingDay(e.target.value)} required className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none text-stone-700">
                  <option value="Segunda-feira">Segunda-feira</option>
                  <option value="Terça-feira">Terça-feira</option>
                  <option value="Quarta-feira">Quarta-feira</option>
                  <option value="Quinta-feira">Quinta-feira</option>
                  <option value="Sexta-feira">Sexta-feira</option>
                  <option value="Sábado">Sábado</option>
                  <option value="Domingo">Domingo</option>
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">Horário *</label>
                <input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} required className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none text-stone-700" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-stone-600 font-semibold text-sm hover:bg-stone-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={saving} className="px-6 py-2 bg-amber-700 text-white font-bold text-sm rounded-xl hover:bg-amber-800 transition-colors disabled:opacity-50 shadow-sm">
                {saving ? 'Salvando...' : 'Salvar Grupo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LISTAGEM DE GRUPOS */}
      {groups.length === 0 && !showForm ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-stone-300 text-stone-500">
          <Users size={48} className="mx-auto mb-4 text-stone-300" />
          <p>Nenhum grupo cadastrado ainda.</p>
          <p className="text-xs mt-1">Clique em "Novo Grupo" acima para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(group => {
            // Inteligência do Frontend: Procura o nome do líder na lista de membros que já baixamos!
            const leaderName = members.find(m => m.id === group.leader_id)?.full_name || 'Sem líder definido'
            
            return (
              <div key={group.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow relative group/card">
                
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <button 
                    onClick={() => handleDelete(group.id)} 
                    className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover/card:opacity-100"
                    title="Excluir Grupo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <h3 className="text-lg font-bold text-stone-800 mb-2">{group.name}</h3>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <UserCircle size={16} className="text-stone-400" /> 
                    <span className="font-semibold">{leaderName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <MapPin size={16} className="text-stone-400" /> 
                    {group.neighborhood}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <CalendarDays size={16} className="text-stone-400" /> 
                    {group.meeting_day}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-stone-600">
                    <Clock size={16} className="text-stone-400" /> 
                    {group.meeting_time}
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}