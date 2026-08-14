import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { ArrowLeft, CalendarDays, MapPin, Clock } from 'lucide-react'

export function AgendaView({ onBack, churchId }: { onBack: () => void, churchId: string }) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEvents() {
      // Busca todos os eventos da igreja ordenados pela data (do mais recente ao mais antigo)
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('church_id', churchId)
        .order('event_date', { ascending: true })
      
      if (data) setEvents(data)
      setLoading(false)
    }
    loadEvents()
  }, [churchId])

  // Separa eventos futuros e passados
  const now = new Date()
  const upcomingEvents = events.filter(e => new Date(e.event_date) >= now)
  const pastEvents = events.filter(e => new Date(e.event_date) < now).reverse() // Inverte para o passado mais recente primeiro

  return (
    <div className="animate-in fade-in space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 text-stone-600 hover:bg-stone-200 rounded-lg transition-colors bg-white border border-stone-200 shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Agenda da Igreja</h1>
          <p className="text-sm text-stone-500">Acompanhe os próximos eventos e cultos.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Carregando agenda...</p>
      ) : (
        <div className="space-y-8">
          
          {/* Próximos Eventos */}
          <div>
            <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
              <CalendarDays size={20} className="text-amber-700" /> Próximos Eventos
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-stone-400 italic bg-white p-6 rounded-xl border border-stone-200 text-center">Nenhum evento futuro agendado.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingEvents.map(evt => (
                  <div key={evt.id} className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-600"></div>
                    <h4 className="font-bold text-stone-800 text-lg mb-2">{evt.title}</h4>
                    <div className="flex items-center gap-2 text-sm text-stone-600 mb-1">
                      <CalendarDays size={14} className="text-amber-600" /> 
                      {new Date(evt.event_date).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-stone-600">
                      <Clock size={14} className="text-amber-600" /> 
                      {new Date(evt.event_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Eventos Realizados */}
          <div className="pt-4 border-t border-stone-200">
            <h3 className="text-lg font-bold text-stone-400 mb-4">Eventos Realizados</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pastEvents.map(evt => (
                <div key={evt.id} className="bg-stone-50 p-5 rounded-2xl border border-stone-200 opacity-70">
                  <h4 className="font-bold text-stone-600 mb-2">{evt.title}</h4>
                  <p className="text-sm text-stone-500 flex items-center gap-1">
                    <CalendarDays size={14} /> {new Date(evt.event_date).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}