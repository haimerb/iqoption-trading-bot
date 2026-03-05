import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ordersAPI } from '../services/api'
import { useBotStore } from '../store'
import toast from 'react-hot-toast'
import { ShoppingCart, Plus, X, TrendingUp, TrendingDown, Loader2, Clock } from 'lucide-react'

export default function OrdersPage() {
  const { openPositions } = useBotStore()
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [orderForm, setOrderForm] = useState({
    activeId: 1, direction: 'call', amount: 10, duration: 60, orderType: 'digital'
  })

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['openPositions'],
    queryFn: () => ordersAPI.getOpenPositions(),
    refetchInterval: 3000
  })

  const openOrderMutation = useMutation({
    mutationFn: (data) => ordersAPI.openOrder(data),
    onSuccess: () => {
      toast.success('Orden enviada a la cola de ejecución')
      setShowOrderModal(false)
      setTimeout(refetch, 2000)
    },
    onError: (err) => toast.error(err?.error || 'Error al abrir orden')
  })

  const closePositionMutation = useMutation({
    mutationFn: (positionId) => ordersAPI.closePosition(positionId),
    onSuccess: () => { toast.success('Posición cerrada'); refetch() },
    onError: (err) => toast.error(err?.error || 'Error al cerrar posición')
  })

  const positions = data?.data || openPositions

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Órdenes</h1>
          <p className="text-gray-400 text-sm mt-1">Gestiona posiciones abiertas y coloca órdenes manuales</p>
        </div>
        <button onClick={() => setShowOrderModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Nueva Orden
        </button>
      </div>

      {/* Posiciones abiertas */}
      <div className="card">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Clock size={18} className="text-yellow-400" />
          Posiciones Abiertas ({positions.length})
        </h2>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-blue-400" size={24} />
          </div>
        ) : positions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-40" />
            <p>No hay posiciones abiertas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-gray-500 font-medium pb-2">ID</th>
                  <th className="text-left text-gray-500 font-medium pb-2">Dirección</th>
                  <th className="text-right text-gray-500 font-medium pb-2">Monto</th>
                  <th className="text-right text-gray-500 font-medium pb-2">Apertura</th>
                  <th className="text-right text-gray-500 font-medium pb-2">PnL Actual</th>
                  <th className="text-right text-gray-500 font-medium pb-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 font-mono text-xs text-gray-400">{pos.id?.slice(0, 8)}...</td>
                    <td className="py-2">
                      <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded text-xs font-bold ${
                        pos.direction === 'call'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {pos.direction === 'call'
                          ? <TrendingUp size={12} />
                          : <TrendingDown size={12} />
                        }
                        {pos.direction?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono">${pos.amount}</td>
                    <td className="py-2 text-right font-mono text-gray-300">{pos.openQuote}</td>
                    <td className="py-2 text-right font-mono">
                      <span className={(pos.currentPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {(pos.currentPnl || 0) >= 0 ? '+' : ''}${(pos.currentPnl || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => closePositionMutation.mutate(pos.id)}
                        disabled={closePositionMutation.isPending}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Cerrar posición"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal nueva orden */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Nueva Orden Manual</h2>

            <div className="space-y-4">
              <div>
                <label className="label">ID del Activo</label>
                <input
                  type="number"
                  className="input"
                  value={orderForm.activeId}
                  onChange={e => setOrderForm(f => ({ ...f, activeId: parseInt(e.target.value) }))}
                />
              </div>

              <div>
                <label className="label">Dirección</label>
                <div className="grid grid-cols-2 gap-2">
                  {['call', 'put'].map(dir => (
                    <button
                      key={dir}
                      onClick={() => setOrderForm(f => ({ ...f, direction: dir }))}
                      className={`p-3 rounded-lg border transition-all font-bold flex items-center justify-center gap-2 ${
                        orderForm.direction === dir
                          ? dir === 'call'
                            ? 'bg-green-600 border-green-500 text-white'
                            : 'bg-red-600 border-red-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400'
                      }`}
                    >
                      {dir === 'call' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                      {dir.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Monto ($)</label>
                  <input
                    type="number"
                    className="input"
                    value={orderForm.amount}
                    min={1}
                    onChange={e => setOrderForm(f => ({ ...f, amount: parseFloat(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className="label">Duración (s)</label>
                  <select
                    className="input"
                    value={orderForm.duration}
                    onChange={e => setOrderForm(f => ({ ...f, duration: parseInt(e.target.value) }))}
                  >
                    {[30, 60, 120, 300, 600, 900, 1800, 3600].map(d => (
                      <option key={d} value={d}>{d >= 60 ? `${d/60}m` : `${d}s`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Tipo de Orden</label>
                <select
                  className="input"
                  value={orderForm.orderType}
                  onChange={e => setOrderForm(f => ({ ...f, orderType: e.target.value }))}
                >
                  <option value="digital">Digital</option>
                  <option value="binary">Binary</option>
                  <option value="turbo">Turbo</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowOrderModal(false)} className="btn-ghost flex-1">
                Cancelar
              </button>
              <button
                onClick={() => openOrderMutation.mutate(orderForm)}
                disabled={openOrderMutation.isPending}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold text-white transition-colors ${
                  orderForm.direction === 'call'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {openOrderMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                {orderForm.direction === 'call' ? '📈 CALL' : '📉 PUT'} ${orderForm.amount}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
