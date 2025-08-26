#!/usr/bin/env bun

/**
 * sfxr-to-wav - Command line tool to convert sfxr definitions to WAV files
 * Modern TypeScript version using async/await and fs/promises
 */

import { Params, SoundEffect } from './index';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import process from 'process';

interface CliOptions {
  outputFile: string;
  synthDefinition?: string;
  parameters?: Params;
  helpRequested: boolean;
}

const DEFAULT_OUTPUT = "sfxr-sound.wav";

const showHelp = (): void => {
  console.log("Usage: sfxr-to-wav SYNTH-DEFINITION [FILENAME.wav]");
  console.log("       echo 'JSON-DEFINITION' | sfxr-to-wav [FILENAME.wav]");
  console.log("");
  console.log("Arguments:");
  console.log("  SYNTH-DEFINITION  Base58 encoded synth definition (from sfxr.me share URL)");
  console.log("  FILENAME.wav      Output WAV file name (optional)");
  console.log("");
  console.log("Examples:");
  console.log("  sfxr-to-wav 57uUUUUmNNrvbGNNjE2vdG9zbzUzWxcTXByR shot.wav");
  console.log("  echo '{\"wave_type\":0,...}' | sfxr-to-wav mysound.wav");
  console.log("");
  console.log("Options:");
  console.log("  -h, --help        Show this help message");
};

const parseArguments = (args: string[]): CliOptions => {
  const options: CliOptions = {
    outputFile: DEFAULT_OUTPUT,
    helpRequested: false
  };

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "-h" || arg === "--help") {
      options.helpRequested = true;
      return options;
    }
    
    if (arg.endsWith(".wav")) {
      options.outputFile = arg;
    } else {
      // This should be the synth definition
      options.synthDefinition = arg;
      if (options.outputFile === DEFAULT_OUTPUT) {
        options.outputFile = `${arg}.wav`;
      }
    }
  }

  return options;
};

const readStdinAsJson = async (): Promise<any> => {
  return new Promise((resolve, reject) => {
    let data = '';
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      try {
        const parsed = JSON.parse(data.trim());
        resolve(parsed);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        reject(new Error(`Failed to parse JSON from stdin: ${errorMessage}`));
      }
    });
    
    process.stdin.on('error', reject);
  });
};

const generateWavFromParams = (params: Params): Buffer => {
  const soundEffect = new SoundEffect(params);
  const sound = soundEffect.generate();
  
  // Parse data URI
  const regex = /^data:.+\/(.+);base64,(.*)$/;
  const matches = sound.dataURI.match(regex);
  
  if (!matches || matches.length < 3) {
    throw new Error("Failed to parse generated sound data URI");
  }
  
  const [, extension, base64Data] = matches;
  
  if (extension !== 'wav') {
    throw new Error(`Expected WAV format but got ${extension}`);
  }
  
  return Buffer.from(base64Data, 'base64');
};

const main = async (): Promise<void> => {
  try {
    const options = parseArguments(process.argv);
    
    if (options.helpRequested) {
      showHelp();
      process.exit(0);
    }
    
    // Set default parameters
    const parameters = new Params();
    parameters.sound_vol = 0.25;
    parameters.sample_rate = 44100;
    parameters.sample_size = 8;
    
    // Determine parameter source
    if (options.synthDefinition) {
      // Get Base58-encoded synth definition from command line arguments
      console.log(`Decoding synth definition: ${options.synthDefinition}`);
      parameters.fromB58(options.synthDefinition);
    } else {
      // Read JSON format parameters from stdin
      console.log("Reading JSON parameters from stdin...");
      
      // Check if stdin is a terminal (user has no piped input)
      if (process.stdin.isTTY) {
        console.error("Error: No synth definition provided and no data piped to stdin.");
        console.error("Use -h for help.");
        process.exit(1);
      }
      
      const jsonData = await readStdinAsJson();
      parameters.fromJSON(jsonData);
    }
    
    console.log(`Generating sound with sample rate: ${parameters.sample_rate}Hz, bits: ${parameters.sample_size}`);
    
    // Generate audio data
    const wavBuffer = generateWavFromParams(parameters);
    
    // Write to file
    await writeFile(options.outputFile, wavBuffer);
    
    console.log(`✅ WAV file successfully written to: ${options.outputFile}`);
    console.log(`📊 File size: ${(wavBuffer.length / 1024).toFixed(1)} KB`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error: ${errorMessage}`);
    process.exit(1);
  }
};

// Run main function
if (import.meta.main) {
  main().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Unhandled error: ${errorMessage}`);
    process.exit(1);
  });
}