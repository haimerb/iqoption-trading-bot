import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useBotStore } from '../store'
import { botAPI, historyAPI } from '../services/api'
import { requestBotStatus } from '../services/socket'
import {
  TrendingUp, TrendingDown, DollarSign, Activity,
  Clock, Target, Zap, BarChart2
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import { format } from 'date-fns'

export default function DashboardPage() {
  const { iqBalance, iqCurrency, openPositions, stats, strategies, isConnected } = useBotStore()

  // Cargar estado inicial
  const { data: botStatus } = useQuery({
    queryKey: ['botStatus'],
    queryFn: () => botAPI.getStatus(),
    refetchInterval: 10000
  })

  const { data: histStats } = useQuery({
    queryKey: ['historyStats'],
    queryFn: () => historyAPI.getStats(),
    refetchInterval: 30000
  })

  useEffect(() => {
    requestBotStatus()
  }, [])

  const activeStrategies = strategies.filter(s => s.status === 'running').length
  const pnlData = histStats?.data?.closed

  // Datos mock para el gráfico de PnL (en producción vendrían del historial)
  const pnlChartData = Array.from({ length: 14 }, (_, i) => ({
    date: format(new Date(Date.now() - (13 - i) * 86400000), 'dd/MM'),
    pnl: (Math.random() - 0.4) * 100
  }))

  const statCards = [
    {
      title: 'Balance',
      value: `${iqCurrency} ${iqBalance.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20'
    },
    {
      title: 'PnL Total',
      value: `$${stats.totalPnl.toFixed(2)}`,
      icon: stats.totalPnl >= 0 ? TrendingUp : TrendingDown,
      color: stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400',
      bg: stats.totalPnl >= 0 ? 'bg-green-500/10' : 'bg-red-500/10',
      border: stats.totalPnl >= 0 ? 'border-green-500/20' : 'border-red-500/20'
    },
    {
      title: 'Win Rate',
      value: `${stats.winRate}%`,
      icon: Target,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20'
    },
    {
      title: 'Posiciones Abiertas',
      value: openPositions.length,
      icon: Activity,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20'
    },
    {
      title: 'Estrategias Activas',
      value: activeStrategies,
      icon: Zap,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20'
    },
    {
      title: 'Total Órdenes',
      value: stats.totalOrders,
      icon: BarChart2,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Vista general del sistema de trading
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 live-indicator' : 'bg-red-400'}`} />
          <span className="text-sm text-gray-400">
            {isConnected ? 'IQ Option Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <div key={stat.title} className={`card border ${stat.border}`}>
            <div className={`${stat.bg} ${stat.color} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}>
              <stat.icon size={16} />
            </div>
            <div className={`stat-value ${stat.color}`}>{stat.value}</div>
            <div className="stat-label mt-1">{stat.title}</div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* PnL Chart */}
        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-green-400" />
            PnL Últimos 14 días
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={pnlChartData}>
              <defs>
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#d1d5db' }}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke="#3b82f6"
                fill="url(#pnlGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Posiciones abiertas */}
        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Activity size={18} className="text-yellow-400" />
            Posiciones Abiertas ({openPositions.length})
          </h2>
          {openPositions.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-500">
              <div className="text-center">
                <Clock size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No hay posiciones abiertas</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {openPositions.map((pos) => (
                <div key={pos.id} className="flex items-center justify-between p-2 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                      pos.direction === 'call'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {pos.direction?.toUpperCase()}
                    </span>
                    <span className="text-sm font-mono">${pos.amount}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400 font-mono">@ {pos.openQuote}</div>
                    <div className={`text-xs font-mono ${(pos.currentPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(pos.currentPnl || 0) >= 0 ? '+' : ''}${(pos.currentPnl || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Estrategias activas */}
      <div className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Zap size={18} className="text-cyan-400" />
          Estrategias Activas
        </h2>
        {strategies.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay estrategias configuradas. Ve a <a href="/strategies" className="text-blue-400 hover:underline">Estrategias</a> para crear una.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {strategies.map((strategy) => (
              <div key={strategy.id} className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{strategy.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    strategy.status === 'running' ? 'bg-green-500/20 text-green-400' :
                    strategy.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {strategy.status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
                  <div>
                    <div className="text-gray-500">Órdenes</div>
                    <div className="font-mono text-gray-200">{strategy.stats?.totalOrders || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Wins</div>
                    <div className="font-mono text-green-400">{strategy.stats?.wins || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">PnL</div>
                    <div className={`font-mono ${(strategy.stats?.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${(strategy.stats?.totalPnl || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
