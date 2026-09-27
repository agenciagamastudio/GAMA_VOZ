import React from 'react'
import { BarChart3, TrendingUp, Clock, MessageSquare } from 'lucide-react'
import type { TranscriptionRecord } from '../utils/history'

interface HistoryStatsProps {
  history: TranscriptionRecord[]
}

export default function HistoryStats({ history }: HistoryStatsProps) {
  const stats = React.useMemo(() => {
    if (history.length === 0) {
      return {
        total: 0,
        totalDuration: 0,
        avgDuration: 0,
        maxDuration: 0,
        minDuration: 0,
        avgTextLength: 0,
        longestText: '',
        byHour: {} as Record<number, number>,
        byDay: {} as Record<string, number>
      }
    }

    const totalDuration = history.reduce((sum, r) => sum + r.duration, 0)
    const durations = history.map((r) => r.duration)
    const maxDuration = Math.max(...durations)
    const minDuration = Math.min(...durations)
    const avgDuration = totalDuration / history.length

    const textLengths = history.map((r) => r.text.length)
    const avgTextLength = textLengths.reduce((a, b) => a + b, 0) / history.length
    const longestText = history.reduce((max, r) => (r.text.length > max.text.length ? r : max))
      .text

    // Por hora do dia
    const byHour: Record<number, number> = {}
    history.forEach((r) => {
      const hour = new Date(r.timestamp).getHours()
      byHour[hour] = (byHour[hour] || 0) + 1
    })

    // Por dia
    const byDay: Record<string, number> = {}
    history.forEach((r) => {
      const day = new Date(r.timestamp).toLocaleDateString('pt-BR')
      byDay[day] = (byDay[day] || 0) + 1
    })

    return {
      total: history.length,
      totalDuration,
      avgDuration: Math.round(avgDuration),
      maxDuration,
      minDuration,
      avgTextLength: Math.round(avgTextLength),
      longestText,
      byHour,
      byDay
    }
  }, [history])

  if (history.length === 0) {
    return null
  }

  const topHours = Object.entries(stats.byHour)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([hour, count]) => `${hour}h (${count})`)
    .join(' • ')

  const topDays = Object.entries(stats.byDay)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([day, count]) => `${day} (${count})`)
    .join(' • ')

  return (
    <div className="space-y-4 bg-white/5 p-4 rounded-lg border border-white/10">
      <h3 className="text-sm font-black text-white flex items-center gap-2">
        <BarChart3 className="w-4 h-4" />
        Estatísticas Detalhadas
      </h3>

      {/* Grid de Metrics Principais */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white/5 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-xl font-black text-[#88CE11]">{stats.total}</p>
        </div>

        <div className="bg-white/5 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Tempo Total (s)</p>
          <p className="text-xl font-black text-[#88CE11]">{(stats.totalDuration / 1000).toFixed(1)}</p>
        </div>

        <div className="bg-white/5 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Tempo Médio (ms)</p>
          <p className="text-xl font-black text-[#88CE11]">{stats.avgDuration}</p>
        </div>

        <div className="bg-white/5 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Chars Médios</p>
          <p className="text-xl font-black text-[#88CE11]">{stats.avgTextLength}</p>
        </div>

        <div className="bg-white/5 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Min/Max (ms)</p>
          <p className="text-sm font-black text-[#88CE11]">
            {stats.minDuration} / {stats.maxDuration}
          </p>
        </div>

        <div className="bg-white/5 p-3 rounded-lg">
          <p className="text-xs text-gray-400">Taxa (rec/hora)</p>
          <p className="text-xl font-black text-[#88CE11]">
            {(stats.total / (history.length > 0 ? (Date.now() - history[history.length - 1].timestamp) / 3600000 : 1)).toFixed(1)}
          </p>
        </div>
      </div>

      {/* Horas de Pico */}
      {topHours && (
        <div className="bg-white/5 p-3 rounded-lg space-y-1">
          <p className="text-xs font-semibold text-gray-400 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            Horas de Pico
          </p>
          <p className="text-xs text-gray-300">{topHours}</p>
        </div>
      )}

      {/* Dias de Pico */}
      {topDays && (
        <div className="bg-white/5 p-3 rounded-lg space-y-1">
          <p className="text-xs font-semibold text-gray-400 flex items-center gap-2">
            <TrendingUp className="w-3 h-3" />
            Dias de Pico
          </p>
          <p className="text-xs text-gray-300">{topDays}</p>
        </div>
      )}

      {/* Transcrição Mais Longa */}
      {stats.longestText && (
        <div className="bg-white/5 p-3 rounded-lg space-y-1">
          <p className="text-xs font-semibold text-gray-400 flex items-center gap-2">
            <MessageSquare className="w-3 h-3" />
            Transcrição Mais Longa
          </p>
          <p className="text-xs text-gray-300 line-clamp-2">{stats.longestText}</p>
          <p className="text-xs text-gray-500">{stats.longestText.length} caracteres</p>
        </div>
      )}
    </div>
  )
}
