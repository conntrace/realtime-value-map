import { useRef, useState, useEffect, useCallback } from 'react'

// ── Luminance & sampling (ported from value-map-generator/imageProcessor.js) ──

function getLuminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

function sampleRect(data, x, y, w, h, imgWidth, imgHeight) {
  let sum = 0
  let count = 0
  const startX = Math.floor(x)
  const startY = Math.floor(y)
  const endX = Math.min(Math.floor(x + w), imgWidth)
  const endY = Math.min(Math.floor(y + h), imgHeight)

  // For large regions, skip pixels to maintain framerate
  const step = (endX - startX) * (endY - startY) > 2000 ? 2 : 1

  for (let py = startY; py < endY; py += step) {
    for (let px = startX; px < endX; px += step) {
      const idx = (py * imgWidth + px) * 4
      sum += getLuminance(data[idx], data[idx + 1], data[idx + 2])
      count++
    }
  }
  return count > 0 ? sum / count : 0.5
}

function sampleCircle(data, cx, cy, radius, imgWidth, imgHeight) {
  let sum = 0
  let count = 0
  const startX = Math.max(0, Math.floor(cx - radius))
  const startY = Math.max(0, Math.floor(cy - radius))
  const endX = Math.min(Math.floor(cx + radius), imgWidth)
  const endY = Math.min(Math.floor(cy + radius), imgHeight)
  const r2 = radius * radius

  const area = (endX - startX) * (endY - startY)
  const step = area > 2000 ? 2 : 1

  for (let py = startY; py < endY; py += step) {
    for (let px = startX; px < endX; px += step) {
      const dx = px - cx
      const dy = py - cy
      if (dx * dx + dy * dy <= r2) {
        const idx = (py * imgWidth + px) * 4
        sum += getLuminance(data[idx], data[idx + 1], data[idx + 2])
        count++
      }
    }
  }
  return count > 0 ? sum / count : 0.5
}

// ── Process a single video frame into a value map ──

function processFrame(videoEl, offscreenCanvas, settings) {
  const vw = videoEl.videoWidth
  const vh = videoEl.videoHeight
  if (!vw || !vh) return null

  // Resize offscreen canvas to match video
  if (offscreenCanvas.width !== vw || offscreenCanvas.height !== vh) {
    offscreenCanvas.width = vw
    offscreenCanvas.height = vh
  }

  const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(videoEl, 0, 0, vw, vh)

  const imageData = ctx.getImageData(0, 0, vw, vh)
  const data = imageData.data

  const { grid, scale, cellShape, invert } = settings
  const cellWidth = vw / grid.columns
  const cellHeight = vh / grid.rows

  const valueMap = new Array(grid.rows)

  for (let row = 0; row < grid.rows; row++) {
    const rowValues = new Array(grid.columns)
    for (let col = 0; col < grid.columns; col++) {
      let avgLuminance

      if (cellShape === 'circle') {
        const cx = col * cellWidth + cellWidth / 2
        const cy = row * cellHeight + cellHeight / 2
        const radius = Math.min(cellWidth, cellHeight) / 2
        avgLuminance = sampleCircle(data, cx, cy, radius, vw, vh)
      } else {
        const x = col * cellWidth
        const y = row * cellHeight
        avgLuminance = sampleRect(data, x, y, cellWidth, cellHeight, vw, vh)
      }

      let darkness = 1 - avgLuminance
      if (invert) darkness = 1 - darkness

      let value = Math.round(darkness * scale.max)
      value = Math.max(scale.min, Math.min(scale.max, value))
      rowValues[col] = value
    }
    valueMap[row] = rowValues
  }

  return valueMap
}

// ── Hook ──

export default function useFrameProcessor(videoRef, settings, frozen) {
  const [valueMap, setValueMap] = useState(null)
  const [fps, setFps] = useState(0)
  const offscreenRef = useRef(null)
  const rafRef = useRef(null)
  const frameCountRef = useRef(0)
  const lastFpsTimeRef = useRef(performance.now())

  // Memoize settings as a serialized key to avoid stale closures
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const frozenRef = useRef(frozen)
  frozenRef.current = frozen

  const loop = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }

    if (!frozenRef.current) {
      if (!offscreenRef.current) {
        offscreenRef.current = document.createElement('canvas')
      }

      const result = processFrame(video, offscreenRef.current, settingsRef.current)
      if (result) {
        setValueMap(result)
      }

      // FPS counter
      frameCountRef.current++
      const now = performance.now()
      const elapsed = now - lastFpsTimeRef.current
      if (elapsed >= 1000) {
        setFps(Math.round((frameCountRef.current / elapsed) * 1000))
        frameCountRef.current = 0
        lastFpsTimeRef.current = now
      }
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [videoRef])

  const start = useCallback(() => {
    if (rafRef.current) return
    frameCountRef.current = 0
    lastFpsTimeRef.current = performance.now()
    rafRef.current = requestAnimationFrame(loop)
  }, [loop])

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return { valueMap, fps, start, stop }
}
