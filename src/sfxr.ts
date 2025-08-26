/**
 * SFXR.ts - 8-bit sound generator for HTML5 (TypeScript port)
 * Original: Based on the C++ sfxr by Tomas Pettersson
 * JavaScript port: Copyleft 2011 by Thomas Vian
 * TypeScript modernization: Complete rewrite with modern ES6+ features and proper typing
 * 
 * Public Domain
 */

// Import dependencies
import { RiffWave } from './riffwave';

// Wave type constants
export const SQUARE = 0;
export const SAWTOOTH = 1;
export const SINE = 2;
export const NOISE = 3;

export type WaveType = typeof SQUARE | typeof SAWTOOTH | typeof SINE | typeof NOISE;

// Master volume control
let masterVolume = 1;

const OVERSAMPLING = 8;

// Base58 encoding alphabet
const b58alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Parameter order definition
const paramsOrder = [
  "wave_type",
  "p_env_attack",
  "p_env_sustain", 
  "p_env_punch",
  "p_env_decay",
  "p_base_freq",
  "p_freq_limit",
  "p_freq_ramp",
  "p_freq_dramp",
  "p_vib_strength",
  "p_vib_speed",
  "p_arp_mod",
  "p_arp_speed",
  "p_duty",
  "p_duty_ramp",
  "p_repeat_speed",
  "p_pha_offset",
  "p_pha_ramp",
  "p_lpf_freq",
  "p_lpf_ramp",
  "p_lpf_resonance",
  "p_hpf_freq",
  "p_hpf_ramp"
] as const;

// Signed parameters list
const paramsSigned = [
  "p_freq_ramp", "p_freq_dramp", "p_arp_mod", "p_duty_ramp", 
  "p_pha_offset", "p_pha_ramp", "p_lpf_ramp", "p_hpf_ramp"
];

// Parameter interface definition
export interface SynthParameters {
  oldParams?: boolean;
  wave_type: WaveType;
  
  // Envelope parameters
  p_env_attack: number;
  p_env_sustain: number;
  p_env_punch: number;
  p_env_decay: number;
  
  // Frequency parameters
  p_base_freq: number;
  p_freq_limit: number;
  p_freq_ramp: number;
  p_freq_dramp: number;
  
  // Vibrato parameters
  p_vib_strength: number;
  p_vib_speed: number;
  
  // Arpeggio parameters
  p_arp_mod: number;
  p_arp_speed: number;
  
  // Square wave duty cycle parameters
  p_duty: number;
  p_duty_ramp: number;
  
  // Repeat parameters
  p_repeat_speed: number;
  
  // Phaser parameters
  p_pha_offset: number;
  p_pha_ramp: number;
  
  // Low-pass filter parameters
  p_lpf_freq: number;
  p_lpf_ramp: number;
  p_lpf_resonance: number;
  
  // High-pass filter parameters
  p_hpf_freq: number;
  p_hpf_ramp: number;
  
  // Sampling parameters
  sound_vol: number;
  sample_rate: number;
  sample_size: number;
}

// Render result interface
export interface RenderResult {
  buffer: number[];
  normalized: number[];
  clipped: number;
}

// Audio source interface
export interface AudioSource {
  channels: any[];
  setVolume(volume: number): AudioSource;
  play(): any;
}

// Extended RiffWave interface
export interface ExtendedRiffWave extends RiffWave {
  clipping?: number;
  buffer?: number[];
  getAudio?: () => AudioSource | HTMLAudioElement;
}

// Helper functions
const sqr = (x: number): number => x * x;
const cube = (x: number): number => x * x * x;
const sign = (x: number): number => x < 0 ? -1 : 1;
const log = (x: number, b: number): number => Math.log(x) / Math.log(b);
const pow = Math.pow;

const frnd = (range: number): number => Math.random() * range;
const rndr = (from: number, to: number): number => Math.random() * (to - from) + from;
const rnd = (max: number): number => Math.floor(Math.random() * (max + 1));

// IEEE 754 floating point conversion functions
const assembleFloat = (sign: number, exponent: number, mantissa: number): number => {
  return (sign << 31) | (exponent << 23) | (mantissa);
};

const floatToNumber = (flt: number): number => {
  if (isNaN(flt)) {
    return assembleFloat(0, 0xFF, 0x1337);
  }

  const sign = (flt < 0) ? 1 : 0;
  flt = Math.abs(flt);
  
  if (flt === 0.0) {
    return assembleFloat(sign, 0, 0);
  }

  const exponent = Math.floor(Math.log(flt) / Math.LN2);
  
  if (exponent > 127 || exponent < -126) {
    return assembleFloat(sign, 0xFF, 0);
  }

  const mantissa = flt / Math.pow(2, exponent);
  return assembleFloat(sign, exponent + 127, (mantissa * Math.pow(2, 23)) & 0x7FFFFF);
};

const numberToFloat = (bytes: number): number => {
  const sign = (bytes & 0x80000000) ? -1 : 1;
  const exponent = ((bytes >> 23) & 0xFF) - 127;
  let significand = (bytes & ~(-1 << 23));

  if (exponent === 128) {
    return sign * ((significand) ? Number.NaN : Number.POSITIVE_INFINITY);
  }

  if (exponent === -127) {
    if (significand === 0) return sign * 0.0;
    significand /= (1 << 22);
  } else {
    significand = (significand | (1 << 23)) / (1 << 23);
  }

  return sign * significand * Math.pow(2, exponent);
};

