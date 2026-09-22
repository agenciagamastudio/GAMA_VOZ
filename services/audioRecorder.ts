// Gerenciador de gravação de áudio para o Modo Ao Vivo
// CAPTURA: microfone do sistema para contexto de 30 segundos

export interface AudioChunk {
  id: string;
  timestamp: number;
  blob: Blob;
  duration: number; // segundos
}

export interface LiveModeState {
  isActive: boolean;
  isListening: boolean;
  bufferSize: number; // segundos de contexto mantidos
  chunks: AudioChunk[];
  lastActivity: number | null;
}

const MAX_BUFFER_SECONDS = 30;
const CHUNK_DURATION = 5; // segundos por chunk

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private chunks: AudioChunk[] = [];
  private isRecording = false;
  private recordingStartTime = 0;
  private animationFrameId: number | null = null;
  private onChunkCapture?: (chunk: AudioChunk) => void;
  private onStatusChange?: (isListening: boolean, level: number) => void;

  async start(options?: { onChunkCapture?: (chunk: AudioChunk) => void; onStatusChange?: (isListening: boolean, level: number) => void }) {
    if (this.isRecording) return;

    this.onChunkCapture = options?.onChunkCapture;
    this.onStatusChange = options?.onStatusChange;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      
      // Configurar AudioContext para análise de nível
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const audioData: BlobPart[] = [];
      let chunkStartTime = Date.now();

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioData.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        if (audioData.length > 0) {
          const blob = new Blob(audioData, { type: 'audio/webm' });
          const duration = (Date.now() - chunkStartTime) / 1000;
          const chunk: AudioChunk = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            blob,
            duration,
          };
          this.chunks.push(chunk);
          this.onChunkCapture?.(chunk);
          this.trimBuffer();
        }
        audioData.length = 0;
      };

      this.mediaRecorder.start(1000); // dados a cada segundo
      this.isRecording = true;
      this.recordingStartTime = Date.now();

      // Monitor de nível de áudio
      this.monitorAudioLevel();

    } catch (err) {
      console.error('Erro ao iniciar gravação:', err);
      throw err;
    }
  }

  private monitorAudioLevel() {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const monitor = () => {
      if (!this.isRecording) return;
      
      this.analyser!.getByteFrequencyData(dataArray);
      
      // Nível médio de áudio (0-255)
      const level = Array.from(dataArray).reduce((a, b) => a + b, 0) / dataArray.length;
      const normalizedLevel = level / 255;
      
      this.onStatusChange?.(true, normalizedLevel);
      
      if (this.isRecording) {
        this.animationFrameId = requestAnimationFrame(monitor);
      }
    };

    this.animationFrameId = requestAnimationFrame(monitor);
  }

  stop() {
    if (!this.isRecording) return;

    return new Promise<void>((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
          }
          if (this.audioContext) {
            this.audioContext.close();
          }
          if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
          }
          this.isRecording = false;
          this.onStatusChange?.(false, 0);
          resolve();
        };
        this.mediaRecorder.stop();
      } else {
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
        }
        if (this.audioContext) {
          this.audioContext.close();
        }
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }
        this.isRecording = false;
        this.onStatusChange?.(false, 0);
        resolve();
      }
    });
  }

  private trimBuffer() {
    const now = Date.now();
    const cutoff = now - (MAX_BUFFER_SECONDS * 1000);
    
    this.chunks = this.chunks.filter(c => c.timestamp > cutoff);
  }

  getRecentChunks(secondsBack: number = MAX_BUFFER_SECONDS): AudioChunk[] {
    const cutoff = Date.now() - (secondsBack * 1000);
    return this.chunks.filter(c => c.timestamp > cutoff);
  }

  getBufferDuration(): number {
    if (this.chunks.length === 0) return 0;
    return this.chunks.reduce((sum, c) => sum + c.duration, 0);
  }

  getState(): LiveModeState {
    return {
      isActive: this.isRecording,
      isListening: this.isRecording,
      bufferSize: MAX_BUFFER_SECONDS,
      chunks: this.chunks,
      lastActivity: this.chunks.length > 0 ? this.chunks[this.chunks.length - 1].timestamp : null,
    };
  }
}

export const audioRecorder = new AudioRecorder();
