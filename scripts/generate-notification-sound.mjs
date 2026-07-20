import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sampleRate = 44_100

const soundDefinitions = [
  {
    id: 'gentle',
    durationSeconds: 2.3,
    amplitude: 0.42,
    bursts: [
      { start: 0.0, duration: 0.48, frequency: 523.25 },
      { start: 0.62, duration: 0.48, frequency: 659.25 },
      { start: 1.34, duration: 0.62, frequency: 783.99 },
    ],
  },
  {
    id: 'clear',
    durationSeconds: 2.2,
    amplitude: 0.62,
    bursts: [
      { start: 0.0, duration: 0.34, frequency: 880 },
      { start: 0.48, duration: 0.34, frequency: 880 },
      { start: 0.96, duration: 0.46, frequency: 1046.5 },
      { start: 1.58, duration: 0.42, frequency: 880 },
    ],
  },
  {
    id: 'alarm',
    durationSeconds: 3.1,
    amplitude: 0.78,
    bursts: [
      { start: 0.0, duration: 0.42, frequency: 988 },
      { start: 0.48, duration: 0.42, frequency: 740 },
      { start: 0.96, duration: 0.42, frequency: 988 },
      { start: 1.44, duration: 0.42, frequency: 740 },
      { start: 1.92, duration: 0.42, frequency: 988 },
      { start: 2.4, duration: 0.5, frequency: 1175 },
    ],
  },
]

function createWave({ durationSeconds, amplitude, bursts }) {
  const sampleCount = Math.floor(sampleRate * durationSeconds)
  const samples = new Int16Array(sampleCount)

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate
    let value = 0

    for (const burst of bursts) {
      const localTime = time - burst.start
      if (localTime < 0 || localTime > burst.duration) continue

      const attack = Math.min(1, localTime / 0.025)
      const release = Math.min(1, (burst.duration - localTime) / 0.12)
      const envelope = Math.max(0, Math.min(attack, release))
      const fundamental = Math.sin(2 * Math.PI * burst.frequency * localTime)
      const harmonic = Math.sin(2 * Math.PI * burst.frequency * 1.5 * localTime) * 0.24
      value += (fundamental + harmonic) * envelope * amplitude
    }

    samples[index] = Math.round(Math.max(-1, Math.min(1, value)) * 32_767)
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
  const buffer = createWave(definition)
  const resourceName = `medicine_${definition.id}.wav`
  const targets = [
    resolve(root, `android/app/src/main/res/raw/${resourceName}`),
    resolve(root, `public/sounds/${resourceName}`),
  ]

  for (const target of targets) {
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, buffer)
    console.log(`Generated ${target}`)
  }

  if (definition.id === 'clear') {
    const legacyTarget = resolve(root, 'public/sounds/notification.wav')
    await mkdir(dirname(legacyTarget), { recursive: true })
    await writeFile(legacyTarget, buffer)
    console.log(`Generated ${legacyTarget}`)
  }
}