// Modernized Params class
export class Params implements SynthParameters {
  oldParams = true;
  wave_type: WaveType = SQUARE;
  
  // Envelope parameters
  p_env_attack = 0;
  p_env_sustain = 0.3;
  p_env_punch = 0;
  p_env_decay = 0.4;
  
  // Frequency parameters
  p_base_freq = 0.3;
  p_freq_limit = 0;
  p_freq_ramp = 0;
  p_freq_dramp = 0;
  
  // Vibrato parameters
  p_vib_strength = 0;
  p_vib_speed = 0;
  
  // Arpeggio parameters
  p_arp_mod = 0;
  p_arp_speed = 0;
  
  // Square wave duty cycle parameters
  p_duty = 0;
  p_duty_ramp = 0;
  
  // Repeat parameters
  p_repeat_speed = 0;
  
  // Phaser parameters
  p_pha_offset = 0;
  p_pha_ramp = 0;
  
  // Filter parameters
  p_lpf_freq = 1;
  p_lpf_ramp = 0;
  p_lpf_resonance = 0;
  p_hpf_freq = 0;
  p_hpf_ramp = 0;
  
  // Sampling parameters
  sound_vol = 0.5;
  sample_rate = 44100;
  sample_size = 8;

  // Base58 encoding
  toB58(): string {
    const convert: number[] = [];
    
    for (const p of paramsOrder) {
      if (p === "wave_type") {
        convert.push(this[p]);
      } else if (p.startsWith("p_")) {
        const val = floatToNumber(this[p as keyof this] as number);
        convert.push(0xff & val);
        convert.push(0xff & (val >> 8));
        convert.push(0xff & (val >> 16));
        convert.push(0xff & (val >> 24));
      }
    }
    
    return this.base58Encode(convert);
  }

  private base58Encode(data: number[]): string {
    const d: number[] = [];
    let s = "";
    let i: number, j = 0, c: number, n: number;
    
    for (const idx in data) {
      i = Number(idx);
      j = 0;
      c = data[i];
      s += c || s.length ^ i ? "" : "1";
      
      while (j in d || c) {
        n = d[j];
        n = n ? n * 256 + c : c;
        c = Math.floor(n / 58);
        d[j] = n % 58;
        j++;
      }
    }
    
    while (j-- > 0) {
      s += b58alphabet[d[j]];
    }
    
    return s;
  }

  // Base58 decoding
  fromB58(b58encoded: string): this {
    this.fromJSON(b58decode(b58encoded));
    return this;
  }

  // Set parameters from JSON object
  fromJSON(struct: Partial<SynthParameters>): this {
    for (const p in struct) {
      if (struct.hasOwnProperty(p)) {
        (this as any)[p] = (struct as any)[p];
      }
    }
    return this;
  }

  // Preset generation methods
  pickupCoin(): this {
    this.wave_type = SAWTOOTH;
    this.p_base_freq = 0.4 + frnd(0.5);
    this.p_env_attack = 0;
    this.p_env_sustain = frnd(0.1);
    this.p_env_decay = 0.1 + frnd(0.4);
    this.p_env_punch = 0.3 + frnd(0.3);
    
    if (rnd(1)) {
      this.p_arp_speed = 0.5 + frnd(0.2);
      this.p_arp_mod = 0.2 + frnd(0.4);
    }
    
    return this;
  }

  laserShoot(): this {
    this.wave_type = rnd(2) as WaveType;
    
    if (this.wave_type === SINE && rnd(1)) {
      this.wave_type = rnd(1) as WaveType;
    }
    
    if (rnd(2) === 0) {
      this.p_base_freq = 0.3 + frnd(0.6);
      this.p_freq_limit = frnd(0.1);
      this.p_freq_ramp = -0.35 - frnd(0.3);
    } else {
      this.p_base_freq = 0.5 + frnd(0.5);
      this.p_freq_limit = this.p_base_freq - 0.2 - frnd(0.6);
      if (this.p_freq_limit < 0.2) this.p_freq_limit = 0.2;
      this.p_freq_ramp = -0.15 - frnd(0.2);
    }
    
    if (this.wave_type === SAWTOOTH) {
      this.p_duty = 1;
    }
    
    if (rnd(1)) {
      this.p_duty = frnd(0.5);
      this.p_duty_ramp = frnd(0.2);
    } else {
      this.p_duty = 0.4 + frnd(0.5);
      this.p_duty_ramp = -frnd(0.7);
    }
    
    this.p_env_attack = 0;
    this.p_env_sustain = 0.1 + frnd(0.2);
    this.p_env_decay = frnd(0.4);
    
    if (rnd(1)) {
      this.p_env_punch = frnd(0.3);
    }
    
    if (rnd(2) === 0) {
      this.p_pha_offset = frnd(0.2);
      this.p_pha_ramp = -frnd(0.2);
    }
    
    this.p_hpf_freq = frnd(0.3);
    return this;
  }

