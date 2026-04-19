// Time utilities
// TODO: реализовать логику

export const getCurrentTime = () => {
  return new Date()
}

export const isTimeReached = (targetTime: Date) => {
  return new Date() >= targetTime
}
