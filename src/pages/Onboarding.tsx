import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { User, Mail, Key, Phone, Building, Users, CheckCircle2, AlertCircle, ArrowLeft, Hourglass, Clock, MapPin } from 'lucide-react'

// Importações visuais
import logoAcolhe from '../assets/logo-acolhe.png'
import logoCVR from '../assets/CVR.jfif'
import iconYoutube from '../assets/youtube.png'
import iconInstagram from '../assets/instagram.jfif'

export function Onboarding({ 
  currentUserId, 
  hasProfile, 
  onBack, 
  onFinish 
}: { 
  currentUserId?: string, 
  hasProfile?: boolean,
  onBack: () => void, 
  onFinish?: () => void 
}) {
  const [activeUserId, setActiveUserId] = useState<string | undefined>(currentUserId)
  const [step, setStep] = useState((currentUserId && hasProfile) ? 2 : 1)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Controle de Solicitações (Spam, Status e Timer)
  const [pendingRequest, setPendingRequest] = useState<any>(null)
  const [rejectedCount, setRejectedCount] = useState(0)
  const [lastRejectedChurch, setLastRejectedChurch] = useState('')
  const [blockEndTime, setBlockEndTime] = useState<Date | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [objective, setObjective] = useState<'admin' | 'member' | null>(null)
  
  const [churchName, setChurchName] = useState('')
  const [country, setCountry] = useState('Brasil')
  const [stateRegion, setStateRegion] = useState('')
  const [address, setAddress] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [complement, setComplement] = useState('')
  const [zipCode, setZipCode] = useState('')

  const [churchesList, setChurchesList] = useState<any[]>([])
  const [selectedChurchId, setSelectedChurchId] = useState('')

  // 1. Busca o histórico de solicitações para lidar com bloqueios
  useEffect(() => {
    async function checkRequestsHistory() {
      if (!activeUserId) return
      
      const { data } = await supabase
        .from('join_requests')
        .select('*, churches(name)')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        const pending = data.find(r => r.status === 'pending')
        if (pending) {
          setPendingRequest(pending)
          setStep(4) 
          return
        }

        const rejected = data.filter(r => r.status === 'rejected')
        setRejectedCount(rejected.length)
        
        // Regra do Bloqueio de 24 horas
        if (rejected.length >= 3) {
          const lastRejection = new Date(rejected[0].resolved_at || rejected[0].created_at)
          const blockEnd = new Date(lastRejection.getTime() + 24 * 60 * 60 * 1000)
          
          if (new Date() < blockEnd) {
            setBlockEndTime(blockEnd)
          } else {
            setRejectedCount(0) 
          }
        } else if (rejected.length > 0) {
          setLastRejectedChurch(rejected[0].churches?.name || 'a instituição')
        }
      }
    }
    checkRequestsHistory()
  }, [activeUserId])

  // 2. Lógica do Timer Dinâmico
  useEffect(() => {
    if (!blockEndTime) return

    const timerInterval = setInterval(() => {
      const now = new Date().getTime()
      const distance = blockEndTime.getTime() - now

      if (distance <= 0) {
        clearInterval(timerInterval)
        setBlockEndTime(null)
        setRejectedCount(0) 
        setTimeLeft('')
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((distance % (1000 * 60)) / 1000)

        setTimeLeft(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        )
      }
    }, 1000)

    return () => clearInterval(timerInterval)
  }, [blockEndTime])

  useEffect(() => {
    if (objective === 'member') {
      supabase.from('churches').select('id, name').order('name').then(({ data }) => {
        if (data) setChurchesList(data)
      })
    }
  }, [objective])

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeUserId && password !== confirmPassword) return setError('As senhas não coincidem.')
    if (!termsAccepted) return setError('Você precisa aceitar os Termos de Utilização.')
    
    setLoading(true)
    setError(null)
    
    let userIdToUse = activeUserId

    if (!userIdToUse) {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: `${firstName} ${lastName}` } }
      })
      if (authError) { setLoading(false); return setError(authError.message); }
      if (!authData.user) { setLoading(false); return setError('Erro inesperado ao criar conta.'); }
      
      userIdToUse = authData.user.id
      setActiveUserId(userIdToUse)
    }

    const { error: profileError } = await supabase.from('user_profiles').upsert([{ 
      id: userIdToUse, full_name: `${firstName} ${lastName}`, whatsapp: phone, role: 'membro' 
    }])

    setLoading(false)
    if (profileError) setError(profileError.message)
    else setStep(2)
  }

  const handleRegisterInstitution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeUserId || !churchName) return
    setLoading(true)
    setError(null)

    const slug = churchName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")

    try {
      const { data: churchData, error: churchError } = await supabase.from('churches').insert([{ 
        name: churchName, slug, country, state: stateRegion, address, address_number: addressNumber, address_complement: complement, zip_code: zipCode 
      }]).select().single()
      
      if (churchError) throw new Error(churchError.message)

      const { error: profileError } = await supabase.from('user_profiles').update({ church_id: churchData.id, role: 'admin' }).eq('id', activeUserId)
      if (profileError) throw new Error(profileError.message)

      if (onFinish) onFinish()
      else window.location.reload()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleSendJoinRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeUserId || !selectedChurchId) return
    setLoading(true)
    setError(null)

    const { error: requestError } = await supabase.from('join_requests').insert([{
      user_id: activeUserId, church_id: selectedChurchId, status: 'pending'
    }])

    setLoading(false)
    if (requestError) {
      setError(requestError.message)
    } else {
      const selectedChurch = churchesList.find(c => c.id === selectedChurchId)
      setPendingRequest({ churches: { name: selectedChurch?.name } })
      setStep(4)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center font-sans selection:bg-amber-100 selection:text-amber-900 relative p-4">
      
      <div 
        className="absolute inset-0 z-0 bg-stone-50"
        style={{ backgroundImage: `url(${logoAcolhe})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.10 }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-stone-50/30 to-stone-100/90 backdrop-blur-[1px]"></div>

      <div className="w-full max-w-3xl bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-stone-300/50 p-6 md:p-12 relative border border-white z-10">
        
        {step > 1 && step < 4 && (
          <button 
            onClick={() => {
              if (step === 2 && currentUserId && hasProfile) onBack()
              else setStep(step - 1)
            }} 
            className="absolute top-6 left-6 text-stone-400 hover:text-amber-600 transition-colors flex items-center gap-1 text-sm font-bold uppercase tracking-wider"
          >
            <ArrowLeft size={16} /> {(step === 2 && currentUserId && hasProfile) ? 'Sair' : 'Voltar'}
          </button>
        )}

        {/* CABEÇALHO PADRÃO (Oculto durante o bloqueio para destacar o banner da Igreja) */}
        {!blockEndTime && (
          <div className="text-center mb-10">
            <div className="flex justify-center mb-6">
              <div className="w-24 h-24 bg-white rounded-full shadow-lg border-4 border-white flex items-center justify-center overflow-hidden">
                <img src={logoAcolhe} alt="Acolhe Logo" className="w-full h-full object-cover scale-110" />
              </div>
            </div>
            
            {step === 1 && (
              <>
                <h2 className="text-2xl font-black text-stone-800 tracking-tight mt-4">{activeUserId ? 'Complete seu perfil' : 'Registre a sua conta'}</h2>
                <p className="text-stone-500 text-base mt-1">{activeUserId ? 'Faltam apenas alguns dados para continuar.' : 'Passo 1: Crie seu acesso ao sistema.'}</p>
              </>
            )}
            {step === 2 && (
              <>
                <h2 className="text-2xl font-black text-stone-800 tracking-tight mt-4">Qual é o seu objetivo?</h2>
                <p className="text-stone-500 text-base mt-1">Passo 2: Defina como você usará a plataforma.</p>
              </>
            )}
            {step === 3 && objective === 'admin' && (
              <>
                <h2 className="text-2xl font-black text-stone-800 tracking-tight mt-4">Registre a sua instituição</h2>
                <p className="text-stone-500 text-base mt-1">Passo 3: Insira as informações da sua congregação.</p>
              </>
            )}
            {step === 3 && objective === 'member' && (
              <>
                <h2 className="text-2xl font-black text-stone-800 tracking-tight mt-4">Vincular a uma instituição</h2>
                <p className="text-stone-500 text-base mt-1">Passo 3: Envie uma solicitação para a liderança.</p>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 rounded-xl border border-red-100 flex items-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleCreateAccount} className="space-y-5 max-w-2xl mx-auto animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 text-stone-400" size={18} />
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="Nome" className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
              </div>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 text-stone-400" size={18} />
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Sobrenome" className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
              </div>
            </div>

            {!activeUserId && (
              <>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 text-stone-400" size={18} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="E-mail" className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
                </div>

                <div className="relative">
                  <Key className="absolute left-3.5 top-3.5 text-stone-400" size={18} />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Senha" className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
                </div>

                <div className="relative">
                  <Key className="absolute left-3.5 top-3.5 text-stone-400" size={18} />
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="Confirme a Senha" className="w-full pl-11 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
                </div>
              </>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative flex shadow-sm rounded-xl">
                <span className="inline-flex items-center px-4 border border-r-0 border-stone-200 bg-stone-50 text-stone-500 rounded-l-xl text-sm font-medium">
                  🇧🇷 +55
                </span>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="11 90000-0000" className="flex-1 w-full px-4 py-3.5 bg-white border border-stone-200 rounded-r-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all" />
              </div>
              <div>
                <select className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm">
                  <option>Português (BR)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="peer sr-only" />
                  <div className="w-5 h-5 border-2 border-stone-300 rounded peer-checked:bg-amber-600 peer-checked:border-amber-600 transition-colors"></div>
                  <CheckCircle2 size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
                </div>
                <span className="text-sm font-medium text-stone-600 group-hover:text-stone-900 transition-colors">Li e concordo com os <b>Termos de Uso</b> e <b>Privacidade</b></span>
              </label>
            </div>

            <div className="pt-6">
              <button type="submit" disabled={loading} className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg rounded-xl transition-all shadow-lg shadow-amber-600/20 active:scale-[0.98]">
                {loading ? 'Aguarde...' : 'Próximo Passo'}
              </button>
            </div>

            {!activeUserId && (
              <div className="text-center pt-6">
                <p className="text-sm text-stone-500">Já tem uma conta? <button type="button" onClick={onBack} className="text-amber-700 font-bold hover:underline">Faça login aqui</button></p>
              </div>
            )}
          </form>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4">
            <button onClick={() => { setObjective('admin'); setStep(3); }} className="p-8 border border-stone-200 bg-white shadow-sm rounded-2xl hover:border-amber-600 hover:shadow-md transition-all text-left flex flex-col items-center text-center gap-4 group">
              <div className="w-16 h-16 bg-stone-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all"><Building size={28} /></div>
              <div>
                <h3 className="font-bold text-stone-800 text-lg">Administrador</h3>
                <p className="text-sm text-stone-500 mt-2">Quero registrar a minha instituição no sistema para gerenciá-la.</p>
              </div>
            </button>

            <button onClick={() => { setObjective('member'); setStep(3); }} className="p-8 border border-stone-200 bg-white shadow-sm rounded-2xl hover:border-amber-600 hover:shadow-md transition-all text-left flex flex-col items-center text-center gap-4 group">
              <div className="w-16 h-16 bg-stone-50 text-stone-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all"><Users size={28} /></div>
              <div>
                <h3 className="font-bold text-stone-800 text-lg">Liderança / Membro</h3>
                <p className="text-sm text-stone-500 mt-2">Minha igreja já tem conta, quero apenas vincular meu perfil.</p>
              </div>
            </button>
          </div>
        )}

        {step === 3 && objective === 'admin' && (
          <form onSubmit={handleRegisterInstitution} className="space-y-4 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Nome da Instituição</label>
              <input type="text" value={churchName} onChange={e => setChurchName(e.target.value)} required className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">País</label>
                <select value={country} onChange={e => setCountry(e.target.value)} className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm">
                  <option value="Brasil">Brasil</option>
                  <option value="Portugal">Portugal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Estado</label>
                <input type="text" value={stateRegion} onChange={e => setStateRegion(e.target.value)} required className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Endereço</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} required className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Nº</label>
                <input type="text" value={addressNumber} onChange={e => setAddressNumber(e.target.value)} required className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">CEP</label>
                <input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} required className="w-full px-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button type="button" onClick={() => setStep(2)} className="px-6 py-3.5 text-stone-500 font-bold rounded-xl hover:bg-stone-100 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="px-10 py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-600/20">
                {loading ? 'Aguarde...' : 'Criar Ambiente'}
              </button>
            </div>
          </form>
        )}

        {/* PASSO 3B: MEMBRO COM PROTEÇÃO CONTRA SPAM & TIMER */}
        {step === 3 && objective === 'member' && (
          <div className="max-w-2xl mx-auto">
            
            {/* TELA DE BLOQUEIO 24 HORAS COM BANNER DA IGREJA */}
            {blockEndTime ? (
              <div className="space-y-6 animate-in zoom-in mt-4">
                
                {/* BANNER INSTITUCIONAL DA IGREJA */}
                <div className="bg-white rounded-[2rem] border border-stone-200 p-8 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-amber-50 to-transparent"></div>
                  
                  <img src={logoCVR} alt="Comunidade Vida Renovada" className="w-32 h-32 rounded-full border-4 border-white shadow-md relative z-10 mb-6 object-cover bg-white" />
                  
                  <h3 className="text-2xl sm:text-3xl font-black text-stone-800 mb-3 tracking-tight">Comunidade Vida Renovada</h3>
                  <p className="text-stone-600 font-medium mb-8 max-w-lg leading-relaxed">
                    🙏🏻 | Uma Comunidade de discípulos discipuladores e discipuladores discípulos - Atos 1.8
                  </p>
                  
                  <div className="w-full max-w-xl bg-stone-50 rounded-2xl p-6 sm:p-8 text-left space-y-6 border border-stone-100">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                        <Clock size={20}/>
                      </div>
                      <div>
                        <p className="font-bold text-stone-800 text-sm uppercase tracking-wider mb-0.5">CULTO</p>
                        <p className="text-stone-600 font-medium">Domingo às 18h</p>
                      </div>
                    </div>

                    <div className="w-full h-px bg-stone-200"></div>
                    
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                        <MapPin size={20}/>
                      </div>
                      <div>
                        <p className="font-bold text-stone-800 text-sm uppercase tracking-wider mb-0.5">Localização</p>
                        <p className="text-stone-600 font-medium">C.E. Dr.Geraldo Melo</p>
                        <p className="text-stone-500 text-sm mt-0.5">R. Treze - Cohab Anil I, São Luís - MA, 65051-030, Brasil</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-8">
                    <a href="#" className="w-14 h-14 rounded-full bg-stone-50 border border-stone-200 flex items-center justify-center hover:bg-amber-50 hover:border-amber-200 transition-all shadow-sm overflow-hidden p-3">
                      <img src={iconInstagram} alt="Instagram" className="w-full h-full object-contain hover:scale-110 transition-transform" />
                    </a>
                    <a href="#" className="w-14 h-14 rounded-full bg-stone-50 border border-stone-200 flex items-center justify-center hover:bg-amber-50 hover:border-amber-200 transition-all shadow-sm overflow-hidden p-3">
                      <img src={iconYoutube} alt="YouTube" className="w-full h-full object-contain hover:scale-110 transition-transform" />
                    </a>
                  </div>
                </div>

                {/* ALERTA DE BLOQUEIO */}
                <div className="bg-red-50 p-8 sm:p-10 rounded-[2rem] border border-red-200 text-center shadow-sm">
                  <Hourglass size={56} className="mx-auto text-red-500 mb-5 animate-pulse" />
                  <h4 className="text-red-800 font-black text-2xl mb-3 tracking-tight">Pausa para o café! ☕</h4>
                  <p className="text-base text-red-600 font-medium mb-8 leading-relaxed max-w-sm mx-auto">
                    Você bateu na trave 3 vezes e suas solicitações foram recusadas. Para não virarmos spam na caixa da liderança, suas tentativas vão tirar um cochilo de beleza. Vai maratonar uma série, tomar um café e volte amanhã!
                  </p>
                  <div className="inline-flex flex-col items-center justify-center bg-white border-2 border-red-100 px-8 py-4 rounded-2xl shadow-sm">
                    <span className="text-xs text-red-400 font-bold uppercase tracking-wider mb-1">Nova tentativa liberada em</span>
                    <span className="text-3xl font-black text-red-600 tabular-nums tracking-wider">{timeLeft || 'Calculando...'} ⏳</span>
                  </div>
                </div>

              </div>
            ) : (
              <form onSubmit={handleSendJoinRequest} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                {/* MENSAGEM DE RECUSA ANTERIOR */}
                {rejectedCount > 0 && (
                  <div className="bg-red-50 p-5 rounded-2xl border border-red-100 flex gap-4 items-start">
                    <AlertCircle size={24} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-base text-red-800 font-black tracking-tight mb-1">Solicitação Recusada</p>
                      <p className="text-sm text-red-600 font-medium leading-relaxed">Sua tentativa de entrar em <b>{lastRejectedChurch}</b> não foi aprovada pela liderança. Não foi dessa vez, tente novamente mais tarde.</p>
                      <p className="text-xs text-red-500 font-bold mt-3 uppercase tracking-wider">Tentativas Restantes: {3 - rejectedCount}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-stone-800 mb-3">Selecione a congregação:</label>
                  <select value={selectedChurchId} onChange={e => setSelectedChurchId(e.target.value)} required className="w-full px-4 py-4 bg-white border border-stone-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none text-stone-800 transition-all shadow-sm cursor-pointer font-medium">
                    <option value="" disabled>Buscar na lista...</option>
                    {churchesList.map(church => (
                      <option key={church.id} value={church.id}>{church.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100">
                  <p className="text-sm text-amber-800 leading-relaxed font-medium">
                    Após selecionar a instituição, um pedido será enviado à liderança. O acesso ao painel será liberado assim que eles aprovarem.
                  </p>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={loading || !selectedChurchId} className="w-full py-4 bg-amber-600 text-white font-bold text-lg rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50">
                    {loading ? 'Enviando...' : 'Solicitar Acesso'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* PASSO 4: AGUARDANDO APROVAÇÃO */}
        {step === 4 && pendingRequest && (
          <div className="text-center max-w-md mx-auto py-10 animate-in zoom-in">
            <div className="w-24 h-24 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-amber-100">
              <CheckCircle2 size={48} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-black text-stone-800 mb-3 tracking-tight">Solicitação Enviada</h2>
            <p className="text-stone-500 mb-8 leading-relaxed font-medium">
              O pedido para ingressar na <b>{pendingRequest.churches?.name}</b> foi entregue à administração.
            </p>
            <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl text-sm text-stone-600 font-bold">
              Aguarde a aprovação da liderança para visualizar a plataforma.
            </div>
            
            <button onClick={() => supabase.auth.signOut()} className="mt-10 text-stone-400 font-bold hover:text-stone-800 hover:underline transition-colors uppercase text-xs tracking-wider">
              Voltar ao Início
            </button>
          </div>
        )}

      </div>
    </div>
  )
}