import { useState } from 'react'
import { QrCode, Copy, ExternalLink, CheckCircle2, Printer, Share2 } from 'lucide-react'

export function QRCodeShareView({ churchId }: { churchId: string }) {
  const [copied, setCopied] = useState(false)

  // Monta a URL completa dinamicamente (pega o http://localhost:5173 ou seu site oficial)
  const baseUrl = window.location.origin
  const formUrl = `${baseUrl}/ficha?c=${churchId}`

  // Gera a imagem do QR Code usando uma API pública rápida
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(formUrl)}&margin=10`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-10">
      
      <div className="bg-white border border-stone-200 rounded-[2rem] p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black mb-1 tracking-tight text-stone-800 flex items-center gap-3">
            <QrCode className="text-amber-600" size={28} /> Compartilhar Ficha
          </h2>
          <p className="text-stone-500 text-sm">Disponibilize a ficha para os visitantes preencherem pelo celular.</p>
        </div>
        <button 
          onClick={handlePrint}
          className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
        >
          <Printer size={18} /> Imprimir Cartaz
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* LADO ESQUERDO: O QR CODE */}
        <div className="bg-white border border-stone-200 rounded-[2rem] p-8 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="bg-stone-50 p-2 rounded-3xl border border-stone-100 mb-6">
            <img 
              src={qrCodeImageUrl} 
              alt="QR Code da Ficha" 
              className="w-64 h-64 rounded-2xl shadow-sm mix-blend-multiply"
            />
          </div>
          <h3 className="text-xl font-black text-stone-800 mb-2">Escaneie para Preencher</h3>
          <p className="text-stone-500 text-sm max-w-xs mx-auto">
            Aponte a câmera do seu celular para o código acima para acessar a nossa ficha de integração.
          </p>
        </div>

        {/* LADO DIREITO: LINK E OPÇÕES */}
        <div className="space-y-6 print:hidden">
          
          <div className="bg-white border border-stone-200 rounded-[2rem] p-8 shadow-sm">
            <h3 className="font-bold text-stone-800 flex items-center gap-2 mb-4">
              <Share2 size={20} className="text-stone-400" /> Link Direto
            </h3>
            <p className="text-sm text-stone-500 mb-4">Você também pode copiar o link abaixo para enviar em grupos de WhatsApp ou colocar na bio do Instagram da igreja.</p>
            
            <div className="flex items-center gap-2 bg-stone-50 p-2 rounded-2xl border border-stone-200">
              <input 
                type="text" 
                readOnly 
                value={formUrl} 
                className="flex-1 bg-transparent outline-none text-sm text-stone-600 font-medium px-2 truncate"
              />
              <button 
                onClick={handleCopyLink}
                className={`px-4 py-2 text-sm font-bold rounded-xl transition-all flex items-center gap-2 ${copied ? 'bg-green-100 text-green-700' : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'}`}
              >
                {copied ? <><CheckCircle2 size={16} /> Copiado</> : <><Copy size={16} /> Copiar</>}
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-stone-100">
              <a 
                href={formUrl} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-stone-200 hover:border-amber-300 text-stone-600 hover:text-amber-700 font-bold text-sm rounded-xl transition-colors shadow-sm"
              >
                <ExternalLink size={16} /> Testar Ficha no Navegador
              </a>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-[2rem] p-6">
            <h4 className="font-bold text-amber-800 mb-2">Dicas de Uso</h4>
            <ul className="text-sm text-amber-700 space-y-2 list-disc list-inside pl-4 marker:text-amber-400">
              <li>Imprima esta página e coloque em totens na recepção da igreja.</li>
              <li>Coloque o QR Code nos telões de aviso antes ou depois do culto.</li>
              <li>O QR Code nunca expira e sempre direcionará para a ficha atualizada da sua congregação.</li>
            </ul>
          </div>

        </div>
      </div>
      
      {/* Estilos específicos para impressão (esconde barra lateral/topo) */}
      <style>{`
        @media print {
          @page { margin: 0; }
          body { background: white; }
          aside, header { display: none !important; }
          main { margin: 0 !important; padding: 2rem !important; }
        }
      `}</style>
    </div>
  )
}