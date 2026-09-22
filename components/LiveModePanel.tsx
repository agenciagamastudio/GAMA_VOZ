import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic2, 
  Mic, 
  Waves, 
  Clock, 
  Brain, 
  MessageCircle, 
  Volume2, 
  Circle,
  Loader2,
  Bot
} from 'lucide-react';
import { audioRecorder, AudioChunk } from '../services/audioRecorder';

interface Insight {
  id: string;
  text: string;
  timestamp: number;
  source: 'system' | 'user-question' | 'auto';
}

// Simulação de insights automáticos baseados em contexto
// Na implementação real, isso conectaria ao LLM com os últimos 30s de áudio
const generateContextualInsight = (chunks: AudioChunk[], lastQuestion?: string): Insight | null => {
  if (chunks.length === 0) return null;
  
  const now = Date.now();
  const recentChunks = chunks.filter(c => now - c.timestamp < 30000);
  
  if (recentChunks.length === 0) return null;
  
  // Em produção, aqui seria enviado ao LLM com transcrição dos áudios
  // Por enquanto, demonstramos a arquitetura com insights simulados
  return {
    id: crypto.randomUUID(),
    text: recentChunks.length >= 3 
      ? 'Contexto capturado: áudio ambiente + sua voz nos últimos 30s disponíveis para análise'
      : 'Gravando contexto do ambiente...',
    timestamp: now,
    source: 'system',
  };
};

