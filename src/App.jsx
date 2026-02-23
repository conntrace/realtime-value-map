import { useState, useCallback, useRef, useEffect } from 'react'
import useCamera from './useCamera'
import useFrameProcessor from './useFrameProcessor'
import ValueMapCanvas from './ValueMapCanvas'

const GRID_PRESETS = [
  { label: '10 x 10', cols: 10, rows: 10 },
  { label: '20 x 20', cols: 20, rows: 20 },
  { label: '30 x 30', cols: 30, rows: 30 },
]

const SCALE_PRESETS = [
  { label: '0–10', max: 10 },
  { label: '0–20', max: 20 },
  { label: '0–50', max: 50 },
]

export default function App() {
  const { videoRef, status: camStatus, error: camError, start: startCam, stop: stopCam } = useCamera()

  const [settings, setSettings] = useState({
    grid: { columns: 20, rows: 20 },
    scale: { min: 0, max: 10 },
    cellShape: 'square',
    invert: false,
  })

  const [frozen, setFrozen] = useState(false)
  const [mapWidth, setMapWidth] = useState(480)
  const mapContainerRef = useRef(null)

  const { valueMap, fps, start: startProcessor, stop: stopProcessor } = useFrameProcessor(
    videoRef,
    settings,
    frozen
  )

  // Start camera + processor
  const handleStart = useCallback(async () => {
    await startCam()
    startProcessor()
  }, [startCam, startProcessor])

  // Stop everything
  const handleStop = useCallback(() => {
    stopProcessor()
    stopCam()
    setFrozen(false)
  }, [stopProcessor, stopCam])

  // Measure available width for value map canvas
  useEffect(() => {
    const el = mapContainerRef.current
    if (!el) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setMapWidth(Math.floor(entry.contentRect.width))
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const isActive = camStatus === 'active'

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold">
            V
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Real-Time Value Map</h1>
        </div>
        <div className="flex items-center gap-3">
          {isActive && (
            <span className="text-xs font-mono text-white/40">{fps} fps</span>
          )}
          {isActive && (
            <button
              onClick={() => setFrozen((f) => !f)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                frozen
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
              }`}
            >
              {frozen ? 'Frozen' : 'Freeze'}
            </button>
          )}
          {!isActive ? (
            <button
              onClick={handleStart}
              disabled={camStatus === 'requesting'}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {camStatus === 'requesting' ? 'Starting...' : 'Start Camera'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Camera feed */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-[300px]">
          {!isActive && camStatus !== 'requesting' ? (
            <div className="text-center">
              {camError ? (
                <p className="text-red-400 text-sm max-w-xs">{camError}</p>
              ) : (
                <div className="space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-white/30"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                      />
                    </svg>
                  </div>
                  <p className="text-white/40 text-sm">
                    Click <strong className="text-white/60">Start Camera</strong> to begin
                  </p>
                </div>
              )}
            </div>
          ) : null}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`rounded-lg max-h-[60vh] w-auto ${
              isActive ? 'block' : 'hidden'
            }`}
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>

        {/* Value map */}
        <div
          ref={mapContainerRef}
          className="flex-1 flex items-center justify-center p-4 min-h-[300px]"
        >
          {valueMap ? (
            <ValueMapCanvas
              valueMap={valueMap}
              settings={settings}
              width={mapWidth}
            />
          ) : isActive ? (
            <p className="text-white/30 text-sm">Processing...</p>
          ) : null}
        </div>
      </div>

      {/* Controls */}
      {isActive && (
        <div className="border-t border-white/10 px-6 py-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Grid size */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Grid
              </label>
              <div className="flex gap-1">
                {GRID_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() =>
                      updateSetting('grid', { columns: p.cols, rows: p.rows })
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      settings.grid.columns === p.cols && settings.grid.rows === p.rows
                        ? 'bg-white/15 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom grid slider */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Size: {settings.grid.columns}
              </label>
              <input
                type="range"
                min={5}
                max={60}
                value={settings.grid.columns}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  updateSetting('grid', { columns: v, rows: v })
                }}
                className="w-24 accent-white/60"
              />
            </div>

            {/* Scale */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Scale
              </label>
              <div className="flex gap-1">
                {SCALE_PRESETS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() =>
                      updateSetting('scale', { min: 0, max: s.max })
                    }
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      settings.scale.max === s.max
                        ? 'bg-white/15 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cell shape */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Shape
              </label>
              <div className="flex gap-1">
                {['square', 'circle'].map((shape) => (
                  <button
                    key={shape}
                    onClick={() => updateSetting('cellShape', shape)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                      settings.cellShape === shape
                        ? 'bg-white/15 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            {/* Invert */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                Invert
              </label>
              <button
                onClick={() => updateSetting('invert', !settings.invert)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  settings.invert
                    ? 'bg-white/15 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {settings.invert ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
