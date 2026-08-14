import { useState } from 'react'
import { supabase } from '../services/supabase'
import logoImage from '../assets/logo-acolhe.png'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      alert('Login realizado com sucesso!')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      {/* Quadro branco com position relative para conter a logo de fundo */}
      <div className="relative w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        
        {/* --- LOGO COMO FUNDO (MARCA D'ÁGUA) --- */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img 
            src={logoImage} 
            alt="Marca d'água Acolhe" 
            className="w-[110%] h-[110%] object-contain opacity-20 select-none"
          />
        </div>
        {/* ------------------------------------- */}

        {/* Conteúdo do formulário com z-10 para ficar acima da logo */}
        <div className="relative z-10">

          {error && (
            <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">E-mail</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-stone-800 bg-white/80"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 uppercase mb-1">Senha</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-600 focus:outline-none text-stone-800 bg-white/80"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-amber-700 text-white font-medium rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Entrando...' : 'Acessar Conta'}
            </button>
          </form>

          <div className="mt-6 text-center">
              <a href="#" className="text-xs text-amber-600 hover:underline">Esqueceu sua senha?</a>
          </div>
        </div>

      </div>
    </div>
  )
}