import { test, expect } from "bun:test";
import { Params, SoundEffect, RiffWave, SQUARE, SAWTOOTH, SINE, NOISE } from "../src/index";

test("Params class initialization", () => {
  const params = new Params();
  expect(params).toBeDefined();
  expect(params.wave_type).toBe(SQUARE);
  expect(params.p_env_sustain).toBe(0.3);
  expect(params.p_env_decay).toBe(0.4);
});

test("Preset sound generation", () => {
  const params = new Params();
  
  // Test coin sound effect
  params.pickupCoin();
  expect(params.p_base_freq).toBeGreaterThan(0);
  
  // Test laser sound effect
  params.laserShoot();
  expect(params.wave_type).toBeDefined();
  
  // Test explosion sound effect
  params.explosion();
  expect(params.p_env_attack).toBeDefined();
});

test("Sound synthesis", () => {
  const params = new Params();
  params.pickupCoin();
  
  const soundEffect = new SoundEffect(params);
  const result = soundEffect.generate();
  
  expect(result).toBeDefined();
  expect(result.data).toBeInstanceOf(Array);
  expect(result.data.length).toBeGreaterThan(0);
  expect(result.header).toBeDefined();
  expect(result.wav).toBeInstanceOf(Array);
  expect(result.dataURI).toContain('data:audio/wav;base64,');
});

test("Wave type constants", () => {
  expect(SQUARE).toBe(0);
  expect(SAWTOOTH).toBe(1);
  expect(SINE).toBe(2);
  expect(NOISE).toBe(3);
});

test("RiffWave class", () => {
  const testData = [100, 120, 140, 160, 180, 200];
  const riff = new RiffWave(testData);
  
  expect(riff.data).toEqual(testData);
  expect(riff.wav.length).toBeGreaterThan(0);
  expect(riff.dataURI).toContain('data:audio/wav;base64,');
});

test("Parameter serialization and deserialization", () => {
  const params1 = new Params();
  params1.pickupCoin();
  
  const serialized = params1.toB58();
  expect(typeof serialized).toBe('string');
  expect(serialized.length).toBeGreaterThan(0);
  
  const params2 = new Params();
  params2.fromB58(serialized);
  
  // Verify that key parameters are the same
  expect(params2.wave_type).toBe(params1.wave_type);
  expect(params2.p_base_freq).toBeCloseTo(params1.p_base_freq, 5);
  expect(params2.p_env_sustain).toBeCloseTo(params1.p_env_sustain, 5);
});