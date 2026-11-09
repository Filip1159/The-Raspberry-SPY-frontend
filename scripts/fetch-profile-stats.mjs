// Writes the chess.com rapid rating and the Duolingo streak shown on the portfolio into src/components/portfolio/profile-stats.ts.
// Run by CI before the build (daily too, see ci.yml). Duolingo sends no CORS headers, so the browser cannot ask it directly; the numbers are
// baked into the pre-rendered page instead. When a request fails the committed values stay, so a flaky API never breaks the build.
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = new URL('../src/components/portfolio/profile-stats.ts', import.meta.url)
const CHESS_USER = 'fifi9811'
const DUOLINGO_USER = 'FilipWinie199260'
const HEADERS = { 'user-agent': 'filipwisniewski.pl portfolio build (https://github.com/Filip1159)' }

async function getJson(url) {
    const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
    return response.json()
}

const current = Object.fromEntries([...readFileSync(FILE, 'utf8').matchAll(/(\w+): (\d+)/g)].map(([, key, value]) => [key, Number(value)]))
const stats = { ...current }

try {
    const chess = await getJson(`https://api.chess.com/pub/player/${CHESS_USER}/stats`)
    const rating = chess.chess_rapid?.last?.rating
    if (Number.isInteger(rating)) stats.chessRapidRating = rating
} catch (error) {
    console.warn(`chess.com skipped: ${error.message}`)
}

try {
    const duolingo = await getJson(`https://www.duolingo.com/2017-06-30/users?username=${DUOLINGO_USER}`)
    const streak = duolingo.users?.[0]?.streak
    if (Number.isInteger(streak)) stats.duolingoStreak = streak
} catch (error) {
    console.warn(`Duolingo skipped: ${error.message}`)
}

writeFileSync(
    FILE,
    `// Written by scripts/fetch-profile-stats.mjs (CI runs it before every build); the numbers below are the last known ones.
export const PROFILE_STATS = {
    chessRapidRating: ${stats.chessRapidRating},
    duolingoStreak: ${stats.duolingoStreak},
}
`
)
console.log(stats)
