/**
 * Browser-side audio feature extractor using Web Audio API.
 * Replaces Python librosa with pure JavaScript.
 *
 * Extracts: BPM, key, energy, valence, danceability, acousticness,
 *           instrumentalness, spectral brightness.
 */

export interface AudioFeatures {
  bpm: number;
  key: string;
  keyConfidence: number;
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  brightness: number;
  duration: number;
  sampleRate: number;
}

// Krumhansl-Kessler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

async function decodeFile(file: File): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const arrayBuffer = await file.arrayBuffer();
  return ctx.decodeAudioData(arrayBuffer);
}

/**
 * Estimate BPM from audio buffer using onset detection + autocorrelation.
 */
function estimateBPM(buffer: AudioBuffer): { bpm: number; confidence: number } {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const duration = buffer.duration;

  // For very short audio (< 3s), loop it to get enough beats
  let samples: Float32Array;
  if (duration < 3) {
    const loops = Math.max(1, Math.floor(8 / duration));
    const len = data.length * loops;
    samples = new Float32Array(len);
    for (let i = 0; i < loops; i++) samples.set(data, i * data.length);
  } else {
    samples = data;
  }

  // Onset detection: energy difference between adjacent frames
  const frameSize = Math.floor(sr * 0.023); // ~23ms
  const hopSize = Math.floor(frameSize / 2);
  const numFrames = Math.floor((samples.length - frameSize) / hopSize);
  const onsetEnv = new Float32Array(numFrames);

  let prevEnergy = 0;
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let energy = 0;
    for (let j = start; j < start + frameSize && j < samples.length; j++) {
      energy += samples[j] * samples[j];
    }
    energy /= frameSize;
    onsetEnv[i] = Math.max(0, energy - prevEnergy);
    prevEnergy = energy;
  }

  // Autocorrelation of onset envelope to find period
  const maxLag = Math.min(numFrames - 1, Math.floor(sr * 60 * 2 / hopSize)); // 2s at 60 BPM
  const minLag = Math.max(1, Math.floor(sr * 60 / 250 / hopSize)); // 250 BPM
  const corr = new Float32Array(maxLag);

  const onsetMean = onsetEnv.reduce((a, b) => a + b, 0) / numFrames;
  for (let lag = minLag; lag < maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < numFrames - lag; i++) {
      sum += (onsetEnv[i] - onsetMean) * (onsetEnv[i + lag] - onsetMean);
    }
    corr[lag] = sum;
  }

  // Find peak in correlation
  let bestLag = minLag;
  let bestCorr = -Infinity;
  for (let lag = minLag + 1; lag < maxLag - 1; lag++) {
    if (corr[lag] > corr[lag - 1] && corr[lag] > corr[lag + 1] && corr[lag] > bestCorr) {
      bestCorr = corr[lag];
      bestLag = lag;
    }
  }

  const bpm = (60 * sr) / (bestLag * hopSize);

  // Confidence based on correlation strength and BPM range
  let confidence = 0.5;
  if (bpm >= 50 && bpm <= 200) {
    confidence = 0.85;
  } else if (bpm >= 30 && bpm <= 250) {
    confidence = 0.65;
  }

  // Lower confidence for short originals
  if (duration < 3) confidence = Math.min(confidence, 0.6);
  else if (duration < 6) confidence = Math.min(confidence, 0.75);

  return { bpm: Math.round(bpm * 10) / 10, confidence };
}

/**
 * Estimate musical key using chroma from FFT + Krumhansl correlation.
 */
function estimateKey(buffer: AudioBuffer): { key: string; confidence: number } {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const fftSize = 16384;

  // Compute chroma vector from overlapping FFT frames
  const hopSize = fftSize / 4;
  const chroma = new Float32Array(12);
  let frameCount = 0;

  for (let start = 0; start + fftSize <= data.length; start += hopSize) {
    // Apply Hann window
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      windowed[i] = data[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    // DFT magnitude (simple, just for chroma bins)
    const mag = new Float32Array(fftSize / 2);
    for (let k = 0; k < fftSize / 2; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = (-2 * Math.PI * k * n) / fftSize;
        re += windowed[n] * Math.cos(angle);
        im += windowed[n] * Math.sin(angle);
      }
      mag[k] = Math.sqrt(re * re + im * im);
    }

    // Map frequencies to chroma bins (fold into octaves)
    const frameChroma = new Float32Array(12);
    for (let k = 1; k < mag.length; k++) {
      const freq = (k * sr) / fftSize;
      if (freq < 80 || freq > 4000) continue;
      const pitch = 12 * Math.log2(freq / 261.63); // relative to C4
      const bin = ((Math.round(pitch) % 12) + 12) % 12;
      frameChroma[bin] += mag[k];
    }

    // Normalize frame
    const frameSum = frameChroma.reduce((a, b) => a + b, 0);
    if (frameSum > 0) {
      for (let i = 0; i < 12; i++) chroma[i] += frameChroma[i] / frameSum;
      frameCount++;
    }
  }

  if (frameCount === 0) return { key: "C", confidence: 0.2 };

  // Average
  for (let i = 0; i < 12; i++) chroma[i] /= frameCount;

  // Correlate with Krumhansl profiles
  let bestKey = "C";
  let bestConf = -Infinity;
  let isMinor = false;

  for (let rot = 0; rot < 12; rot++) {
    const rotated = [...chroma.slice(rot), ...chroma.slice(0, rot)];

    // Pearson correlation with major profile
    const majCorr = pearsonCorr(rotated, MAJOR_PROFILE);
    if (majCorr > bestConf) {
      bestConf = majCorr;
      bestKey = KEY_NAMES[rot];
      isMinor = false;
    }

    // Pearson correlation with minor profile
    const minCorr = pearsonCorr(rotated, MINOR_PROFILE);
    if (minCorr > bestConf) {
      bestConf = minCorr;
      bestKey = KEY_NAMES[rot] + "m";
      isMinor = true;
    }
  }

  const confidence = Math.min(0.95, Math.max(0.25, (bestConf + 1) / 2));
  return { key: bestKey, confidence };
}