  explosion(): this {
    this.wave_type = NOISE;
    
    if (rnd(1)) {
      this.p_base_freq = sqr(0.1 + frnd(0.4));
      this.p_freq_ramp = -0.1 + frnd(0.4);
    } else {
      this.p_base_freq = sqr(0.2 + frnd(0.7));
      this.p_freq_ramp = -0.2 - frnd(0.2);
    }
    
    if (rnd(4) === 0) {
      this.p_freq_ramp = 0;
    }
    
    if (rnd(2) === 0) {
      this.p_repeat_speed = 0.3 + frnd(0.5);
    }
    
    this.p_env_attack = 0;
    this.p_env_sustain = 0.1 + frnd(0.3);
    this.p_env_decay = frnd(0.5);
    
    if (rnd(1)) {
      this.p_pha_offset = -0.3 + frnd(0.9);
      this.p_pha_ramp = -frnd(0.3);
    }
    
    this.p_env_punch = 0.2 + frnd(0.6);
    
    if (rnd(1)) {
      this.p_vib_strength = frnd(0.7);
      this.p_vib_speed = frnd(0.6);
    }
    
    if (rnd(2) === 0) {
      this.p_arp_speed = 0.6 + frnd(0.3);
      this.p_arp_mod = 0.8 - frnd(1.6);
    }
    
    return this;
  }

  powerUp(): this {
    if (rnd(1)) {
      this.wave_type = SAWTOOTH;
      this.p_duty = 1;
    } else {
      this.p_duty = frnd(0.6);
    }
    
    this.p_base_freq = 0.2 + frnd(0.3);
    
    if (rnd(1)) {
      this.p_freq_ramp = 0.1 + frnd(0.4);
      this.p_repeat_speed = 0.4 + frnd(0.4);
    } else {
      this.p_freq_ramp = 0.05 + frnd(0.2);
      
      if (rnd(1)) {
        this.p_vib_strength = frnd(0.7);
        this.p_vib_speed = frnd(0.6);
      }
    }
    
    this.p_env_attack = 0;
    this.p_env_sustain = frnd(0.4);
    this.p_env_decay = 0.1 + frnd(0.4);
    
    return this;
  }

  hitHurt(): this {
    this.wave_type = rnd(2) as WaveType;
    
    if (this.wave_type === SINE) {
      this.wave_type = NOISE;
    }
    
    if (this.wave_type === SQUARE) {
      this.p_duty = frnd(0.6);
    }
    
    if (this.wave_type === SAWTOOTH) {
      this.p_duty = 1;
    }
    
    this.p_base_freq = 0.2 + frnd(0.6);
    this.p_freq_ramp = -0.3 - frnd(0.4);
    this.p_env_attack = 0;
    this.p_env_sustain = frnd(0.1);
    this.p_env_decay = 0.1 + frnd(0.2);
    
    if (rnd(1)) {
      this.p_hpf_freq = frnd(0.3);
    }
    
    return this;
  }

  jump(): this {
    this.wave_type = SQUARE;
    this.p_duty = frnd(0.6);
    this.p_base_freq = 0.3 + frnd(0.3);
    this.p_freq_ramp = 0.1 + frnd(0.2);
    this.p_env_attack = 0;
    this.p_env_sustain = 0.1 + frnd(0.3);
    this.p_env_decay = 0.1 + frnd(0.2);
    
    if (rnd(1)) {
      this.p_hpf_freq = frnd(0.3);
    }
    
    if (rnd(1)) {
      this.p_lpf_freq = 1 - frnd(0.6);
    }
    
    return this;
  }

  blipSelect(): this {
    this.wave_type = rnd(1) as WaveType;
    
    if (this.wave_type === SQUARE) {
      this.p_duty = frnd(0.6);
    } else {
      this.p_duty = 1;
    }
    
    this.p_base_freq = 0.2 + frnd(0.4);
    this.p_env_attack = 0;
    this.p_env_sustain = 0.1 + frnd(0.1);
    this.p_env_decay = frnd(0.2);
    this.p_hpf_freq = 0.1;
    
    return this;
  }

  synth(): this {
    this.wave_type = rnd(1) as WaveType;
    this.p_base_freq = [0.2723171360931539, 0.19255692561524382, 0.13615778746815113][rnd(2)];
    this.p_env_attack = rnd(4) > 3 ? frnd(0.5) : 0;
    this.p_env_sustain = frnd(1);
    this.p_env_punch = frnd(1);
    this.p_env_decay = frnd(0.9) + 0.1;
    this.p_arp_mod = [0, 0, 0, 0, -0.3162, 0.7454, 0.7454][rnd(6)];
    this.p_arp_speed = frnd(0.5) + 0.4;
    this.p_duty = frnd(1);
    this.p_duty_ramp = rnd(2) === 2 ? frnd(1) : 0;
    this.p_lpf_freq = [1, 0.9 * frnd(1) * frnd(1) + 0.1][rnd(1)];
    this.p_lpf_ramp = rndr(-1, 1);
    this.p_lpf_resonance = frnd(1);
    this.p_hpf_freq = rnd(3) === 3 ? frnd(1) : 0;
    this.p_hpf_ramp = rnd(3) === 3 ? frnd(1) : 0;
    
    return this;
  }

  tone(): this {
    this.wave_type = SINE;
    this.p_base_freq = 0.35173364; // 440 Hz
    this.p_env_attack = 0;
    this.p_env_sustain = 0.6641; // 1 sec
    this.p_env_decay = 0;
    this.p_env_punch = 0;
    
    return this;
  }

