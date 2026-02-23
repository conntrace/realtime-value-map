import { useRef, useEffect } from 'react'

export default function ValueMapCanvas({ valueMap, settings, width }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !valueMap || valueMap.length === 0) return

    const rows = valueMap.length
    const cols = valueMap[0].length
    const cellSize = width / cols
    const totalHeight = rows * cellSize

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = totalHeight * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${totalHeight}px`

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = valueMap[r][c]
        const shade = Math.round((val / settings.scale.max) * 255)
        const bg = 255 - shade
        const x = c * cellSize
        const y = r * cellSize

        if (settings.cellShape === 'circle') {
          ctx.fillStyle = '#111318'
          ctx.fillRect(x, y, cellSize, cellSize)

          const cx = x + cellSize / 2
          const cy = y + cellSize / 2
          const radius = cellSize / 2 - 1
          ctx.beginPath()
          ctx.arc(cx, cy, radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgb(${bg}, ${bg}, ${bg})`
          ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.08)'
          ctx.lineWidth = 0.5
          ctx.stroke()
        } else {
          ctx.fillStyle = `rgb(${bg}, ${bg}, ${bg})`
          ctx.fillRect(x, y, cellSize, cellSize)
        }

        // Draw value number if cells are big enough
        if (cellSize >= 16) {
          const textColor = shade > 128 ? '#FFFFFF' : '#000000'
          ctx.fillStyle = textColor
          const fontSize = Math.max(8, Math.min(cellSize / 2.8, 18))
          ctx.font = `bold ${fontSize}px Inter, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(val.toString(), x + cellSize / 2, y + cellSize / 2)
        }
      }
    }

    // Grid lines for squares
    if (settings.cellShape !== 'circle') {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 0.5
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath()
        ctx.moveTo(0, r * cellSize)
        ctx.lineTo(width, r * cellSize)
        ctx.stroke()
      }
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath()
        ctx.moveTo(c * cellSize, 0)
        ctx.lineTo(c * cellSize, totalHeight)
        ctx.stroke()
      }
    }
  }, [valueMap, settings, width])

  return <canvas ref={canvasRef} className="rounded-lg" />
}