const LiveModePanel: React.FC = () => {
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [question, setQuestion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [bufferDuration, setBufferDuration] = useState(0);
  
  const insightsEndRef = useRef<HTMLDivElement>(null);
  const questionEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (insightsEndRef.current) {
      insightsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [insights]);

  useEffect(() => {
    if (questionEndRef.current) {
      questionEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [answer]);

  // Simulação de detecção de atividade - em produção usaria VAD real
  useEffect(() => {
    if (!isListening) return;
    
    const interval = setInterval(() => {
      setBufferDuration(audioRecorder.getBufferDuration());
      
      // Gerar insight de status a cada 5 segundos
      if (audioRecorder.getState().chunks.length > 0) {
        const lastInsight = insights[insights.length - 1];
        if (!lastInsight || lastInsight.source !== 'system' || Date.now() - lastInsight.timestamp > 5000) {
          const insight = generateContextualInsight(audioRecorder.getState().chunks);
          if (insight) {
            setInsights(prev => [...prev.slice(-20), insight]);
          }
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isListening, insights]);

  const handleToggleLiveMode = useCallback(async () => {
    if (isLiveMode) {
      // Desativar modo ao vivo
      await audioRecorder.stop();
      setIsListening(false);
      setAudioLevel(0);
    } else {
      // Ativar modo ao vivo
      try {
        await audioRecorder.start({
          onChunkCapture: (chunk) => {
            // Adicionar insight quando novo áudio capturado
            setInsights(prev => [
              ...prev.slice(-20),
              {
                id: crypto.randomUUID(),
                text: `[Áudio capturado] ${chunk.duration.toFixed(1)}s - ${new Date(chunk.timestamp).toLocaleTimeString()}`,
                timestamp: chunk.timestamp,
                source: 'system',
              }
            ]);
          },
          onStatusChange: (listening, level) => {
            setIsListening(listening);
            setAudioLevel(level);
          }
        });
      } catch (err) {
        console.error('Erro ao iniciar modo ao vivo:', err);
        alert('Permissão de microfone necessária para o modo ao vivo.');
      }
    }
    setIsLiveMode(!isLiveMode);
  }, [isLiveMode]);

  const handleAskQuestion = useCallback(async () => {
    if (!question.trim() || !isListening) return;
    
    setIsProcessing(true);
    setAnswer(null);
    
    // Capturar contexto dos últimos 30 segundos
    const contextChunks = audioRecorder.getRecentChunks(30);
    const bufferInfo = `Capturados ${contextChunks.length} chunks (${(bufferInfo.duration || audioRecorder.getBufferDuration()).toFixed(1)}s de contexto)`;
    
    // Simulação de resposta com contexto
    // Em produção: enviar áudios + pergunta para o LLM
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const simulatedAnswer = generateAnswer(question, contextChunks);
    setAnswer(simulatedAnswer);
    
    setInsights(prev => [...prev.slice(-20), {
      id: crypto.randomUUID(),
      text: `Pergunta: "${question}"`,
      timestamp: Date.now(),
      source: 'user-question',
    }]);
    
    setQuestion('');
    setIsProcessing(false);
  }, [question, isListening]);

  // Simulação de resposta contextual (substituir por LLM real)
  const generateAnswer = (q: string, chunks: AudioChunk[]): string => {
    const contextInfo = chunks.length > 0 
      ? `Com base nos últimos ${chunks.reduce((s, c) => s + c.duration, 0).toFixed(1)} segundos de áudio que escolou o ambiente...`
      : 'Analisando seu contexto de aprendizagem...';
    
    // Respostas simuladas baseadas em palavras-chave
    const lowerQ = q.toLowerCase();
    if (lowerQ.includes('closer') || lowerQ.includes('close')) {
      return `${contextInfo}
      
**Closing (Closing de vendas)** é a etapa final do processo de vendas onde o vendedor conduz o prospecto a tomar uma decisão de compra.
      
Em 시장상황에:
- **"Fechar a venda"** = Obter o "sim" final do cliente
- **Técnicas de closing**: assumir que o cliente já decidiu ("Quando quer que eu envie?"), oferecer urgência ("Essa oferta é válida até hoje"), ou resolver objeções finais
- O termo vem do inglês "to close" = fechar, completar um acordo
- Em treinamentos de vendas, o "closing" é ensinado como uma habilidade separada do resto do funil`;
    }
    
    if (lowerQ.includes('planta')) {
      return `${contextInfo}
      
**Planta** em construção civil tem dois significados principais:
      
1. **Planta Baixa**: É o desenho técnico que mostra a construção "vista de cima" (como um corte horizontal). Mostra:
   - Distribuição de ambientes/cômodos
   - Posição de paredes, portas e janelas
   - Circulação e dimensões
   - Localização de instalações
      
2. **Planta Alta (ou Plant Elevations)**: São as "visões laterais" da construção - frente, fundos, lados. Mostra:
   - Altura das paredes
   - Detalhes da fachada
   - Posição de janelas e portões em relação ao nível do solo
   - Comportamento externo da edificação`;
    }
    
    return `${contextInfo}
    
**Resposta contextual baseada no que você está estudando:**${chunks.length > 2 ? '\n\n*Sugestão: o assistente tem todo o contexto da sua sessão de aprendizado para fundamentar respostas mais precisas.*' : ''}`;
  };

  return (
    <div className="fixed bottom-6 right-6 w-[380px] bg-[#0F0F0F] border border-[#262626] rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden z-50 transition-all duration-500">
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${isLiveMode ? 'border-[#88CE11]/30 bg-[#88CE11]/5' : 'border-[#262626] bg-[#0A0A0A]'}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isLiveMode ? 'bg-[#88CE11]/20' : 'bg-white/5'}`}>
            {isListening ? (
              <Mic size={20} className="text-[#88CE11] animate-pulse" />
            ) : (
              <Mic2 size={20} className="text-[#A0A0A0]" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Modo Assistente Ao Vivo
            </h3>
            <p className="text-[10px] text-[#A0A0A0] font-mono">
              {isLiveMode ? 'ATIVADO' : 'INATIVO'} • {bufferDuration.toFixed(1)}s de contexto
            </p>
          </div>
        </div>
        
        <button
          onClick={handleToggleLiveMode}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isLiveMode ? 'bg-[#88CE11] text-[#0A0A0A] hover:scale-110' : 'bg-[#141414] border border-[#262626] text-[#A0A0A0] hover:border-white/20'}`}
          title={isLiveMode ? 'Desativar Modo Ao Vivo' : 'Ativar Modo Assistente'}
        >
          {isLiveMode ? (
            <Circle size={18} fill="currentColor" className="animate-pulse" />
          ) : (
            <Waves size={18} />
          )}
        </button>
      </div>

      {/* Status visual de audição */}
      {isListening && (
        <div className="h-1.5 bg-[#141414] overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#88CE11] to-[#6B9E0A] transition-all duration-150"
            style={{ width: `${audioLevel * 100}%` }}
          />
        </div>
      )}

      {/* Insights Panel */}
      <div className="p-4 space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2 text-[10px] text-[#A0A0A0] font-mono uppercase tracking-wider">
          <Brain size={12} />
          <span>Insights do Assistente</span>
          <span className="ml-auto text-white/30">{insights.length} eventos</span>
        </div>
        
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div
              key={insight.id}
              className={`text-[11px] leading-relaxed p-2 rounded-lg ${
                insight.source === 'user-question' 
                  ? 'bg-[#88CE11]/10 border border-[#88CE11]/20 text-[#88CE11]'
                  : 'bg-[#141414] text-[#A0A0A0]'
              }`}
            >
              <div className="flex items-start gap-2">
                {insight.source === 'user-question' ? (
                  <MessageCircle size={12} className="text-[#88CE11] mt-0.5 shrink-0" />
                ) : (
                  <Bot size={12} className="text-white/30 mt-0.5 shrink-0" />
                )}
                <span className="whitespace-pre-wrap">{insight.text}</span>
              </div>
              <div className="text-[9px] text-white/20 mt-1 text-right font-mono">
                {new Date(insight.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          <div ref={insightsEndRef} />
        </div>
      </div>

      {/* Input de pergunta contextual */}
      <div className="p-4 border-t border-[#262626]">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
            placeholder="O que é closer? (com contexto dos últimos 30s)"
            disabled={!isListening || isProcessing}
            className="flex-1 bg-[#141414] border border-[#262626] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#88CE11]/50 disabled:opacity-50"
          />
          <button
            onClick={handleAskQuestion}
            disabled={!isListening || isProcessing || !question.trim()}
            className={`p-2.5 rounded-xl transition-all ${
              isProcessing 
                ? 'bg-[#88CE11]/20 text-[#88CE11]' 
                : !isListening || !question.trim()
                  ? 'bg-[#141414] text-[#A0A0A0] cursor-not-allowed'
                  : 'bg-[#88CE11] text-[#0A0A0A] hover:scale-110 active:scale-95'
            }`}
            title="Perguntar com contexto"
          >
            {isProcessing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Volume2 size={18} />
            )}
          </button>
        </div>
        
        {answer && (
          <div className="mt-3 bg-[#88CE11]/5 border border-[#88CE11]/20 rounded-xl p-3">
            <div className="text-[9px] text-[#88CE11] font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
              <Clock size={12} /> Resposta Contextualizada
            </div>
            <div className="text-[11px] leading-relaxed text-[#D0D0D0] whitespace-pre-wrap">
              {answer}
            </div>
            <div ref={questionEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveModePanel;