  click(): this {
    const base = ["explosion", "hitHurt"][rnd(1)] as "explosion" | "hitHurt";
    this[base]();
    
    if (rnd(1)) {
      this.p_freq_ramp = -0.5 + frnd(1.0);
    }
    
    if (rnd(1)) {
      this.p_env_sustain = (frnd(0.4) + 0.2) * this.p_env_sustain;
      this.p_env_decay = (frnd(0.4) + 0.2) * this.p_env_decay;
    }
    
    if (rnd(3) === 0) {
      this.p_env_attack = frnd(0.3);
    }
    
    this.p_base_freq = 1 - frnd(0.25);
    this.p_hpf_freq = 1 - frnd(0.1);
    
    return this;
  }

  random(): this {
    this.wave_type = rnd(3) as WaveType;
    
    if (rnd(1)) {
      this.p_base_freq = cube(frnd(2) - 1) + 0.5;
    } else {
      this.p_base_freq = sqr(frnd(1));
    }
    
    this.p_freq_limit = 0;
    this.p_freq_ramp = Math.pow(frnd(2) - 1, 5);
    
    if (this.p_base_freq > 0.7 && this.p_freq_ramp > 0.2) {
      this.p_freq_ramp = -this.p_freq_ramp;
    }
    
    if (this.p_base_freq < 0.2 && this.p_freq_ramp < -0.05) {
      this.p_freq_ramp = -this.p_freq_ramp;
    }
    
    this.p_freq_dramp = Math.pow(frnd(2) - 1, 3);
    this.p_duty = frnd(2) - 1;
    this.p_duty_ramp = Math.pow(frnd(2) - 1, 3);
    this.p_vib_strength = Math.pow(frnd(2) - 1, 3);
    this.p_vib_speed = rndr(-1, 1);
    this.p_env_attack = cube(rndr(-1, 1));
    this.p_env_sustain = sqr(rndr(-1, 1));
    this.p_env_decay = rndr(-1, 1);
    this.p_env_punch = Math.pow(frnd(0.8), 2);
    
    if (this.p_env_attack + this.p_env_sustain + this.p_env_decay < 0.2) {
      this.p_env_sustain += 0.2 + frnd(0.3);
      this.p_env_decay += 0.2 + frnd(0.3);
    }
    
    this.p_lpf_resonance = rndr(-1, 1);
    this.p_lpf_freq = 1 - Math.pow(frnd(1), 3);
    this.p_lpf_ramp = Math.pow(frnd(2) - 1, 3);
    
    if (this.p_lpf_freq < 0.1 && this.p_lpf_ramp < -0.05) {
      this.p_lpf_ramp = -this.p_lpf_ramp;
    }
    
    this.p_hpf_freq = Math.pow(frnd(1), 5);
    this.p_hpf_ramp = Math.pow(frnd(2) - 1, 5);
    this.p_pha_offset = Math.pow(frnd(2) - 1, 3);
    this.p_pha_ramp = Math.pow(frnd(2) - 1, 3);
    this.p_repeat_speed = frnd(2) - 1;
    this.p_arp_speed = frnd(2) - 1;
    this.p_arp_mod = frnd(2) - 1;
    
    return this;
  }

  mutate(): this {
    const mutateParam = (value: number): number => value + frnd(0.1) - 0.05;
    
    if (rnd(1)) this.p_base_freq = mutateParam(this.p_base_freq);
    if (rnd(1)) this.p_freq_ramp = mutateParam(this.p_freq_ramp);
    if (rnd(1)) this.p_freq_dramp = mutateParam(this.p_freq_dramp);
    if (rnd(1)) this.p_duty = mutateParam(this.p_duty);
    if (rnd(1)) this.p_duty_ramp = mutateParam(this.p_duty_ramp);
    if (rnd(1)) this.p_vib_strength = mutateParam(this.p_vib_strength);
    if (rnd(1)) this.p_vib_speed = mutateParam(this.p_vib_speed);
    if (rnd(1)) this.p_env_attack = mutateParam(this.p_env_attack);
    if (rnd(1)) this.p_env_sustain = mutateParam(this.p_env_sustain);
    if (rnd(1)) this.p_env_decay = mutateParam(this.p_env_decay);
    if (rnd(1)) this.p_env_punch = mutateParam(this.p_env_punch);
    if (rnd(1)) this.p_lpf_resonance = mutateParam(this.p_lpf_resonance);
    if (rnd(1)) this.p_lpf_freq = mutateParam(this.p_lpf_freq);
    if (rnd(1)) this.p_lpf_ramp = mutateParam(this.p_lpf_ramp);
    if (rnd(1)) this.p_hpf_freq = mutateParam(this.p_hpf_freq);
    if (rnd(1)) this.p_hpf_ramp = mutateParam(this.p_hpf_ramp);
    if (rnd(1)) this.p_pha_offset = mutateParam(this.p_pha_offset);
    if (rnd(1)) this.p_pha_ramp = mutateParam(this.p_pha_ramp);
    if (rnd(1)) this.p_repeat_speed = mutateParam(this.p_repeat_speed);
    if (rnd(1)) this.p_arp_speed = mutateParam(this.p_arp_speed);
    if (rnd(1)) this.p_arp_mod = mutateParam(this.p_arp_mod);
    
    return this;
  }
}

