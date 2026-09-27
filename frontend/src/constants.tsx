
import { VoiceName, VoiceOption } from './types';

export const VOICES: VoiceOption[] = [
  { id: VoiceName.KORE, name: 'Kore (Ember Style)', description: 'Voz feminina ultra-natural, clara e acolhedora.', gender: 'Female' },
  { id: VoiceName.PUCK, name: 'Puck (Energético)', description: 'Voz masculina energética e jovem.', gender: 'Male' },
  { id: VoiceName.ZEPHYR, name: 'Zephyr (Suave)', description: 'Voz neutra suave e profunda.', gender: 'Neutral' },
  { id: VoiceName.CHARON, name: 'Charon (Autoridade)', description: 'Voz masculina madura e autoritária.', gender: 'Male' },
  { id: VoiceName.AOEDE, name: 'Aoede (Expressivo)', description: 'Voz feminina suave e expressiva.', gender: 'Female' },
];

export const SAMPLE_TEXTS = [
  "Bem-vindo ao Gama Voice IA. Esta é a fronteira final da síntese de voz neural, desenvolvida exclusivamente para o ecossistema do Grupo Gama.",
  "Com o Gama Voice IA, transformamos meras palavras em experiências auditivas imersivas. A tecnologia Flash 2.5 garante latência zero e clareza absoluta.",
  "Nossa IA processa cada sílaba com precisão cirúrgica, ideal para comerciais, treinamentos e comunicações internas de alto impacto."
];
