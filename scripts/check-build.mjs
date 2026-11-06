// Sanity check of the production build, run by CI before the site is deployed: node scripts/check-build.mjs
// Guards what is easy to break unnoticed: the pre-rendered portfolio (SEO) and the files GitHub Pages needs.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] ?? 'dist/raspberry-ui/browser'
const problems = []
const read = file => (existsSync(join(dist, file)) ? readFileSync(join(dist, file), 'utf8') : null)
const expect = (condition, message) => condition || problems.push(message)

const index = read('index.html')
expect(index !== null, 'index.html is missing')
if (index) {
    expect(/<h1[^>]*>\s*Hi, I'm Filip/.test(index), 'index.html is not pre-rendered (the portfolio heading is missing)')
    expect(index.includes('Ocado Technology'), 'index.html does not contain the portfolio text')
    expect(index.includes('<link rel="canonical" href="https://filipwisniewski.pl/"'), 'canonical link is missing')
    expect(index.includes('property="og:image"'), 'Open Graph image is missing')
    expect(index.includes('application/ld+json'), 'JSON-LD structured data is missing')
    expect(!/fonts\.(googleapis|gstatic)\.com/.test(index), 'index.html still loads Google Fonts')
    expect(!index.includes('name="robots"'), 'the portfolio must not carry a robots meta tag')
}

const shell = read('index.csr.html')
expect(shell !== null, 'index.csr.html (the client-side shell used as 404.html) is missing')
if (shell) expect(!shell.includes("Hi, I'm Filip"), 'index.csr.html must not be pre-rendered')

expect(read('CNAME')?.trim() === 'filipwisniewski.pl', 'CNAME is missing or wrong (the custom domain would be lost)')
expect(read('robots.txt')?.includes('Disallow: /app/'), 'robots.txt is missing or does not block /app/')
expect(read('sitemap.xml')?.includes('<loc>https://filipwisniewski.pl/</loc>'), 'sitemap.xml is missing or wrong')
expect(read('site.webmanifest') !== null, 'site.webmanifest is missing')
expect(existsSync(join(dist, 'img', 'og-image.jpg')), 'img/og-image.jpg is missing')

if (problems.length) {
    console.error('Build check failed:\n' + problems.map(problem => ` - ${problem}`).join('\n'))
    process.exit(1)
}
console.log(`Build check passed (${dist})`)
