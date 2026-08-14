import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { ArrowLeft, User, Phone, Save, Calendar, MapPin, Heart } from 'lucide-react'

export function ProfileManagement({ onBack, userId }: { onBack: () => void, userId: string }) {
  const [fullName, setFullName] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [maritalStatus, setMaritalStatus] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.from('user_profiles').select('*').eq('id', userId).single()
      if (data) {
        setFullName(data.full_name || '')
        setWhatsapp(data.whatsapp || '')
        setBirthDate(data.birth_date || '')
        setGender(data.gender || '')
        setMaritalStatus(data.marital_status || '')
        setNeighborhood(data.neighborhood || '')
      }
      setLoading(false)
    }
    loadProfile()
  }, [userId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        full_name: fullName, 
        whatsapp,
        birth_date: birthDate || null,
        gender,
        marital_status: maritalStatus,
        neighborhood
      })
      .eq('id', userId)

    if (error) {
      setMessage('Erro ao salvar: ' + error.message)
    } else {
      setMessage('Dados atualizados com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  return (
    <div className="animate-in fade-in space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors bg-white border border-stone-200 shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Meu Perfil</h1>
          <p className="text-sm text-stone-500">Mantenha seus dados cadastrais atualizados.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 max-w-2xl">
        {loading ? (
          <p className="text-sm text-stone-500">Carregando dados...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {message && (
              <div className={`p-3 text-sm font-medium rounded-xl border ${message.includes('Erro') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-700 border-green-200'}`}>
                {message}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome Completo */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Nome Completo *</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-stone-400" size={16} />
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={80} className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none" />
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">WhatsApp *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-stone-400" size={16} />
                  <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} required placeholder="(00) 90000-0000" maxLength={15} className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none" />
                </div>
              </div>

              {/* Data de Nascimento */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Data de Nascimento</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 text-stone-400" size={16} />
                  <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none text-stone-700" />
                </div>
              </div>

              {/* Gênero */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Gênero</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-stone-400" size={16} />
                  <select value={gender} onChange={e => setGender(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none appearance-none text-stone-700">
                    <option value="" disabled>Selecione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                  </select>
                </div>
              </div>

              {/* Estado Civil */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Estado Civil</label>
                <div className="relative">
                  <Heart className="absolute left-3 top-3 text-stone-400" size={16} />
                  <select value={maritalStatus} onChange={e => setMaritalStatus(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none appearance-none text-stone-700">
                    <option value="" disabled>Selecione...</option>
                    <option value="Solteiro(a)">Solteiro(a)</option>
                    <option value="Casado(a)">Casado(a)</option>
                    <option value="Divorciado(a)">Divorciado(a)</option>
                    <option value="Viúvo(a)">Viúvo(a)</option>
                  </select>
                </div>
              </div>

              {/* Bairro */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Bairro onde mora</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-stone-400" size={16} />
                  <input type="text" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder="Apenas o bairro para ajudar na indicação de células" maxLength={50} className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-600 outline-none" />
                </div>
              </div>
            </div>

            <button type="submit" disabled={saving} className="w-full py-3 mt-4 bg-stone-800 text-white font-medium rounded-xl hover:bg-stone-900 transition-colors flex justify-center items-center gap-2">
              <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}