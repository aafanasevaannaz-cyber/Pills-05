import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sampleRate = 44_100
const sounds = [
  { id: 'gentle', duration: 2.3, kind: 'gentle' },
  { id: 'bell', duration: 2.1, kind: 'bell' },
  { id: 'marimba', duration: 1.9, kind: 'marimba' },
  { id: 'digital', duration: 1.35, kind: 'digital' },
  { id: 'classic', duration: 2.8, kind: 'classic' },
  { id: 'alarm', duration: 3.7, kind: 'alarm' },
]
const volumes = [
  { id: 'normal', multiplier: 0.62, drive: 1.15 },
  { id: 'loud', multiplier: 0.82, drive: 1.55 },
  { id: 'maximum', multiplier: 1, drive: 2.05 },
]

const noise = (index) => {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}
const sine = (frequency, time) => Math.sin(2 * Math.PI * frequency * time)
const square = (frequency, time) => sine(frequency, time) >= 0 ? 1 : -1
const pulse = (time, start, duration) => time >= start && time <= start + duration
const envelope = (time, start, duration, attack = 0.01, release = 0.12) => {
  const local = time - start
  if (local < 0 || local > duration) return 0
  return Math.max(0, Math.min(1, local / attack, (duration - local) / release))
}

function gentle(time) {
  const notes = [
    [0, 0.52, 392],
    [0.62, 0.52, 523.25],
    [1.24, 0.8, 659.25],
  ]
  return notes.reduce((sum, [start, duration, frequency]) => {
    const env = envelope(time, start, duration, 0.035, 0.22)
    const local = time - start
    return sum + env * (sine(frequency, local) * 0.72 + sine(frequency * 2, local) * 0.1)
  }, 0) * 0.58
}

function bell(time) {
  if (time < 0 || time > 2) return 0
  const attack = Math.min(1, time / 0.004)
  const decay = Math.exp(-time / 0.55)
  return attack * decay * (
    sine(740, time) * 0.55 +
    sine(1483, time) * 0.22 +
    sine(2074, time) * 0.14 +
    sine(2590, time) * 0.08
  )
}

function marimba(time, index) {
  const strikes = [[0, 196], [0.46, 246.94], [0.92, 220], [1.38, 293.66]]
  return strikes.reduce((sum, [start, frequency]) => {
    const local = time - start
    if (local < 0 || local > 0.32) return sum
    const decay = Math.exp(-local / 0.065)
    return sum + decay * (
      sine(frequency, local) * 0.7 +
      sine(frequency * 3.7, local) * 0.12 +
      noise(index) * 0.16
    )
  }, 0) * 0.82
}

function digital(time) {
  const pairs = [[0.0, 0.17, 880], [0.24, 0.17, 1175], [0.78, 0.17, 880], [1.02, 0.17, 1175]]
  return pairs.reduce((sum, [start, duration, frequency]) => {
    const env = envelope(time, start, duration, 0.004, 0.025)
    return sum + env * (square(frequency, time - start) * 0.72 + sine(frequency * 2, time - start) * 0.12)
  }, 0) * 0.58
}

function classic(time) {
  const slot = Math.floor(time / 0.28)
  const local = time - slot * 0.28
  if (slot > 8 || local > 0.19) return 0
  const frequency = slot % 2 === 0 ? 660 : 880
  const env = envelope(local, 0, 0.19, 0.006, 0.035)
  return env * (sine(frequency, local) * 0.72 + sine(frequency * 1.5, local) * 0.18) * 0.82
}

function alarm(time) {
  const active = pulse(time, 0, 1.45) || pulse(time, 1.75, 1.45)
  if (!active) return 0
  const local = time < 1.45 ? time : time - 1.75
  const sweep = 720 + 360 * (0.5 + 0.5 * sine(1.8, local))
  const tremolo = 0.58 + 0.42 * (0.5 + 0.5 * square(7, local))
  const start = Math.min(1, local / 0.025)
  const end = Math.min(1, (1.45 - local) / 0.08)
  return Math.max(0, Math.min(start, end)) * tremolo * (sine(sweep, local) * 0.78 + square(sweep / 2, local) * 0.12)
}

function sample(kind, time, index) {
  if (kind === 'gentle') return gentle(time)
  if (kind === 'bell') return bell(time)
  if (kind === 'marimba') return marimba(time, index)
  if (kind === 'digital') return digital(time)
  if (kind === 'classic') return classic(time)
  return alarm(time)
}

function createWave(definition, volume) {
  const count = Math.floor(sampleRate * definition.duration)
  const samples = new Int16Array(count)
  for (let index = 0; index < count; index += 1) {
    const raw = sample(definition.kind, index / sampleRate, index) * volume.multiplier
    const compressed = Math.tanh(raw * volume.drive) / Math.tanh(volume.drive)
    samples[index] = Math.round(Math.max(-1, Math.min(1, compressed)) * 32_767)
  }

  const size = samples.length * 2
  const buffer = Buffer.alloc(44 + size)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + size, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(size, 40)
  samples.forEach((value, index) => buffer.writeInt16LE(value, 44 + index * 2))
  return buffer
}

for (const sound of sounds) {
  for (const volume of volumes) {
    const name = `medicine_${sound.id}_${volume.id}.wav`
    const buffer = createWave(sound, volume)
    for (const target of [
      resolve(root, `android/app/src/main/res/raw/${name}`),
      resolve(root, `public/sounds/${name}`),
    ]) {
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, buffer)
      console.log(`Generated ${target}`)
    }
  }
}