// Base58 decoding function
const b58decode = (b58encoded: string): Partial<SynthParameters> => {
  const decoded = base58DecodeRaw(b58encoded, b58alphabet);
  const result: any = {};
  
  for (let pi = 0; pi < paramsOrder.length; pi++) {
    const p = paramsOrder[pi];
    const offset = (pi - 1) * 4 + 1;
    
    if (p === "wave_type") {
      result[p] = decoded[0];
    } else {
      const val = (decoded[offset] | (decoded[offset + 1] << 8) | 
                   (decoded[offset + 2] << 16) | (decoded[offset + 3] << 24));
      result[p] = numberToFloat(val);
    }
  }
  
  return result;
};

const base58DecodeRaw = (s: string, alphabet: string): Uint8Array => {
  const d: number[] = [];
  const b: number[] = [];
  let i: number, j = 0, c: number, n: number;
  
  for (i = 0; i < s.length; i++) {
    j = 0;
    c = alphabet.indexOf(s[i]);
    if (c < 0) throw new Error('Invalid base58 character');
    
    if (c || b.length !== i) {
      // Continue processing
    } else {
      b.push(0);
    }
    
    while (j in d || c) {
      n = d[j] || 0;
      n = n ? n * 58 + c : c;
      c = n >> 8;
      d[j] = n % 256;
      j++;
    }
  }
  
  while (j-- > 0) {
    b.push(d[j]);
  }
  
  return new Uint8Array(b);
};

// Modernized SoundEffect class
export class SoundEffect {
  private parameters!: SynthParameters;
  private elapsedSinceRepeat = 0;
  private period = 0;
  private periodMax = 0;
  private enableFrequencyCutoff = false;
  private periodMult = 0;
  private periodMultSlide = 0;
  private dutyCycle = 0;
  private dutyCycleSlide = 0;
  private arpeggioMultiplier = 0;
  private arpeggioTime = 0;
  private waveShape: WaveType = SQUARE;
  
  // Filter variables
  private fltw = 0;
  private enableLowPassFilter = false;
  private fltw_d = 0;
  private fltdmp = 0;
  private flthp = 0;
  private flthp_d = 0;
  
  // Vibrato variables
  private vibratoSpeed = 0;
  private vibratoAmplitude = 0;
  
  // Envelope variables
  private envelopeLength: number[] = [];
  private envelopePunch = 0;
  
  // Phaser variables
  private flangerOffset = 0;
  private flangerOffsetSlide = 0;
  
  // Repeat variables
  private repeatTime = 0;
  
  // Volume and sample rate
  private gain = 0;
  public sampleRate = 44100;
  private bitsPerChannel = 8;

  constructor(params: SynthParameters | string) {
    if (typeof params === "string") {
      const p = new Params();
      if (params.startsWith("#")) {
        params = params.slice(1);
      }
      params = p.fromB58(params) as any;
    }
    
    this.init(params as SynthParameters);
  }

  private init(ps: SynthParameters): void {
    this.parameters = ps;
    this.initForRepeat();
    
    // Wave shape
    this.waveShape = ps.wave_type;
    
    // Filters
    this.fltw = Math.pow(ps.p_lpf_freq, 3) * 0.1;
    this.enableLowPassFilter = (ps.p_lpf_freq !== 1);
    this.fltw_d = 1 + ps.p_lpf_ramp * 0.0001;
    this.fltdmp = 5 / (1 + Math.pow(ps.p_lpf_resonance, 2) * 20) * (0.01 + this.fltw);
    if (this.fltdmp > 0.8) this.fltdmp = 0.8;
    this.flthp = Math.pow(ps.p_hpf_freq, 2) * 0.1;
    this.flthp_d = 1 + ps.p_hpf_ramp * 0.0003;
    
    // Vibrato
    this.vibratoSpeed = Math.pow(ps.p_vib_speed, 2) * 0.01;
    this.vibratoAmplitude = ps.p_vib_strength * 0.5;
    
    // Envelope
    this.envelopeLength = [
      Math.floor(ps.p_env_attack * ps.p_env_attack * 100000),
      Math.floor(ps.p_env_sustain * ps.p_env_sustain * 100000),
      Math.floor(ps.p_env_decay * ps.p_env_decay * 100000)
    ];
    this.envelopePunch = ps.p_env_punch;
    
    // Phaser
    this.flangerOffset = Math.pow(ps.p_pha_offset, 2) * 1020;
    if (ps.p_pha_offset < 0) this.flangerOffset = -this.flangerOffset;
    this.flangerOffsetSlide = Math.pow(ps.p_pha_ramp, 2) * 1;
    if (ps.p_pha_ramp < 0) this.flangerOffsetSlide = -this.flangerOffsetSlide;
    
    // Repeat
    this.repeatTime = Math.floor(Math.pow(1 - ps.p_repeat_speed, 2) * 20000 + 32);
    if (ps.p_repeat_speed === 0) {
      this.repeatTime = 0;
    }
    
    this.gain = Math.exp(ps.sound_vol) - 1;
    this.sampleRate = ps.sample_rate;
    this.bitsPerChannel = ps.sample_size;
  }

