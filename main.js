/* eslint-env browser */
/* global document, requestAnimationFrame, innerWidth, innerHeight, addEventListener */
// Suno Prompt Studio Main JS (Modularized)
// NOTE: Attempts to dynamically import optional ./api-key.js. If missing, runs in "static mode" (Gemini enhancement disabled unless backend proxy provided).

(async () => {
  // --- STARFIELD & ORBITING EMOJI BUDDIES ---
  const bg = document.getElementById('bg'), g = bg.getContext('2d');
  let W, H, CX, CY, stars = [];
  const R = () => { W = bg.width = innerWidth; H = bg.height = innerHeight; CX = W / 2; CY = H / 2 }; addEventListener('resize', R); R();
  function initStars(n = 340) { stars = new Array(n).fill(0).map(() => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() * 0.8 + 0.2, len: Math.random() * 0.008 + 0.002 })) }
  initStars();
  const spaceBuddies = [
    { emoji: '🐈', t: 0, speed: .0022, orbitX: .35, orbitY: .22, orbitZ: .4 },
    { emoji: '🧑‍🚀', t: 1.5, speed: .0018, orbitX: .4, orbitY: .25, orbitZ: .5 },
    { emoji: '🐕', t: 3, speed: .0025, orbitX: .3, orbitY: .2, orbitZ: .3 },
    { emoji: '🥦', t: 4.5, speed: .0020, orbitX: .38, orbitY: .23, orbitZ: .45 }
  ];
  bg.addEventListener('click', (e) => {
    const rect = bg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; const s = Math.min(W, H) * .55;
    spaceBuddies.forEach(buddy => {
      if (buddy.isFlicked) return;
      const x = Math.cos(buddy.t) * buddy.orbitX; const y = Math.sin(buddy.t * 0.7) * buddy.orbitY; const z = 0.58 + 0.13 * Math.sin(buddy.t * buddy.orbitZ);
      const sx = CX + (x / z) * s; const sy = CY + (y / z) * s; const px = 16 + (1 - z) * 26;
      const distance = Math.hypot(mouseX - sx, mouseY - sy);
      if (distance < px) {
        buddy.isFlicked = true; buddy.flickX = sx; buddy.flickY = sy; buddy.flickVx = (Math.random() - 0.5) * 40; buddy.flickVy = (Math.random() - 0.5) * 40;
      }
    });
  });
  function drawBuddies() {
    const s = Math.min(W, H) * .55;
    spaceBuddies.forEach(buddy => {
      let sx, sy, px;
      if (buddy.isFlicked) {
        buddy.flickX += buddy.flickVx; buddy.flickY += buddy.flickVy; buddy.flickVx *= 0.99; buddy.flickVy *= 0.99; sx = buddy.flickX; sy = buddy.flickY; px = 30;
        if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) buddy.isFlicked = false;
      } else {
        buddy.t += buddy.speed; const x = Math.cos(buddy.t) * buddy.orbitX; const y = Math.sin(buddy.t * 0.7) * buddy.orbitY; const z = 0.58 + 0.13 * Math.sin(buddy.t * buddy.orbitZ); sx = CX + (x / z) * s; sy = CY + (y / z) * s; px = 16 + (1 - z) * 26;
      }
      g.save(); g.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji", system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(buddy.emoji, sx, sy); g.restore();
    });
  }
  const SPEED = .006;
  function tick() {
    g.clearRect(0, 0, W, H); g.save(); g.lineCap = 'round'; const s = Math.min(W, H) * .55;
    for (const st of stars) {
      st.z -= SPEED; if (st.z <= .02) { st.x = Math.random() * 2 - 1; st.y = Math.random() * 2 - 1; st.z = 1 }
      const sx = CX + (st.x / st.z) * s, sy = CY + (st.y / st.z) * s, psx = CX + (st.x / (st.z + st.len)) * s, psy = CY + (st.y / (st.z + st.len)) * s, a = 1 - Math.min(1, st.z);
      g.strokeStyle = `rgba(255,255,255,${.12 + a * .55})`; g.lineWidth = 1 + (1 - st.z) * 1.8; g.beginPath(); g.moveTo(psx, psy); g.lineTo(sx, sy); g.stroke();
    }
    drawBuddies(); g.restore(); requestAnimationFrame(tick);
  }
  tick();

  // --- DOM References ---
  const view = document.getElementById('view'), result = document.getElementById('result'), segAI = document.getElementById('seg-ai'), segPRO = document.getElementById('seg-pro'), pl = document.getElementById('progress'), pw = document.getElementById('progress-wrap'), navL = document.getElementById('nav-left'), navR = document.getElementById('nav-right'), modal = document.getElementById('modal'), mt = document.getElementById('mt'), mg = document.getElementById('mg'), mOK = document.getElementById('mOK'), mX = document.getElementById('mX'), mSearch = document.getElementById('mSearch'), toast = document.getElementById('toast');

  // --- Helpers ---
  const Chip = (t, sel, fn) => { const b = document.createElement('button'); b.className = 'chip'; b.dataset.selected = sel; b.textContent = t; b.onclick = fn; return b };
  function pills(list, selected, set) { const wrap = document.createElement('div'); wrap.className = 'flex flex-wrap gap-2 mt-3'; list.forEach(n => wrap.appendChild(Chip(n, selected.has ? selected.has(n) : selected === n, (e) => { if (selected.has) { selected.has(n) ? selected.delete(n) : selected.add(n); e.target.dataset.selected = selected.has(n) } else { set(n); [...wrap.children].forEach(c => c.dataset.selected = false); e.target.dataset.selected = true } }))); return wrap }
  function showToast(msg) { const el = document.createElement('div'); el.className = 'glass rounded-xl px-3 py-2 text-sm max-w-[90vw]'; el.textContent = msg; toast.appendChild(el); setTimeout(() => { el.remove() }, 1500) }

  // --- Modal State ---
  let ctx = null;
  function openModal({ title, list, multi = false, onDone }) { ctx = { multi, onDone, all: list, sel: new Set(), view: new Set(list) }; mt.textContent = title; renderModal(); modal.classList.add('grid'); modal.classList.remove('hidden') }
  function renderModal() { mg.innerHTML = ""; [...ctx.view].forEach(n => { const b = Chip(n, false, () => { if (!ctx.multi) { ctx.sel = new Set([n]); finishModal(); return } const on = b.dataset.selected === 'true'; b.dataset.selected = !on; on ? ctx.sel.delete(n) : ctx.sel.add(n); mOK.textContent = `선택 ${ctx.sel.size}개 추가` }); mg.appendChild(b) }); mSearch.oninput = () => { const q = mSearch.value.toLowerCase().trim(); ctx.view = new Set(ctx.all.filter(x => x.toLowerCase().includes(q))); renderModal() }; mOK.textContent = ctx.multi ? `선택 ${ctx.sel.size}개 추가` : '선택'; mOK.onclick = finishModal; mX.onclick = () => { modal.classList.add('hidden'); }
  }
  function finishModal() { modal.classList.add('hidden'); if (ctx.onDone) { ctx.onDone(ctx.multi ? Array.from(ctx.sel) : Array.from(ctx.sel)[0]) } }

  // --- Gemini API ---
  async function callGeminiAPI(localPrompt) {
    try {
      const r = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: localPrompt })
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({ error: `Backend API Error: ${r.status}` }));
        throw new Error(errBody.error || `Backend API Error: ${r.status}`);
      }
      const j = await r.json();
      return j.text || j.error || '백엔드 응답을 파싱하지 못했습니다.';
    } catch (e) {
      console.error('Backend API Error:', e);
      return `API 호출에 실패했습니다: ${e.message}`;
    }
  }

  // --- AI Mode State ---
  const genreMap = { 'Funk': ['Funk (General)', 'Soul Funk', 'Neo-Soul', 'G-Funk', 'Acid Jazz', 'Psychedelic Funk'], 'Jazz': ['Jazz (General)', 'Bebop', 'Cool Jazz', 'Swing', 'Fusion', 'Modal Jazz'], 'K-Pop': ['K-Pop (General)', 'Dance-Pop', 'K-Hip Hop', 'K-Ballad', 'K-R&B'], 'J-Pop': ['J-Pop (General)', 'City Pop', 'Shibuya-kei', 'J-Rock', 'Anime Song'], 'Synthpop': ['Synthpop (General)', 'Synthwave', 'Futurepop', 'Darkwave', 'Chillwave'], 'Rock': ['Rock (General)', 'Classic Rock', 'Alternative Rock', 'Indie Rock', 'Punk Rock', 'Heavy Metal', 'Post-Punk'], 'Hip Hop': ['Hip Hop (General)', 'Trap', 'Boom Bap', 'Lo-fi Hip Hop', 'Drill', 'Cloud Rap'], 'EDM': ['EDM (General)', 'House', 'Deep House', 'Tech House', 'Progressive House', 'Techno', 'Trance', 'Dubstep', 'Future Bass'], 'Drum & Bass': ['Drum & Bass (General)', 'Liquid DnB', 'Neurofunk', 'Jump-Up', 'Jungle', 'Deep DnB', 'Atmospheric', 'Minimal', 'Halftime'], 'R&B': ['R&B (General)', 'Contemporary R&B', 'Neo-Soul', 'Alternative R&B', 'Quiet Storm'], 'Ballad': ['Ballad (General)', 'Pop Ballad', 'Rock Ballad', 'Soul Ballad'] };
  const aiState = { step: 1, genre: 'Funk', sub: 'Funk (General)', core: new Set(['Drums', 'Bass', 'Piano']), perk: new Set(['Shaker']), vocal: 'Female Vocal', vocalTone: new Set([]), keywords: '', mood: new Set(['Warm', 'Dreamy']), bpm: 110, structure: new Set(['Intro', 'Verse', 'Chorus']), bracket: true, emphasis: false };
  function aiTotal() { return 7 }
  function field(label, value, onclick) { const d = document.createElement('button'); d.type = 'button'; d.className = 'field w-full text-left'; d.onclick = onclick; d.innerHTML = `<span>${label}</span><span class="mini">${value}</span>`; return d }

  function renderAI() {
    view.innerHTML = ''; pw.style.display = 'block'; pl.style.width = ((aiState.step / aiTotal()) * 100) + '%';
    navL.style.visibility = aiState.step === 1 ? 'hidden' : 'visible'; navR.style.visibility = aiState.step === aiTotal() ? 'hidden' : 'visible';
    const card = document.createElement('div'); card.className = 'space-y-4';
    const H = (t) => { const h = document.createElement('h3'); h.className = 'text-base font-semibold'; h.textContent = t; return h };
    if (aiState.step === 1) { card.appendChild(H('Step 1: 장르 선택')); card.appendChild(field(`장르`, `${aiState.genre} @${aiState.bpm}bpm`, () => openModal({ title: 'GENRE 선택', list: Object.keys(genreMap), multi: false, onDone: (pick) => { if (!pick) return; aiState.genre = pick; aiState.sub = genreMap[pick][0]; aiState.bpm = (pick === 'Drum & Bass') ? 174 : aiState.bpm; renderAI() } }))) }
    if (aiState.step === 2) { card.appendChild(H('Step 2: 세부 장르 선택')); card.appendChild(field('세부 장르', aiState.sub, () => openModal({ title: 'SUBGENRE 선택', list: genreMap[aiState.genre], multi: false, onDone: (pick) => { if (!pick) return; aiState.sub = pick; renderAI() } }))) }
    if (aiState.step === 3) { card.appendChild(H('Step 3: 핵심악기 구성')); let items = ['Drums', 'Bass', 'Guitar', 'Piano', 'Synthesizer', 'Strings', 'Contrabass', 'Saxophone']; if (aiState.genre === 'Drum & Bass') { items = ['Drums', 'Reese Bass', 'Sub Bass', 'FM Growl', 'Wobble Lead', 'Pads', 'Atmos Pad', 'Arp Synth'] } card.appendChild(pills(items, aiState.core)) }
    if (aiState.step === 4) { card.appendChild(H('Step 4: 퍼커션 & FX')); let items = ['Bongo', 'Conga', 'Tambourine', 'Shaker', 'Claves', 'Riser', 'Impact', 'White Noise', 'Vinyl Crackle']; if (aiState.genre === 'Drum & Bass') { items = ['Riser', 'Downlifter', 'White Noise', 'Reverb Tail', 'Noise Sweep', 'Snare Roll', 'Reverse Cymbal'] } card.appendChild(pills(items, aiState.perk)) }
    if (aiState.step === 5) { card.appendChild(H('Step 5: 보컬 & 키워드')); const row = document.createElement('div'); row.className = 'grid grid-cols-1 md:grid-cols-2 gap-3 mt-2'; const vocList = aiState.genre === 'Drum & Bass' ? ['Instrumental', 'Vocal Chop', 'Male Vocal', 'Female Vocal'] : ['Male Vocal', 'Female Vocal', 'Instrumental']; const vocWrap = field('보컬', aiState.vocal, () => openModal({ title: 'VOCAL 선택', list: vocList, multi: false, onDone: (pick) => { if (pick) aiState.vocal = pick; renderAI() } })); const kw = document.createElement('input'); kw.placeholder = '노래 주제 키워드'; kw.value = aiState.keywords || ''; kw.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2'; kw.oninput = () => aiState.keywords = kw.value; row.appendChild(vocWrap); row.appendChild(kw); card.appendChild(row) }
    if (aiState.step === 6) { card.appendChild(H('Step 6: 무드, BPM, 구조')); const moodsBase = ['Warm', 'Dreamy', 'Groovy', 'Dark', 'Sparkly', 'Vintage']; const dnbMoods = ['Euphoric', 'Atmospheric', 'Neuro', 'Liquid', 'Rollers']; const moodList = aiState.genre === 'Drum & Bass' ? moodsBase.concat(dnbMoods) : moodsBase; card.appendChild(pills(moodList, aiState.mood)); const ctrl = document.createElement('div'); ctrl.className = 'grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3'; const bpmDefault = aiState.genre === 'Drum & Bass' ? 174 : aiState.bpm; ctrl.innerHTML = `<label class='block text-sm'>BPM <input id='bpm' type='number' value='${bpmDefault}' class='mt-1 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2'></label><label class='block text-sm sm:col-span-2'>구조 <span class='block text-[11px] text-neutral-400 mt-1'>Intro, Drop, Break, Build, Outro 등</span></label>`; aiState.bpm = bpmDefault; card.appendChild(ctrl); ctrl.querySelector('#bpm').oninput = e => aiState.bpm = +e.target.value || bpmDefault; const structList = aiState.genre === 'Drum & Bass' ? ['Intro', 'Build', 'Drop', 'Roller', 'Break', 'Second Drop', 'Outro'] : ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Breakdown', 'Outro']; card.appendChild(pills(structList, aiState.structure)) }
    if (aiState.step === 7) { card.appendChild(H('Step 7: 프롬프트 생성')); const btn = document.createElement('button'); btn.className = 'w-full bg-[hsl(var(--ac))]/90 hover:bg-[hsl(var(--ac))] rounded-xl py-2.5 font-medium'; btn.textContent = '✨ 프롬프트 생성'; btn.onclick = () => { const prompt = buildAIPrompt(); showResult(prompt, 'ai', btn) }; card.appendChild(btn) }
    view.appendChild(card)
  }

  function buildAIPrompt() {
    const join = (s) => Array.from(s || []).join(', ');
    const nonEmpty = (arr) => arr.filter(Boolean);
    const head = `GENRE: ${aiState.genre}/${aiState.sub} @${aiState.bpm}bpm`;
    const lines = [head];
    const core = join(aiState.core); if (core) lines.push(`CORE: ${core}`);
    const perk = join(aiState.perk); if (perk) lines.push(`PERC/FX: ${perk}`);
    if (aiState.vocal && aiState.vocal !== 'Instrumental') { const tone = join(aiState.vocalTone); lines.push(`VOCAL: ${aiState.vocal}${tone ? ` (${tone} voice)` : ''}`) }
    const mood = join(aiState.mood); if (mood) lines.push(`MOOD: ${mood}`);
    const struct = Array.from(aiState.structure || []); if (struct.length) { if (aiState.bracket) { lines.push(`STRUCT: ${struct.map(s => `[${s}]`).join(' ')}`) } else { lines.push(`STRUCT: ${struct.join(' > ')}`) } }
    if (aiState.keywords && aiState.keywords.trim()) lines.push(`THEME: ${aiState.keywords.trim()}`);
    return nonEmpty(lines).join(' | ')
  }

  // --- PRO Mode ---
  const tracks = { rhythm: ['DnB 174 Straight'], bass: [], harmony: [], lead: [], percussion: [], fx: [], kick: ['Punchy DnB Kick'], snare: ['Snappy DnB Snare'], hihat: ['Shuffling Hat'], clap: [], cymbal: [] };
  const lib = { rhythm: ['Four-on-the-floor', 'Half-time Trap', 'Boom Bap Swing 56%', 'Dilla Swing 58%', 'Funk Shuffle 16th', 'Disco Shuffle', 'Breakbeat 130bpm', 'Reggaeton Dembow', 'Bossa Nova', 'Samba', 'Afrobeat Groove', 'House Shuffle', 'Techno Straight 16th', 'Garage Skip', 'Latin Clave 3-2', 'Latin Clave 2-3', 'DnB 174 Straight', 'DnB 174 Swing 52%', 'Jungle 165', 'Halftime 85', 'Neurofunk 172'], bass: ['Electric Bass (Finger)', 'Electric Bass (Pick)', 'Slap Bass', 'Synth Bass', '808 Bass', 'Contrabass', 'Reese Bass', 'Sub Sine', 'FM Growl', 'Wobble Bass', 'Neuro Bass'], harmony: ['Piano', 'Electric Piano', 'Organ', 'Synth Pad', 'String Section', 'Rhythm Guitar', 'Atmos Pad', 'Chords Stab'], lead: ['Lead Guitar', 'Synth Lead', 'Saxophone', 'Trumpet', 'Violin', 'Flute', 'Wobble Lead', 'Pluck Lead', 'Arp Synth'], percussion: ['Bongo', 'Conga', 'Tambourine', 'Shaker', 'Claves', 'Snare Roll', 'Reverse Cymbal'], fx: ['Riser', 'Impact', 'White Noise', 'Vinyl Crackle', 'Downlifter', 'Reverb Tail'], kick: ['808 Kick', '909 Kick', 'Linn Kick', 'Acoustic Kick Soft', 'Acoustic Kick Hard', 'Punchy DnB Kick', 'Tight 909 Kick', 'Subby Kick'], snare: ['808 Snare', '909 Snare', 'Linn Snare', 'Acoustic Snare Brush', 'Acoustic Snare Crack', 'Snappy DnB Snare', 'Rimshot Crack', 'Layered Snare 909'], hihat: ['Closed Hat 808', 'Open Hat 808', 'Closed Hat 909', 'Open Hat 909', 'Acoustic Hat Tight', 'Acoustic Hat Loose', 'Shuffling Hat', '16th Hat Tight', 'Open Hat Splash'], clap: ['808 Clap', '909 Clap', 'Handclap', 'Layered Clap'], cymbal: ['Crash Bright', 'Crash Dark', 'Ride Ping', 'Ride Wash'] };
  function openKit(cat) { openModal({ title: `${cat.toUpperCase()} 항목 선택`, list: lib[cat] || [], multi: true, onDone: (arr) => { (tracks[cat] || (tracks[cat] = [])); arr.forEach(n => tracks[cat].push(n)); renderPRO() } }) }
  function box(cat, label) { const d = document.createElement('div'); d.className = 'glass rounded-2xl p-4'; d.innerHTML = `<div class='flex items-center justify-between mb-2'><h4 class='font-medium'>${label}</h4><button class='add bg-[hsl(var(--ac))]/20 hover:bg-[hsl(var(--ac))]/30 rounded-lg px-3 py-1.5 text-sm'>+ 선택 추가</button></div><div class='space-y-2 list'></div>`; const list = d.querySelector('.list'); d.querySelector('.add').onclick = () => openKit(cat); const refresh = () => { list.innerHTML = ''; (tracks[cat] || []).forEach((n, i) => { const r = document.createElement('div'); r.className = 'flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2'; r.innerHTML = `<span>${n}</span>`; const del = document.createElement('button'); del.className = 'text-red-300/90 hover:text-red-200 text-sm'; del.textContent = '삭제'; del.onclick = () => { tracks[cat].splice(i, 1); refresh() }; r.appendChild(del); list.appendChild(r) }) }; refresh(); return d }
  function renderPRO() { view.innerHTML = ''; pw.style.display = 'none'; navL.style.visibility = 'hidden'; navR.style.visibility = 'hidden'; const wrap = document.createElement('div'); wrap.className = 'grid grid-cols-1 lg:grid-cols-2 gap-4'; const left = document.createElement('div'); left.className = 'space-y-4'; const right = document.createElement('div'); right.className = 'space-y-4'; ['rhythm', 'bass', 'harmony'].forEach(k => left.appendChild(box(k, { rhythm: '리듬', bass: '베이스', harmony: '하모니' }[k]))); ['lead', 'percussion', 'fx', 'kick', 'snare', 'hihat', 'clap', 'cymbal'].forEach(k => right.appendChild(box(k, { lead: '리드', percussion: '퍼커션', fx: 'FX', kick: '킥', snare: '스네어', hihat: '하이햇', clap: '클랩', cymbal: '심벌' }[k]))); wrap.appendChild(left); wrap.appendChild(right); view.appendChild(wrap); const actions = document.createElement('div'); actions.className = 'mt-4 flex flex-col sm:flex-row gap-2'; const genBtn = document.createElement('button'); genBtn.className = 'flex-1 bg-[hsl(var(--ac))]/90 hover:bg-[hsl(var(--ac))] rounded-xl py-2.5 font-medium'; genBtn.textContent = '✨ 프롬프트 생성'; genBtn.onclick = () => { genPRO(genBtn); scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) }; actions.appendChild(genBtn); view.appendChild(actions) }

  async function showResult(localPrompt, mode, btn) {
    const originalText = btn.textContent; btn.disabled = true;
    const loadingMessages = ['영감 수신 중...', '외계인과 교신 중... 👽', '우주 고양이에게 물어보는 중... 🐈', '브로콜리에게 의견 묻는 중... 🥦', '별들의 속삭임을 듣는 중...'];
    let messageIndex = 0; btn.textContent = loadingMessages[messageIndex];
    const loadingInterval = setInterval(() => { messageIndex = (messageIndex + 1) % loadingMessages.length; btn.textContent = loadingMessages[messageIndex]; }, 800);
    result.innerHTML = `<div class='grid grid-cols-1 md:grid-cols-2 gap-4'><div class='glass rounded-2xl p-4'><h3 class='text-base font-semibold mb-2'>로컬 프롬프트</h3><pre id='local-prompt' class='whitespace-pre-wrap text-sm leading-relaxed bg-black/30 rounded-xl p-3 border border-white/10'>${localPrompt}</pre></div><div class='glass rounded-2xl p-4'><h3 class='text-base font-semibold mb-2'>Gemini 보강 프롬프트</h3><div id='gemini-result-wrapper' class='min-h-[100px] flex items-center justify-center bg-black/30 rounded-xl p-3 border border-white/10'><div class="loader"></div></div></div></div><div class='mt-4 flex gap-2 justify-end'><button id='cpy' class='iconbtn rounded-lg px-3 py-1.5 text-sm'>모두 복사</button><button id='savePrompt' class='iconbtn rounded-lg px-3 py-1.5 text-sm'>JSON 저장</button></div>`;
    const geminiWrapper = document.getElementById('gemini-result-wrapper');
    const geminiResultText = await callGeminiAPI(localPrompt);
    clearInterval(loadingInterval); btn.disabled = false; btn.textContent = originalText;
    geminiWrapper.innerHTML = `<pre id='gemini-prompt' class='whitespace-pre-wrap text-sm leading-relaxed'>${geminiResultText}</pre>`;
    document.getElementById('cpy').onclick = () => { const combined = `// 로컬 프롬프트\n${localPrompt}\n\n// Gemini 보강 프롬프트\n${geminiResultText}`; navigator.clipboard.writeText(combined).then(() => showToast('두 프롬프트가 복사되었습니다.')).catch(() => showToast('복사 실패')) };
    document.getElementById('savePrompt').onclick = () => { const data = { mode, ts: Date.now(), localPrompt, geminiPrompt: geminiResultText }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `prompt_${mode}_${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url) }
  }
  function genPRO(btn) { const blocks = []; ['rhythm', 'bass', 'harmony', 'lead', 'percussion', 'fx', 'kick', 'snare', 'hihat', 'clap', 'cymbal'].forEach(k => { if (tracks[k]?.length) blocks.push(`${k.toUpperCase()}: ${tracks[k].join(', ')}`) }); const p = blocks.filter(Boolean).join(' | '); showResult(p, 'pro', btn) }
  let mode = 'ai';
  function render() { result.innerHTML = ''; if (mode === 'ai') { renderAI() } else { renderPRO() } }
  segAI.onclick = () => { mode = 'ai'; segAI.dataset.active = true; segAI.setAttribute('aria-selected', 'true'); segPRO.dataset.active = false; segPRO.setAttribute('aria-selected', 'false'); render() };
  segPRO.onclick = () => { mode = 'pro'; segAI.dataset.active = false; segAI.setAttribute('aria-selected', 'false'); segPRO.dataset.active = true; segPRO.setAttribute('aria-selected', 'true'); render() };
  navL.onclick = () => { if (mode == 'ai' && aiState.step > 1) { aiState.step--; renderAI() } };
  navR.onclick = () => { if (mode === 'ai' && aiState.step < aiTotal()) { aiState.step++; renderAI() } };
  render();
})();
