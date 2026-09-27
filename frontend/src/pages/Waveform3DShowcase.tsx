import React, { useState } from 'react'
import { Waveform3D } from '../components/Waveform3D'

export default function Waveform3DShowcase() {
  const [status, setStatus] = useState('Pronto para começar')

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#161616] to-[#1a1a1a] p-8 sm:p-12 md:p-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-[#88CE11] mb-4">
            🎤 Waveform 3D Visualizer
          </h1>
          <p className="text-lg text-gray-400 mb-6">
            Visualizador de áudio interativo com animação 3D em tempo real.
            Clique no canvas para ativar o microfone e veja as ondas sonoras dançando.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-white/5 rounded-lg border border-[#88CE11]/20">
              <p className="text-sm text-gray-500 mb-2">Status Atual:</p>
              <p className="text-lg font-bold text-[#88CE11]">{status}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg border border-[#88CE11]/20">
              <p className="text-sm text-gray-500 mb-2">Recurso:</p>
              <p className="text-lg font-bold text-white">Canvas 2D + Web Audio API</p>
            </div>
          </div>
        </div>

        {/* Visualizador */}
        <div className="bg-white/5 border-2 border-[#88CE11]/20 rounded-2xl p-8 mb-12">
          <Waveform3D
            width={400}
            height={400}
            onStatusChange={setStatus}
          />
        </div>

        {/* Documentação */}
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Características</h2>
            <ul className="space-y-2 text-gray-400">
              <li className="flex gap-3">
                <span className="text-[#88CE11]">✓</span>
                <span>Visualização 3D em tempo real com múltiplas camadas</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#88CE11]">✓</span>
                <span>Integração com Web Audio API</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#88CE11]">✓</span>
                <span>Suavização de dados para animação fluida</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#88CE11]">✓</span>
                <span>Feedback visual com círculos concêntricos</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#88CE11]">✓</span>
                <span>Bolinhas animadas nos pontos de pico</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#88CE11]">✓</span>
                <span>Design totalmente alinhado com GAMA Design System</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Como Usar</h2>
            <div className="space-y-4">
              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <h3 className="font-bold text-[#88CE11] mb-2">1. Clique no Canvas</h3>
                <p className="text-sm text-gray-400">
                  Clique na tela do visualizador para ativar o acesso ao microfone
                </p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <h3 className="font-bold text-[#88CE11] mb-2">2. Permissão de Áudio</h3>
                <p className="text-sm text-gray-400">
                  O navegador pedirá permissão para acessar seu microfone
                </p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <h3 className="font-bold text-[#88CE11] mb-2">3. Fale ou Faça Barulho</h3>
                <p className="text-sm text-gray-400">
                  A visualização reagirá em tempo real ao áudio capturado
                </p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <h3 className="font-bold text-[#88CE11] mb-2">4. Clique Novamente para Parar</h3>
                <p className="text-sm text-gray-400">
                  Clique no canvas novamente para parar a captura de áudio
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Componente React</h2>
            <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20 font-mono text-sm text-gray-400 overflow-x-auto">
              <pre>{`import { Waveform3D } from './components/Waveform3D'

export function MyComponent() {
  return (
    <Waveform3D
      width={500}
      height={500}
      onStatusChange={(status) => console.log(status)}
    />
  )
}`}</pre>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Props</h2>
            <div className="space-y-3">
              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <p className="font-mono text-[#88CE11] mb-1">width?: number</p>
                <p className="text-sm text-gray-400">Largura do canvas (padrão: 500)</p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <p className="font-mono text-[#88CE11] mb-1">height?: number</p>
                <p className="text-sm text-gray-400">Altura do canvas (padrão: 500)</p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <p className="font-mono text-[#88CE11] mb-1">isActive?: boolean</p>
                <p className="text-sm text-gray-400">Controlar microfone externamente</p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <p className="font-mono text-[#88CE11] mb-1">audioStream?: MediaStream</p>
                <p className="text-sm text-gray-400">Stream de áudio externo (ex: TTS, gravação)</p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <p className="font-mono text-[#88CE11] mb-1">isRecording?: boolean</p>
                <p className="text-sm text-gray-400">Flag para controlar visualização com stream externo</p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <p className="font-mono text-[#88CE11] mb-1">{'onStatusChange?: (status: string) => void'}</p>
                <p className="text-sm text-gray-400">Callback ao mudar status</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Integração com GAMA_VOZ</h2>
            <div className="space-y-4">
              <p className="text-gray-400">
                O componente Waveform3D pode ser integrado nos seguintes cenários:
              </p>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <h3 className="font-bold text-[#88CE11] mb-2">📝 Visualização de TTS (Text-to-Speech)</h3>
                <p className="text-sm text-gray-400">
                  Passar o audioStream da saída TTS para visualizar em tempo real enquanto o texto está sendo lido
                </p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <h3 className="font-bold text-[#88CE11] mb-2">🎙️ Captura de STT (Speech-to-Text)</h3>
                <p className="text-sm text-gray-400">
                  Passar o audioStream do microfone para visualizar o áudio sendo capturado
                </p>
              </div>

              <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#88CE11]/20">
                <h3 className="font-bold text-[#88CE11] mb-2">📚 Geração de Audiobook</h3>
                <p className="text-sm text-gray-400">
                  Visualizar a síntese de voz em tempo real durante a geração do audiobook
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Próximas Versões</h2>
            <ul className="space-y-2 text-gray-400">
              <li className="flex gap-3">
                <span className="text-[#88CE11]">→</span>
                <span>Suporte a diferentes temas de cores customizáveis</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#88CE11]">→</span>
                <span>Exportar visualização como vídeo/GIF</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#88CE11]">→</span>
                <span>Presets de animação personalizáveis</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#88CE11]">→</span>
                <span>Integração com Web Audio Worklet para análise avançada</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
