import { useState } from 'react'
import { QrCode, Copy, Check, Mail, Send, ArrowLeft } from 'lucide-react'

export function VisitorShare({ onBack }: { onBack: () => void }) {
  const [copied, setCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sentInvite, setSentInvite] = useState(false)

  // URL pública do formulário (ajuste para a porta ou domínio correto do seu app)
  const formUrl = `${window.location.origin}/ficha`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSendEmailInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    // Aqui você pode integrar o envio de e-mail via Supabase Functions ou API externa futuramente
    setSentInvite(true)
    setTimeout(() => {
      setSentInvite(false)
      setInviteEmail('')
    }, 3000)
  }

  // URL geradora de QR Code gratuita baseada no link da ficha
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(formUrl)}`

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Gerar Ficha de Conexão</h1>
            <p className="text-sm text-stone-500">Compartilhe o formulário com os visitantes via QR Code ou Link.</p>
          </div>
        </div>

        {/* Seção do QR Code */}
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 text-center mb-6">
          <div className="w-48 h-48 bg-white p-3 rounded-xl shadow-sm mx-auto flex items-center justify-center border border-stone-100 mb-4">
            <img src={qrCodeUrl} alt="QR Code da Ficha de Conexão" className="w-full h-full object-contain" />
          </div>
          <p className="text-xs font-semibold uppercase text-stone-500 tracking-wider mb-2">QR Code para Leitura Direta</p>
          <p className="text-xs text-stone-400">Aponta para: <span className="font-mono text-stone-600">{formUrl}</span></p>
        </div>

        {/* Seção de Copiar Link */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-stone-600 uppercase mb-2">Link Direto da Ficha</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              readOnly 
              value={formUrl}
              className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-600 font-mono select-all"
            />
            <button
              onClick={handleCopyLink}
              className="px-4 py-2.5 bg-amber-700 text-white rounded-lg text-sm font-medium hover:bg-amber-800 transition-colors flex items-center gap-2 shrink-0"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        {/* Seção de Envio por E-mail */}
        <div className="border-t border-stone-100 pt-6">
          <label className="block text-xs font-semibold text-stone-600 uppercase mb-2 flex items-center gap-1">
            <Mail size={14} /> Enviar Convite por E-mail
          </label>
          <form onSubmit={handleSendEmailInvite} className="flex gap-2">
            <input 
              type="email" 
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="visitante@email.com"
              className="w-full px-4 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-800 focus:ring-2 focus:ring-amber-600 focus:outline-none"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition-colors flex items-center gap-2 shrink-0"
            >
              <Send size={16} /> Enviar
            </button>
          </form>
          {sentInvite && (
            <p className="text-xs text-green-600 mt-2 font-medium">Convite simulado disparado com sucesso!</p>
          )}
        </div>

      </div>
    </div>
  )
}