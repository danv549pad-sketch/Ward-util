// Browser-only smoke test with a temporary Chromium profile; no Staff data or PIN.
// Run with the WardSpace workflow serving http://127.0.0.1:80/.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const profile = await mkdtemp(join(tmpdir(), 'wardspace-games-'));
const browser = spawn('chromium', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9224',
  `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const base = 'http://127.0.0.1:80';
const wordPathsExpression = `(() => {
  const grid = [...document.querySelectorAll('[data-testid^="cell-word-search-"]')];
  const at = (r,c) => grid.find(x => x.dataset.testid === 'cell-word-search-'+r+'-'+c)?.textContent?.trim();
  const words = [...document.querySelectorAll('[data-testid^="word-search-word-"]')].map(x => x.textContent.trim().toUpperCase().replace(/[^A-Z]/g,''));
  return words.map(word => {
    for (let r=0;r<10;r++) for (let c=0;c<10;c++) for (const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1],[0,-1],[-1,0],[-1,-1],[-1,1]])
      if ([...word].every((ch,i)=> at(r+dr*i,c+dc*i)===ch)) return {a:'cell-word-search-'+r+'-'+c,b:'cell-word-search-'+(r+dr*(word.length-1))+'-'+(c+dc*(word.length-1))};
    return null;
  });
})()`;
let socket;
let nextId = 0;
const pending = new Map();

async function command(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await command('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function waitFor(expression, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await evaluate(expression);
    if (value) return value;
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${expression}`);
}
async function visit(path, marker) {
  await command('Page.navigate', { url: `${base}${path}` });
  await waitFor(`!!document.querySelector('[data-testid="${marker}"]')`);
}
async function click(testId) {
  const didClick = await evaluate(`(() => { const el = document.querySelector('[data-testid="${testId}"]'); if (!el) return false; el.click(); return true; })()`);
  assert.ok(didClick, `missing ${testId}`);
}
async function tapCell(testId) {
  await evaluate(`document.querySelector('[data-testid="${testId}"]').scrollIntoView({block:'center'})`);
  const box = await evaluate(`(() => { const r = document.querySelector('[data-testid="${testId}"]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
}
async function screenshot(path) {
  // The app intentionally fades pages in; capture the settled state.
  await sleep(650);
  const image = await command('Page.captureScreenshot', { format: 'jpeg', quality: 80, captureBeyondViewport: false });
  await writeFile(path, Buffer.from(image.data, 'base64'));
}

try {
  let target;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      target = (await (await fetch('http://127.0.0.1:9224/json')).json()).find(item => item.type === 'page');
      if (target) break;
    } catch { /* Chromium is starting. */ }
    await sleep(100);
  }
  assert.ok(target, 'Chromium debug target');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener('message', event => {
    const result = JSON.parse(event.data);
    const item = pending.get(result.id);
    if (item) {
      pending.delete(result.id);
      result.error ? item.reject(new Error(result.error.message)) : item.resolve(result.result);
    }
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  await command('Page.enable');
  await command('Runtime.enable');

  const routes = [
    ['/games', '.games', 'heading-game-zone'],
    ['/games/sudoku', '.sudoku', 'game-sudoku'],
    ['/games/word-search', '.word-search', 'game-word-search'],
    ['/games/word-scramble', '.word-scramble', 'game-word-scramble'],
    ['/games/number-puzzle', '.number-puzzle', 'game-number-puzzle'],
  ];
  const output = 'screenshots/game-zone';
  await mkdir(output, { recursive: true });
  let checked = 0;
  for (const width of [320, 375, 430, 768, 1024, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', {
      width, height: width < 768 ? 850 : 950, deviceScaleFactor: 1, mobile: width < 768,
    });
    for (const [route, label, marker] of routes) {
      await visit(route, marker);
      const sizes = await evaluate('({scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth})');
      assert.ok(sizes.scroll <= sizes.client, `${route} overflows at ${width}px: ${JSON.stringify(sizes)}`);
      if (width === 375 || width === 768) await screenshot(`${output}/${label.slice(1)}-${width}.jpg`);
      checked++;
    }
  }

  await command('Emulation.setDeviceMetricsOverride', { width: 375, height: 850, deviceScaleFactor: 1, mobile: true });
  await visit('/games/sudoku?daily=1', 'game-sudoku');
  const editable = await evaluate(`(() => { const el = [...document.querySelectorAll('[data-testid^="button-sudoku-cell-"]')].find(x => x.getAttribute('aria-label').includes('empty')); return el?.getAttribute('data-testid'); })()`);
  assert.ok(editable, 'Sudoku has editable cells');
  await click(editable);
  await click('button-sudoku-number-1');
  const boardAfterEntry = await evaluate(`document.querySelector('[data-testid="${editable}"]').textContent`);
  assert.match(boardAfterEntry, /1/);
  await click('button-sudoku-undo');
  const boardAfterUndo = await evaluate(`document.querySelector('[data-testid="${editable}"]').textContent`);
  assert.notEqual(boardAfterUndo, boardAfterEntry, 'Sudoku undo reverted entry');
  const missingNumbers = await evaluate(`(() => {
    const key = Object.keys(localStorage).find(item => item.includes('sudoku-daily-') && item.endsWith('-medium'));
    const {puzzle, solution} = JSON.parse(localStorage.getItem(key));
    return puzzle.flatMap((given, index) => given ? [] : [[index, solution[index]]]);
  })()`);
  for (const [index, answer] of missingNumbers) {
    await click(`button-sudoku-cell-${index}`);
    await click(`button-sudoku-number-${answer}`);
  }
  await waitFor(`!!document.querySelector('[data-testid="status-sudoku-complete"]')`);

  await visit('/games/word-search', 'game-word-search');
  const endpoints = await evaluate(wordPathsExpression);
  assert.equal(endpoints.length, 10);
  assert.ok(endpoints.every(Boolean), 'found every listed word in the grid');
  await tapCell(endpoints[0].a);
  await waitFor(`document.querySelector('[data-testid="status-word-search"]').textContent.includes('Now tap the last letter')`);
  await tapCell(endpoints[0].b);
  await waitFor(`document.querySelector('[data-testid="text-word-search-progress"]').textContent.includes('1 / 10')`);
  for (const path of endpoints.slice(1)) {
    await tapCell(path.a);
    await waitFor(`document.querySelector('[data-testid="status-word-search"]').textContent.includes('Now tap the last letter')`);
    await tapCell(path.b);
  }
  await waitFor(`!!document.querySelector('[data-testid="status-word-search-complete"]')`);

  await visit('/games/number-puzzle', 'game-number-puzzle');
  const before = await evaluate(`document.querySelector('[data-testid="game-number-puzzle"]').textContent`);
  let after = before;
  for (const [key, code] of [['ArrowLeft', 37], ['ArrowRight', 39], ['ArrowUp', 38], ['ArrowDown', 40]]) {
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: code });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
    await sleep(80);
    after = await evaluate(`document.querySelector('[data-testid="game-number-puzzle"]').textContent`);
    if (after !== before) break;
  }
  assert.notEqual(after, before, 'arrow key changes Number Puzzle');

  await visit('/games/sudoku?mode=shared', 'button-start-game-session');
  await click('button-start-game-session');
  await waitFor(`!!document.querySelector('[data-testid="game-sudoku"]')`);
  const sharedCell = await evaluate(`(() => [...document.querySelectorAll('[data-testid^="button-sudoku-cell-"]')].find(x => x.getAttribute('aria-label').includes('empty'))?.dataset.testid)()`);
  await click(sharedCell);
  await click('button-sudoku-number-2');
  assert.ok(await evaluate(`Object.keys(sessionStorage).some(k => k.startsWith('wardspace-game:'))`));
  await evaluate('window.confirm = () => true');
  await click('button-mobile-finish-shared');
  await waitFor(`!Object.keys(sessionStorage).some(k => k.startsWith('wardspace-game:'))`);
  await visit('/games/sudoku', 'button-start-game-session');
  await click('button-start-game-session');
  await waitFor(`!!document.querySelector('[data-testid="game-sudoku"]')`);
  assert.ok(await evaluate(`!document.querySelector('[data-testid="${sharedCell}"]').textContent.includes('2')`),
    'new shared session did not inherit the old Sudoku entry');
  await visit('/games/word-search', 'game-word-search');
  const sharedWord = (await evaluate(wordPathsExpression))[0];
  await tapCell(sharedWord.a);
  await waitFor(`document.querySelector('[data-testid="status-word-search"]').textContent.includes('Now tap the last letter')`);
  await tapCell(sharedWord.b);
  await waitFor(`document.querySelector('[data-testid="text-word-search-progress"]').textContent.includes('1 / 10')`);
  await visit('/games/word-scramble', 'game-word-scramble');
  await click('button-show-hint');
  assert.ok(await evaluate(`!!document.querySelector('[data-testid="text-word-hint"]')`));
  await evaluate('window.confirm = () => true');
  await click('button-mobile-finish-shared');
  await waitFor(`!Object.keys(sessionStorage).some(k => k.startsWith('wardspace-game:'))`);
  await visit('/games/word-search', 'button-start-game-session');
  await click('button-start-game-session');
  await waitFor(`!!document.querySelector('[data-testid="game-word-search"]')`);
  assert.match(await evaluate(`document.querySelector('[data-testid="text-word-search-progress"]').textContent`), /0\s*\/\s*10/);
  await visit('/games/word-scramble', 'game-word-scramble');
  assert.ok(await evaluate(`!document.querySelector('[data-testid="text-word-hint"]')`));
  console.log(`PASS: ${checked} route/viewport combinations, complete Sudoku and Word Search puzzles, Number Puzzle keyboard, and shared-session cleanup across games.`);
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  await new Promise(resolve => {
    if (browser.exitCode !== null) resolve();
    else browser.once('exit', resolve);
  });
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
}