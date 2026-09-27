export interface Voice {
  id: string
  gender: 'male' | 'female'
  age: 'adult' | 'child' | 'teen'
  description: string
}

export interface TTSSettings {
  voice: string
  speed: number
  saveHistory: boolean
  analyticsEnabled: boolean
}

export interface STTSettings {
  language: string
}

export interface Transcript {
  id: string
  text: string
  timestamp: Date
  audioUrl?: string
  language: string
}

export interface APIError {
  error: string
  code?: string
  statusCode?: number
}
