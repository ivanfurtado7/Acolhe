import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { ArrowLeft, Plus, CheckCircle, Clock, ShieldCheck, Baby, LogOut, AlertTriangle } from 'lucide-react'

export function KidsCheckinManagement({ onBack }: { onBack: () => void }) {
  const [kids, setKids] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [checkins, setCheckins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  const [activeTab, setActiveTab] = useState<'checkin' | 'registry'>('checkin')

  // Estados Novo Cadastro
  const [showKidModal, setShowKidModal] = useState(false)
  const [kidName, setKidName] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentWhatsapp, setParentWhatsapp] = useState('')
  const [allergies, setAllergies] = useState('')

  // Estados Novo Check-in
  const [showCheckinModal, setShowCheckinModal] = useState(false)
  const [selectedKidId, setSelectedKidId] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: kidsData } = await supabase.from('kids').select('*').order('name', { ascending: true })
    const { data: eventsData } = await supabase.from('events').select('*').order('event_date', { ascending: false }).limit(5)
    
    // Busca os check-ins com os dados da criança e do culto juntos
    const { data: checkinsData } = await supabase
      .from('kids_checkin')
      .select('*, kid:kids(*), event:events(*)')
      .order('checked_in_at', { ascending: false })

    if (kidsData) setKids(kidsData)
    if (eventsData) {
        setEvents(eventsData)
        if (eventsData.length > 0) setSelectedEventId(eventsData[0].id)
    }
    if (checkinsData) setCheckins(checkinsData)
    
    setLoading(false)
  }

  const handleRegisterKid = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: churchData } = await supabase.from('churches').select('id').limit(1).single()
    if (!churchData) return

    const { error } = await supabase.from('kids').insert([{
      church_id: churchData.id,
      name: kidName,
      parent_name: parentName,
      parent_whatsapp: parentWhatsapp,
      allergies_obs: allergies
    }])

    if (!error) {
      setKidName(''); setParentName(''); setParentWhatsapp(''); setAllergies('')
      setShowKidModal(false)
      fetchData()
    }
  }

  const handleCreateCheckin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedKidId || !selectedEventId) return

    // Gera um código aleatório de 4 dígitos (ex: #4092)
    const code = Math.floor(1000 + Math.random() * 9000).toString()

    const { error } = await supabase.from('kids_checkin').insert([{
      kid_id: selectedKidId,
      event_id: selectedEventId,
      checkin_code: code,
      status: 'presente'
    }])

    if (!error) {
      setGeneratedCode(code)
      fetchData()
    }
  }

  const handleCheckout = async (checkinId: string) => {
    const { error } = await supabase.from('kids_checkin').update({
      status: 'liberado',
      checked_out_at: new Date().toISOString()
    }).eq('id', checkinId)

    if (!error) fetchData()
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-5xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors bg-white border border-stone-200 shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-stone-800">Check-in Kids</h1>
              <p className="text-sm text-stone-500">Segurança e organização para o Ministério Infantil.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-stone-200/70 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('checkin')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'checkin' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-600 hover:text-stone-800'}`}
            >
              Check-in (Culto)
            </button>
            <button
              onClick={() => setActiveTab('registry')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'registry' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-600 hover:text-stone-800'}`}
            >
              Cadastro ({kids.length})
            </button>
          </div>
        </div>

        {/* ABA: CHECK-IN */}
        {activeTab === 'checkin' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-stone-800">Crianças na Salinha</h3>
                <p className="text-xs text-stone-500 mt-0.5">Registre a entrada e gere o código de segurança para os pais.</p>
              </div>
              <button
                onClick={() => { setGeneratedCode(null); setShowCheckinModal(true); }}
                className="px-4 py-2.5 bg-amber-700 text-white rounded-xl text-sm font-medium hover:bg-amber-800 transition-colors shadow-sm flex items-center gap-1.5"
              >
                <ShieldCheck size={16} /> Fazer Entrada
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {checkins.filter(c => c.status === 'presente').length === 0 ? (
                <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-stone-200 text-stone-400 text-sm">
                  Nenhuma criança na salinha no momento.
                </div>
              ) : (
                checkins.filter(c => c.status === 'presente').map((checkin) => (
                  <div key={checkin.id} className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-stone-100 px-3 py-1.5 rounded-bl-xl border-b border-l border-stone-200">
                      <span className="text-xs font-bold font-mono text-stone-800">#{checkin.checkin_code}</span>
                    </div>
                    
                    <h4 className="text-base font-bold text-stone-800 pr-12">{checkin.kid?.name}</h4>
                    <p className="text-xs text-stone-500 flex items-center gap-1 mt-1">
                      <Clock size={12} /> Entrada: {new Date(checkin.checked_in_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    
                    <div className="mt-3 pt-3 border-t border-stone-100 text-xs">
                      <p className="text-stone-600 font-semibold">Resp: {checkin.kid?.parent_name}</p>
                      {checkin.kid?.allergies_obs && (
                        <p className="text-red-600 mt-1 flex gap-1 items-start bg-red-50 p-2 rounded-lg">
                          <AlertTriangle size={12} className="shrink-0 mt-0.5" /> 
                          {checkin.kid.allergies_obs}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleCheckout(checkin.id)}
                      className="mt-4 w-full py-2 bg-stone-100 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <LogOut size={14} /> Liberar Saída
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ABA: CADASTRO DE CRIANÇAS */}
        {activeTab === 'registry' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div>
                <h3 className="text-lg font-bold text-stone-800">Banco de Crianças</h3>
                <p className="text-xs text-stone-500 mt-0.5">Cadastre os pequenos e informações de contato dos pais.</p>
              </div>
              <button
                onClick={() => setShowKidModal(true)}
                className="px-4 py-2.5 bg-stone-800 text-white rounded-xl text-sm font-medium hover:bg-stone-900 transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Plus size={16} /> Cadastrar Criança
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-stone-500 uppercase">
                    <th className="p-4">Criança</th>
                    <th className="p-4">Responsável</th>
                    <th className="p-4">Alergias / Obs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {kids.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-stone-400">Nenhum registro encontrado.</td>
                    </tr>
                  ) : (
                    kids.map(kid => (
                      <tr key={kid.id} className="hover:bg-stone-50/60">
                        <td className="p-4 font-bold text-stone-800 flex items-center gap-2">
                          <Baby size={16} className="text-amber-700" /> {kid.name}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-stone-700">{kid.parent_name}</div>
                          <div className="text-xs text-stone-500">{kid.parent_whatsapp}</div>
                        </td>
                        <td className="p-4 text-xs text-stone-600">
                          {kid.allergies_obs || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: CADASTRO CRIANÇA */}
        {showKidModal && (
          <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
              <h3 className="text-lg font-bold text-stone-800 mb-4">Cadastrar Criança</h3>
              <form onSubmit={handleRegisterKid} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Nome da Criança *</label>
                  <input type="text" value={kidName} onChange={e => setKidName(e.target.value)} required placeholder="Ex: Davi Lucas" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Nome do Responsável *</label>
                  <input type="text" value={parentName} onChange={e => setParentName(e.target.value)} required placeholder="Ex: Maria (Mãe)" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">WhatsApp do Responsável</label>
                  <input type="text" value={parentWhatsapp} onChange={e => setParentWhatsapp(e.target.value)} placeholder="(98) 99999-9999" className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Alergias ou Observações Médicas</label>
                  <textarea value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Ex: Alergia a amendoim, intolerância a lactose..." className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none resize-none"></textarea>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowKidModal(false)} className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium">Cancelar</button>
                  <button type="submit" className="px-5 py-2 bg-stone-800 text-white rounded-xl text-sm font-medium">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: NOVO CHECK-IN */}
        {showCheckinModal && (
          <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200">
              
              {!generatedCode ? (
                <>
                  <h3 className="text-lg font-bold text-stone-800 mb-4">Entrada na Salinha</h3>
                  <form onSubmit={handleCreateCheckin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Selecione o Culto *</label>
                      <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} required className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none">
                        {events.map(ev => (
                          <option key={ev.id} value={ev.id}>{ev.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Selecione a Criança *</label>
                      <select value={selectedKidId} onChange={e => setSelectedKidId(e.target.value)} required className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm outline-none">
                        <option value="" disabled>Escolha a criança...</option>
                        {kids.map(kid => (
                          <option key={kid.id} value={kid.id}>{kid.name} (Resp: {kid.parent_name})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setShowCheckinModal(false)} className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-sm font-medium">Cancelar</button>
                      <button type="submit" disabled={!selectedKidId || !selectedEventId} className="px-5 py-2 bg-amber-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">Gerar Código</button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={36} />
                  </div>
                  <h3 className="text-xl font-bold text-stone-800">Check-in Realizado!</h3>
                  <p className="text-sm text-stone-500 mt-2">Informe o código abaixo ao responsável para a retirada ao final do culto.</p>
                  
                  <div className="bg-stone-100 border border-stone-200 rounded-xl p-4 mt-6 mb-6">
                    <p className="text-xs uppercase text-stone-400 font-bold mb-1">Código de Retirada</p>
                    <p className="text-4xl font-mono font-black text-amber-700">#{generatedCode}</p>
                  </div>

                  <button onClick={() => setShowCheckinModal(false)} className="w-full py-3 bg-stone-800 text-white rounded-xl text-sm font-medium">
                    Concluir
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}