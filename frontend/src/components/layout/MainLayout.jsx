import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore, useBotStore } from '../../store'
import { authAPI } from '../../services/api'
import { disconnectSocket } from '../../services/socket'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, TrendingUp, ShoppingCart, History,
  ScrollText, Settings, LogOut, Wifi, WifiOff, AlertTriangle,
  Bell, ChevronRight
} from 'lucide-react'
import { botAPI } from '../../services/api'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/strategies', icon: TrendingUp, label: 'Estrategias' },
  { to: '/orders', icon: ShoppingCart, label: 'Órdenes' },
  { to: '/history', icon: History, label: 'Historial' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
  { to: '/settings', icon: Settings, label: 'Configuración' }
]

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { logout, user } = useAuthStore()
  const { isConnected, iqBalance, iqCurrency, alerts, stats } = useBotStore()
  const navigate = useNavigate()
  const unreadAlerts = alerts.filter(a => !a.readAt).length

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch {}
    disconnectSocket()
    logout()
    navigate('/login')
    toast.success('Sesión cerrada')
  }

  const handleEmergencyStop = async () => {
    if (!confirm('¿Detener TODAS las estrategias activas?')) return
    try {
      await botAPI.emergencyStop()
      toast.success('Parada de emergencia ejecutada')
    } catch (err) {
      toast.error('Error en parada de emergencia')
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-gray-800">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} />
          </div>
          {sidebarOpen && (
            <div>
              <div className="font-bold text-sm">IQ Bot</div>
              <div className="text-xs text-gray-500">Trading System</div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-gray-500 hover:text-gray-300"
          >
            <ChevronRight size={16} className={`transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Balance */}
        {sidebarOpen && (
          <div className="mx-3 mt-3 p-3 bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 mb-1">Balance</div>
            <div className={`font-mono font-bold text-lg ${iqBalance > 0 ? 'text-green-400' : 'text-gray-400'}`}>
              {iqCurrency} {iqBalance.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {isConnected
                ? <><Wifi size={12} className="text-green-400 live-indicator" /><span className="text-xs text-green-400">Conectado</span></>
                : <><WifiOff size={12} className="text-red-400" /><span className="text-xs text-red-400">Desconectado</span></>
              }
            </div>
          </div>
        )}

        {/* Navegación */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm
                ${isActive
                  ? 'bg-blue-600/20 text-blue-400 font-medium border border-blue-500/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Botones de acción */}
        <div className="p-3 border-t border-gray-800 space-y-2">
          {sidebarOpen && (
            <button
              onClick={handleEmergencyStop}
              className="w-full flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm transition-colors border border-red-500/30"
            >
              <AlertTriangle size={16} />
              <span>Parada Emergencia</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg text-sm transition-colors"
          >
            <LogOut size={16} />
            {sidebarOpen && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Bienvenido, <span className="text-gray-200 font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Estadísticas rápidas */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-gray-500">
                W: <span className="text-green-400">{stats.wins}</span>
              </span>
              <span className="text-gray-500">
                L: <span className="text-red-400">{stats.losses}</span>
              </span>
              <span className="text-gray-500">
                PnL: <span className={stats.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                  ${stats.totalPnl.toFixed(2)}
                </span>
              </span>
            </div>
            {/* Alertas */}
            <button className="relative text-gray-400 hover:text-gray-200">
              <Bell size={18} />
              {unreadAlerts > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadAlerts}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Página */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
