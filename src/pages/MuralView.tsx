import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { Megaphone, CalendarDays, ThumbsUp, CheckCircle, Plus, X, Trash2, Clock, MapPin, Activity } from 'lucide-react'

export function MuralView({ churchId, userProfile }: { churchId: string, userProfile: any }) {
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [postType, setPostType] = useState<'aviso' | 'evento'>('aviso')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const perms = userProfile?.computed_permissions;
  const canCreate = perms?.mural?.create || false;
  const canManageStatus = perms?.mural?.manage_status || false;
  const canDelete = perms?.mural?.delete || false;

  useEffect(() => { if (churchId) fetchPosts() }, [churchId])

  async function fetchPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('mural_posts')
      .select('*, author:user_profiles!mural_posts_author_id_fkey(full_name), mural_likes(user_id), mural_rsvps(user_id)')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })

    if (data) setPosts(data)
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    const payload = {
      church_id: churchId,
      author_id: userProfile.id,
      type: postType,
      title,
      content,
      event_date: postType === 'evento' ? eventDate : null,
      event_location: postType === 'evento' ? eventLocation : null,
      status: postType === 'evento' ? 'Em breve' : null
    }

    const { error } = await supabase.from('mural_posts').insert([payload])
    setIsSubmitting(false)
    
    if (!error) {
      setIsModalOpen(false)
      setTitle(''); setContent(''); setEventDate(''); setEventLocation('')
      fetchPosts()
    } else alert('Erro ao publicar.')
  }

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja apagar esta publicação?')) {
      await supabase.from('mural_posts').delete().eq('id', id)
      fetchPosts()
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    await supabase.from('mural_posts').update({ status: newStatus }).eq('id', id)
    fetchPosts()
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-10">
      <div className="bg-white border border-stone-200 rounded-[2rem] p-5 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black mb-1 tracking-tight text-stone-800 flex items-center gap-3">
            <Megaphone className="text-amber-600" size={26} /> Mural & Agenda
          </h2>
          <p className="text-stone-500 text-sm md:text-base font-medium">Fique por dentro dos avisos e eventos da comunidade.</p>
        </div>
        {canCreate && (
          <button onClick={() => setIsModalOpen(true)} className="w-full md:w-auto px-6 py-3.5 md:py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm md:text-base rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer">
            <Plus size={20} /> Nova Publicação
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-stone-400 font-bold animate-pulse text-sm md:text-base">Carregando feed...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[2rem] border border-stone-200 text-stone-400 shadow-sm">
          <Megaphone size={48} className="mx-auto mb-4 opacity-20" />
          <p className="font-bold text-lg text-stone-600">O mural está vazio</p>
          <p className="text-sm mt-1">Nenhuma publicação foi feita ainda.</p>
        </div>
      ) : (
        <div className="space-y-5 md:space-y-6 max-w-3xl mx-auto">
          {posts.map(post => {
            const isEvent = post.type === 'evento'
            const hasLiked = post.mural_likes?.some((l: any) => l.user_id === userProfile.id)
            const hasRsvped = post.mural_rsvps?.some((r: any) => r.user_id === userProfile.id)
            const isAtivo = post.status === 'Ativo'

            return (
              <div key={post.id} className={`bg-white border rounded-[2rem] overflow-hidden shadow-sm transition-all ${isAtivo ? 'border-emerald-300 ring-4 ring-emerald-50' : 'border-stone-200'}`}>
                
                {/* CABEÇALHO DO POST */}
                <div className="px-5 py-4 md:px-6 md:py-5 flex justify-between items-start border-b border-stone-100 bg-stone-50/50">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm ${isEvent ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-stone-500 border-stone-200'}`}>
                      {isEvent ? <CalendarDays size={24} /> : <Megaphone size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${isEvent ? 'bg-amber-200 text-amber-900' : 'bg-stone-200 text-stone-700'}`}>
                          {isEvent ? 'Evento' : 'Aviso'}
                        </span>
                        {isEvent && (
                          <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md flex items-center gap-1 ${isAtivo ? 'bg-emerald-500 text-white animate-pulse' : post.status === 'Concluído' ? 'bg-stone-200 text-stone-500' : post.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isAtivo && <Activity size={10} />} {post.status}
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-stone-800 text-lg md:text-xl leading-tight">{post.title}</h3>
                      <p className="text-[11px] md:text-xs text-stone-400 font-medium mt-0.5">Por {post.author?.full_name?.split(' ')[0]} • {new Date(post.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  {canDelete && <button onClick={() => handleDelete(post.id)} className="p-2.5 bg-white border border-stone-200 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl cursor-pointer transition-colors"><Trash2 size={18} /></button>}
                </div>

                {/* CORPO DO POST */}
                <div className="p-5 md:p-6">
                  <p className="text-stone-600 text-sm md:text-base whitespace-pre-wrap leading-relaxed">{post.content}</p>
                  
                  {isEvent && (
                    <div className="mt-5 md:mt-6 flex flex-col gap-3 bg-amber-50/50 border border-amber-100 p-4 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><Clock size={14} className="text-amber-700"/></div>
                        <div>
                          <p className="text-[10px] font-bold text-amber-700/70 uppercase">Data e Hora</p>
                          <p className="text-sm font-bold text-amber-900">{new Date(post.event_date).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}</p>
                        </div>
                      </div>
                      {post.event_location && (
                        <div className="flex items-center gap-3 mt-1">
                          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><MapPin size={14} className="text-amber-700"/></div>
                          <div>
                            <p className="text-[10px] font-bold text-amber-700/70 uppercase">Local</p>
                            <p className="text-sm font-bold text-amber-900">{post.event_location}</p>
                          </div>
                        </div>
                      )}

                      {/* Controle de Status (Apenas Lideres/Admin) */}
                      {canManageStatus && (
                        <div className="mt-3 pt-4 border-t border-amber-200/50 flex flex-wrap gap-2">
                          {['Em breve', 'Ativo', 'Adiado', 'Concluído', 'Cancelado'].map(st => (
                            <button key={st} onClick={() => handleUpdateStatus(post.id, st)} className={`px-3 py-1.5 text-[10px] md:text-xs font-bold rounded-lg border transition-colors cursor-pointer ${post.status === st ? 'bg-amber-600 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}>
                              {st}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* RODAPÉ (Interações) */}
                <div className="px-3 py-3 md:px-5 md:py-4 bg-stone-50 flex items-center gap-3 border-t border-stone-100">
                  <button onClick={() => toggleLike(post.id, hasLiked)} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${hasLiked ? 'bg-blue-100 text-blue-700 shadow-inner' : 'bg-white text-stone-500 hover:bg-stone-200 border border-stone-200'}`}>
                    <ThumbsUp size={18} className={hasLiked ? 'fill-blue-700' : ''} />
                    <span>Curtir ({post.mural_likes?.length || 0})</span>
                  </button>
                  
                  {isEvent && (
                    <button onClick={() => toggleRsvp(post.id, hasRsvped)} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 md:py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${hasRsvped ? 'bg-emerald-100 text-emerald-700 shadow-inner' : 'bg-white text-stone-500 hover:bg-stone-200 border border-stone-200'}`}>
                      <CheckCircle size={18} className={hasRsvped ? 'fill-emerald-700 text-emerald-100' : ''} />
                      <span>{hasRsvped ? 'Confirmado' : 'Vou'} ({post.mural_rsvps?.length || 0})</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 md:p-6 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95">
            <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-stone-800">Nova Publicação</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full cursor-pointer"><X size={20}/></button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5 bg-stone-50/50">
                <div className="flex gap-2 p-1.5 bg-stone-200/50 rounded-2xl mb-2">
                  <button type="button" onClick={() => setPostType('aviso')} className={`flex-1 py-3 px-4 text-sm font-bold rounded-xl transition-all cursor-pointer ${postType === 'aviso' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}>Aviso Geral</button>
                  <button type="button" onClick={() => setPostType('evento')} className={`flex-1 py-3 px-4 text-sm font-bold rounded-xl transition-all cursor-pointer ${postType === 'evento' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}>Evento</button>
                </div>

                <div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">Título *</label><input required type="text" value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-4 py-3.5 md:py-3 bg-white border border-stone-200 rounded-xl text-base md:text-sm outline-none focus:border-amber-500 shadow-sm"/></div>
                <div><label className="block text-xs font-bold text-stone-500 uppercase mb-2">Conteúdo / Descrição *</label><textarea required rows={4} value={content} onChange={e=>setContent(e.target.value)} className="w-full px-4 py-3.5 md:py-3 bg-white border border-stone-200 rounded-xl text-base md:text-sm outline-none focus:border-amber-500 resize-none shadow-sm"/></div>

                {postType === 'evento' && (
                  <div className="p-5 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-4">
                    <div><label className="block text-xs font-bold text-amber-700/70 uppercase mb-2">Data e Hora *</label><input required type="datetime-local" value={eventDate} onChange={e=>setEventDate(e.target.value)} className="w-full px-4 py-3.5 md:py-3 bg-white border border-amber-200 rounded-xl text-base md:text-sm outline-none focus:border-amber-500 shadow-sm"/></div>
                    <div><label className="block text-xs font-bold text-amber-700/70 uppercase mb-2">Local do Evento</label><input type="text" value={eventLocation} onChange={e=>setEventLocation(e.target.value)} placeholder="Ex: Templo Principal" className="w-full px-4 py-3.5 md:py-3 bg-white border border-amber-200 rounded-xl text-base md:text-sm outline-none focus:border-amber-500 shadow-sm"/></div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-stone-100 bg-white flex flex-col sm:flex-row justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full sm:w-auto px-5 py-3.5 md:py-3 bg-stone-100 text-stone-700 font-bold text-sm rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-6 py-3.5 md:py-3 bg-amber-600 text-white font-bold text-sm rounded-xl shadow-sm disabled:opacity-50 cursor-pointer">{isSubmitting ? 'Publicando...' : 'Publicar no Mural'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}