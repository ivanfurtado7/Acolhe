import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { CalendarDays, Clock, CheckCircle2, XCircle, UserPlus, Plus, ShieldAlert, Edit2, Trash2, Save, X } from 'lucide-react'

export function SchedulesManagement() {
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  
  // Dados
  const [events, setEvents] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [team, setTeam] = useState<any[]>([])
  
  // Estados de Criação
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventTime, setNewEventTime] = useState('')

  // Estados de Edição
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', userData.user.id).single()
    setCurrentUser(profile)

    if (profile?.church_id) {
      const today = new Date().toISOString()
      
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('church_id', profile.church_id)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
      
      // Removemos o 'user_profiles' do select para evitar o erro de Foreign Key. Vamos mapear no frontend!
      const { data: schedulesData } = await supabase
        .from('schedules')
        .select('*')
      
      const { data: teamData } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('church_id', profile.church_id)
        .order('full_name')

      if (eventsData) setEvents(eventsData)
      if (schedulesData) setSchedules(schedulesData)
      if (teamData) setTeam(teamData)
    }
    setLoading(false)
  }

  // ================= AÇÕES DO EVENTO (CRIAR, EDITAR, EXCLUIR) =================

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEventTitle || !newEventDate || !newEventTime || !currentUser?.church_id) return
    
    const eventDateTime = new Date(`${newEventDate}T${newEventTime}`).toISOString()

    const { data, error } = await supabase.from('events').insert([{
      church_id: currentUser.church_id,
      title: newEventTitle,
      event_date: eventDateTime
    }]).select().single()

    if (!error && data) {
      setEvents(prev => [...prev, data].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()))
      setNewEventTitle('')
      setNewEventDate('')
      setNewEventTime('')
    } else {
      alert('Erro ao criar evento: ' + error?.message)
    }
  }

  const startEditing = (evt: any) => {
    setEditingEventId(evt.id)
    setEditTitle(evt.title)
    
    // Formata a data para os inputs
    const d = new Date(evt.event_date)
    const pad = (n: number) => n.toString().padStart(2, '0')
    setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    setEditTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
  }

  const handleSaveEdit = async () => {
    if (!editingEventId) return
    const eventDateTime = new Date(`${editDate}T${editTime}`).toISOString()

    const { error } = await supabase.from('events').update({
      title: editTitle,
      event_date: eventDateTime
    }).eq('id', editingEventId)

    if (!error) {
      setEvents(prev => prev.map(e => e.id === editingEventId ? { ...e, title: editTitle, event_date: eventDateTime } : e)
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      )
      setEditingEventId(null)
    } else {
      alert('Erro ao atualizar: ' + error.message)
    }
  }

  const handleDeleteEvent = async (id: string) => {
    if (confirm('Atenção: Tem certeza que deseja cancelar e excluir este evento? Toda a escala será perdida.')) {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (!error) {
        setEvents(prev => prev.filter(e => e.id !== id))
      } else {
        alert('Erro ao excluir: ' + error.message)
      }
    }
  }

  // ================= AÇÕES DA ESCALA =================

  const handleAddPersonToSchedule = async (eventId: string, userId: string) => {
    if (!userId) return
    
    const isAlreadyScheduled = schedules.some(s => s.event_id === eventId && s.user_id === userId)
    if (isAlreadyScheduled) return alert('Esta pessoa já está escalada neste evento.')

    const { data, error } = await supabase.from('schedules').insert([{
      event_id: eventId,
      user_id: userId,
      status: 'pendente'
    }]).select().single()

    if (error) {
      alert('Erro ao escalar: ' + error.message)
    } else if (data) {
      setSchedules(prev => [...prev, data])
    }
  }

  const handleResponse = async (scheduleId: string, newStatus: 'confirmado' | 'recusado') => {
    setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, status: newStatus } : s))
    await supabase.from('schedules').update({ status: newStatus }).eq('id', scheduleId)
  }

  const removeSchedule = async (scheduleId: string) => {
    if (confirm('Deseja remover esta pessoa da escala?')) {
      setSchedules(prev => prev.filter(s => s.id !== scheduleId))
      await supabase.from('schedules').delete().eq('id', scheduleId)
    }
  }

  if (loading) return <div className="p-8 text-center text-sm text-stone-500 animate-pulse">Carregando painel de escalas...</div>

  return (
    <div className="animate-in fade-in space-y-8">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-stone-800">Escalas & Cultos</h2>
          <p className="text-sm text-stone-500">Gerencie a equipe dos próximos eventos.</p>
        </div>
      </div>

      {currentUser?.role === 'superadmin' && (
        <form onSubmit={handleCreateEvent} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">Novo Evento / Culto</label>
            <input type="text" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} required placeholder="Ex: Culto de Celebração" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none" />
          </div>
          <div className="w-full md:w-40">
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">Data</label>
            <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} required className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none text-stone-700" />
          </div>
          <div className="w-full md:w-32">
            <label className="block text-xs font-bold text-stone-600 uppercase mb-1">Hora</label>
            <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} required className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none text-stone-700" />
          </div>
          <button type="submit" className="w-full md:w-auto px-6 py-2.5 bg-stone-800 text-white font-medium rounded-xl hover:bg-stone-900 transition-colors flex items-center justify-center gap-2">
            <Plus size={18} /> Agendar
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {events.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-dashed border-stone-300 text-stone-500">
            Nenhum evento futuro programado.
          </div>
        ) : (
          events.map(evt => {
            const eventDate = new Date(evt.event_date)
            const eventSchedules = schedules.filter(s => s.event_id === evt.id)
            const mySchedule = eventSchedules.find(s => s.user_id === currentUser?.id)
            const isEditing = editingEventId === evt.id

            return (
              <div key={evt.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
                
                {/* Cabeçalho do Evento (Modo Leitura ou Edição) */}
                <div className="bg-stone-900 p-5 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/20 rounded-full blur-3xl"></div>
                  
                  {isEditing ? (
                    <div className="relative z-10 space-y-3">
                      <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full px-3 py-1.5 bg-stone-800 border border-stone-600 rounded-lg text-sm text-white focus:outline-none" />
                      <div className="flex gap-2">
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full px-3 py-1.5 bg-stone-800 border border-stone-600 rounded-lg text-sm text-white focus:outline-none [color-scheme:dark]" />
                        <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} className="w-full px-3 py-1.5 bg-stone-800 border border-stone-600 rounded-lg text-sm text-white focus:outline-none [color-scheme:dark]" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleSaveEdit} className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><Save size={14}/> Salvar</button>
                        <button onClick={() => setEditingEventId(null)} className="flex-1 py-1.5 bg-stone-700 hover:bg-stone-600 rounded-lg text-xs font-bold flex items-center justify-center gap-1"><X size={14}/> Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative z-10 flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold">{evt.title}</h3>
                        <div className="flex gap-4 mt-2 text-sm text-stone-400 font-medium">
                          <span className="flex items-center gap-1.5"><CalendarDays size={14} className="text-amber-500"/> {eventDate.toLocaleDateString('pt-BR')}</span>
                          <span className="flex items-center gap-1.5"><Clock size={14} className="text-amber-500"/> {eventDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                      
                      {currentUser?.role === 'superadmin' && (
                        <div className="flex gap-2">
                          <button onClick={() => startEditing(evt)} className="p-1.5 text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors tooltip" title="Editar"><Edit2 size={14}/></button>
                          <button onClick={() => handleDeleteEvent(evt.id)} className="p-1.5 text-stone-400 hover:text-red-400 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors tooltip" title="Excluir"><Trash2 size={14}/></button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {mySchedule && mySchedule.status === 'pendente' && (
                  <div className="bg-amber-50 p-4 border-b border-amber-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-amber-800 text-sm font-bold">
                      <ShieldAlert size={18} /> Você foi escalado!
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => handleResponse(mySchedule.id, 'recusado')} className="flex-1 sm:flex-none px-4 py-2 bg-white text-red-600 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors">Recusar</button>
                      <button onClick={() => handleResponse(mySchedule.id, 'confirmado')} className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm">Confirmar</button>
                    </div>
                  </div>
                )}

                <div className="p-5 flex-1 bg-stone-50">
                  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Equipe Escalada ({eventSchedules.length})</h4>
                  
                  {eventSchedules.length === 0 ? (
                    <p className="text-sm text-stone-400 italic">Ninguém escalado ainda.</p>
                  ) : (
                    <div className="space-y-2">
                      {eventSchedules.map(schedule => {
                        // Busca o nome do usuário na memória, evitando erro de Foreign Key
                        const memberName = team.find(m => m.id === schedule.user_id)?.full_name || 'Usuário Removido'
                        
                        return (
                          <div key={schedule.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-stone-200 group">
                            <span className="text-sm font-bold text-stone-700">{memberName}</span>
                            
                            <div className="flex items-center gap-2">
                              {schedule.status === 'confirmado' && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-2 py-1 rounded-md"><CheckCircle2 size={12}/> Confirmado</span>}
                              {schedule.status === 'recusado' && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-700 bg-red-100 px-2 py-1 rounded-md"><XCircle size={12}/> Ausente</span>}
                              {(schedule.status === 'pendente' || !schedule.status) && <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-1 rounded-md"><Clock size={12}/> Aguardando</span>}
                              
                              {currentUser?.role === 'superadmin' && (
                                <button onClick={() => removeSchedule(schedule.id)} className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all"><X size={14}/></button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {currentUser?.role === 'superadmin' && (
                  <div className="p-4 bg-white border-t border-stone-200">
                    <div className="flex gap-2">
                      <select id={`select-${evt.id}`} className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-600 outline-none text-stone-700" defaultValue="">
                        <option value="" disabled>Selecionar voluntário...</option>
                        {team.map(member => (
                          <option key={member.id} value={member.id}>{member.full_name}</option>
                        ))}
                      </select>
                      <button onClick={() => {
                          const select = document.getElementById(`select-${evt.id}`) as HTMLSelectElement
                          handleAddPersonToSchedule(evt.id, select.value)
                          select.value = "" 
                        }}
                        className="px-4 py-2 bg-stone-100 text-stone-700 font-bold text-sm rounded-lg hover:bg-stone-200 transition-colors flex items-center gap-2 border border-stone-200"
                      >
                        <UserPlus size={16} /> Escalar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}