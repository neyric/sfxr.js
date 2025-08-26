/**
 * RIFFWAVE.ts - Audio encoder for HTML5 <audio> elements (TypeScript port)
 * Original: Copyleft 2011 by Pedro Ladaria <pedro.ladaria at Gmail dot com>
 * TypeScript port: Modern rewrite with proper typing
 * 
 * Public Domain
 * 
 * Notes:
 * - 8 bit data is unsigned: 0..255
 * - 16 bit data is signed: -32,768..32,767
 */

interface FastBase64 {
  chars: string;
  encLookup: string[];
  Init(): void;
  Encode(src: number[]): string;
}

const FastBase64: FastBase64 = {
  chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
  encLookup: [],

  Init(): void {
    for (let i = 0; i < 4096; i++) {
      this.encLookup[i] = this.chars[i >> 6] + this.chars[i & 0x3F];
    }
  },

  Encode(src: number[]): string {
    let len = src.length;
    let dst = '';
    let i = 0;
    let n: number;
    
    while (len > 2) {
      n = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
      dst += this.encLookup[n >> 12] + this.encLookup[n & 0xFFF];
      len -= 3;
      i += 3;
    }
    
    if (len > 0) {
      const n1 = (src[i] & 0xFC) >> 2;
      let n2 = (src[i] & 0x03) << 4;
      if (len > 1) n2 |= (src[++i] & 0xF0) >> 4;
      dst += this.chars[n1];
      dst += this.chars[n2];
      
      if (len == 2) {
        let n3 = (src[i++] & 0x0F) << 2;
        n3 |= (src[i] & 0xC0) >> 6;
        dst += this.chars[n3];
      }
      
      if (len == 1) dst += '=';
      dst += '=';
    }
    
    return dst;
  }
};

FastBase64.Init();

interface RiffWaveHeader {
  chunkId: number[];
  chunkSize: number;
  format: number[];
  subChunk1Id: number[];
  subChunk1Size: number;
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  subChunk2Id: number[];
  subChunk2Size: number;
}

export class RiffWave {
  public data: number[] = [];
  public wav: number[] = [];
  public dataURI: string = '';
  public header: RiffWaveHeader;

  constructor(data?: number[]) {
    this.header = {
      chunkId: [0x52, 0x49, 0x46, 0x46], // "RIFF"
      chunkSize: 0,                       // 36+SubChunk2Size
      format: [0x57, 0x41, 0x56, 0x45],  // "WAVE"
      subChunk1Id: [0x66, 0x6d, 0x74, 0x20], // "fmt "
      subChunk1Size: 16,                  // 16 for PCM
      audioFormat: 1,                     // PCM = 1
      numChannels: 1,                     // Mono = 1, Stereo = 2
      sampleRate: 8000,                   // 8000, 44100...
      byteRate: 0,                        // SampleRate*NumChannels*BitsPerSample/8
      blockAlign: 0,                      // NumChannels*BitsPerSample/8
      bitsPerSample: 8,                   // 8 bits = 8, 16 bits = 16
      subChunk2Id: [0x64, 0x61, 0x74, 0x61], // "data"
      subChunk2Size: 0                    // data size
    };

    if (data) {
      this.Make(data);
    }
  }

  private u32ToArray(i: number): number[] {
    return [i & 0xFF, (i >> 8) & 0xFF, (i >> 16) & 0xFF, (i >> 24) & 0xFF];
  }

  private u16ToArray(i: number): number[] {
    return [i & 0xFF, (i >> 8) & 0xFF];
  }

  private split16bitArray(data: number[]): number[] {
    const r: number[] = [];
    let j = 0;
    const len = data.length;
    
    for (let i = 0; i < len; i++) {
      r[j++] = data[i] & 0xFF;
      r[j++] = (data[i] >> 8) & 0xFF;
    }
    
    return r;
  }

  public Make(data: number[]): void {
    this.data = data;
    this.header.byteRate = (this.header.sampleRate * this.header.numChannels * this.header.bitsPerSample) >> 3;
    this.header.blockAlign = (this.header.numChannels * this.header.bitsPerSample) >> 3;
    this.header.subChunk2Size = this.data.length;
    this.header.chunkSize = 36 + this.header.subChunk2Size;

    this.wav = this.header.chunkId.concat(
      this.u32ToArray(this.header.chunkSize),
      this.header.format,
      this.header.subChunk1Id,
      this.u32ToArray(this.header.subChunk1Size),
      this.u16ToArray(this.header.audioFormat),
      this.u16ToArray(this.header.numChannels),
      this.u32ToArray(this.header.sampleRate),
      this.u32ToArray(this.header.byteRate),
      this.u16ToArray(this.header.blockAlign),
      this.u16ToArray(this.header.bitsPerSample),
      this.header.subChunk2Id,
      this.u32ToArray(this.header.subChunk2Size),
      this.data
    );
    
    this.dataURI = 'data:audio/wav;base64,' + FastBase64.Encode(this.wav);
  }
}

// For backward compatibility
export const RIFFWAVE = RiffWave;
export default RiffWave;