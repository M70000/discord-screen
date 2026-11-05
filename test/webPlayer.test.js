const fs = require('fs');
const assert = require('assert');

console.log('--- Checking File Existence ---');
assert(fs.existsSync('src/public/player.html'), 'player.html does not exist');
assert(fs.existsSync('src/public/offline.html'), 'offline.html does not exist');
console.log('✓ Both files exist.');

console.log('\n--- Checking player.html contents ---');
const playerHtml = fs.readFileSync('src/public/player.html', 'utf8');

// Check Hls.js CDN
assert(playerHtml.includes('https://cdn.jsdelivr.net/npm/hls.js@latest'), 'Hls CDN missing');
// Check low-latency settings
assert(playerHtml.includes('lowLatencyMode: true'), 'lowLatencyMode missing');
assert(playerHtml.includes('liveSyncDurationCount: 1'), 'liveSyncDurationCount missing');
assert(playerHtml.includes('backBufferLength: 10'), 'backBufferLength missing');
// Check source reading
assert(playerHtml.includes("urlParams.get('src')"), 'query param ?src missing');
assert(playerHtml.includes('window.__STREAM_SRC__'), 'window.__STREAM_SRC__ missing');
// Check UI controls & PiP
assert(playerHtml.includes('requestPictureInPicture'), 'requestPictureInPicture missing');
assert(playerHtml.includes('Janela Flutuante (PiP)'), 'PiP button missing');
assert(playerHtml.includes('Tela Cheia'), 'Tela Cheia button missing');
assert(playerHtml.includes('Desmutar Áudio'), 'Desmutar Audio missing');
// Check Safari/iOS fallback
assert(playerHtml.includes('application/vnd.apple.mpegurl'), 'Safari fallback missing');
// Check Status banner and theme
assert(playerHtml.includes('AO VIVO'), 'AO VIVO missing');
assert(playerHtml.includes('Transmissão de Tela'), 'Transmissão de Tela missing');
assert(playerHtml.includes('#0e1015'), '#0e1015 background missing');
assert(playerHtml.includes('aspect-ratio: 16 / 9'), '16:9 aspect ratio missing');

// Check external dependencies: Only cdn.jsdelivr.net should be referenced as external script/style/font
const scriptSrcMatches = Array.from(playerHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/g)).map(m => m[1]);
console.log('External script tags in player.html:', scriptSrcMatches);
assert.strictEqual(scriptSrcMatches.length, 1, 'Should have exactly 1 script tag with src');
assert(scriptSrcMatches[0].startsWith('https://cdn.jsdelivr.net/npm/hls.js'), 'Only Hls.js CDN should be used');

const linkHrefMatches = Array.from(playerHtml.matchAll(/<link[^>]+href=["']([^"']+)["']/g)).map(m => m[1]);
console.log('External link tags in player.html:', linkHrefMatches);
assert.strictEqual(linkHrefMatches.length, 0, 'No external link tags should be present');

console.log('\n--- Checking offline.html contents ---');
const offlineHtml = fs.readFileSync('src/public/offline.html', 'utf8');
assert(offlineHtml.includes('Transmissão Encerrada'), 'Title missing');
assert(offlineHtml.includes('Esta transmissão de tela foi finalizada pelo streamer ou ainda não foi iniciada.'), 'Subtitle missing');
assert(offlineHtml.includes('Voltar para o Discord'), 'Voltar para o Discord button missing');
assert(offlineHtml.includes('📺'), 'TV icon missing');
assert(offlineHtml.includes('#0e1015'), '#0e1015 background missing');

const offlineScriptSrcMatches = Array.from(offlineHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/g)).map(m => m[1]);
console.log('External script tags in offline.html:', offlineScriptSrcMatches);
assert.strictEqual(offlineScriptSrcMatches.length, 0, 'No external script tags should be present in offline.html');

const offlineLinkHrefMatches = Array.from(offlineHtml.matchAll(/<link[^>]+href=["']([^"']+)["']/g)).map(m => m[1]);
console.log('External link tags in offline.html:', offlineLinkHrefMatches);
assert.strictEqual(offlineLinkHrefMatches.length, 0, 'No external link tags should be present in offline.html');

console.log('\n✓ ALL SPECIFICATIONS VERIFIED SUCCESSFULLY!');
