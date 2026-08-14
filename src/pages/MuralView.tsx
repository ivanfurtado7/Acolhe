import { useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'
import { CalendarDays, Megaphone, ThumbsUp, CheckCircle2, Globe, Users, Shield, Plus, X, LayoutList, Calendar as CalendarIcon, Edit3, ChevronLeft, ChevronRight, UserCircle, AlertCircle, Trash2, Clock, AlertTriangle, Activity } from 'lucide-react'

export function MuralView({ churchId, userProfile }: { churchId: string, userProfile: any }) {
  const [activePosts, setActivePosts] = useState<any[]>([])
  const [pastPosts, setPastPosts] = useState<any[]>([])
  const [allEvents, setAllEvents] = useState<any[]>([]) 
  
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  
  const [viewMode, setViewMode] = useState<'feed' | 'calendar'>('feed')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [type, setType] = useState<'aviso' | 'evento'>('aviso')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'members' | 'leaders'>('public')
  const [status, setStatus] = useState<'Em breve' | 'Cancelado' | 'Adiado' | 'Concluído' | 'Ativo'>('Em breve')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const formRef = useRef<HTMLFormElement>(null)

  const today = new Date()
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const userRole = userProfile?.role?.toLowerCase() || 'membro'
  const canAdd = userProfile?.computed_permissions?.mural?.add || userRole === 'admin'
  const canEdit = userProfile?.computed_permissions?.mural?.edit || userRole === 'admin'

  useEffect(() => {
    if (churchId) fetchPosts()
  }, [churchId])

  async function fetchPosts() {
    setLoading(true)
    setFetchError(null)

    const { data: postsData, error: postsError } = await supabase
      .from('mural_posts')
      .select('*, mural_likes ( user_id ), mural_rsvps ( user_id )')
      .eq('church_id', churchId)

    if (postsError) {
      setFetchError(postsError.message)
      setLoading(false)
      return
    }

    const { data: profilesData } = await supabase.from('user_profiles').select('id, full_name').eq('church_id', churchId)

    if (postsData) {
      const nowMs = new Date().getTime()
      const autoCloseIds: string[] = [] 

      const combinedData = postsData.map(post => {
        const author = profilesData?.find(p => p.id === post.author_id)
        let currentStatus = post.status

        if (post.type === 'evento' && post.event_date && post.status !== 'Concluído' && post.status !== 'Cancelado') {
          const eventTimeMs = new Date(post.event_date).getTime()
          const diffHours = (nowMs - eventTimeMs) / (1000 * 60 * 60)

          if (diffHours >= 24) {
            autoCloseIds.push(post.id)
            currentStatus = 'Concluído' 
          } else if (diffHours >= 0 && diffHours < 24) {
            currentStatus = 'Ativo'
          } else if (currentStatus === 'Ativo' && diffHours < 0) {
             currentStatus = 'Em breve'
          }
        }

        return { ...post, status: currentStatus, author: author || { full_name: 'Equipe Acolhe' } }
      })

      if (autoCloseIds.length > 0) {
        supabase.from('mural_posts').update({ status: 'Concluído' }).in('id', autoCloseIds).then()
      }

      const filteredData = combinedData.filter(post => {
        if (userRole === 'admin' || userRole === 'lider') return true
        if (userRole === 'membro') return post.visibility === 'public' || post.visibility === 'members'
        return post.visibility === 'public'
      })
      
      const active = filteredData.filter(p => p.type === 'aviso' || (p.type === 'evento' && !['Concluído', 'Cancelado'].includes(p.status)))
      const past = filteredData.filter(p => p.type === 'evento' && ['Concluído', 'Cancelado'].includes(p.status))

      active.sort((a, b) => {
        if (a.status === 'Ativo' && b.status !== 'Ativo') return -1;
        if (b.status === 'Ativo' && a.status !== 'Ativo') return 1;
        
        if (a.type === 'evento' && b.type === 'evento') {
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        }
        if (a.type === 'aviso' && b.type === 'aviso') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return a.type === 'evento' ? -1 : 1;
      })

      past.sort((a, b) => {
        return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
      })

      setActivePosts(active)
      setPastPosts(past)
      setAllEvents(filteredData.filter(p => p.type === 'evento')) 
    }
    setLoading(false)
  }

  const handleFastFinishEvent = async (id: string) => {
    const postToMove = activePosts.find(p => p.id === id);
    if (postToMove) {
      setActivePosts(prev => prev.filter(p => p.id !== id));
      setPastPosts(prev => [{ ...postToMove, status: 'Concluído' }, ...prev].sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()));
    }
    const { error } = await supabase.from('mural_posts').update({ status: 'Concluído' }).eq('id', id)
    if (error) {
      alert("Erro ao finalizar o evento: " + error.message)
      fetchPosts() 
    }
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setType('aviso')
    setTitle('')
    setContent('')
    setEventDate('')
    setEventTime('')
    setVisibility('public')
    setStatus('Em breve')
    setShowForm(true)
    setFormError(null)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleOpenEdit = (post: any) => {
    setEditingId(post.id)
    setType(post.type)
    setTitle(post.title)
    setContent(post.content)
    setVisibility(post.visibility)
    setStatus(post.status || 'Em breve')
    setFormError(null)
    if (post.event_date) {
      const d = new Date(post.event_date)
      setEventDate(d.toISOString().split('T')[0])
      setEventTime(d.toTimeString().substring(0, 5))
    } else {
      setEventDate('')
      setEventTime('')
    }
    setShowForm(true)
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setFormError(null)

    let finalEventDate = null
    if (type === 'evento' && eventDate && eventTime) {
      const localDate = new Date(`${eventDate}T${eventTime}:00`)
      finalEventDate = localDate.toISOString()
    }

    const postStatus = (type === 'evento' && !editingId) ? 'Em breve' : status

    const postData = {
      church_id: churchId,
      type,
      title,
      content,
      event_date: finalEventDate,
      visibility,
      status: type === 'evento' ? postStatus : 'Em breve'
    }

    let error;
    if (editingId) {
      const res = await supabase.from('mural_posts').update(postData).eq('id', editingId).select()
      error = res.error
    } else {
      const res = await supabase.from('mural_posts').insert([{ ...postData, author_id: userProfile.id }]).select()
      error = res.error
    }

    setIsSubmitting(false)
    if (!error) {
      setShowForm(false)
      fetchPosts()
    } else {
      setFormError('Falha ao salvar: ' + error.message)
    }
  }

  const handleDeletePost = async () => {
    if (!editingId) return
    if (confirm('Tem certeza que deseja excluir esta publicação? Essa ação não pode ser desfeita.')) {
      setIsSubmitting(true)
      const { error } = await supabase.from('mural_posts').delete().eq('id', editingId)
      setIsSubmitting(false)
      
      if (!error) {
        setShowForm(false)
        fetchPosts()
      } else {
        setFormError('Erro ao excluir: ' + error.message)
      }
    }
  }

  const toggleLike = async (postId: string, hasLiked: boolean) => {
    if (hasLiked) await supabase.from('mural_likes').delete().eq('post_id', postId).eq('user_id', userProfile.id)
    else await supabase.from('mural_likes').insert([{ post_id: postId, user_id: userProfile.id }])
    fetchPosts()
  }

  const toggleRsvp = async (postId: string, hasRsvped: boolean) => {
    if (hasRsvped) await supabase.from('mural_rsvps').delete().eq('post_id', postId).eq('user_id', userProfile.id)
    else await supabase.from('mural_rsvps').insert([{ post_id: postId, user_id: userProfile.id }])
    fetchPosts()
  }

  const prevMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))
  const daysInMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate()
  const firstDayIndex = currentMonthDate.getDay()
  const monthNames = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO']
  
  const getEventsForDay = (day: number) => {
    return allEvents.filter(p => {
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

  const getEventBadgeStyle = (status: string) => {
    if (status === 'Ativo') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (status === 'Cancelado') return 'bg-red-50 text-red-600 border-red-100 line-through'
    if (status === 'Adiado') return 'bg-orange-100 text-orange-800 border-orange-200'
    if (status === 'Concluído') return 'bg-stone-100 text-stone-500 border-stone-200'
    return 'bg-blue-50 text-blue-700 border-blue-100' // Em breve
  }

  const VisibilityIcon = ({ type }: { type: string }) => {
    if (type === 'public') return <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[10px] uppercase font-bold"><Globe size={10} /> Geral</div>
    if (type === 'members') return <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px] uppercase font-bold"><Users size={10} /> Membros</div>
    return <div className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-0.5 rounded text-[10px] uppercase font-bold"><Shield size={10} /> Liderança</div>
  }

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'Concluído': return <span className="bg-stone-100 text-stone-600 px-2.5 py-1 rounded text-[10px] font-bold uppercase border border-stone-200">✅ Concluído</span>
      case 'Cancelado': return <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded text-[10px] font-bold uppercase border border-red-200">❌ Cancelado</span>
      case 'Adiado': return <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded text-[10px] font-bold uppercase border border-orange-200">⚠️ Adiado</span>
      case 'Ativo': return <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded text-[10px] font-bold uppercase border border-emerald-200 flex items-center gap-1"><Activity size={10} /> Acontecendo Agora</span>
      default: return <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-[10px] font-bold uppercase border border-blue-200">🗓️ Em breve</span>
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-stone-200 rounded-[2rem] p-6 sm:p-8 shadow-sm">
        <div>
          <h2 className="text-2xl font-black mb-1 tracking-tight text-stone-800">Mural & Agenda</h2>
          <p className="text-stone-500 text-sm">Gerencie os comunicados e o calendário da igreja.</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button onClick={() => setViewMode('feed')} className={`p-2 rounded-lg transition-colors ${viewMode === 'feed' ? 'bg-white shadow-sm text-amber-700 font-bold' : 'text-stone-400 hover:text-stone-700'}`} title="Feed">
              <LayoutList size={20} />
            </button>
            <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-white shadow-sm text-amber-700 font-bold' : 'text-stone-400 hover:text-stone-700'}`} title="Calendário Ampliado">
              <CalendarIcon size={20} />
            </button>
          </div>

          {canAdd && !showForm && (
            <button onClick={handleOpenCreate} className="flex-1 sm:flex-none px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
              <Plus size={18} /> Publicar
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <form ref={formRef} onSubmit={handleSavePost} className="bg-white p-6 md:p-8 rounded-[2rem] border border-stone-200 shadow-xl shadow-stone-200/50 animate-in zoom-in-95 scroll-mt-24">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-stone-800 tracking-tight">{editingId ? 'Editar Publicação' : 'Nova Publicação'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-stone-400 hover:text-red-500 bg-stone-50 p-2 rounded-full transition-colors"><X size={20} /></button>
          </div>

          {formError && <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">{formError}</div>}

          <div className="space-y-6">
            <div className="flex gap-4">
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="type" className="peer sr-only" checked={type === 'aviso'} onChange={() => setType('aviso')} />
                <div className="p-4 text-center border-2 border-stone-100 rounded-2xl peer-checked:border-amber-600 peer-checked:bg-amber-50 peer-checked:text-amber-700 font-bold text-sm text-stone-500 transition-all flex items-center justify-center gap-2">
                  <Megaphone size={18} /> Aviso Geral
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input type="radio" name="type" className="peer sr-only" checked={type === 'evento'} onChange={() => setType('evento')} />
                <div className="p-4 text-center border-2 border-stone-100 rounded-2xl peer-checked:border-amber-600 peer-checked:bg-amber-50 peer-checked:text-amber-700 font-bold text-sm text-stone-500 transition-all flex items-center justify-center gap-2">
                  <CalendarDays size={18} /> Evento
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Título</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: Culto de Jovens" className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-base focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all" />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Detalhes</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} required placeholder="Escreva os detalhes aqui..." rows={4} className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-base focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all resize-none"></textarea>
            </div>

            {type === 'evento' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 bg-amber-50/50 rounded-2xl border border-amber-100">
                <div>
                  <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Data</label>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl text-sm focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Horário</label>
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} required className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl text-sm focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Status</label>
                  {!editingId ? (
                    <div className="w-full px-4 py-3.5 bg-amber-100 border border-amber-200 rounded-xl text-sm text-amber-800 font-bold shadow-sm flex items-center justify-between">
                      <span>Em breve</span>
                      <span className="text-[10px] uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded">Automático</span>
                    </div>
                  ) : (
                    <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl text-sm focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm cursor-pointer">
                      <option value="Em breve">Em breve</option>
                      <option value="Ativo">Acontecendo Agora</option>
                      <option value="Adiado">Adiado</option>
                      <option value="Cancelado">Cancelado</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Quem pode ver isso?</label>
              <select value={visibility} onChange={e => setVisibility(e.target.value as any)} className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-base focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all cursor-pointer">
                <option value="public">Público Geral (Todos os membros)</option>
                <option value="members">Apenas Membros (Restrito)</option>
                <option value="leaders">Apenas Liderança/Equipe</option>
              </select>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
              <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-amber-600/20 disabled:opacity-70 order-1 sm:order-2">
                {isSubmitting ? 'Processando...' : (editingId ? 'Atualizar Publicação' : 'Confirmar Publicação')}
              </button>

              {editingId && userProfile?.computed_permissions?.mural?.delete && (
                <button type="button" onClick={handleDeletePost} disabled={isSubmitting} className="py-4 px-6 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-lg rounded-xl transition-all border border-red-200 flex items-center justify-center gap-2 order-2 sm:order-1">
                  <Trash2 size={20} /> Excluir
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {loading ? (
         <div className="text-center py-10 text-stone-400 animate-pulse font-medium">Carregando painel...</div>
      ) : fetchError ? (
        <div className="bg-red-50 p-8 rounded-3xl border border-red-200 text-center shadow-sm">
          <AlertCircle size={40} className="mx-auto mb-3 text-red-400" />
          <p className="font-bold text-lg text-red-700 mb-1">Erro de Conexão</p>
          <p className="text-sm text-red-600">{fetchError}</p>
        </div>
      ) : viewMode === 'feed' ? (
        // ==========================================
        // MODO FEED: COLUNAS DIVIDIDAS (8 e 4)
        // ==========================================
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* COLUNA ESQUERDA: FEED ATIVO */}
          <div className="lg:col-span-8 space-y-6">
            <h3 className="text-xl font-black text-stone-800 tracking-tight flex items-center gap-2 mb-2">
              <Megaphone className="text-amber-600" size={24} /> Tá chegando
            </h3>

            {activePosts.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-stone-200 text-center text-stone-500 shadow-sm">
                <CalendarIcon size={48} className="mx-auto mb-4 text-stone-200" />
                <p className="font-bold text-xl text-stone-700 mb-1">Mural Vazio</p>
                <p className="text-sm">Não há eventos ou avisos recentes programados.</p>
              </div>
            ) : (
              activePosts.map(post => {
                const hasLiked = post.mural_likes?.some((l: any) => l.user_id === userProfile.id)
                const hasRsvped = post.mural_rsvps?.some((r: any) => r.user_id === userProfile.id)
                const authorName = post.author?.full_name || 'Equipe Acolhe'
                
                const isEvento = post.type === 'evento' && post.event_date;
                const isAtivo = isEvento && post.status === 'Ativo';
                
                let diffHours = 0;
                if (isAtivo) {
                  const eventTimeMs = new Date(post.event_date).getTime();
                  diffHours = (new Date().getTime() - eventTimeMs) / (1000 * 60 * 60);
                }
                
                const show2hAlert = isAtivo && diffHours >= 2 && diffHours < 24 && canEdit;
                
                return (
                  <div key={post.id} className={`bg-white rounded-3xl border shadow-sm overflow-hidden transition-all ${isAtivo ? 'border-emerald-300 ring-4 ring-emerald-500/10' : 'border-stone-200'}`}>
                    <div className={`p-5 sm:p-6 flex justify-between items-center border-b ${isAtivo ? 'border-emerald-100 bg-emerald-50/50' : 'border-stone-50 bg-stone-50/30'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-inner ${isAtivo ? 'bg-emerald-100 text-emerald-800' : 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800'}`}>
                          {authorName[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-stone-800">{authorName}</h4>
                          <p className="text-xs text-stone-400 font-medium flex items-center gap-1">
                            <UserCircle size={12} /> Postado em {new Date(post.created_at).toLocaleDateString('pt-BR')} às {new Date(post.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <VisibilityIcon type={post.visibility} />
                        
                        {canEdit && (
                          <button onClick={() => handleOpenEdit(post)} className="text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-amber-600 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-bold">
                            <Edit3 size={14} /> Editar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-6 sm:p-8">
                      <div className="flex items-center gap-2 mb-4">
                        {post.type === 'aviso' ? (
                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-600 bg-stone-100 border border-stone-200 px-2.5 py-1 rounded-md"><Megaphone size={12}/> Aviso Geral</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md"><CalendarDays size={12}/> Evento</span>
                            <StatusBadge status={post.status} />
                          </div>
                        )}
                      </div>
                      
                      <h3 className="text-2xl font-black mb-3 tracking-tight text-stone-800">{post.title}</h3>
                      <p className="text-base leading-relaxed whitespace-pre-wrap text-stone-600">{post.content}</p>

                      {post.type === 'evento' && post.event_date && (
                        <>
                          <div className={`mt-6 p-5 sm:p-6 border rounded-3xl flex items-center gap-5 ${isAtivo ? 'bg-emerald-50 border-emerald-200' : 'bg-stone-50 border-stone-200'}`}>
                            <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 border bg-white shadow-sm border-stone-100">
                              <span className="text-[10px] font-bold uppercase text-red-500">{new Date(post.event_date).toLocaleString('pt-BR', { month: 'short' })}</span>
                              <span className="text-2xl font-black leading-none mt-1 text-stone-800">{new Date(post.event_date).getDate()}</span>
                            </div>
                            <div>
                              <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Data do Evento</p>
                              <p className="text-base font-bold capitalize text-stone-800">{new Date(post.event_date).toLocaleString('pt-BR', { weekday: 'long' })}, às {new Date(post.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}h</p>
                            </div>
                          </div>

                          {show2hAlert && (
                            <div className="mt-4 p-4 sm:p-5 bg-orange-50 border border-orange-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in zoom-in">
                              <div className="flex items-center gap-3">
                                <AlertTriangle className="text-orange-500 shrink-0" size={24} />
                                <div>
                                  <p className="text-sm font-bold text-orange-800">Evento ativo há mais de 2 horas</p>
                                  <p className="text-xs text-orange-600 font-medium mt-0.5">Deseja encerrar este evento e marcá-lo como concluído?</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => handleFastFinishEvent(post.id)}
                                className="w-full sm:w-auto px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors whitespace-nowrap shadow-sm shadow-orange-500/20"
                              >
                                Finalizar Evento
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="px-6 py-5 bg-stone-50 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
                      <button 
                        onClick={() => toggleLike(post.id, hasLiked)}
                        className={`flex items-center gap-2 text-sm font-bold transition-all px-3 py-1.5 rounded-xl ${hasLiked ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-white border border-stone-200 text-stone-500 hover:border-amber-400 hover:text-amber-700'}`}
                      >
                        <ThumbsUp size={18} className={hasLiked ? "fill-amber-600 text-amber-600" : ""} /> {post.mural_likes?.length || 0}
                      </button>

                      {post.type === 'evento' && post.status !== 'Cancelado' && (
                        <button 
                          onClick={() => toggleRsvp(post.id, hasRsvped)}
                          className={`flex items-center gap-2 text-sm font-bold transition-all px-4 py-2.5 rounded-xl ${hasRsvped ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-white border border-stone-200 shadow-sm text-stone-600 hover:border-amber-500 hover:text-amber-700'}`}
                        >
                          <CheckCircle2 size={18} className={hasRsvped ? "fill-green-200 text-green-700" : ""} /> {hasRsvped ? 'Presença Confirmada' : 'Vou Participar'} ({post.mural_rsvps?.length || 0})
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* COLUNA DIREITA: CALENDÁRIO MINI E FINALIZADOS */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              
              <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 animate-in slide-in-from-right-8">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                  <h3 className="text-xl font-bold text-stone-800 tracking-tight">Agenda</h3>
                  <div className="flex items-center gap-2 bg-stone-50 px-2 py-1 rounded-xl border border-stone-200 shadow-sm">
                    <button onClick={prevMonth} className="p-1 text-stone-400 hover:text-amber-600 transition-colors"><ChevronLeft size={16} /></button>
                    <span className="font-bold text-xs text-stone-700 w-20 text-center uppercase">
                      {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear().toString().substring(2)}
                    </span>
                    <button onClick={nextMonth} className="p-1 text-stone-400 hover:text-amber-600 transition-colors"><ChevronRight size={16} /></button>
                  </div>
                </div>

                <div className="grid grid-cols-7 mb-2 gap-1">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest">{day}</div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayIndex }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[40px] bg-stone-50/50 rounded-lg border border-transparent"></div>
                  ))}
                  
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const isToday = day === today.getDate() && currentMonthDate.getMonth() === today.getMonth() && currentMonthDate.getFullYear() === today.getFullYear()
                    const dayEvents = getEventsForDay(day)

                    return (
                      <div key={day} className={`min-h-[40px] rounded-lg border p-1 flex flex-col items-center justify-center transition-all ${isToday ? 'bg-amber-100 border-amber-300 shadow-sm' : 'bg-white border-stone-200 hover:border-amber-300'}`}>
                        <span className={`text-[10px] font-bold mb-0.5 ${isToday ? 'text-amber-800' : 'text-stone-600'}`}>{day}</span>
                        <div className="flex gap-0.5 flex-wrap justify-center px-1">
                          {dayEvents.slice(0, 3).map(ev => (
                            <div key={ev.id} onClick={() => { if(canEdit && ev.status !== 'Concluído') handleOpenEdit(ev) }} className={`w-1.5 h-1.5 rounded-full ${getDotColor(ev.status)} ${canEdit && ev.status !== 'Concluído' ? 'cursor-pointer hover:scale-150 transition-transform' : ''}`} title={ev.title}></div>
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

              {pastPosts.length > 0 && (
                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 animate-in slide-in-from-right-8">
                  <h3 className="text-lg font-bold text-stone-800 tracking-tight flex items-center gap-2 mb-6">
                    <Clock className="text-stone-400" size={20} /> Eventos Finalizados
                  </h3>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent">
                    {pastPosts.map(post => (
                      <div key={post.id} className="p-4 bg-stone-50 border border-stone-100 rounded-2xl flex flex-col gap-2 relative group transition-colors hover:border-stone-200 hover:bg-stone-100/50">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h4 className="font-bold text-sm text-stone-700 line-clamp-1" title={post.title}>{post.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] text-stone-500 font-bold uppercase">{new Date(post.event_date).toLocaleDateString('pt-BR')}</p>
                              <span className="text-[10px]">•</span>
                              <span className={`text-[10px] font-bold uppercase ${post.status === 'Cancelado' ? 'text-red-500' : 'text-stone-400'}`}>{post.status}</span>
                            </div>
                          </div>
                          {canEdit && post.status === 'Cancelado' && (
                            <button onClick={() => handleOpenEdit(post)} className="text-stone-400 hover:text-amber-600 p-1 shrink-0 bg-white rounded-md border border-stone-200 shadow-sm"><Edit3 size={14} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // ==========================================
        // MODO CALENDÁRIO AMPLIADO (12 COLUNAS)
        // ==========================================
        <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm p-6 sm:p-8 animate-in fade-in slide-in-from-right-8">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 border-b border-stone-100 pb-6">
            <h3 className="text-2xl font-bold text-stone-800 tracking-tight">Agenda Mensal</h3>
            <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-2xl border border-stone-200 shadow-sm">
              <button onClick={prevMonth} className="p-2 text-stone-400 hover:bg-white hover:shadow-sm hover:text-amber-600 rounded-xl transition-all"><ChevronLeft size={20} /></button>
              <span className="font-bold text-sm text-stone-700 w-32 text-center uppercase tracking-wider">
                {monthNames[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
              </span>
              <button onClick={nextMonth} className="p-2 text-stone-400 hover:bg-white hover:shadow-sm hover:text-amber-600 rounded-xl transition-all"><ChevronRight size={20} /></button>
            </div>
          </div>

          {/* CABEÇALHO DOS DIAS DA SEMANA */}
          <div className="grid grid-cols-7 mb-3 gap-2">
            {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(day => (
              <div key={day} className="text-center text-[11px] font-bold text-stone-500 uppercase tracking-widest hidden sm:block">{day}</div>
            ))}
            {/* Versão Mobile */}
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day + '-mobile'} className="text-center text-[10px] font-bold text-stone-500 uppercase tracking-widest sm:hidden">{day}</div>
            ))}
          </div>

          {/* CORPO DO CALENDÁRIO */}
          <div className="grid grid-cols-7 gap-2 sm:gap-3">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-large-${i}`} className="min-h-[100px] sm:min-h-[140px] bg-stone-50/30 rounded-2xl border border-transparent"></div>
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isToday = day === today.getDate() && currentMonthDate.getMonth() === today.getMonth() && currentMonthDate.getFullYear() === today.getFullYear()
              const dayEvents = getEventsForDay(day)

              return (
                <div key={day} className={`min-h-[100px] sm:min-h-[140px] rounded-2xl border p-2 sm:p-3 flex flex-col transition-all ${isToday ? 'bg-amber-50/50 border-amber-300 ring-4 ring-amber-500/10' : 'bg-white border-stone-200 hover:border-amber-300'}`}>
                  
                  {/* NUMERAÇÃO DO DIA */}
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm sm:text-base font-black ${isToday ? 'text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg' : 'text-stone-600'}`}>
                      {day}
                    </span>
                  </div>
                  
                  {/* LISTA DE EVENTOS DO DIA (BADGES) */}
                  <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[70px] sm:max-h-[100px] scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent pr-1">
                    {dayEvents.map(ev => {
                      const isClickable = canEdit && ev.status !== 'Concluído';
                      return (
                        <div 
                          key={ev.id} 
                          onClick={() => { if(isClickable) handleOpenEdit(ev) }}
                          className={`text-[9px] sm:text-[11px] font-bold truncate px-2 py-1.5 rounded-lg border transition-all ${isClickable ? 'cursor-pointer hover:scale-[1.02] hover:shadow-sm' : ''} ${getEventBadgeStyle(ev.status)}`}
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      )
                    })}
                  </div>

                </div>
              )
            })}
          </div>
          
        </div>
      )}
    </div>
  )
}