// Content of the portfolio page. Facts come from https://github.com/Filip1159 (profile README and repository descriptions).

export interface Link {
    label: string
    url: string
}

export interface Project {
    name: string
    description: string
    tags: string[]
    links: Link[]
}

export interface SkillGroup {
    title: string
    skills: string[]
}

const GITHUB = 'https://github.com/Filip1159'

export const SOCIAL_LINKS = {
    github: GITHUB,
    linkedin: 'https://www.linkedin.com/in/filip-wi%C5%9Bniewski-135696219/',
    chess: 'https://www.chess.com/member/fifi9811',
    duolingo: 'https://www.duolingo.com/profile/FilipWinie199260',
}

export const SKILL_GROUPS: SkillGroup[] = [
    {
        title: 'Professional stack',
        skills: [
            'Java',
            'Spring',
            'AWS',
            'Gradle',
            'Docker',
            'PostgreSQL',
            'GraphQL',
            'Terraform',
            'TypeScript',
            'React',
            'Redux',
            'Vite',
            'Material UI',
            'Playwright',
            'Claude',
        ],
    },
    {
        title: 'Personal projects & hobbies',
        skills: [
            'C',
            'C++',
            'Arduino',
            'Raspberry Pi',
            'ESP32',
            'STM32',
            'Python',
            'Flask',
            'FastAPI',
            'PyTorch',
            'Angular',
            'Vue',
            'Autodesk Fusion',
            'Bambu Lab',
        ],
    },
]

export const PROJECTS: Project[] = [
    {
        name: 'Gadget',
        description:
            'A 2-wheeled exploring robot. The firmware runs per-wheel PID control on FreeRTOS, reads 10 VL53L0X distance sensors and is controlled over WebSocket with OTA updates. A browser control panel drives it with buttons or the keyboard, tunes the wheel PID and shows the sensors on a live canvas.',
        tags: ['C++', 'ESP32', 'FreeRTOS', 'TypeScript'],
        links: [
            { label: 'Firmware', url: `${GITHUB}/Gadget-firmware` },
            { label: 'Control panel', url: `${GITHUB}/Gadget-UI` },
        ],
    },
    {
        name: 'BLE Climate Monitor',
        description:
            'An ultra low power temperature and humidity monitor built around an ATmega328P, an HM-10 BLE module and a DHT22 sensor, with high-side power switching and MCU deep sleep. It feeds the live stats of the Raspberry SPY.',
        tags: ['C++', 'AVR', 'BLE', 'Electronics'],
        links: [{ label: 'Source', url: `${GITHUB}/BLE-Climate-Monitor` }],
    },
    {
        name: 'Connect Messenger',
        description: 'A real-time chat: talk one-to-one or in groups, send photos, react to messages with emoji, and more.',
        tags: ['Java', 'Angular', 'TypeScript'],
        links: [
            { label: 'Frontend', url: `${GITHUB}/Connect-Messenger-frontend` },
            { label: 'Backend', url: `${GITHUB}/Connect-Messenger-backend` },
        ],
    },
    {
        name: 'Macau card game',
        description: 'Play Macau against a bot in your browser. A frontend-only Angular card game with three difficulty levels and no backend.',
        tags: ['Angular', 'TypeScript'],
        links: [{ label: 'Source', url: `${GITHUB}/Macau-card-game` }],
    },
    {
        name: 'Boardgame search',
        description: 'A reusable MinMax / Alpha-Beta search library in Java, with othello and chess (JavaFX GUIs) built on top of it.',
        tags: ['Java', 'JavaFX', 'Algorithms'],
        links: [{ label: 'Source', url: `${GITHUB}/Boardgame-search` }],
    },
    {
        name: 'More embedded & algorithms',
        description:
            'Snake on an AVR, a paint program for the Raspberry Pi Pico, an NRF24L01 library for STM32 and an evolutionary optimizer for the MAX-3-SAT problem.',
        tags: ['C', 'C++', 'AVR', 'STM32'],
        links: [
            { label: 'Snake-EX2-AVR', url: `${GITHUB}/Snake-EX2-AVR` },
            { label: 'Pico Paint', url: `${GITHUB}/Raspberry-Pico-Paint` },
            { label: 'STM32 NRF lib', url: `${GITHUB}/STM32-NRF-lib` },
            { label: 'MAX-3-SAT', url: `${GITHUB}/MAX-3-SAT-optimizer` },
        ],
    },
]

export const RASPBERRY_SPY = {
    features: [
        'Live camera stream (HLS) with pan/tilt servos and an adjustable camera light',
        'Programmable alarm clock with a buzzer and 7 built-in melodies',
        'Local interface: 20x4 LCD with a rotary encoder',
        'BLE climate monitoring and live Raspberry stats',
    ],
    tags: ['Raspberry Pi 5', 'Angular', 'Python', 'FastAPI', 'Socket.IO', 'MediaMTX', 'nginx', 'Cloudflare Tunnel', '3D printing'],
    links: [
        { label: 'Frontend repo', url: `${GITHUB}/The-Raspberry-SPY-frontend` },
        { label: 'Backend repo', url: `${GITHUB}/The-Raspberry-SPY-backend` },
        { label: '3D model on Makerworld', url: 'https://makerworld.com/pl/models/2886103-the-raspberry-spy#profileId-3223978' },
    ],
}
