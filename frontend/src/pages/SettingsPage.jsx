import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { accountAPI } from '../services/api'
import toast from 'react-hot-toast'
import { Settings, Shield, AlertTriangle, Save, Loader2, RefreshCw } from 'lucide-react'

export default function SettingsPage() {
  const [riskConfig, setRiskConfig] = useState({
    maxDailyLoss: 100,
    maxOrderAmount: 100,
    maxConsecutiveLosses: 5,
    maxOrdersPerHour: 20,
    cooldownAfterLoss: 60
  })

  const { data: riskStats, refetch: refetchStats } = useQuery({
    queryKey: ['riskStats'],
    queryFn: () => accountAPI.getRiskStats(),
    onSuccess: (data) => {
      if (data?.data?.config) {
        setRiskConfig(prev => ({ ...prev, ...data.data.config }))
      }
    }
  })

  const updateRiskMutation = useMutation({
    mutationFn: (config) => accountAPI.updateRiskConfig(config),
    onSuccess: () => {
      toast.success('Configuración de riesgo actualizada')
      refetchStats()
    },
    onError: (err) => toast.error(err?.error || 'Error al actualizar')
  })

  const config = riskStats?.data?.config || {}
  const dailyStats = riskStats?.data?.dailyStats || {}

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-gray-400 text-sm mt-1">Ajusta los parámetros de riesgo y seguridad del bot</p>
      </div>

      {/* Estadísticas del día */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Shield size={18} className="text-blue-400" />
            Estadísticas del Día
          </h2>
          <button onClick={() => refetchStats()} className="text-gray-400 hover:text-gray-200">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {[
            { label: 'Fecha', value: dailyStats.date || '-' },
            { label: 'Órdenes', value: dailyStats.orderCount || 0 },
            { label: 'Wins', value: dailyStats.wins || 0, color: 'text-green-400' },
            { label: 'Losses', value: dailyStats.losses || 0, color: 'text-red-400' },
            { label: 'PnL Total', value: `$${(dailyStats.totalPnl || 0).toFixed(2)}`, color: (dailyStats.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Pérd. Total', value: `$${(dailyStats.totalLoss || 0).toFixed(2)}`, color: 'text-red-400' }
          ].map(stat => (
            <div key={stat.label} className="text-center p-2 bg-gray-800 rounded-lg">
              <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
              <div className={`font-mono font-bold text-sm ${stat.color || 'text-gray-200'}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Configuración de Riesgo */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <AlertTriangle size={18} className="text-yellow-400" />
          Gestión de Riesgo
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Pérdida Máxima Diaria ($)</label>
            <input
              type="number"
              className="input"
              value={riskConfig.maxDailyLoss}
              min={0}
              onChange={e => setRiskConfig(r => ({ ...r, maxDailyLoss: parseFloat(e.target.value) }))}
            />
            <p className="text-xs text-gray-500 mt-1">El bot se detendrá si alcanza esta pérdida en el día</p>
          </div>

          <div>
            <label className="label">Monto Máximo por Orden ($)</label>
            <input
              type="number"
              className="input"
              value={riskConfig.maxOrderAmount}
              min={1}
              onChange={e => setRiskConfig(r => ({ ...r, maxOrderAmount: parseFloat(e.target.value) }))}
            />
          </div>

          <div>
            <label className="label">Máx. Pérdidas Consecutivas</label>
            <input
              type="number"
              className="input"
              value={riskConfig.maxConsecutiveLosses}
              min={1}
              max={20}
              onChange={e => setRiskConfig(r => ({ ...r, maxConsecutiveLosses: parseInt(e.target.value) }))}
            />
            <p className="text-xs text-gray-500 mt-1">Pausa el bot después de N pérdidas seguidas</p>
          </div>

          <div>
            <label className="label">Máx. Órdenes por Hora</label>
            <input
              type="number"
              className="input"
              value={riskConfig.maxOrdersPerHour}
              min={1}
              max={100}
              onChange={e => setRiskConfig(r => ({ ...r, maxOrdersPerHour: parseInt(e.target.value) }))}
            />
          </div>

          <div>
            <label className="label">Cooldown tras pérdida (segundos)</label>
            <input
              type="number"
              className="input"
              value={riskConfig.cooldownAfterLoss}
              min={0}
              onChange={e => setRiskConfig(r => ({ ...r, cooldownAfterLoss: parseInt(e.target.value) }))}
            />
            <p className="text-xs text-gray-500 mt-1">Espera antes de la siguiente orden tras una pérdida</p>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={() => updateRiskMutation.mutate(riskConfig)}
            disabled={updateRiskMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {updateRiskMutation.isPending
              ? <Loader2 size={16} className="animate-spin" />
              : <Save size={16} />
            }
            Guardar Configuración
          </button>
        </div>
      </div>

      {/* Info del Sistema */}
      <div className="card">
        <h2 className="font-semibold flex items-center gap-2 mb-4">
          <Settings size={18} className="text-gray-400" />
          Información del Sistema
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Versión', value: 'v1.0.0' },
            { label: 'Backend', value: 'Node.js/Express' },
            { label: 'WebSocket', value: 'Socket.IO' },
            { label: 'Base de datos', value: 'MongoDB' }
          ].map(item => (
            <div key={item.label}>
              <div className="text-gray-500 text-xs">{item.label}</div>
              <div className="font-mono text-gray-200">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