  private initForRepeat(): void {
    const ps = this.parameters;
    this.elapsedSinceRepeat = 0;
    
    this.period = 100 / (ps.p_base_freq * ps.p_base_freq + 0.001);
    this.periodMax = 100 / (ps.p_freq_limit * ps.p_freq_limit + 0.001);
    this.enableFrequencyCutoff = (ps.p_freq_limit > 0);
    this.periodMult = 1 - Math.pow(ps.p_freq_ramp, 3) * 0.01;
    this.periodMultSlide = -Math.pow(ps.p_freq_dramp, 3) * 0.000001;
    
    this.dutyCycle = 0.5 - ps.p_duty * 0.5;
    this.dutyCycleSlide = -ps.p_duty_ramp * 0.00005;
    
    if (ps.p_arp_mod >= 0) {
      this.arpeggioMultiplier = 1 - Math.pow(ps.p_arp_mod, 2) * 0.9;
    } else {
      this.arpeggioMultiplier = 1 + Math.pow(ps.p_arp_mod, 2) * 10;
    }
    
    this.arpeggioTime = Math.floor(Math.pow(1 - ps.p_arp_speed, 2) * 20000 + 32);
    if (ps.p_arp_speed === 1) {
      this.arpeggioTime = 0;
    }
  }

  getRawBuffer(): RenderResult {
    let fltp = 0;
    let fltdp = 0;
    let fltphp = 0;
    
    const noiseBuffer = new Array<number>(32);
    for (let i = 0; i < 32; ++i) {
      noiseBuffer[i] = Math.random() * 2 - 1;
    }
    
    let envelopeStage = 0;
    let envelopeElapsed = 0;
    let vibratoPhase = 0;
    let phase = 0;
    let ipp = 0;
    
    const flangerBuffer = new Array<number>(1024);
    flangerBuffer.fill(0);
    
    let numClipped = 0;
    const buffer: number[] = [];
    const normalized: number[] = [];
    
    let sampleSum = 0;
    let numSummed = 0;
    const summands = Math.floor(44100 / this.sampleRate);
    
    for (let t = 0; ; ++t) {
      // Repeat handling
      if (this.repeatTime !== 0 && ++this.elapsedSinceRepeat >= this.repeatTime) {
        this.initForRepeat();
      }
      
      // Arpeggio handling
      if (this.arpeggioTime !== 0 && t >= this.arpeggioTime) {
        this.arpeggioTime = 0;
        this.period *= this.arpeggioMultiplier;
      }
      
      // Frequency sliding
      this.periodMult += this.periodMultSlide;
      this.period *= this.periodMult;
      
      if (this.period > this.periodMax) {
        this.period = this.periodMax;
        if (this.enableFrequencyCutoff) {
          break;
        }
      }
      
      // Vibrato
      let rfperiod = this.period;
      if (this.vibratoAmplitude > 0) {
        vibratoPhase += this.vibratoSpeed;
        rfperiod = this.period * (1 + Math.sin(vibratoPhase) * this.vibratoAmplitude);
      }
      
      let iperiod = Math.floor(rfperiod);
      if (iperiod < OVERSAMPLING) iperiod = OVERSAMPLING;
      
      // Square wave duty cycle
      this.dutyCycle += this.dutyCycleSlide;
      if (this.dutyCycle < 0) this.dutyCycle = 0;
      if (this.dutyCycle > 0.5) this.dutyCycle = 0.5;
      
      // Volume envelope
      if (++envelopeElapsed > this.envelopeLength[envelopeStage]) {
        envelopeElapsed = 0;
        if (++envelopeStage > 2) {
          break;
        }
      }
      
      let envVol: number;
      const envf = envelopeElapsed / this.envelopeLength[envelopeStage];
      
      if (envelopeStage === 0) { // Attack
        envVol = envf;
      } else if (envelopeStage === 1) { // Sustain
        envVol = 1 + (1 - envf) * 2 * this.envelopePunch;
      } else { // Decay
        envVol = 1 - envf;
      }
      
      // Phaser step
      this.flangerOffset += this.flangerOffsetSlide;
      let iphase = Math.abs(Math.floor(this.flangerOffset));
      if (iphase > 1023) iphase = 1023;
      
      if (this.flthp_d !== 0) {
        this.flthp *= this.flthp_d;
        if (this.flthp < 0.00001) this.flthp = 0.00001;
        if (this.flthp > 0.1) this.flthp = 0.1;
      }
      
      // 8x oversampling
      let sample = 0;
      for (let si = 0; si < OVERSAMPLING; ++si) {
        let subSample = 0;
        phase++;
        
        if (phase >= iperiod) {
          phase %= iperiod;
          if (this.waveShape === NOISE) {
            for (let i = 0; i < 32; ++i) {
              noiseBuffer[i] = Math.random() * 2 - 1;
            }
          }
        }
        
        // Base waveform
        const fp = phase / iperiod;
        
        if (this.waveShape === SQUARE) {
          if (fp < this.dutyCycle) {
            subSample = 0.5;
          } else {
            subSample = -0.5;
          }
        } else if (this.waveShape === SAWTOOTH) {
          if (fp < this.dutyCycle) {
            subSample = -1 + 2 * fp / this.dutyCycle;
          } else {
            subSample = 1 - 2 * (fp - this.dutyCycle) / (1 - this.dutyCycle);
          }
        } else if (this.waveShape === SINE) {
          subSample = Math.sin(fp * 2 * Math.PI);
        } else if (this.waveShape === NOISE) {
          subSample = noiseBuffer[Math.floor(phase * 32 / iperiod)];
        } else {
          throw new Error(`ERROR: Bad wave type: ${this.waveShape}`);
        }
        
        // Low-pass filter
        const pp = fltp;
        this.fltw *= this.fltw_d;
        if (this.fltw < 0) this.fltw = 0;
        if (this.fltw > 0.1) this.fltw = 0.1;
        
        if (this.enableLowPassFilter) {
          fltdp += (subSample - fltp) * this.fltw;
          fltdp -= fltdp * this.fltdmp;
        } else {
          fltp = subSample;
          fltdp = 0;
        }
        fltp += fltdp;
        
        // High-pass filter
        fltphp += fltp - pp;
        fltphp -= fltphp * this.flthp;
        subSample = fltphp;
        
        // Phaser
        flangerBuffer[ipp & 1023] = subSample;
        subSample += flangerBuffer[(ipp - iphase + 1024) & 1023];
        ipp = (ipp + 1) & 1023;
        
        // Final accumulation and envelope application
        sample += subSample * envVol;
      }
      
      // Accumulate samples appropriately for sample rate
      sampleSum += sample;
      if (++numSummed >= summands) {
        numSummed = 0;
        sample = sampleSum / summands;
        sampleSum = 0;
      } else {
        continue;
      }
      
      sample = sample / OVERSAMPLING * masterVolume;
      sample *= this.gain;
      
      // Store raw normalized float samples
      normalized.push(sample);
      
      if (this.bitsPerChannel === 8) {
        // Rescale [-1, 1) to [0, 256)
        sample = Math.floor((sample + 1) * 128);
        if (sample > 255) {
          sample = 255;
          ++numClipped;
        } else if (sample < 0) {
          sample = 0;
          ++numClipped;
        }
        buffer.push(sample);
      } else {
        // Rescale [-1, 1) to [-32768, 32768)
        sample = Math.floor(sample * (1 << 15));
        if (sample >= (1 << 15)) {
          sample = (1 << 15) - 1;
          ++numClipped;
        } else if (sample < -(1 << 15)) {
          sample = -(1 << 15);
          ++numClipped;
        }
        buffer.push(sample & 0xFF);
        buffer.push((sample >> 8) & 0xFF);
      }
    }
    
    return {
      buffer,
      normalized,
      clipped: numClipped
    };
  }

