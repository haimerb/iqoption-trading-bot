import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { strategiesAPI } from '../services/api'
import { useBotStore } from '../store'
import toast from 'react-hot-toast'
import {
  Plus, Play, Pause, Square, Settings2,
  TrendingUp, Activity, ChevronDown, ChevronUp, Loader2
} from 'lucide-react'

const STRATEGY_COLORS = {
  'ma-crossover': 'blue',
  'rsi': 'purple',
  'bollinger-bands': 'cyan',
  'grid-trading': 'orange'
}

function StrategyCard({ strategy, onStart, onPause, onResume, onStop, onUpdateParams }) {
  const [expanded, setExpanded] = useState(false)
  const [params, setParams] = useState(strategy.params || {})
  const color = STRATEGY_COLORS[strategy.type] || 'gray'

  const statusColors = {
    running: 'bg-green-500/20 text-green-400 border-green-500/30',
    paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    stopped: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  return (
    <div className={`card border border-${color}-500/20`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 bg-${color}-500/20 rounded-lg flex items-center justify-center`}>
            <TrendingUp size={20} className={`text-${color}-400`} />
          </div>
          <div>
            <h3 className="font-semibold">{strategy.name}</h3>
            <p className="text-xs text-gray-500">{strategy.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full border ${statusColors[strategy.status]}`}>
            {strategy.status === 'running' && <span className="live-indicator inline-block w-1.5 h-1.5 bg-current rounded-full mr-1" />}
            {strategy.status}
          </span>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-4 gap-3 mt-4 p-3 bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 text-xs">Órdenes</div>
          <div className="font-mono font-bold">{strategy.stats?.totalOrders || 0}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-xs">Wins</div>
          <div className="font-mono font-bold text-green-400">{strategy.stats?.wins || 0}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-xs">Losses</div>
          <div className="font-mono font-bold text-red-400">{strategy.stats?.losses || 0}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-xs">PnL</div>
          <div className={`font-mono font-bold ${(strategy.stats?.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${(strategy.stats?.totalPnl || 0).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 mt-4">
        {strategy.status === 'stopped' && (
          <button
            onClick={() => onStart(strategy.id)}
            className="btn-success flex items-center gap-1 text-sm py-1.5"
          >
            <Play size={14} /> Iniciar
          </button>
        )}
        {strategy.status === 'running' && (
          <button
            onClick={() => onPause(strategy.id)}
            className="btn-ghost flex items-center gap-1 text-sm py-1.5"
          >
            <Pause size={14} /> Pausar
          </button>
        )}
        {strategy.status === 'paused' && (
          <button
            onClick={() => onResume(strategy.id)}
            className="btn-success flex items-center gap-1 text-sm py-1.5"
          >
            <Play size={14} /> Resumir
          </button>
        )}
        <button
          onClick={() => onStop(strategy.id)}
          className="btn-danger flex items-center gap-1 text-sm py-1.5"
        >
          <Square size={14} /> Detener
        </button>
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn-ghost flex items-center gap-1 text-sm py-1.5 ml-auto"
        >
          <Settings2 size={14} />
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Panel de configuración expandible */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Parámetros</h4>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(params).map(([key, value]) => (
              <div key={key}>
                <label className="label">{key}</label>
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  value={params[key]}
                  onChange={(e) => setParams(prev => ({
                    ...prev,
                    [key]: typeof value === 'number' ? parseFloat(e.target.value) : e.target.value
                  }))}
                  className="input text-sm py-1.5"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => onUpdateParams(strategy.id, params)}
            className="btn-primary text-sm mt-3"
          >
            Guardar Cambios
          </button>
        </div>
      )}
    </div>
  )
}

export default function StrategiesPage() {
  const queryClient = useQueryClient()
  const { strategies, setStrategies, addStrategy, updateStrategy, removeStrategy } = useBotStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newStrategyForm, setNewStrategyForm] = useState({ type: 'rsi', activeId: 1, candleSizes: [60] })

  const { data: availableStrategies } = useQuery({
    queryKey: ['availableStrategies'],
    queryFn: () => strategiesAPI.getAvailable()
  })

  const { data: allStrategies, isLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: async () => {
      const res = await strategiesAPI.getAll()
      setStrategies(res.data)
      return res.data
    },
    refetchInterval: 5000
  })

  const createMutation = useMutation({
    mutationFn: (data) => strategiesAPI.create(data),
    onSuccess: (res) => {
      addStrategy(res.data)
      setShowCreateModal(false)
      toast.success(`Estrategia "${res.data.name}" creada`)
    },
    onError: (err) => toast.error(err?.error || 'Error al crear estrategia')
  })

  const startMutation = useMutation({
    mutationFn: ({ id, activeId, candleSizes }) =>
      strategiesAPI.start(id, { activeId, candleSizes }),
    onSuccess: (res) => {
      updateStrategy(res.data)
      toast.success('Estrategia iniciada')
    },
    onError: (err) => toast.error(err?.error || 'Error al iniciar')
  })

  const pauseMutation = useMutation({
    mutationFn: (id) => strategiesAPI.pause(id),
    onSuccess: (res) => { updateStrategy(res.data); toast.success('Estrategia pausada') }
  })

  const resumeMutation = useMutation({
    mutationFn: (id) => strategiesAPI.resume(id),
    onSuccess: (res) => { updateStrategy(res.data); toast.success('Estrategia resumida') }
  })

  const stopMutation = useMutation({
    mutationFn: (id) => strategiesAPI.stop(id),
    onSuccess: (_, id) => { removeStrategy(id); toast.success('Estrategia detenida') }
  })

  const updateParamsMutation = useMutation({
    mutationFn: ({ id, params }) => strategiesAPI.updateParams(id, params),
    onSuccess: (res) => { updateStrategy(res.data); toast.success('Parámetros actualizados') }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-400" size={32} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estrategias</h1>
          <p className="text-gray-400 text-sm mt-1">Gestiona y configura tus estrategias de trading</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Nueva Estrategia
        </button>
      </div>

      {/* Lista de estrategias */}
      {strategies.length === 0 ? (
        <div className="card text-center py-12">
          <TrendingUp size={48} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">No hay estrategias creadas</p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary mt-4">
            Crear primera estrategia
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {strategies.map(strategy => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              onStart={(id) => startMutation.mutate({ id, activeId: 1, candleSizes: [60] })}
              onPause={(id) => pauseMutation.mutate(id)}
              onResume={(id) => resumeMutation.mutate(id)}
              onStop={(id) => {
                if (confirm(`¿Detener estrategia "${strategy.name}"?`)) {
                  stopMutation.mutate(id)
                }
              }}
              onUpdateParams={(id, params) => updateParamsMutation.mutate({ id, params })}
            />
          ))}
        </div>
      )}

      {/* Modal crear estrategia */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Nueva Estrategia</h2>

            <div className="space-y-4">
              <div>
                <label className="label">Tipo de Estrategia</label>
                <select
                  className="input"
                  value={newStrategyForm.type}
                  onChange={(e) => setNewStrategyForm(f => ({ ...f, type: e.target.value }))}
                >
                  {availableStrategies?.data?.map(s => (
                    <option key={s.type} value={s.type}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">ID del Activo</label>
                <input
                  type="number"
                  className="input"
                  value={newStrategyForm.activeId}
                  onChange={(e) => setNewStrategyForm(f => ({ ...f, activeId: parseInt(e.target.value) }))}
                  placeholder="Ej: 1 (EURUSD)"
                />
                <p className="text-xs text-gray-500 mt-1">ID del activo en IQ Option (1=EURUSD)</p>
              </div>

              {/* Parámetros por defecto de la estrategia seleccionada */}
              {availableStrategies?.data?.find(s => s.type === newStrategyForm.type)?.defaultParams && (
                <div>
                  <label className="label">Parámetros</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(
                      availableStrategies.data.find(s => s.type === newStrategyForm.type).defaultParams
                    ).map(([key, value]) => (
                      <div key={key}>
                        <label className="text-xs text-gray-500 mb-0.5 block">{key}</label>
                        <input
                          type="number"
                          className="input text-sm py-1"
                          defaultValue={value}
                          onChange={(e) => setNewStrategyForm(f => ({
                            ...f,
                            params: { ...(f.params || {}), [key]: parseFloat(e.target.value) }
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-ghost flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={() => createMutation.mutate({
                  type: newStrategyForm.type,
                  params: newStrategyForm.params
                })}
                disabled={createMutation.isPending}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
