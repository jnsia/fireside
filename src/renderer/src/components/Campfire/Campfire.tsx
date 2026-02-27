import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import styles from './Campfire.module.css'

interface CampfireProps {
  onClick?: () => void
  collapsed?: boolean
}

type Ember = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number }

const FULL = { size: 140, cx: 70, base: 90, gR: 42, gY: 90 }
const MINI = { size: 32,  cx: 16, base: 22, gR: 10, gY: 22 }

export function Campfire({ onClick, collapsed = false }: CampfireProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const mouseDown  = useRef<{ x: number; y: number } | null>(null)

  // 드래그와 클릭 구분: 5px 이상 움직이면 드래그로 판단
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    mouseDown.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!mouseDown.current) return
    const dx = Math.abs(e.clientX - mouseDown.current.x)
    const dy = Math.abs(e.clientY - mouseDown.current.y)
    mouseDown.current = null
    if (dx < 5 && dy < 5) onClick?.()
  }, [onClick])
  const cfg = collapsed ? MINI : FULL

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { size, cx, base, gR, gY } = cfg
    canvas.width  = size
    canvas.height = size

    let t = 0
    let animId: number
    const embers: Ember[] = []
    const scale = collapsed ? 0.52 : 1

    function spawnEmber() {
      embers.push({
        x: cx + (Math.random() - 0.5) * 12 * scale,
        y: base,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -(0.5 + Math.random() * 0.7) * scale,
        life: 0,
        max:  50 + Math.random() * 50,
        r:   (0.7 + Math.random() * 1.1) * scale
      })
    }

    function draw() {
      ctx.clearRect(0, 0, size, size)
      const wobble  = Math.sin(t * 0.055) * 3 * scale
      const flicker = 1 + Math.sin(t * 0.08) * 0.05

      // 모닥불 뒤 어두운 배경 원
      const bgR = gR * 0.75
      const bg = ctx.createRadialGradient(cx, gY, 0, cx, gY, bgR)
      bg.addColorStop(0,   'rgba(16, 7, 2, 0.80)')
      bg.addColorStop(0.7, 'rgba(10, 4, 1, 0.45)')
      bg.addColorStop(1,   'transparent')
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.arc(cx, gY, bgR, 0, Math.PI * 2)
      ctx.fill()

      // 바닥 글로우
      const ground = ctx.createRadialGradient(cx, gY, 0, cx, gY, gR)
      ground.addColorStop(0, `rgba(240, 120, 30, ${0.22 + Math.sin(t * 0.04) * 0.04})`)
      ground.addColorStop(1, 'transparent')
      ctx.fillStyle = ground
      ctx.beginPath()
      ctx.ellipse(cx, gY + 2, gR, gR * 0.33, 0, 0, Math.PI * 2)
      ctx.fill()

      // 불꽃 3레이어
      flame(ctx, cx, base, wobble, flicker, 13 * scale, 32 * scale, 'rgba(230, 90, 20, 0.18)', 10 * scale)
      flame(ctx, cx, base, wobble, flicker, 8  * scale, 24 * scale, 'rgba(250, 140, 40, 0.52)', 6  * scale)
      flame(ctx, cx, base, wobble * 0.6, flicker, 4.5 * scale, 15 * scale, 'rgba(255, 225, 100, 0.88)', 2 * scale)

      // 불씨
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]
        e.x  += e.vx + Math.sin(e.life * 0.18) * 0.25
        e.y  += e.vy
        e.life++
        if (e.life >= e.max) { embers.splice(i, 1); continue }
        const a = (1 - e.life / e.max) * 0.65
        ctx.beginPath()
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 210, 120, ${a})`
        ctx.fill()
      }
      if (Math.random() < 0.055 && embers.length < (collapsed ? 4 : 7)) spawnEmber()

      t++
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animId)
  }, [collapsed])

  return (
    <motion.div
      className={styles.wrapper}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{ width: cfg.size, height: cfg.size }}
      whileHover={{ scale: collapsed ? 1.08 : 1.04 }}
      whileTap={{ scale: 0.94 }}
      title={collapsed ? '펼치기' : '모닥불'}
    >
      <div className={styles.halo} style={{ opacity: collapsed ? 0 : undefined }} />
      <canvas ref={canvasRef} className={styles.canvas} />
    </motion.div>
  )
}

function flame(
  ctx: CanvasRenderingContext2D,
  cx: number, base: number,
  wobble: number, flicker: number,
  w: number, h: number,
  color: string, blur: number
) {
  const tip = base - h * flicker
  ctx.save()
  ctx.filter = `blur(${blur}px)`
  ctx.beginPath()
  ctx.moveTo(cx - w, base)
  ctx.bezierCurveTo(cx - w, base - h * 0.35 * flicker, cx + wobble - w * 0.4, tip + 4, cx + wobble * 0.3, tip)
  ctx.bezierCurveTo(cx + wobble * 0.3 + w * 0.4, tip + 4, cx + w, base - h * 0.35 * flicker, cx + w, base)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}
