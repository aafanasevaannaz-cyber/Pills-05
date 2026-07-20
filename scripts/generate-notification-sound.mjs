import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sampleRate = 44_100

const soundDefinitions = [
  {
    id: 'gentle',
    durationSeconds: 2.5,
    baseAmplitude: 0.62,
    bursts: [
      { start: 0.0, duration: 0.5, frequency: 523.25 },
      { start: 0.68, duration: 0.5, frequency: 659.25 },
      { start: 1.42, duration: 0.68, frequency: 783.99 },
    ],
  },
  {
    id: 'clear',
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

function createWave({ durationSeconds, baseAmplitude, bursts }, volume) {
  const sampleCount = Math.floor(sampleRate * durationSeconds)
  const samples = new Int16Array(sampleCount)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    let value = 0

    for (const burst of bursts) {
      const localTime = time - burst.start
      if (localTime < 0 || localTime > burst.duration) continue

      const attack = Math.min(1, localTime / 0.018)
      const release = Math.min(1, (burst.duration - localTime) / 0.11)
      const envelope = Math.max(0, Math.min(attack, release))
      const fundamental = Math.sin(2 * Math.PI * burst.frequency * localTime)
      const second = Math.sin(2 * Math.PI * burst.frequency * 2 * localTime) * 0.32
      const third = Math.sin(2 * Math.PI * burst.frequency * 3 * localTime) * 0.16
      value += (fundamental + second + third) * envelope * baseAmplitude * volume.multiplier
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
