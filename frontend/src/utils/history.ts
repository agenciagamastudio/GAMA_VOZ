/**
 * Histórico de Transcrições (STT)
 * Persistente via localStorage
 */

export interface TranscriptionRecord {
  id: string
  text: string
  timestamp: number
  duration: number
  language: string
  isFavorite?: boolean
  tags?: string[]
  note?: string
}

import { API_BASE_URL } from './config'

const STORAGE_KEY = 'gama_stt_history'

export const HistoryManager = {
  /**
   * Adiciona transcrição ao histórico (sem limite) e salva .md no PC via backend
   */
  addTranscription(text: string, durationMs: number, language = 'pt'): TranscriptionRecord {
    const record: TranscriptionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text,
      timestamp: Date.now(),
      duration: durationMs,
      language
    }

    const history = this.getHistory()
    history.unshift(record)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))

    // Persiste como arquivo .md em Documentos/GAMA_VOZ/Transcricoes (fire-and-forget)
    fetch(`${API_BASE_URL}/api/stt/history/save-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    }).catch(() => {})

    return record
  },

  /**
   * Sincroniza todo o histórico para a pasta do PC e abre o Explorer nela
   */
  async openFolder(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/stt/history/open-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: this.getHistory() })
    })
  },

  /**
   * Obtém todo o histórico
   */
  getHistory(): TranscriptionRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  },

  /**
   * Obtém uma transcrição pelo ID
   */
  getById(id: string): TranscriptionRecord | null {
    const history = this.getHistory()
    return history.find((r) => r.id === id) || null
  },

  /**
   * Remove uma transcrição
   */
  remove(id: string): void {
    const history = this.getHistory()
    const filtered = history.filter((r) => r.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  },

  /**
   * Limpa todo o histórico
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  },

  /**
   * Exporta histórico como JSON
   */
  exportAsJSON(): string {
    const history = this.getHistory()
    return JSON.stringify(history, null, 2)
  },

  /**
   * Exporta histórico como CSV
   */
  exportAsCSV(): string {
    const history = this.getHistory()
    const headers = ['ID', 'Texto', 'Data', 'Duração (ms)', 'Idioma']
    const rows = history.map((r) => [
      r.id,
      `"${r.text.replace(/"/g, '""')}"`, // Escape quotes
      new Date(r.timestamp).toLocaleString('pt-BR'),
      r.duration,
      r.language
    ])

    return [headers, ...rows].map((row) => row.join(',')).join('\n')
  },

  /**
   * Obtém estatísticas do histórico
   */
  getStats() {
    const history = this.getHistory()
    const totalTranscriptions = history.length
    const totalDuration = history.reduce((sum, r) => sum + r.duration, 0)
    const avgDuration = totalTranscriptions > 0 ? totalDuration / totalTranscriptions : 0

    return {
      total: totalTranscriptions,
      totalDuration,
      avgDuration,
      oldestEntry: history[history.length - 1]?.timestamp || null,
      newestEntry: history[0]?.timestamp || null
    }
  },

  /**
   * Marca/desmarcan uma transcrição como favorita
   */
  toggleFavorite(id: string): void {
    const history = this.getHistory()
    const record = history.find((r) => r.id === id)
    if (record) {
      record.isFavorite = !record.isFavorite
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    }
  },

  /**
   * Adiciona uma tag a uma transcrição
   */
  addTag(id: string, tag: string): void {
    const history = this.getHistory()
    const record = history.find((r) => r.id === id)
    if (record) {
      if (!record.tags) record.tags = []
      if (!record.tags.includes(tag)) {
        record.tags.push(tag)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
      }
    }
  },

  /**
   * Remove uma tag
   */
  removeTag(id: string, tag: string): void {
    const history = this.getHistory()
    const record = history.find((r) => r.id === id)
    if (record && record.tags) {
      record.tags = record.tags.filter((t) => t !== tag)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    }
  },

  /**
   * Adiciona uma nota
   */
  setNote(id: string, note: string): void {
    const history = this.getHistory()
    const record = history.find((r) => r.id === id)
    if (record) {
      record.note = note || undefined
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
    }
  },

  /**
   * Obtém só os favoritos
   */
  getFavorites(): TranscriptionRecord[] {
    const history = this.getHistory()
    return history.filter((r) => r.isFavorite)
  }
}