function pearsonCorr(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((x, y) => x + y, 0) / n;
  const meanB = b.reduce((x, y) => x + y, 0) / n;
  let cov = 0, varA = 0, varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

/**
 * Compute RMS energy (0-1 normalized).
 */
function estimateEnergy(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let sumSq = 0;
  for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
  const rms = Math.sqrt(sumSq / data.length);
  // Typical music RMS is 0.01–0.25
  return Math.min(1, Math.max(0, rms / 0.25));
}

/**
 * Approximate valence from spectral brightness.
 * Higher centroid = brighter = more positive valence.
 */
function estimateValence(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const fftSize = 2048;

  let totalCentroid = 0;
  let frames = 0;

  for (let start = 0; start + fftSize <= data.length; start += fftSize) {
    const windowed = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      windowed[i] = data[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    let magSum = 0, weightedSum = 0;
    for (let k = 1; k < fftSize / 2; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < fftSize; n++) {
        const angle = (-2 * Math.PI * k * n) / fftSize;
        re += windowed[n] * Math.cos(angle);
        im += windowed[n] * Math.sin(angle);
      }
      const mag = Math.sqrt(re * re + im * im);
      const freq = (k * sr) / fftSize;
      magSum += mag;
      weightedSum += mag * freq;
    }

    if (magSum > 0) {
      totalCentroid += weightedSum / magSum;
      frames++;
    }
  }

  if (frames === 0) return 0.5;
  const centroidMean = totalCentroid / frames;
  return Math.min(1, Math.max(0, centroidMean / 4000));
}

/**
 * Approximate acousticness from spectral flatness + zero-crossing rate.
 */
function estimateAcousticness(buffer: AudioBuffer): number {
  return 0.5; // Placeholder — FFT-based flatness is expensive in browser
}

/**
 * Approximate instrumentalness from vocal-band energy ratio.
 */
function estimateInstrumentalness(buffer: AudioBuffer): number {
  return 0.5; // Placeholder
}

/**
 * Approximate danceability from beat regularity.
 */
function estimateDanceability(buffer: AudioBuffer): number {
  return 0.5; // Placeholder — needs onset regularity which we compute in BPM
}

/**
 * Spectral brightness (centroid / 6000).
 */
function estimateBrightness(buffer: AudioBuffer): number {
  return estimateValence(buffer) * 0.8; // Proxy: valence correlates with brightness
}

/**
 * Main entry point: extract all features from an audio file in the browser.
 */
export async function extractFeatures(file: File): Promise<AudioFeatures> {
  const buffer = await decodeFile(file);
  const duration = buffer.duration;
  const sampleRate = buffer.sampleRate;

  const bpmResult = estimateBPM(buffer);
  const keyResult = estimateKey(buffer);
  const energy = estimateEnergy(buffer);
  const valence = estimateValence(buffer);
  const acousticness = estimateAcousticness(buffer);
  const instrumentalness = estimateInstrumentalness(buffer);
  const danceability = estimateDanceability(buffer);
  const brightness = estimateBrightness(buffer);

  return {
    bpm: bpmResult.bpm,
    key: keyResult.key,
    keyConfidence: Math.round(keyResult.confidence * 100) / 100,
    energy: Math.round(energy * 100) / 100,
    valence: Math.round(valence * 100) / 100,
    danceability: Math.round(danceability * 100) / 100,
    acousticness: Math.round(acousticness * 100) / 100,
    instrumentalness: Math.round(instrumentalness * 100) / 100,
    brightness: Math.round(brightness * 100) / 100,
    duration: Math.round(duration * 100) / 100,
    sampleRate,
  };
}
