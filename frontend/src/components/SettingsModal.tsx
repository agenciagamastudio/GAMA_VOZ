import React, { useState } from 'react'
import { X, Shield, Settings, AlertCircle } from 'lucide-react'
import { VolMinimal } from '../icons/MediaIcons'
import type { Voice, TTSSettings } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  settings: TTSSettings
  onSettingsChange: (settings: Partial<TTSSettings>) => void
  voices: Voice[]
}

export default function SettingsModal({ isOpen, onClose, settings, onSettingsChange, voices }: Props) {
  const [activeTab, setActiveTab] = useState<'voice' | 'input' | 'privacy' | 'advanced'>('voice')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#272727] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-black text-white">Configurações</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('voice')}
            className={`flex-1 py-4 px-6 font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'voice'
                ? 'text-[#88CE11] border-b-2 border-[#88CE11]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <VolMinimal className="w-5 h-5" /> Voz
          </button>
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 py-4 px-6 font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'input'
                ? 'text-[#88CE11] border-b-2 border-[#88CE11]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <AlertCircle className="w-5 h-5" /> Entrada
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-4 px-6 font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'privacy'
                ? 'text-[#88CE11] border-b-2 border-[#88CE11]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shield className="w-5 h-5" /> Privacidade
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex-1 py-4 px-6 font-medium transition flex items-center justify-center gap-2 ${
              activeTab === 'advanced'
                ? 'text-[#88CE11] border-b-2 border-[#88CE11]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Settings className="w-5 h-5" /> Avançado
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'voice' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white block mb-2">Voz Preferida</label>
                <select
                  value={settings.voice}
                  onChange={(e) => onSettingsChange({ voice: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#88CE11]/50"
                >
                  {[
                    { id: 'pm_alex', name: 'Alex (Masculino)' },
                    { id: 'pm_santa', name: 'Santa (Masculino)' },
                    { id: 'pf_dora', name: 'Dora (Feminino)' }
                  ].map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-white block mb-2">Velocidade ({settings.speed.toFixed(1)}x)</label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={settings.speed}
                  onChange={(e) => onSettingsChange({ speed: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.saveHistory}
                  onChange={(e) => onSettingsChange({ saveHistory: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="text-white">Salvar Histórico de Áudio</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.analyticsEnabled}
                  onChange={(e) => onSettingsChange({ analyticsEnabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <span className="text-white">Enviar Análise de Uso</span>
              </label>

              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300 text-sm">
                🔒 Seu áudio é processado localmente. Nada é enviado para nossos servidores.
              </div>
            </div>
          )}

          {activeTab === 'input' && (
            <div className="space-y-4 text-gray-300">
              <p>Faça upload ou grave áudio na interface principal.</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Formatos suportados: WAV, MP3, M4A</li>
                <li>Tamanho máximo do arquivo: 100MB</li>
                <li>Idiomas: Português (Brasileiro)</li>
              </ul>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-4 text-gray-300 text-sm">
              <div>
                <p className="font-medium text-white mb-1">Motor TTS</p>
                <p>Kokoro 82M (Principal) + Edge-TTS (Alternativa)</p>
              </div>
              <div>
                <p className="font-medium text-white mb-1">Motor STT</p>
                <p>Groq Whisper v3 Turbo</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}