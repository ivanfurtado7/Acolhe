import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { User, Phone, Shield, Users, CheckCircle2, AlertCircle, Save, Church } from 'lucide-react'

export function ProfileManagement({ churchId, userProfile }: { churchId: string, userProfile: any }) {
  const [fullName, setFullName] = useState(userProfile?.full_name || '')
  const [whatsapp, setWhatsapp] = useState(userProfile?.whatsapp || '')
  const [myGroup, setMyGroup] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const userRoleName = userProfile?.role === 'admin' 
    ? 'Administrador Master' 
    : userProfile?.role === 'lider' 
    ? (userProfile?.custom_role?.name || 'Liderança') 
    : 'Membro';

  useEffect(() => {
    async function fetchExtraData() {
      // Busca o grupo de cuidado aprovado do usuário
      const { data } = await supabase
        .from('group_members')
        .select('group:cell_groups(name, neighborhood, meeting_day)')
        .eq('user_id', userProfile.id)
        .eq('status', 'aprovado')
        .maybeSingle()

      if (data && data.group) {
        setMyGroup(data.group)
      }
    }
    if (userProfile?.id) fetchExtraData()
  }, [userProfile])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setSuccessMessage(null)
    setErrorMessage(null)

    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        full_name: fullName.trim(), 
        whatsapp: whatsapp.trim() 
      })
      .eq('id', userProfile.id)

    setLoading(false)

    if (error) {
      setErrorMessage(`Erro ao atualizar perfil: ${error.message}`)
    } else {
      setSuccessMessage('Perfil atualizado com sucesso!')
      setTimeout(() => setSuccessMessage(null), 4000)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-12 max-w-3xl mx-auto">
      
      {/* CABEÇALHO */}
      <div className="bg-white border border-stone-200 rounded-[2.5rem] p-6 sm:p-8 shadow-sm">
        <h2 className="text-2xl font-black text-stone-800 tracking-tight flex items-center gap-3">
          <User className="text-amber-600" size={28} /> Meu Perfil
        </h2>
        <p className="text-stone-500 text-sm font-medium mt-1">Gerencie suas informações pessoais e visualize seus vínculos.</p>
      </div>

      {/* MENSAGENS DE FEEDBACK */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-2xl border border-emerald-200 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 text-red-700 text-sm font-bold rounded-2xl border border-red-200 flex items-center gap-2 animate-in fade-in">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* CARDS DE VÍNCULOS (Cargo e Grupo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 p-6 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center shrink-0">
            <Shield size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Nível de Acesso</p>
            <h4 className="font-bold text-stone-800 text-base mt-0.5">{userRoleName}</h4>
          </div>
        </div>

        <div className="bg-white border border-stone-200 p-6 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Grupo de Cuidado</p>
            <h4 className="font-bold text-stone-800 text-base mt-0.5">{myGroup ? myGroup.name : 'Não vinculado'}</h4>
            {myGroup && <p className="text-xs text-stone-500">{myGroup.meeting_day} • {myGroup.neighborhood}</p>}
          </div>
        </div>
      </div>

      {/* FORMULÁRIO DE EDIÇÃO */}
      <div className="bg-white border border-stone-200 rounded-[2.5rem] p-6 sm:p-8 shadow-sm">
        <h3 className="font-bold text-stone-800 text-lg mb-6 border-b border-stone-100 pb-3">Informações Pessoais</h3>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User size={14} /> Nome Completo
            </label>
            <input 
              type="text" 
              required 
              value={fullName} 
              onChange={e => setFullName(e.target.value)} 
              className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-medium text-stone-800 outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Phone size={14} /> WhatsApp / Telefone
            </label>
            <input 
              type="text" 
              required 
              value={whatsapp} 
              onChange={e => setWhatsapp(e.target.value)} 
              placeholder="(98) 99999-9999"
              className="w-full px-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-sm font-medium text-stone-800 outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Church size={14} /> E-mail de Acesso (Não alterável)
            </label>
            <input 
              type="email" 
              disabled 
              value={userProfile?.email || 'Registrado via Google/Auth'} 
              className="w-full px-4 py-3.5 bg-stone-100 border border-stone-200 rounded-2xl text-sm font-medium text-stone-400 cursor-not-allowed shadow-sm"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full sm:w-auto px-8 py-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}