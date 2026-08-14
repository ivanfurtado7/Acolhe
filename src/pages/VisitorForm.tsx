import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { CheckCircle2, User, Phone, MapPin, Calendar } from 'lucide-react'

const PRAYER_OPTIONS = [
  'Saúde Física', 'Família / Casamento', 
  'Vida Financeira', 'Força Espiritual', 
  'Libertação', 'Emprego'
]

export function VisitorForm() {
  const [churchId, setChurchId] = useState<string | null>(null)
  const [churchName, setChurchName] = useState<string>('Nossa Comunidade')
  
  const [fullName, setFullName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [howKnewUs, setHowKnewUs] = useState('')
  const [decision, setDecision] = useState('')
  const [prayerRequests, setPrayerRequests] = useState<string[]>([])
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const cId = params.get('c')
    if (cId) {
      setChurchId(cId)
      supabase.from('churches').select('name').eq('id', cId).single()
        .then(({ data }) => { if (data) setChurchName(data.name) })
    }
  }, [])

  const handleTogglePrayer = (option: string) => {
    setPrayerRequests(prev => 
      prev.includes(option) ? prev.filter(p => p !== option) : [...prev, option]
    )
  }

  const formatPhone = (val: string) => {
    const limpo = val.replace(/\D/g, '')
    const match = limpo.match(/^(\d{0,2})(\d{0,5})(\d{0,4})$/)
    if (!match) return val
    if (!match[2]) return match[1]
    return `(${match[1]}) ${match[2]}${match[3] ? '-' + match[3] : ''}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!churchId) {
      setError("Link da ficha inválido. Falta o código da igreja.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    // PREPARAÇÃO SEGURA DOS DADOS:
    const safeBirthDate = birthDate.trim() === '' ? null : birthDate;

    const { error: dbError } = await supabase.from('visitors').insert([{
      church_id: churchId,
      full_name: fullName,
      whatsapp,
      birth_date: safeBirthDate, 
      neighborhood,
      how_knew_us: howKnewUs,
      decision,
      prayer_requests: prayerRequests,
      status: 'Novo Visitante',
      origin: 'Ficha Online' // Correção do erro "violates not-null constraint"
    }])

    setIsSubmitting(false)

    if (dbError) {
      console.error("DETALHES DO ERRO:", dbError.message, dbError.details, dbError.hint)
      setError(`Erro no servidor: ${dbError.message}`)
    } else {
      setIsSuccess(true)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white max-w-md w-full rounded-[2rem] p-8 sm:p-10 text-center shadow-xl border border-stone-200 animate-in zoom-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-black text-stone-800 mb-2 tracking-tight">Ficha Enviada!</h2>
          <p className="text-stone-600 leading-relaxed mb-8">
            Que alegria ter você conosco hoje. Nossa equipe de acolhimento já recebeu seus dados e estará orando por você.
          </p>
          <p className="text-sm font-bold text-amber-700 uppercase tracking-widest">{churchName}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex justify-center py-6 px-4 sm:py-10 font-sans selection:bg-amber-100 selection:text-amber-900">
      
      <div className="w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-stone-100 relative h-max">
        
        <div className="bg-gradient-to-b from-stone-900 to-stone-800 px-8 pt-10 pb-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          
          <h1 className="text-3xl font-black text-white tracking-tight mb-3">Bem-vindo!</h1>
          <p className="text-stone-300 text-sm font-medium leading-relaxed max-w-sm mx-auto">
            Preencha rapidamente para que possamos conhecer e orar por você.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-8 sm:px-8 -mt-6 bg-white rounded-t-[2rem] relative z-10 space-y-6">
          
          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100 text-center">
              {error}
            </div>
          )}

          {!churchId && !error && (
            <div className="p-4 bg-orange-50 text-orange-700 text-xs font-bold rounded-xl border border-orange-100 text-center mb-4">
              ⚠️ Visualização de Teste: O ID da igreja não está na URL.
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Seu Nome e Sobrenome *</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-medium focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">WhatsApp *</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input type="tel" required placeholder="(00) 90000-0000" value={whatsapp} onChange={e => setWhatsapp(formatPhone(e.target.value))} className="w-full pl-11 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-medium focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Nascimento *</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input type="date" required value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-medium focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Bairro Onde Mora *</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input type="text" required placeholder="Ex: Centro" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} className="w-full pl-11 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-medium focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all" />
            </div>
          </div>

          <hr className="border-stone-100" />

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Como Conheceu Nossa Igreja? *</label>
            <select required value={howKnewUs} onChange={e => setHowKnewUs(e.target.value)} className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-medium focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all appearance-none cursor-pointer">
              <option value="" disabled>Selecione uma opção...</option>
              <option value="Convite de um amigo/familiar">Convite de um amigo/familiar</option>
              <option value="Redes Sociais (Instagram/YouTube)">Redes Sociais (Instagram/YouTube)</option>
              <option value="Passei em frente">Passei em frente</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Sua Decisão Hoje</label>
            <div className="space-y-3">
              {['Quero entregar minha vida a Jesus', 'Quero me reconciliar com Deus', 'Estou apenas visitando'].map((opt) => (
                <label 
                  key={opt} 
                  onClick={() => setDecision(opt)} 
                  className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${decision === opt ? 'border-amber-600 bg-amber-50' : 'border-stone-200 hover:border-amber-300'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${decision === opt ? 'border-amber-600' : 'border-stone-300'}`}>
                    {decision === opt && <div className="w-2.5 h-2.5 bg-amber-600 rounded-full" />}
                  </div>
                  <span className={`text-sm font-bold ${decision === opt ? 'text-amber-900' : 'text-stone-600'}`}>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Podemos Orar por Alguma Área?</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRAYER_OPTIONS.map((opt) => {
                const isSelected = prayerRequests.includes(opt)
                return (
                  <label 
                    key={opt} 
                    onClick={() => handleTogglePrayer(opt)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-amber-600 bg-amber-50' : 'border-stone-200 hover:border-amber-300'}`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-amber-600 border-amber-600 text-white' : 'border-stone-300 bg-white'}`}>
                      {isSelected && <CheckCircle2 size={14} strokeWidth={3} />}
                    </div>
                    <span className={`text-sm font-bold ${isSelected ? 'text-amber-900' : 'text-stone-600'}`}>{opt}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-4 bg-[#C15B0A] hover:bg-[#A34A08] text-white font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 disabled:opacity-70 active:scale-[0.98]"
            >
              {isSubmitting ? 'Enviando...' : <><CheckCircle2 size={22} /> Concluir Ficha</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}