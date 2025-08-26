/**
 * JSFXR - 8-bit sound effects generator
 * Modern TypeScript port of the original sfxr
 */

export { RiffWave, RIFFWAVE } from './riffwave';
export { 
  Params,
  SoundEffect,
  SQUARE,
  SAWTOOTH,
  SINE,
  NOISE
} from './sfxr';

// Re-export everything for convenience
export * from './riffwave';
export * from './sfxr';