  generate(): ExtendedRiffWave {
    const rendered = this.getRawBuffer();
    const wave = new RiffWave() as ExtendedRiffWave;
    wave.header.sampleRate = this.sampleRate;
    wave.header.bitsPerSample = this.bitsPerChannel;
    wave.Make(rendered.buffer);
    wave.clipping = rendered.clipped;
    wave.buffer = rendered.normalized;
    wave.getAudio = getAudioFunction(wave);
    return wave;
  }
}

// Audio context management
let audioContext: AudioContext | null = null;

const getAudioFunction = (wave: ExtendedRiffWave) => {
  return (): AudioSource | HTMLAudioElement => {
    // Check for programmatic audio
    if (!audioContext) {
      if (typeof AudioContext !== 'undefined') {
        audioContext = new AudioContext();
      } else if (typeof (window as any).webkitAudioContext !== 'undefined') {
        audioContext = new (window as any).webkitAudioContext();
      }
    }
    
    if (audioContext && wave.buffer) {
      const buff = audioContext.createBuffer(1, wave.buffer.length, wave.header.sampleRate);
      const nowBuffering = buff.getChannelData(0);
      
      for (let i = 0; i < wave.buffer.length; i++) {
        nowBuffering[i] = wave.buffer[i];
      }
      
      let volume = 1.0;
      
      const audioSource: AudioSource = {
        channels: [],
        setVolume: (v: number) => {
          volume = v;
          return audioSource;
        },
        play: () => {
          const proc = audioContext!.createBufferSource();
          proc.buffer = buff;
          const gainNode = audioContext!.createGain();
          gainNode.gain.value = volume;
          gainNode.connect(audioContext!.destination);
          proc.connect(gainNode);
          
          if (proc.start) {
            proc.start();
          } else if ((proc as any).noteOn) {
            (proc as any).noteOn(0);
          }
          
          audioSource.channels.push(proc);
          return proc;
        }
      };
      
      return audioSource;
    } else {
      const audio = new Audio();
      audio.src = wave.dataURI;
      return audio;
    }
  };
};

// Simplified namespace functional API
export const sfxr = {
  toBuffer: (synthdef: SynthParameters): number[] => {
    return new SoundEffect(synthdef).getRawBuffer().buffer;
  },

  toWebAudio: (synthdef: SynthParameters, audiocontext?: AudioContext): AudioBufferSourceNode | undefined => {
    const sfx = new SoundEffect(synthdef);
    const buffer = sfx.getRawBuffer().normalized;
    
    if (audiocontext) {
      const buff = audiocontext.createBuffer(1, buffer.length, sfx.sampleRate);
      const nowBuffering = buff.getChannelData(0);
      
      for (let i = 0; i < buffer.length; i++) {
        nowBuffering[i] = buffer[i];
      }
      
      const proc = audiocontext.createBufferSource();
      proc.buffer = buff;
      return proc;
    }
  },

  toWave: (synthdef: SynthParameters) => {
    return new SoundEffect(synthdef).generate();
  },

  toAudio: (synthdef: SynthParameters) => {
    return sfxr.toWave(synthdef).getAudio!();
  },

  play: (synthdef: SynthParameters) => {
    return sfxr.toAudio(synthdef).play();
  },

  b58decode,

  b58encode: (synthdef: Partial<SynthParameters>): string => {
    const p = new Params();
    p.fromJSON(synthdef);
    return p.toB58();
  },

  generate: (algorithm: string, options?: { sound_vol?: number; sample_rate?: number; sample_size?: number }): Params => {
    const p = new Params();
    const opts = options || {};
    
    p.sound_vol = opts.sound_vol || 0.25;
    p.sample_rate = opts.sample_rate || 44100;
    p.sample_size = opts.sample_size || 8;
    
    return (p as any)[algorithm]();
  }
};

