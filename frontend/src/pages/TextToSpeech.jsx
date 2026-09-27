import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Square, RotateCcw, FileText, Settings2, Zap } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5001/api';

export default function TextToSpeech() {
  const [text, setText] = useState('');
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');
  const [rate, setRate] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeChunkIndex, setActiveChunkIndex] = useState(-1);
  const [voicesLoading, setVoicesLoading] = useState(true);
  const audioRef = useRef(null);

  // Load voices on mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        setVoicesLoading(true);
        const response = await fetch(`${API_BASE}/tts/voices`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        console.log('Vozes carregadas:', data);

        const voicesList = data.voices || [];
        setVoices(voicesList);
        setSelectedVoice(data.default || voicesList[0] || '');
      } catch (err) {
        console.error('Erro ao carregar vozes:', err);
        // Fallback com vozes padrão
        const defaultVoices = [
          'pt-BR-AntonioNeural',
          'pt-BR-FranciscaNeural',
          'pt-BR-BrendaNeural'
        ];
        setVoices(defaultVoices);
        setSelectedVoice(defaultVoices[0]);
        setError('⚠️ Usando vozes padrão');
      } finally {
        setVoicesLoading(false);
      }
    };

    loadVoices();
  }, []);

  const chunks = useMemo(() => {
    if (!text) return [];
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    return sentences
      .map((s, i) => ({ id: i, text: s.trim() }))
      .filter(c => c.text.length > 0);
  }, [text]);

  const synthesizeWithWebSpeech = (textToSpeak, rate) => {
    // Fallback: usar Web Speech API do navegador
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    // Tentar encontrar voz PT-BR no navegador
    const voices = window.speechSynthesis.getVoices();
    const ptBrVoice = voices.find(v => v.lang.startsWith('pt-BR'));
    if (ptBrVoice) {
      utterance.voice = ptBrVoice;
    }

    utterance.lang = 'pt-BR';
    utterance.rate = rate;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setError('Erro ao falar (Web Speech)');

    window.speechSynthesis.speak(utterance);
  };

  const synthesize = async () => {
    if (!text.trim()) {
      setError('Por favor, insira um texto');
      return;
    }

    if (!selectedVoice) {
      setError('Selecione uma voz');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Usar AbortController para timeout de 30s (suficiente para 3 retries no backend)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${API_BASE}/tts/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: selectedVoice, rate }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP ${response.status}: Síntese falhou`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Audio vazio recebido');
      }

      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('❌ Backend TTS falhou:', err.message || err);
      console.log('🔄 Tentando Web Speech API como fallback...');

      // Fallback para Web Speech API (apenas se backend falhar)
      try {
        synthesizeWithWebSpeech(text, rate);
        setError('⚠️ Usando Web Speech API (Edge-TTS indisponível)');
      } catch (fallbackErr) {
        console.error('❌ Web Speech também falhou:', fallbackErr);
        setError('Síntese indisponível. Tente novamente em alguns instantes.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8">
      <main className="border border-[#2E2E2E] rounded-2xl overflow-hidden flex flex-col lg:flex-row h-auto lg:h-[650px] shadow-2xl bg-[#272727]">

        {/* Editor */}
        <div className="w-full lg:w-5/12 p-8 border-b lg:border-b-0 lg:border-r border-[#2E2E2E] flex flex-col bg-[#161616]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-black text-[#88CE11] uppercase tracking-[0.2em] flex items-center gap-2">
              <FileText size={14} /> Script Composer
            </h3>
            <Zap size={14} className="text-[#88CE11] animate-pulse" />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole seu texto aqui..."
            className="flex-1 bg-transparent text-base leading-relaxed text-white/90 placeholder-white/20 resize-none outline-none focus:ring-0 scrollbar-hide"
          />

          <div className="mt-6 pt-6 border-t border-[#2E2E2E] space-y-4">
            <div>
              <label className="text-[10px] font-black text-[#C9CDD2] uppercase tracking-widest mb-2 flex items-center gap-2 block">
                <Settings2 size={12} /> Voz
              </label>

              {voicesLoading ? (
                <div className="w-full bg-[#2E2E2E] border border-[#3E3E3E] rounded-lg p-3 text-sm text-[#88CE11] animate-pulse">
                  ⏳ Carregando vozes...
                </div>
              ) : voices.length > 0 ? (
                <>
                  <select
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="w-full bg-[#2E2E2E] border border-[#3E3E3E] rounded-lg p-3 text-sm font-medium text-white outline-none focus:border-[#88CE11] transition-colors cursor-pointer"
                  >
                    {voices.map((voice) => (
                      <option key={voice} value={voice}>
                        {voice
                          .replace('pt-BR-', '')
                          .replace('Neural', '')
                          .trim()}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-[#88CE11] mt-2">
                    ✓ {voices.length} vozes disponíveis
                  </p>
                </>
              ) : (
                <div className="w-full bg-[#2E2E2E] border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                  ❌ Nenhuma voz carregada
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex justify-between text-[10px] font-black uppercase text-[#C9CDD2]">
                <span>Velocidade</span>
                <span className="text-[#88CE11]">{rate.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full h-1 bg-[#2E2E2E] rounded-full accent-[#88CE11] cursor-pointer"
              />
            </div>

            <button
              onClick={synthesize}
              disabled={isLoading || !text.trim() || voices.length === 0}
              className="w-full mt-4 px-6 py-3 bg-[#88CE11] text-[#161616] font-black rounded-xl hover:brightness-110 disabled:opacity-50 transition-all uppercase"
            >
              {isLoading ? '⏳ Sintetizando...' : '🎙️ Sintetizar'}
            </button>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Player */}
        <div className="w-full lg:w-7/12 p-8 flex flex-col bg-[#0F0F0F]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-black text-[#C9CDD2] uppercase tracking-[0.2em]">
              🎵 Live Preview
            </h3>
            <div className="text-[10px] font-mono text-[#88CE11] bg-[#88CE11]/5 px-2 py-1 rounded">
              {isPlaying ? '🔴 PLAYING' : '⚫ READY'}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-4 space-y-2 custom-scrollbar">
            {chunks.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#2E2E2E]">
                <p className="text-sm text-[#444]">Aguardando texto...</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {chunks.map((chunk, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveChunkIndex(idx)}
                    className={`px-3 py-2 rounded-xl transition-all text-base ${
                      activeChunkIndex === idx
                        ? 'bg-[#88CE11] text-[#0E1200] font-black scale-105'
                        : 'bg-[#2E2E2E] text-white/70 hover:text-white/90'
                    }`}
                  >
                    {chunk.text}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-[#2E2E2E] flex items-center gap-4">
            <button
              onClick={() => {
                if (audioRef.current) {
                  if (isPlaying) {
                    audioRef.current.pause();
                    setIsPlaying(false);
                  } else {
                    audioRef.current.play();
                    setIsPlaying(true);
                  }
                }
              }}
              disabled={!audioRef.current?.src}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isPlaying
                  ? 'bg-[#EF4444] hover:scale-105'
                  : 'bg-[#88CE11] hover:scale-110'
              } disabled:opacity-50 text-[#161616] font-black`}
            >
              {isPlaying ? (
                <Square size={24} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" className="ml-1" />
              )}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  audioRef.current.pause();
                  setIsPlaying(false);
                  setActiveChunkIndex(-1);
                }
              }}
              className="p-3 bg-[#2E2E2E] rounded-lg hover:bg-[#3E3E3E] transition-all"
            >
              <RotateCcw size={20} />
            </button>
          </div>

          <audio
            ref={audioRef}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setActiveChunkIndex(-1);
            }}
            className="hidden"
          />
        </div>
      </main>
    </div>
  );
}
