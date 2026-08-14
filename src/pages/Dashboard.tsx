import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import { Users, Calendar, ClipboardList, LogOut } from 'lucide-react'

export function Dashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Busca o perfil e o papel (role) do usuário na igreja
        const { data } = await supabase
          .from('profiles')
          .select('*, churches(name)')
          .eq('id', user.id)
          .single()

        setProfile(data)
      }
      setLoading(false)
    }

    loadUserData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-500">
        Carregando informações...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Cabeçalho */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-amber-700">Acolhe</h1>
          <p className="text-xs text-stone-500">
            {profile?.churches?.name || 'Igreja'} • <span className="uppercase font-semibold">{profile?.role}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-stone-700">Olá, {profile?.full_name}</span>
          <button 
            onClick={handleLogout}
            className="p-2 text-stone-500 hover:text-red-600 transition-colors"
            title="Sair da conta"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* Card: Visitantes */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                <Users size={24} />
              </div>
              <span className="text-xs bg-green-50 text-green-700 font-medium px-2.5 py-1 rounded-full">Ativo</span>
            </div>
            <h2 className="text-lg font-bold text-stone-800">Visitantes</h2>
            <p className="text-sm text-stone-500 mt-1">Gerencie fichas de conexão e o funil de integração.</p>
          </div>

          {/* Card: Escalas */}
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
                <Calendar size={24} />
              </div>
              <span className="text-xs bg-amber-50 text-amber-700 font-medium px-2.5 py-1 rounded-full">Escala</span>
            </div>
            <h2 className="text-lg font-bold text-stone-800">Equipe & Escalas</h2>
            <p className="text-sm text-stone-500 mt-1">Confirme sua presença e visualize os cultos.</p>
          </div>

          {/* Card: Relatórios (Visível apenas para Admins) */}
          {profile?.role === 'admin' && (
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-stone-100 text-stone-700 rounded-xl">
                  <ClipboardList size={24} />
                </div>
                <span className="text-xs bg-purple-50 text-purple-700 font-medium px-2.5 py-1 rounded-full">Admin</span>
              </div>
              <h2 className="text-lg font-bold text-stone-800">Gestão da Igreja</h2>
              <p className="text-sm text-stone-500 mt-1">Adicione voluntários e configure dados da congregação.</p>
            </div>
          )}

        </div>

        {/* Área de Ações Rápidas */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <h3 className="text-md font-bold text-stone-800 mb-2">Bem-vindo ao painel do Acolhe</h3>
          <p className="text-sm text-stone-600">
            Selecione uma das opções acima para começar a gerenciar o acolhimento ou acompanhar suas escalas de recepção.
          </p>
        </div>
      </main>
    </div>
  )
}