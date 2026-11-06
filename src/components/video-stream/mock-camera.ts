// Stand-in for the HLS camera stream when running against the mock backend (environment.mock.ts)

const WIDTH = 720
const HEIGHT = 480
const FRAME_INTERVAL_MS = 40

export interface MockCamera {
    stream: MediaStream
    stop: () => void
}

export function createMockCameraStream(): MockCamera {
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = HEIGHT
    const context = canvas.getContext('2d')!

    const draw = () => {
        const t = Date.now() / 1000

        const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT)
        background.addColorStop(0, '#1b2735')
        background.addColorStop(1, '#090a0f')
        context.fillStyle = background
        context.fillRect(0, 0, WIDTH, HEIGHT)

        context.strokeStyle = 'rgba(255, 255, 255, 0.08)'
        for (let x = 0; x <= WIDTH; x += 60) {
            context.beginPath()
            context.moveTo(x, 0)
            context.lineTo(x, HEIGHT)
            context.stroke()
        }
        for (let y = 0; y <= HEIGHT; y += 60) {
            context.beginPath()
            context.moveTo(0, y)
            context.lineTo(WIDTH, y)
            context.stroke()
        }

        context.fillStyle = '#c51d4a'
        context.beginPath()
        context.arc(WIDTH / 2 + Math.cos(t) * 220, HEIGHT / 2 + Math.sin(t * 1.3) * 120, 36, 0, Math.PI * 2)
        context.fill()

        context.fillStyle = 'white'
        context.font = 'bold 28px sans-serif'
        context.fillText('MOCK CAMERA', 24, 48)
        context.font = '20px monospace'
        context.fillText(new Date().toLocaleTimeString(), 24, HEIGHT - 24)
    }

    draw()
    const timer = setInterval(draw, FRAME_INTERVAL_MS)

    return {
        stream: canvas.captureStream(25),
        stop: () => clearInterval(timer),
    }
}
