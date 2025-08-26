# SFXR.JS - 8-bit Sound Effects Generator

[![NPM Version](https://img.shields.io/npm/v/sfxr.js.svg)](https://www.npmjs.com/package/sfxr.js)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-Public%20Domain-brightgreen.svg)](./UNLICENSE)

A modern TypeScript port of the classic **sfxr** 8-bit sound effects generator. Generate retro game sound effects programmatically with a clean, type-safe API.

## ✨ Features

- 🎵 **Modern TypeScript**: Full type safety and modern ES6+ syntax
- 🚀 **Bun Runtime**: Fast development and testing with Bun
- 🎮 **Classic Presets**: Built-in sound presets (coin, laser, explosion, etc.)
- 🔧 **Highly Configurable**: Fine-tune every aspect of sound generation
- 📦 **Multiple Formats**: Export as WAV, JSON, or Base58-encoded strings
- 🖥️ **CLI Tool**: Command-line interface for batch processing
- 🌐 **Universal**: Works in Node.js, browsers, and Bun environments
- 📊 **Web Audio API**: Native browser audio playback support

## 📦 Installation

### Using npm/yarn/pnpm

```bash
npm install sfxr.js
# or
yarn add sfxr.js
# or  
pnpm add sfxr.js
```

### Using Bun

```bash
bun add sfxr.js
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { Params, SoundEffect } from 'sfxr.js';

// Generate a coin pickup sound
const params = new Params();
params.pickupCoin();

// Create and play the sound effect
const soundEffect = new SoundEffect(params);
const audioData = soundEffect.generate();

// In browser environments, you can play it directly
const audio = audioData.getAudio();
audio.play();
```

### Available Presets

```typescript
import { Params } from 'sfxr.js';

const params = new Params();

// Choose from these classic presets:
params.pickupCoin();    // Coin collection sound
params.laserShoot();    // Laser/shoot sound  
params.explosion();     // Explosion sound
params.powerUp();       // Power-up sound
params.hitHurt();       // Hit/hurt sound
params.jump();          // Jump sound
params.blipSelect();    // Menu selection sound
params.synth();         // Synth pad sound
params.tone();          // Pure tone (440Hz)
```

### Parameter Serialization

```typescript
import { Params } from 'sfxr.js';

const params = new Params();
params.explosion();

// Serialize to Base58 (compact format)
const b58String = params.toB58();
console.log(b58String); // "34T6Pkwc12HjE..."

// Serialize to JSON (human-readable)
const jsonData = JSON.stringify(params);

// Deserialize from either format
const newParams = new Params();
newParams.fromB58(b58String);
// or
newParams.fromJSON(JSON.parse(jsonData));
```

## 🎛️ Advanced Configuration

### Custom Sound Parameters

```typescript
import { Params, SoundEffect, SQUARE, SINE } from 'sfxr.js';

const params = new Params();

// Customize wave properties
params.wave_type = SQUARE;           // Wave shape
params.p_base_freq = 0.3;           // Base frequency
params.p_freq_ramp = -0.1;          // Frequency slide

// Envelope settings  
params.p_env_attack = 0.1;          // Attack time
params.p_env_sustain = 0.3;         // Sustain time
params.p_env_decay = 0.4;           // Decay time

// Effects
params.p_vib_strength = 0.2;        // Vibrato depth
params.p_vib_speed = 0.1;           // Vibrato speed
params.p_lpf_freq = 0.8;            // Low-pass filter

// Generate the sound
const soundEffect = new SoundEffect(params);
const result = soundEffect.generate();
```

### Export to WAV File

```typescript
import { writeFile } from 'fs/promises';

// Generate sound data
const result = soundEffect.generate(); 

// Parse the data URI to get raw WAV data
const base64Data = result.dataURI.split(',')[1];
const wavBuffer = Buffer.from(base64Data, 'base64');

// Save to file
await writeFile('sound.wav', wavBuffer);
```

## 🖥️ Command Line Interface

The package includes a CLI tool for converting sound definitions to WAV files:

### Install CLI globally

```bash
npm install -g sfxr.js
```

### CLI Usage

```bash
# Generate from Base58-encoded definition
sfxr-to-wav "34T6Pkwc12HjEUkchGGt..." output.wav

# Generate from JSON file
cat sound-definition.json | sfxr-to-wav sound.wav

# Get help
sfxr-to-wav --help
```

### CLI Examples

```bash
# Create a coin sound
echo '{"wave_type":1,"p_base_freq":0.4}' | sfxr-to-wav coin.wav

# Batch process multiple sounds
for preset in pickupCoin laserShoot explosion; do
  echo "Generating ${preset}..."
  sfxr-to-wav "${preset}_definition" "${preset}.wav"
done
```

## 🌐 Browser Usage

### ES Modules

```html
<script type="module">
import { Params, SoundEffect } from './node_modules/sfxr.js/dist/index.js';

const params = new Params();
params.pickupCoin();

const sound = new SoundEffect(params).generate();
sound.getAudio().play();
</script>
```

### With Build Tools

```typescript
// Works with Webpack, Vite, Rollup, etc.
import { Params, SoundEffect } from 'sfxr.js';

document.getElementById('play-button').addEventListener('click', () => {
  const params = new Params();
  params.blipSelect();
  
  const sound = new SoundEffect(params).generate();
  sound.getAudio().play();
});
```

## 🔧 Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0.0
- Node.js >= 18.0.0 (for npm compatibility)

### Setup

```bash
git clone https://github.com/neyric/sfxr.js.git
cd sfxr.js
bun install
```

### Available Scripts

```bash
bun run build          # Build the project  
bun run test           # Run tests
bun run typecheck      # Type checking
bun run dev            # Development mode with file watching
bun run sfxr-to-wav    # Run CLI tool directly
```

### Project Structure

```
src/
├── index.ts           # Main entry point
├── sfxr.ts           # Core sound generation logic  
├── riffwave.ts       # WAV file generation
└── cli.ts            # Command-line interface

test/
└── index.test.ts     # Test suite

dist/                 # Built output
├── index.js          # Compiled JavaScript
├── index.d.ts        # TypeScript definitions
└── ...
```

## 📖 API Reference

### Classes

#### `Params`
Main parameter container for sound generation.

```typescript
class Params {
  // Wave properties
  wave_type: WaveType;          // 0=square, 1=sawtooth, 2=sine, 3=noise
  p_base_freq: number;          // Base frequency (0-1)
  p_freq_ramp: number;          // Frequency slide (-1 to 1)
  
  // Envelope
  p_env_attack: number;         // Attack time (0-1)  
  p_env_sustain: number;        // Sustain time (0-1)
  p_env_decay: number;          // Decay time (0-1)
  
  // Methods
  pickupCoin(): this;           // Generate coin sound
  laserShoot(): this;           // Generate laser sound
  explosion(): this;            // Generate explosion sound
  // ... more presets
  
  toB58(): string;              // Serialize to Base58
  fromB58(data: string): this;  // Deserialize from Base58
  fromJSON(data: object): this; // Deserialize from JSON
}
```

#### `SoundEffect`
Renders audio from parameters.

```typescript
class SoundEffect {
  constructor(params: Params | string);
  generate(): ExtendedRiffWave;     // Generate WAV data
}
```

#### `RiffWave`  
WAV file container and generator.

```typescript
class RiffWave {
  constructor(data?: number[]);
  Make(data: number[]): void;       // Generate WAV from samples
  data: number[];                   // Raw sample data
  wav: number[];                    // Complete WAV file bytes
  dataURI: string;                  // Base64 data URI
}
```

### Constants

```typescript
export const SQUARE = 0;    // Square wave
export const SAWTOOTH = 1;  // Sawtooth wave  
export const SINE = 2;      // Sine wave
export const NOISE = 3;     // Noise
```

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`  
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Coding Standards

- Use **TypeScript** with strict typing
- Follow **modern ES6+** syntax
- Write **comprehensive tests** for new features
- Maintain **100% test coverage** for critical paths
- Use **descriptive commit messages**

### Running Tests

```bash
bun test                    # Run all tests
bun run typecheck          # Type checking  
bun run build              # Verify build passes
```

## 📈 Performance

SFXR.JS is optimized for both development and runtime performance:

- **Fast builds** with Bun (15ms typical build time)
- **Zero-dependency runtime** (only dev dependencies)
- **Tree-shakeable** ES modules
- **Efficient audio generation** with 8x oversampling
- **Memory efficient** sample processing

## 🔗 Related Projects

- **[sfxr](http://www.drpetter.se/project_sfxr.html)** - Original C++ version by Dr. Petter
- **[sfxr.me](https://sfxr.me/)** - Web interface for sound generation  
- **[jsfxr-pro](https://pro.sfxr.me/)** - Pro version with enhanced features

## 📜 License

This project is in the **Public Domain**. See [UNLICENSE](./UNLICENSE) for details.

## 🙏 Acknowledgments

- **Dr. Petter** - Creator of the original sfxr
- **Eric Fredricksen** - JavaScript port author  
- **Thomas Vian** - Original JavaScript improvements
- **Chris McCormick** - Maintenance and enhancements
- **Pedro Ladaria** - RiffWave implementation

---

**Made with ❤️ for retro game developers**