// R3-277b link drill: a page with relative / corpus-absolute / $fs: (both spellings)
// / broken links, rendered under FORK and DISPATCH — every link must route to the
// same page (or render broken for the broken one) in both modes.
import { execSync } from 'node:child_process';
const PUPPETEER = '/home/peter/git/immediately-run/docs/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const { default: puppeteer } = await import(PUPPETEER);
const B = JSON.parse(execSync('cat /tmp/opencode/devB-277b.json').toString().trim().split('\n')[0]);
const C = JSON.parse(execSync('cat /tmp/opencode/devC-corpusL.json').toString().trim().split('\n')[0]);
const present = (u) => u.replace('/edit/', '/present/');
const segs = (u) => new URL(u).pathname.split('/').filter(Boolean);
const B_SOURCE = `local/${segs(B.url)[2]}/${segs(B.url)[3]}/${segs(B.url)[4]}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function groveFrame(page, timeoutMs = 300000) {
  const t0 = Date.now();
  for (;;) {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      try { if (await f.evaluate(() => !!document.querySelector('.grove-root h1'))) return f; } catch {}
    }
    if (Date.now() - t0 > timeoutMs) throw new Error('no grove frame');
    await sleep(1500);
  }
}

/** Click the link whose text matches, wait, return the new page's h1 (or broken-marker). */
async function clickLink(page, text) {
  const f = await groveFrame(page, 60000);
  const clicked = await f.evaluate((t) => {
    const a = [...document.querySelectorAll('.grove-root a')].find((x) => x.textContent.trim().toLowerCase().includes(t));
    if (!a) return false;
    a.click();
    return true;
  }, text);
  if (!clicked) return { clicked: false };
  await sleep(3500);
  let out = { clicked: true, h1: null, broken: false };
  for (const fr of page.frames()) {
    if (fr === page.mainFrame()) continue;
    try {
      const r = await fr.evaluate(() => ({
        h1: document.querySelector('.grove-root h1')?.textContent?.trim() ?? null,
        broken: !!document.querySelector('.ir-wikilink-broken, [data-state="broken"]'),
      }));
      if (r.h1) { out = { clicked: true, ...r }; break; }
    } catch {}
  }
  return out;
}

const gotoRetry = async (page, url, tries = 4) => {
  for (let i = 1; i <= tries; i++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }); return; }
    catch (e) { if (i === tries) throw e; await sleep(8000); }
  }
};
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new', protocolTimeout: 420000,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const verdict = { errors: [] };
const run = async (name, fn) => { try { verdict[name] = await fn(); } catch (e) { verdict.errors.push(`${name}: ${String(e).stack || e}`.slice(0, 250)); } };

const LINKS = [
  ['relative link', 'docs page', 'Drill Docs'],
  ['corpus-absolute', 'home', 'Drill Home'],
  ['fs fork spelling', 'docs via fs', 'Drill Docs'],
  ['fs dispatch spelling', 'docs via fs', 'Drill Docs'], // same text — second entry picks same link; see below
  ['broken renders broken', 'nowhere', null],
];

await run('fork', async () => {
  const page = await browser.newPage();
  await page.goto(present(B.url) , { waitUntil: 'domcontentloaded', timeout: 240000 });
  const f = await groveFrame(page);
  // navigate to the links page via nav
  await f.evaluate(() => { [...document.querySelectorAll('a[href]')].find((a) => (a.getAttribute('href')||'').includes('links'))?.click(); });
  await sleep(3500);
  const out = {};
  for (const [name, text, _] of LINKS) {
    if (name === 'fs dispatch spelling') continue; // dispatch-only spelling
    out[name] = await clickLink(page, text);
    // go back to the links page for the next probe
    const f2 = await groveFrame(page, 60000);
    await f2.evaluate(() => { [...document.querySelectorAll('a[href]')].find((a) => (a.getAttribute('href')||'').includes('links'))?.click(); });
    await sleep(2500);
  }
  await page.close();
  return out;
});

await run('dispatch', async () => {
  const page = await browser.newPage();
  await gotoRetry(page, present(B.url));
  await sleep(4000);
  let viewerReq = 0;
  page.on('request', (r) => { if (r.url().startsWith('http://127.0.0.1:7701')) viewerReq++; });
  await gotoRetry(page, present(C.url) + `&ir-dev-region=task.open-wiki&ir-dev-source=${encodeURIComponent(B_SOURCE)}`);
  const f = await groveFrame(page);
  await f.evaluate(() => { [...document.querySelectorAll('a[href]')].find((a) => (a.getAttribute('href')||'').includes('links'))?.click(); });
  await sleep(3500);
  const out = {};
  for (const [name, text, _] of LINKS) {
    if (name === 'fs fork spelling') continue; // fork-only spelling
    out[name] = await clickLink(page, text);
    const f2 = await groveFrame(page, 60000);
    await f2.evaluate(() => { [...document.querySelectorAll('a[href]')].find((a) => (a.getAttribute('href')||'').includes('links'))?.click(); });
    await sleep(2500);
  }
  out.localViewerRequests = viewerReq;
  await page.close();
  return out;
});

await browser.close();
console.log(JSON.stringify(verdict, null, 1));
