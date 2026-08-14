import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { HeartHandshake, Search, Filter, Phone, Calendar, MapPin, MessageCircle, UserPlus, Users, ArrowRight, ShieldAlert, CheckCircle2, Clock, FileText, Shield, X, UserCircle, AlertCircle } from 'lucide-react'

// Tipagem baseada no banco
type Visitor = {
  id: string;
  full_name: string;
  whatsapp: string;
  birth_date: string;
  neighborhood: string;
  how_knew_us: string;
  decision: string;
  prayer_requests: any;
  status: string;
  assigned_to: string | null;
  created_at: string;
  assigned_user?: { full_name: string }; 
}

const FUNNEL_STAGES = [
  'Novo Visitante', 
  'Primeiro Contato Feito', 
  'Recebeu Visita', 
  'Encaminhado para GC', 
  'Integrado'
]

export function AcolhimentoView({ churchId, userProfile }: { churchId: string, userProfile: any }) {
  const [visitors, setVisitors] = useState<Visitor[]>([])
  const [leaders, setLeaders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Todos')

  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null)
  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const userRole = userProfile?.role?.toLowerCase() || 'membro'
  const canEdit = userProfile?.computed_permissions?.acolhimento?.edit || userRole === 'admin'

  useEffect(() => {
    if (churchId) {
      fetchVisitors()
      fetchLeaders()
    }
  }, [churchId])

  async function fetchVisitors() {
    setLoading(true)
    const { data, error } = await supabase
      .from('visitors')
      .select('*, assigned_user:user_profiles!visitors_assigned_to_fkey(full_name)')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setVisitors(data as unknown as Visitor[])
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

  async function fetchNotes(visitorId: string) {
    const { data } = await supabase
      .from('visitor_notes')
      .select('*, author:user_profiles(full_name)')
      .eq('visitor_id', visitorId)
      .order('created_at', { ascending: false })
    
    if (data) setNotes(data)
  }

  const handleOpenVisitor = (visitor: Visitor) => {
    setSelectedVisitor(visitor)
    fetchNotes(visitor.id)
  }

  const handleCloseVisitor = () => {
    setSelectedVisitor(null)
    setNotes([])
  }

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedVisitor || !canEdit) return
    setIsUpdating(true)
    const { error } = await supabase.from('visitors').update({ status: newStatus }).eq('id', selectedVisitor.id)
    if (!error) {
      setSelectedVisitor({ ...selectedVisitor, status: newStatus })
      fetchVisitors() 
    }
    setIsUpdating(false)
  }

  const handleAssignLeader = async (leaderId: string) => {
    if (!selectedVisitor || !canEdit) return
    setIsUpdating(true)
    const assignedId = leaderId === 'none' ? null : leaderId
    const { error } = await supabase.from('visitors').update({ assigned_to: assignedId }).eq('id', selectedVisitor.id)
    if (!error) {
      const leaderName = leaderId === 'none' ? undefined : leaders.find(l => l.id === leaderId)?.full_name
      setSelectedVisitor({ ...selectedVisitor, assigned_to: assignedId, assigned_user: leaderName ? { full_name: leaderName } : undefined })
      fetchVisitors()
    }
    setIsUpdating(false)
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVisitor || !newNote.trim() || !canEdit) return
    
    setIsUpdating(true)
    const { error } = await supabase.from('visitor_notes').insert([{
      visitor_id: selectedVisitor.id,
      author_id: userProfile.id,
      content: newNote.trim()
    }])

    if (!error) {
      setNewNote('')
      fetchNotes(selectedVisitor.id)
    }
    setIsUpdating(false)
  }

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  
  const totalThisMonth = visitors.filter(v => {
    const d = new Date(v.created_at)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  }).length

  const pendingContact = visitors.filter(v => v.status === 'Novo Visitante').length
  const integratedCount = visitors.filter(v => v.status === 'Integrado').length

  const filteredVisitors = visitors.filter(v => {
    const matchesSearch = v.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          v.whatsapp.includes(searchTerm) || 
                          (v.neighborhood && v.neighborhood.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'Todos' ? true : v.status === statusFilter;
    return matchesSearch && matchesStatus;
  })

  const formatWhatsapp = (num: string) => {
    if (!num) return '#'
    const limpo = num.replace(/\D/g, '')
    return `https://wa.me/55${limpo}` 
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Novo Visitante': return 'bg-red-100 text-red-700 border-red-200'
      case 'Primeiro Contato Feito': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'Recebeu Visita': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'Encaminhado para GC': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'Integrado': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
      default: return 'bg-stone-100 text-stone-600 border-stone-200'
    }
  }

  const getSafePrayerRequests = (requests: any): string[] => {
    if (Array.isArray(requests)) return requests;
    if (typeof requests === 'string') {
      try { return JSON.parse(requests); } 
      catch (e) { return []; }
    }
    return [];
  }

  const safeRequests = selectedVisitor ? getSafePrayerRequests(selectedVisitor.prayer_requests) : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      {/* HEADER E CARDS */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1 tracking-tight text-stone-800 flex items-center gap-3">
            <HeartHandshake className="text-amber-600" size={28} /> Consolidação de Visitantes
          </h2>
          <p className="text-stone-500 text-sm">Acompanhe e integre as novas vidas que chegaram à comunidade.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-stone-50 border border-stone-200 p-5 rounded-2xl flex items-center gap-4 hover:border-amber-200 transition-colors">
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
              <UserPlus size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-0.5">Neste Mês</p>
              <h3 className="text-2xl font-bold text-stone-800 leading-none">{totalThisMonth} <span className="text-sm font-medium text-stone-400">visitas</span></h3>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 p-5 rounded-2xl flex items-center gap-4 hover:border-red-200 transition-colors">
            <div className="w-12 h-12 bg-red-100 text-red-700 rounded-xl flex items-center justify-center shrink-0">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-0.5">Aguardando Contato</p>
              <h3 className="text-2xl font-bold text-red-800 leading-none">{pendingContact} <span className="text-sm font-medium text-red-400">novos</span></h3>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex items-center gap-4 hover:border-emerald-200 transition-colors">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-0.5">Integrados</p>
              <h3 className="text-2xl font-bold text-emerald-800 leading-none">{integratedCount} <span className="text-sm font-medium text-emerald-600">no total</span></h3>
            </div>
          </div>
        </div>
      </div>

      {/* ÁREA DE LISTAGEM */}
      <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        
        {/* BARRA DE PESQUISA E FILTROS */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, bairro ou telefone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-medium focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all"
            />
          </div>
          
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-700 focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 outline-none appearance-none cursor-pointer transition-all"
            >
              <option value="Todos">Todas as Fases</option>
              {FUNNEL_STAGES.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TABELA / LISTA */}
        {loading ? (
          <div className="text-center py-10 text-stone-400 animate-pulse font-medium">Buscando fichas...</div>
        ) : filteredVisitors.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200 text-stone-400">
            <ShieldAlert size={40} className="mx-auto mb-3 opacity-50" />
            <p className="font-semibold">Nenhum visitante encontrado.</p>
            <p className="text-sm">Tente ajustar seus filtros de busca.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="py-4 px-5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Visitante</th>
                  <th className="py-4 px-5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Bairro</th>
                  <th className="py-4 px-5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Fase Atual</th>
                  <th className="py-4 px-5 text-xs font-semibold text-stone-500 uppercase tracking-wider">Acolhedor</th>
                  <th className="py-4 px-5 text-xs font-semibold text-stone-500 uppercase tracking-wider text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-100">
                {filteredVisitors.map(visitor => (
                  <tr key={visitor.id} className="hover:bg-stone-50 transition-colors group">
                    <td className="py-4 px-5">
                      <p className="font-semibold text-stone-800 text-sm">{visitor.full_name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-stone-500 font-medium">{new Date(visitor.created_at).toLocaleDateString('pt-BR')}</span>
                        {visitor.decision && visitor.decision !== 'Estou apenas visitando' && (
                          <span className="text-[10px] font-semibold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded flex items-center gap-1"><ArrowRight size={10}/> {visitor.decision === 'Quero entregar minha vida a Jesus' ? 'Conversão' : 'Reconciliação'}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-sm text-stone-600 flex items-center gap-1.5"><MapPin size={14} className="text-stone-400"/> {visitor.neighborhood || '-'}</td>
                    <td className="py-4 px-5">
                      <span className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${getStatusColor(visitor.status)}`}>
                        {visitor.status}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      {visitor.assigned_user ? (
                        <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1 rounded-md flex items-center gap-1.5 w-max">
                          <Shield size={12} /> {visitor.assigned_user.full_name.split(' ')[0]}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-1 rounded-md">Sem líder</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="flex justify-end gap-2">
                        <a 
                          href={formatWhatsapp(visitor.whatsapp)} 
                          target="_blank" rel="noreferrer"
                          className="p-2 text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-200"
                          title="Chamar no WhatsApp"
                        >
                          <Phone size={18} />
                        </a>
                        <button 
                          onClick={() => handleOpenVisitor(visitor)}
                          className="px-4 py-2 bg-white border border-stone-200 text-stone-600 hover:text-amber-700 hover:border-amber-300 text-xs font-semibold rounded-lg transition-colors shadow-sm"
                        >
                          Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL PADRONIZADO ESTRUTURALMENTE */}
      {selectedVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm animate-in fade-in">
          
          <div className="bg-white w-full max-w-5xl h-[90vh] sm:h-[85vh] max-h-[800px] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
            
            {/* 1. Header do Modal (Fixo) */}
            <div className="px-6 py-5 border-b border-stone-200 flex justify-between items-start bg-white shrink-0 z-10">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-stone-800 tracking-tight">{selectedVisitor.full_name}</h3>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <span className="text-sm font-medium text-stone-500 flex items-center gap-1.5">
                    <Calendar size={14} className="text-stone-400"/> Visita em {new Date(selectedVisitor.created_at).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="text-sm font-medium text-stone-500 flex items-center gap-1.5">
                    <Phone size={14} className="text-stone-400"/> {selectedVisitor.whatsapp}
                  </span>
                </div>
              </div>
              <button 
                onClick={handleCloseVisitor} 
                className="p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 rounded-full transition-colors"
              >
                <X size={24}/>
              </button>
            </div>

            {/* 2. Corpo do Modal (Grid 2 colunas com Scroll Independente) */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 bg-white">
              
              {/* Coluna Esquerda: Dados e Gestão (Rola de forma independente) */}
              <div className="overflow-y-auto p-6 sm:p-8 space-y-8 border-r border-stone-100">
                
                {/* Gestão do Funil */}
                {canEdit && (
                  <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100">
                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-amber-800 uppercase tracking-wider mb-3">
                        Fase no Funil de Integração
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {FUNNEL_STAGES.map(stage => (
                          <button 
                            key={stage}
                            disabled={isUpdating}
                            onClick={() => handleUpdateStatus(stage)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                              selectedVisitor.status === stage 
                              ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                              : 'bg-white text-stone-600 border-stone-200 hover:border-amber-300 hover:bg-amber-50'
                            }`}
                          >
                            {stage}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-amber-100/50">
                      <label className="block text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Shield size={14}/> Atribuir Acolhedor (Líder/GC)
                      </label>
                      <select 
                        disabled={isUpdating}
                        value={selectedVisitor.assigned_to || 'none'}
                        onChange={(e) => handleAssignLeader(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none shadow-sm cursor-pointer transition-all"
                      >
                        <option value="none">Nenhum (Na fila de espera)</option>
                        {leaders.map(l => (
                          <option key={l.id} value={l.id}>{l.full_name} ({l.role === 'admin' ? 'Admin' : 'Líder'})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Resumo da Ficha */}
                <div>
                  <h4 className="font-bold text-stone-800 text-base flex items-center gap-2 mb-5 border-b border-stone-100 pb-3">
                    <FileText size={18} className="text-stone-400"/> Resumo da Ficha
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-5">
                    <div>
                      <span className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Decisão / Momento Atual</span>
                      <span className={`inline-block text-sm font-semibold px-2.5 py-1 rounded-lg ${!selectedVisitor.decision || selectedVisitor.decision.includes('apenas visitando') ? 'bg-stone-100 text-stone-600' : 'bg-amber-100 text-amber-800'}`}>
                        {selectedVisitor.decision || 'Não informou'}
                      </span>
                    </div>
                    
                    <div>
                      <span className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Como nos conheceu?</span>
                      <p className="text-sm font-medium text-stone-800">{selectedVisitor.how_knew_us || 'Não informou'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Data de Nasc.</span>
                        <p className="text-sm font-medium text-stone-800">{selectedVisitor.birth_date ? new Date(selectedVisitor.birth_date).toLocaleDateString('pt-BR') : 'Não informou'}</p>
                      </div>
                      <div>
                        <span className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Bairro</span>
                        <p className="text-sm font-medium text-stone-800">{selectedVisitor.neighborhood || 'Não informou'}</p>
                      </div>
                    </div>
                    
                    {safeRequests.length > 0 && (
                      <div>
                        <span className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Pedidos de Oração</span>
                        <div className="flex flex-wrap gap-2">
                          {safeRequests.map((req: string, idx: number) => (
                            <span key={idx} className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">{req}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Coluna Direita: Histórico de Contato (Layout Flex para travar input no fundo) */}
              <div className="flex flex-col h-full bg-stone-50/50 relative">
                
                {/* Título Histórico */}
                <div className="p-6 pb-4 border-b border-stone-100 shrink-0">
                  <h4 className="font-bold text-stone-800 text-base flex items-center gap-2">
                    <Clock size={18} className="text-stone-400"/> Histórico de Contato
                  </h4>
                </div>
                
                {/* Lista de Notas (Rola para preencher o espaço) */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {notes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2">
                      <MessageCircle size={32} className="opacity-20" />
                      <p className="text-sm font-medium italic">Nenhum contato registrado ainda.</p>
                    </div>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                        <p className="text-sm text-stone-700 leading-relaxed mb-3">{note.content}</p>
                        <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                          <span className="text-xs font-semibold text-stone-500 flex items-center gap-1.5">
                            <UserCircle size={14}/> {note.author?.full_name.split(' ')[0]}
                          </span>
                          <span className="text-xs font-medium text-stone-400">
                            {new Date(note.created_at).toLocaleDateString('pt-BR')} às {new Date(note.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input Fixo no Rodapé da Coluna Direita */}
                {canEdit && (
                  <div className="p-6 pt-4 border-t border-stone-100 bg-white shrink-0">
                    <form onSubmit={handleAddNote} className="bg-stone-50 p-2 rounded-2xl border border-stone-200 flex gap-2 focus-within:border-amber-300 focus-within:bg-white focus-within:ring-4 ring-amber-500/10 transition-all">
                      <input 
                        type="text" 
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="Adicionar registro de contato..."
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-stone-800 px-3 placeholder:text-stone-400"
                      />
                      <button 
                        type="submit" 
                        disabled={isUpdating || !newNote.trim()} 
                        className="bg-amber-600 hover:bg-amber-700 text-white p-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center shadow-sm"
                      >
                        <MessageCircle size={18}/>
                      </button>
                    </form>
                  </div>
                )}
              </div>

            </div>
            
            {/* 3. Rodapé Global do Modal */}
            <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex justify-between items-center shrink-0 rounded-b-3xl">
              <a 
                href={formatWhatsapp(selectedVisitor.whatsapp)} 
                target="_blank" rel="noreferrer"
                className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
              >
                <Phone size={16} /> Abrir WhatsApp
              </a>
              <button 
                onClick={handleCloseVisitor} 
                className="px-5 py-2.5 bg-white border border-stone-200 text-stone-600 font-bold text-sm rounded-xl hover:bg-stone-100 hover:text-stone-800 transition-colors shadow-sm"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}