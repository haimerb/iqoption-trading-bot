import { useQuery } from '@tanstack/react-query'
import { historyAPI } from '../services/api'
import { useBotStore } from '../store'
import { History, TrendingUp, TrendingDown, Trophy, Target, DollarSign } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function HistoryPage() {
  const { orderHistory: localHistory } = useBotStore()

  const { data: histData } = useQuery({
    queryKey: ['history'],
    queryFn: () => historyAPI.getHistory({ limit: 200 })
  })

  const { data: statsData } = useQuery({
    queryKey: ['historyStats'],
    queryFn: () => historyAPI.getStats()
  })

  const history = histData?.data || localHistory
  const stats = statsData?.data?.closed || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Historial de Operaciones</h1>
        <p className="text-gray-400 text-sm mt-1">Análisis y registro de todas tus operaciones</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Operaciones', value: stats.total || 0, icon: History, color: 'text-blue-400' },
          { label: 'Win Rate', value: stats.winRate || '0%', icon: Target, color: 'text-purple-400' },
          { label: 'Total Profit', value: `$${(stats.totalProfit || 0).toFixed(2)}`, icon: Trophy, color: 'text-green-400' },
          { label: 'PnL Neto', value: `$${(stats.totalPnl || 0).toFixed(2)}`, icon: DollarSign, color: (stats.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400' }
        ].map(s => (
          <div key={s.label} className="card">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={16} className={s.color} />
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabla de historial */}
      <div className="card">
        <h2 className="font-semibold mb-4">Últimas Operaciones</h2>

        {history.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <History size={40} className="mx-auto mb-3 opacity-40" />
            <p>No hay operaciones en el historial</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Fecha/Hora', 'Dirección', 'Monto', 'Apertura', 'Cierre', 'PnL', 'Resultado'].map(h => (
                    <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((order, idx) => (
                  <tr key={order.id || idx} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                    <td className="py-2 pr-4 text-xs text-gray-400 font-mono">
                      {order.closedAt ? format(parseISO(order.closedAt), 'dd/MM HH:mm') : '-'}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded text-xs font-bold ${
                        order.direction === 'call'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {order.direction === 'call' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {order.direction?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono">${order.amount}</td>
                    <td className="py-2 pr-4 font-mono text-gray-300">{order.openQuote || '-'}</td>
                    <td className="py-2 pr-4 font-mono text-gray-300">{order.closeQuote || '-'}</td>
                    <td className={`py-2 pr-4 font-mono font-bold ${(order.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(order.pnl || 0) >= 0 ? '+' : ''}${(order.pnl || 0).toFixed(2)}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        (order.pnl || 0) > 0
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {(order.pnl || 0) > 0 ? 'WIN' : 'LOSS'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
