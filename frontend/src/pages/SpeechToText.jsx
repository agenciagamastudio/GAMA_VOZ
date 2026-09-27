import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, Copy, Volume2 } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:5001/api';

export default function SpeechToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        await sendAudio();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone error:', err);
      setError('Acesso ao microfone negado');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const sendAudio = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('language', 'pt');

      const response = await fetch(`${API_BASE}/stt/transcribe`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errorMsg = 'Transcrição falhou';
        try {
          const data = await response.json();
          errorMsg = data.error || errorMsg;
        } catch (e) {
          errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setTranscript(data.text);

    } catch (err) {
      console.error('Transcription error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setTranscript('');
    setRecordingTime(0);
    audioChunksRef.current = [];
    setError(null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
      <main className="border border-[#2E2E2E] rounded-2xl overflow-hidden flex flex-col shadow-2xl bg-[#272727]">

        {/* Mic Control */}
        <div className="p-12 bg-[#0F0F0F] flex flex-col items-center justify-center space-y-8 border-b border-[#2E2E2E]">

          {isRecording && (
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full bg-[#EF4444] animate-pulse" />
                <div className="absolute inset-2 rounded-full bg-[#EF4444]/50" />
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-black text-[#EF4444] uppercase tracking-widest">Gravando...</p>
                <p className="text-2xl font-mono font-black text-[#88CE11]">{formatTime(recordingTime)}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => isRecording ? stopRecording() : startRecording()}
            disabled={isLoading}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? 'bg-[#EF4444] text-white shadow-[0_0_40px_rgba(239,68,68,0.4)] hover:scale-105'
                : 'bg-[#88CE11] text-[#161616] shadow-[0_0_40px_rgba(136,206,17,0.3)] hover:scale-110'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isRecording ? (
              <Square size={40} fill="currentColor" />
            ) : (
              <Mic size={48} />
            )}
          </button>

          {isLoading && (
            <div className="text-center">
              <div className="inline-block">
                <div className="w-8 h-8 border-4 border-[#2E2E2E] border-t-[#88CE11] rounded-full animate-spin" />
              </div>
              <p className="text-sm text-[#88CE11] font-black mt-4 uppercase">Transcrevendo...</p>
            </div>
          )}
        </div>

        {/* Transcription */}
        <div className="p-8 flex-1 min-h-[300px] flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-black text-[#C9CDD2] uppercase tracking-[0.2em] flex items-center gap-2">
              <Volume2 size={14} /> Transcrição
            </h3>
            <div className="text-[10px] font-mono text-[#88CE11] bg-[#88CE11]/5 px-2 py-1 rounded">
              {transcript ? '✅ PRONTO' : '⏳ AGUARDANDO'}
            </div>
          </div>

          {transcript ? (
            <div className="space-y-4">
              <div className="p-4 bg-[#2E2E2E] rounded-xl border border-[#3E3E3E]">
                <p className="text-lg leading-relaxed text-white/90 font-medium break-words">
                  {transcript}
                </p>
              </div>

              <div className="p-3 bg-[#88CE11]/5 rounded-lg border border-[#88CE11]/20">
                <p className="text-xs text-[#88CE11] font-black uppercase tracking-widest">
                  ✓ {transcript.split(' ').length} palavras
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#2E2E2E]">
              <p className="text-sm text-[#444]">Clique no microfone para começar a gravar</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              ❌ {error}
            </div>
          )}

          {transcript && (
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 px-4 py-2 bg-[#2E2E2E] rounded-lg hover:bg-[#3E3E3E] transition-all text-sm font-black uppercase flex items-center justify-center gap-2"
              >
                <Copy size={16} /> Copiar
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 bg-[#2E2E2E] rounded-lg hover:bg-[#3E3E3E] transition-all text-sm font-black uppercase flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} /> Limpar
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
