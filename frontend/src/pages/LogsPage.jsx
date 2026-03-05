import { useRef, useEffect, useState } from 'react'
import { useBotStore } from '../store'
import { ScrollText, Trash2, Filter, Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import clsx from 'clsx'

const LOG_LEVELS = ['all', 'info', 'warn', 'error', 'success']
const CATEGORIES = ['all', 'SYSTEM', 'ORDER', 'STRATEGY', 'TRADING_AUDIT', 'SECURITY_AUDIT']

const levelColors = {
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-green-400'
}

const levelBg = {
  info: 'bg-blue-500/10',
  warn: 'bg-yellow-500/10',
  error: 'bg-red-500/10',
  success: 'bg-green-500/10'
}

export default function LogsPage() {
  const { logs, clearLogs } = useBotStore()
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [search, setSearch] = useState('')
  const logsEndRef = useRef(null)

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoScroll])

  const filteredLogs = logs
    .filter(log => filterLevel === 'all' || log.level === filterLevel)
    .filter(log => filterCategory === 'all' || log.category === filterCategory)
    .filter(log => !search || log.message.toLowerCase().includes(search.toLowerCase()))

  const handleExportLogs = () => {
    const content = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level?.toUpperCase()}] [${l.category}] ${l.message}`)
      .join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bot-logs-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs en Tiempo Real</h1>
          <p className="text-gray-400 text-sm mt-1">
            {filteredLogs.length} de {logs.length} entradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportLogs} className="btn-ghost flex items-center gap-2 text-sm">
            <Download size={16} /> Exportar
          </button>
          <button onClick={clearLogs} className="btn-danger flex items-center gap-2 text-sm">
            <Trash2 size={16} /> Limpiar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar en logs..."
          className="input max-w-xs text-sm"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="flex items-center gap-1">
          <Filter size={14} className="text-gray-500" />
          {LOG_LEVELS.map(level => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={clsx(
                'text-xs px-2 py-1 rounded transition-colors font-mono',
                filterLevel === level
                  ? level === 'all'
                    ? 'bg-gray-600 text-white'
                    : `${levelBg[level]} ${levelColors[level]} border border-current/30`
                  : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {level.toUpperCase()}
            </button>
          ))}
        </div>

        <select
          className="input max-w-xs text-sm"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-400 ml-auto">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            className="accent-blue-500"
          />
          Auto-scroll
        </label>
      </div>

      {/* Panel de logs */}
      <div className="flex-1 card font-mono text-xs overflow-y-auto max-h-[calc(100vh-280px)] bg-gray-950 border-gray-800">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-600">
            <div className="text-center">
              <ScrollText size={32} className="mx-auto mb-2 opacity-40" />
              <p>Sin logs para mostrar</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={clsx(
                  'flex gap-3 px-2 py-1 rounded hover:bg-gray-800/50',
                  levelBg[log.level]
                )}
              >
                <span className="text-gray-600 flex-shrink-0 w-14 text-right">
                  {log.timestamp ? format(parseISO(log.timestamp), 'HH:mm:ss') : ''}
                </span>
                <span className={clsx('flex-shrink-0 w-8 font-bold uppercase', levelColors[log.level])}>
                  {log.level?.slice(0, 3) || 'inf'}
                </span>
                <span className="text-gray-500 flex-shrink-0 w-20 truncate">
                  [{log.category || 'SYS'}]
                </span>
                <span className={clsx('flex-1', levelColors[log.level] || 'text-gray-300')}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
