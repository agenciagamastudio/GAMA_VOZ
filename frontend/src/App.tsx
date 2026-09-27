
import React, { useState, useEffect, useMemo } from 'react';
import { ttsService } from './services/ttsService';
import { SAMPLE_TEXTS, VOICES } from './constants';
import { VoiceName } from './types';
import { 
  Square, 
  FileText,
  Volume2,
  Play,
  RotateCcw,
  Zap,
  MousePointer2,
  Settings2,
  Loader2,
  CheckCircle2,
  Mic2
} from 'lucide-react';

interface WordToken {
  word: string;
  start: number;
  end: number;
  index: number;
}

const App: React.FC = () => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.KORE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  
  // Tokenização para feedback visual e navegação
  const tokens = useMemo(() => {
    if (!text) return [];
    const wordRegex = /\S+/g;
    const result: WordToken[] = [];
    let match;
    let i = 0;

    while ((match = wordRegex.exec(text)) !== null) {
      result.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length,
        index: i++
      });
    }
    return result;
  }, [text]);

  const handleStop = () => {
    ttsService.stop();
    setIsPlaying(false);
    setIsLoading(false);
    setActiveWordIndex(-1);
  };

  const handlePlay = async (fromTokenIndex: number = 0) => {
    if (!text) return;

    handleStop();
    setIsLoading(true);

    // O texto enviado para a IA começa a partir do token selecionado
    const charStart = tokens[fromTokenIndex]?.start || 0;
    const textToSpeak = text.substring(charStart);

    await ttsService.generateAndPlay(textToSpeak, selectedVoice, {
      onStart: () => {
        setIsLoading(false);
        setIsPlaying(true);
        // Quando a IA não provê timestamps em tempo real, 
        // destacamos o bloco que começou a ser lido.
        setActiveWordIndex(fromTokenIndex);
      },
      onEnd: () => {
        setIsPlaying(false);
        setActiveWordIndex(-1);
      },
      onError: (err) => {
        console.error(err);
        setIsLoading(false);
        setIsPlaying(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <div className="max-w-6xl w-full space-y-8 animate-in fade-in duration-1000">
        
        {/* Header Profissional Gama Voice IA */}
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4 px-2">
          <div className="flex items-center gap-4">
            <div className="bg-[#88CE11] p-3 rounded-2xl shadow-[0_0_50px_rgba(136,206,17,0.4)] rotate-3">
              <Mic2 size={28} className="text-[#0A0A0A]" />
            </div>
            <div>
              <h1 className="font-black text-3xl tracking-tighter uppercase leading-none italic">
                GAMA<span className="text-[#88CE11]">VOICE</span><span className="text-white/40">IA</span>
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-[#88CE11] font-bold uppercase tracking-[0.4em] bg-[#88CE11]/10 px-2 py-0.5 rounded-full border border-[#88CE11]/20">Neural Core v2.5</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2 bg-[#141414] p-2 rounded-2xl border border-[#262626]">
            {SAMPLE_TEXTS.map((_, i) => (
              <button 
                key={i}
                onClick={() => setText(SAMPLE_TEXTS[i])}
                className="text-[10px] font-bold px-5 py-2.5 rounded-xl hover:bg-[#1E1E1E] transition-all uppercase tracking-widest text-[#A0A0A0] hover:text-white"
              >
                Sample {i + 1}
              </button>
            ))}
          </div>
        </div>

        <main className="ge-card overflow-hidden flex flex-col lg:flex-row h-[750px] lg:h-[650px] shadow-[0_30px_100px_rgba(0,0,0,0.6)]">
          
          {/* Editor de Roteiro */}
          <div className="w-full lg:w-5/12 p-10 border-b lg:border-b-0 lg:border-r border-[#262626] flex flex-col bg-[#0F0F0F]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] font-bold text-[#88CE11] uppercase tracking-[0.3em] flex items-center">
                <FileText size={16} className="mr-2" /> Script Engine
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-white/20 font-mono tracking-tighter">{tokens.length} WORDS</span>
                <Zap size={16} className={`${isLoading ? 'text-[#88CE11] animate-pulse' : 'text-white/5'}`} />
              </div>
            </div>
            
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Insira o roteiro para processamento de voz neural..."
              className="flex-1 bg-transparent text-xl leading-relaxed text-white/90 placeholder-white/5 resize-none outline-none font-medium scrollbar-hide"
            />

            <div className="mt-8 pt-8 border-t border-[#262626] space-y-6">
              <div>
                <label className="text-[10px] font-bold text-[#A0A0A0] uppercase tracking-widest mb-4 flex items-center gap-2">
                   <Settings2 size={14} /> Voice Architecture
                </label>
                <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-[150px] custom-scrollbar pr-3">
                  {VOICES.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVoice(v.id)}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left ${
                        selectedVoice === v.id
                          ? 'bg-[#88CE11]/10 border-[#88CE11] text-[#88CE11] shadow-[inset_0_0_20px_rgba(136,206,17,0.05)]'
                          : 'bg-transparent border-[#262626] text-white/40 hover:border-white/10 hover:text-white/60'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-tight">{v.name}</span>
                        <span className="text-[9px] uppercase tracking-widest opacity-40 mt-0.5">{v.gender} • High Fidelity</span>
                      </div>
                      {selectedVoice === v.id && <CheckCircle2 size={16} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Visualização de Tokens e Reprodução */}
          <div className="w-full lg:w-7/12 p-10 flex flex-col bg-[#070707] relative">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] font-bold text-[#A0A0A0] uppercase tracking-[0.3em] flex items-center">
                <MousePointer2 size={16} className="mr-2" /> Interactive Prompt
              </h3>
              <div className="flex items-center gap-4">
                <div className={`text-[9px] font-black flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${isLoading ? 'border-[#88CE11]/50 bg-[#88CE11]/10 text-[#88CE11]' : 'border-white/5 bg-white/5 text-white/20'}`}>
                  {isLoading ? 'GENERATING AUDIO...' : 'ENGINE READY'}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-6 custom-scrollbar">
              {tokens.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#1A1A1A]">
                  <Volume2 size={100} strokeWidth={1} className="opacity-20 mb-4" />
                  <p className="font-black text-3xl uppercase tracking-tighter opacity-10">Waiting Script</p>
                </div>
              ) : (
                <div className="flex flex-wrap content-start gap-x-2 gap-y-4">
                  {tokens.map((token) => (
                    <span
                      key={token.index}
                      onClick={() => handlePlay(token.index)}
                      className={`cursor-pointer px-1.5 py-0.5 rounded-lg transition-all duration-500 text-3xl lg:text-4xl leading-tight select-none ${
                        isPlaying && activeWordIndex <= token.index && activeWordIndex !== -1
                          ? 'text-[#88CE11] font-black drop-shadow-[0_0_15px_rgba(136,206,17,0.3)]' 
                          : 'text-[#1A1A1A] hover:text-white/20 transition-colors'
                      } ${activeWordIndex === token.index ? 'scale-110' : ''}`}
                    >
                      {token.word}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Painel de Controle Flutuante */}
            <div className="mt-10 pt-10 border-t border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-8">
                <button 
                  onClick={() => isPlaying ? handleStop() : handlePlay(0)}
                  disabled={tokens.length === 0 || isLoading}
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center transition-all shadow-2xl ${
                    isPlaying 
                      ? 'bg-[#EF4444] text-white hover:scale-105 rotate-3' 
                      : 'bg-[#88CE11] text-[#0A0A0A] hover:scale-110 -rotate-3 hover:rotate-0'
                  } disabled:opacity-5`}
                >
                  {isLoading ? (
                    <Loader2 className="animate-spin" size={32} />
                  ) : isPlaying ? (
                    <Square size={28} fill="currentColor" />
                  ) : (
                    <Play size={34} className="ml-1" fill="currentColor" />
                  )}
                </button>
                
                <div className="hidden sm:block">
                  <p className="text-[11px] font-black text-[#262626] uppercase tracking-[0.4em] mb-1">Gama Voice IA Status</p>
                  <p className={`text-lg font-black uppercase tracking-tighter ${isPlaying || isLoading ? 'text-[#88CE11]' : 'text-white/10'}`}>
                    {isLoading ? 'Neural Synthesis active' : isPlaying ? 'Broadcasting audio stream' : 'Engine on standby'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={handleStop}
                  className="p-5 bg-[#141414] rounded-2xl hover:bg-[#1E1E1E] transition-all border border-[#262626] text-[#A0A0A0] hover:text-white active:scale-95"
                  title="Reset Engine"
                >
                  <RotateCcw size={22} />
                </button>
              </div>
            </div>
          </div>
        </main>

        <footer className="flex flex-col sm:flex-row justify-between items-center px-6 gap-6 opacity-30">
          <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-[#88CE11]">Gemini 2.5 Flash Neural Architecture</p>
          <div className="h-[1px] flex-1 bg-white/5 hidden sm:block mx-10"></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-white/50">Gama Voice IA • Professional Edition • 2024</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