// Slider transformation functions
export const sliders = {
  p_env_attack: (v: number): number => v * v * 100000.0,
  p_env_sustain: (v: number): number => v * v * 100000.0,
  p_env_punch: (v: number): number => v,
  p_env_decay: (v: number): number => v * v * 100000.0,
  p_base_freq: (v: number): number => 8 * 44100 * (v * v + 0.001) / 100,
  p_freq_limit: (v: number): number => 8 * 44100 * (v * v + 0.001) / 100,
  p_freq_ramp: (v: number): number => 1.0 - Math.pow(v, 3.0) * 0.01,
  p_freq_dramp: (v: number): number => -Math.pow(v, 3.0) * 0.000001,
  p_vib_speed: (v: number): number => Math.pow(v, 2.0) * 0.01,
  p_vib_strength: (v: number): number => v * 0.5,
  p_arp_mod: (v: number): number => v >= 0 ? 1.0 - Math.pow(v, 2) * 0.9 : 1.0 + Math.pow(v, 2) * 10,
  p_arp_speed: (v: number): number => (v === 1.0) ? 0 : Math.floor(Math.pow(1.0 - v, 2.0) * 20000 + 32),
  p_duty: (v: number): number => 0.5 - v * 0.5,
  p_duty_ramp: (v: number): number => -v * 0.00005,
  p_repeat_speed: (v: number): number => (v === 0) ? 0 : Math.floor(Math.pow(1 - v, 2) * 20000) + 32,
  p_pha_offset: (v: number): number => (v < 0 ? -1 : 1) * Math.pow(v, 2) * 1020,
  p_pha_ramp: (v: number): number => (v < 0 ? -1 : 1) * Math.pow(v, 2),
  p_lpf_freq: (v: number): number => Math.pow(v, 3) * 0.1,
  p_lpf_ramp: (v: number): number => 1.0 + v * 0.0001,
  p_lpf_resonance: (v: number): number => 5.0 / (1.0 + Math.pow(v, 2) * 20),
  p_hpf_freq: (v: number): number => Math.pow(v, 2) * 0.1,
  p_hpf_ramp: (v: number): number => 1.0 + v * 0.0003,
  sound_vol: (v: number): number => Math.exp(v) - 1
};

// Inverse slider transformation functions
export const slidersInverse = {
  p_env_attack: (v: number): number => Math.sqrt(v / 100000.0),
  p_env_sustain: (v: number): number => Math.sqrt(v / 100000.0),
  p_env_punch: (v: number): number => v,
  p_env_decay: (v: number): number => Math.sqrt(v / 100000.0),
  p_base_freq: (v: number): number => Math.sqrt(v * 100 / 8 / 44100 - 0.001),
  p_freq_limit: (v: number): number => Math.sqrt(v * 100 / 8 / 44100 - 0.001),
  p_freq_ramp: (v: number): number => Math.cbrt((1.0 - v) / 0.01),
  p_freq_dramp: (v: number): number => Math.cbrt(v / -0.000001),
  p_vib_speed: (v: number): number => Math.sqrt(v / 0.01),
  p_vib_strength: (v: number): number => v / 0.5,
  p_arp_mod: (v: number): number => v < 1 ? Math.sqrt((1.0 - v) / 0.9) : -Math.sqrt((v - 1.0) / 10.0),
  p_arp_speed: (v: number): number => (v === 0) ? 1.0 : (1.0 - Math.sqrt((v - (v < 100 ? 30 : 32)) / 20000)),
  p_duty: (v: number): number => (v - 0.5) / -0.5,
  p_duty_ramp: (v: number): number => v / -0.00005,
  p_repeat_speed: (v: number): number => v === 0 ? 0 : -(Math.sqrt((v - 32) / 20000) - 1.0),
  p_pha_offset: (v: number): number => (v < 0 ? -1 : 1) * Math.sqrt(Math.abs(v) / 1020),
  p_pha_ramp: (v: number): number => (v < 0 ? -1 : 1) * Math.sqrt(Math.abs(v)),
  p_lpf_freq: (v: number): number => Math.cbrt(v / 0.1),
  p_lpf_ramp: (v: number): number => (v - 1.0) / 0.0001,
  p_lpf_resonance: (v: number): number => Math.sqrt((1.0 / (v / 5.0) - 1) / 20),
  p_hpf_freq: (v: number): number => Math.sqrt(v / 0.1),
  p_hpf_ramp: (v: number): number => (v - 1.0) / 0.0003,
  sound_vol: (v: number): number => Math.log(v + 1)
};

// Export constants and types
export { masterVolume, paramsOrder, paramsSigned };

// Function to set master volume
export const setMasterVolume = (volume: number): void => {
  masterVolume = Math.max(0, Math.min(1, volume));
};

// Function to get master volume
export const getMasterVolume = (): number => masterVolume;

// Default export
export default {
  sfxr,
  Params,
  SoundEffect,
  SQUARE,
  SAWTOOTH,
  SINE,
  NOISE,
  sliders,
  slidersInverse,
  setMasterVolume,
  getMasterVolume
};