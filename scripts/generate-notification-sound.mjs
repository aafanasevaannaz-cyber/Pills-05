import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sampleRate = 44_100

const soundDefinitions = [
  {
    id: 'gentle',
    kind: 'tone',
    durationSeconds: 2.5,
    baseAmplitude: 0.62,
    bursts: [
      { start: 0.0, duration: 0.5, frequency: 523.25 },
      { start: 0.68, duration: 0.5, frequency: 659.25 },
      { start: 1.42, duration: 0.68, frequency: 783.99 },
    ],
  },
  {
    id: 'chime',
    kind: 'chime',
    durationSeconds: 1.8,
    baseAmplitude: 0.67,
    bursts: [
      { start: 0.0, duration: 0.72, frequency: 659.25 },
      { start: 0.46, duration: 0.72, frequency: 783.99 },
      { start: 0.92, duration: 0.82, frequency: 987.77 },
    ],
  },
  {
    id: 'wood',
    kind: 'wood',
    durationSeconds: 1.45,
    baseAmplitude: 0.8,
    bursts: [
      { start: 0.0, duration: 0.2, frequency: 220 },
      { start: 0.34, duration: 0.2, frequency: 180 },
      { start: 0.68, duration: 0.2, frequency: 240 },
      { start: 1.02, duration: 0.24, frequency: 200 },
    ],
  },
  {
    id: 'pulse',
    kind: 'pulse',
    durationSeconds: 2.1,
    baseAmplitude: 0.72,
    bursts: [
      { start: 0.0, duration: 0.34, frequency: 392 },
      { start: 0.48, duration: 0.34, frequency: 523.25 },
      { start: 0.96, duration: 0.34, frequency: 440 },
      { start: 1.44, duration: 0.38, frequency: 587.33 },
    ],
  },
  {
    id: 'clear',
    kind: 'tone',
    durationSeconds: 2.5,
    baseAmplitude: 0.78,
    bursts: [
      { start: 0.0, duration: 0.38, frequency: 880 },
      { start: 0.5, duration: 0.38, frequency: 880 },
      { start: 1.0, duration: 0.5, frequency: 1046.5 },
      { start: 1.68, duration: 0.48, frequency: 880 },
    ],
  },
  {
    id: 'alarm',
    kind: 'tone',
    durationSeconds: 3.5,
    baseAmplitude: 0.96,
    bursts: [
      { start: 0.0, duration: 0.46, frequency: 988 },
      { start: 0.5, duration: 0.46, frequency: 740 },
      { start: 1.0, duration: 0.46, frequency: 988 },
      { start: 1.5, duration: 0.46, frequency: 740 },
      { start: 2.0, duration: 0.46, frequency: 988 },
      { start: 2.5, duration: 0.68, frequency: 1175 },
    ],
  },
]

const volumeDefinitions = [
  { id: 'normal', multiplier: 0.72, drive: 1.15 },
  { id: 'loud', multiplier: 0.9, drive: 1.65 },
  { id: 'maximum', multiplier: 1, drive: 2.35 },
]

function deterministicNoise(index) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}

function burstSample(definition, burst, localTime, sampleIndex) {
  if (localTime < 0 || localTime > burst.duration) return 0

  if (definition.kind === 'chime') {
    const attack = Math.min(1, localTime / 0.012)
    const envelope = attack * Math.exp(-localTime / 0.28)
    return envelope * (
      Math.sin(2 * Math.PI * burst.frequency * localTime) * 0.62 +
      Math.sin(2 * Math.PI * burst.frequency * 1.5 * localTime) * 0.23 +
      Math.sin(2 * Math.PI * burst.frequency * 2.01 * localTime) * 0.12
    )
  }

  if (definition.kind === 'wood') {
    const envelope = Math.exp(-localTime / 0.045)
    return envelope * (
      Math.sin(2 * Math.PI * burst.frequency * localTime) * 0.72 +
      Math.sin(2 * Math.PI * burst.frequency * 2.3 * localTime) * 0.17 +
      deterministicNoise(sampleIndex) * 0.18
    )
  }

  if (definition.kind === 'pulse') {
    const phase = Math.max(0, Math.min(1, localTime / burst.duration))
    const envelope = Math.sin(Math.PI * phase) ** 2
    return envelope * (
      Math.sin(2 * Math.PI * burst.frequency * localTime) * 0.84 +
      Math.sin(2 * Math.PI * burst.frequency * 0.5 * localTime) * 0.16
    )
  }

  const attack = Math.min(1, localTime / 0.018)
  const release = Math.min(1, (burst.duration - localTime) / 0.11)
  const envelope = Math.max(0, Math.min(attack, release))
  const fundamental = Math.sin(2 * Math.PI * burst.frequency * localTime)
  const second = Math.sin(2 * Math.PI * burst.frequency * 2 * localTime) * 0.32
  const third = Math.sin(2 * Math.PI * burst.frequency * 3 * localTime) * 0.16
  return (fundamental + second + third) * envelope
}

function createWave(definition, volume) {
  const sampleCount = Math.floor(sampleRate * definition.durationSeconds)
  const samples = new Int16Array(sampleCount)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    let value = 0

    for (const burst of definition.bursts) {
      value += burstSample(definition, burst, time - burst.start, index)
        * definition.baseAmplitude
        * volume.multiplier
    }

    const compressed = Math.tanh(value * volume.drive) / Math.tanh(volume.drive)
    samples[index] = Math.round(Math.max(-1, Math.min(1, compressed)) * 32_767)
  }

  const dataSize = samples.length * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
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
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(samples[index], 44 + index * 2)
  }
  return buffer
}

for (const definition of soundDefinitions) {
  for (const volume of volumeDefinitions) {
    const buffer = createWave(definition, volume)
    const resourceName = `medicine_${definition.id}_${volume.id}.wav`
    const targets = [
      resolve(root, `android/app/src/main/res/raw/${resourceName}`),
      resolve(root, `public/sounds/${resourceName}`),
    ]

    for (const target of targets) {
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, buffer)
      console.log(`Generated ${target}`)
    }

    if (volume.id === 'loud') {
      const legacyResource = `medicine_${definition.id}.wav`
      const legacyTargets = [
        resolve(root, `android/app/src/main/res/raw/${legacyResource}`),
        resolve(root, `public/sounds/${legacyResource}`),
      ]
      for (const target of legacyTargets) {
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, buffer)
        console.log(`Generated ${target}`)
      }
    }

    if (definition.id === 'clear' && volume.id === 'loud') {
      const legacyTarget = resolve(root, 'public/sounds/notification.wav')
      await mkdir(dirname(legacyTarget), { recursive: true })
      await writeFile(legacyTarget, buffer)
      console.log(`Generated ${legacyTarget}`)
    }
  }
}
