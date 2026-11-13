/* =====================================================================
 * SchoolMusic — 배경음악 (파일 없이 브라우저 안에서 직접 합성)
 * ---------------------------------------------------------------------
 * · Web Audio 로 피아노 반주 · 오르골 선율 · 은은한 패드 · 베이스를 그 자리에서 만든다.
 *   음원 파일을 싣지 않으므로 HTML 한 장으로 그대로 돌아가고, 저작권 걱정도 없다(직접 지은 곡).
 * · 곡: C장조 · 80BPM · 16마디(48초) 되풀이. 앞 8마디(졸업 노래 느낌의 진행) + 뒤 8마디(조금 밝게).
 *   첫 바퀴 앞 8마디는 반주만(도입), 그 뒤부터 선율. 바퀴마다 선율 음색과 반주 밀도가 조금씩 바뀐다.
 * · 화면에 맞춰 소리 크기를 바꾼다: 입력 화면 작게 → 이야기 재생 보통 → 일시정지 아주 작게 → 졸업 엔딩 선율 위주.
 *   창을 내리거나 다른 탭으로 가면 멈춘다.
 * · 브라우저는 사용자가 한 번 누르기 전에는 소리를 못 내게 막으므로, 첫 클릭/키 입력 때 켠다.
 * · 켜고 끄기: 입력 화면 오른쪽 위 ♪ 단추 · 재생 화면 조작 막대의 "배경음악" · 키보드 M. 고른 값은 이 브라우저에 기억한다.
 * ===================================================================== */
(function (root) {
  'use strict';
  var doc = root.document;
  if (!doc || !(root.AudioContext || root.webkitAudioContext)) return;

  var LS_KEY = 'yongam.music';
  var BPM = 80, EIGHTH = 60 / BPM / 2, BAR = 8;           // 한 마디 = 8분음표 8개 = 3초
  var LEVEL = { off: 0, input: 0.45, play: 1, paused: 0.3, ending: 0.85 };
  var MASTER = 0.2;

  // ── 곡 ─────────────────────────────────────────────────────────────
  // 화음: [베이스, [화음음…]]  (MIDI 번호, 60 = 가운데 도)
  var CHORDS = [
    [48, [60, 64, 67]], [47, [59, 62, 67]], [45, [57, 60, 64]], [43, [55, 59, 64]],       // C  G/B  Am  Em/G
    [41, [57, 60, 65]], [40, [55, 60, 64]], [38, [57, 60, 62, 65]], [43, [55, 59, 62, 65]], // F  C/E  Dm7 G7
    [41, [57, 60, 65]], [43, [55, 59, 62]], [40, [55, 59, 64]], [45, [57, 60, 64]],       // F  G  Em  Am
    [38, [57, 60, 62, 65]], [43, [55, 59, 62, 65]], [48, [55, 60, 64]], [48, [55, 60, 64]] // Dm7 G7 C C
  ];
  // 선율: 마디마다 [시작(8분음표 칸), 음, 길이(칸)]
  var MELODY = [
    [[0, 76, 3], [3, 74, 1], [4, 72, 2], [6, 74, 2]],
    [[0, 71, 3], [3, 72, 1], [4, 74, 4]],
    [[0, 72, 3], [3, 71, 1], [4, 69, 2], [6, 71, 2]],
    [[0, 67, 4], [4, 71, 2], [6, 72, 2]],
    [[0, 69, 3], [3, 72, 1], [4, 77, 2], [6, 76, 2]],
    [[0, 76, 2], [2, 74, 2], [4, 72, 4]],
    [[0, 74, 2], [2, 72, 2], [4, 69, 2], [6, 72, 2]],
    [[0, 71, 6]],
    [[0, 72, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2]],
    [[0, 74, 3], [3, 71, 1], [4, 74, 2], [6, 79, 2]],
    [[0, 79, 3], [3, 76, 1], [4, 71, 2], [6, 76, 2]],
    [[0, 76, 3], [3, 74, 1], [4, 72, 4]],
    [[0, 72, 2], [2, 74, 2], [4, 77, 2], [6, 76, 2]],
    [[0, 74, 2], [2, 72, 2], [4, 71, 2], [6, 74, 2]],
    [[0, 72, 8]],
    [[6, 74, 2]]
  ];
  var ARP = [0, 1, 2, 1, 3, 1, 2, 1];                      // 반주: 화음음 차례(3 = 맨 아래 음의 옥타브 위)

  // ── 상태 ───────────────────────────────────────────────────────────
  var M = {
    on: readPref(), ctx: null, out: null, wet: null, timer: null, poll: null,
    step: 0, next: 0, life: null, mode: 'input', level: 0, suspendAt: 0, ending: false
  };
  function readPref() { try { var v = root.localStorage.getItem(LS_KEY); return v === null ? true : v === '1'; } catch (e) { return true; } }
  function savePref() { try { root.localStorage.setItem(LS_KEY, M.on ? '1' : '0'); } catch (e) { /* 저장 못 해도 이번에는 그대로 */ } }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // ── 소리 엔진 ──────────────────────────────────────────────────────
  function ensureCtx() {
    if (M.ctx) return M.ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    try { M.ctx = new AC(); } catch (e) { return null; }
    var c = M.ctx;
    var master = c.createGain(); master.gain.value = 0;
    var comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp); comp.connect(c.destination);
    // 잔향: 짧게 사라지는 잡음으로 만든 공간
    var len = Math.floor(c.sampleRate * 2.4), ir = c.createBuffer(2, len, c.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    var verb = c.createConvolver(); verb.buffer = ir;
    var wet = c.createGain(); wet.gain.value = 0.32;
    wet.connect(verb); verb.connect(master);
    M.out = master; M.dry = master; M.wet = wet;
    return c;
  }
  function voiceOut(g, wetAmt) { g.connect(M.dry); if (wetAmt) { var s = M.ctx.createGain(); s.gain.value = wetAmt; g.connect(s); s.connect(M.wet); } }
  function osc(type, f, t, end, dest, detune) {
    var o = M.ctx.createOscillator(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(end); return o;
  }
  function env(t, peak, attack, decay) {
    var g = M.ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }
  function piano(t, m, dur, vel) {
    var f = hz(m), dec = Math.min(2.4, dur + 0.9), g = env(t, 0.16 * vel, 0.006, dec);
    var lp = M.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.4;
    g.connect(lp); voiceOut(lp, 0.5);
    var end = t + dec + 0.05;
    osc('triangle', f, t, end, g);
    var h = M.ctx.createGain(); h.gain.value = 0.18; h.connect(g); osc('sine', f * 2, t, end, h);
  }
  function bell(t, m, dur, vel) {                       // 오르골: 맑은 기본음 + 높은 배음이 먼저 사라진다
    var f = hz(m), dec = Math.min(2.8, dur + 1.4), g = env(t, 0.13 * vel, 0.004, dec);
    voiceOut(g, 0.8);
    var end = t + dec + 0.05;
    osc('sine', f, t, end, g);
    var hg = env(t, 0.05 * vel, 0.002, 0.35); hg.connect(g); osc('sine', f * 4, t, t + 0.45, hg);
    var h2 = env(t, 0.035 * vel, 0.002, 0.6); h2.connect(g); osc('sine', f * 2.01, t, t + 0.7, h2);
  }
  function soft(t, m, dur, vel) {                       // 부드러운 플루트 느낌(엔딩 선율)
    var f = hz(m), len = dur * EIGHTH, g = M.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * vel, t + 0.08);
    g.gain.setValueAtTime(0.09 * vel, t + Math.max(0.1, len - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.6);
    voiceOut(g, 0.7);
    var o = osc('sine', f, t, t + len + 0.7, g);
    var lfo = M.ctx.createOscillator(), lg = M.ctx.createGain(); lfo.frequency.value = 5; lg.gain.value = 4;
    lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + len + 0.7);
  }
  function pad(t, notes, len, vel) {
    var g = M.ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035 * vel, t + 0.9); g.gain.setValueAtTime(0.035 * vel, t + len - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.8);
    var lp = M.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    g.connect(lp); voiceOut(lp, 0.6);
    notes.forEach(function (m) { osc('triangle', hz(m), t, t + len + 0.9, g, -6); osc('triangle', hz(m), t, t + len + 0.9, g, 6); });
  }
  function bass(t, m, len, vel) {
    var g = M.ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.2 * vel, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.3);
    var lp = M.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    g.connect(lp); voiceOut(lp, 0.1);
    osc('sine', hz(m), t, t + len + 0.35, g); osc('triangle', hz(m), t, t + len + 0.35, g);
  }

  /** 8분음표 한 칸을 시각 t 에 놓는다 */
  function playStep(step, t) {
    var bar = Math.floor(step / BAR), pos = step % BAR, cycle = Math.floor(bar / 16), bi = bar % 16;
    var ch = CHORDS[bi], tones = ch[1], end = M.ending;
    var hum = function () { return 0.85 + Math.random() * 0.2; };
    if (pos === 0) pad(t, tones, BAR * EIGHTH, end ? 1.2 : 1);
    if (!end) {
      if (pos === 0) bass(t, ch[0], EIGHTH * 3.5, 1);
      if (pos === 4) bass(t, ch[0] + (bi % 4 === 3 ? 7 : 12), EIGHTH * 3, 0.7);
      var sparse = cycle % 3 === 2 && bi < 8;                            // 셋째 바퀴 앞부분은 반주를 성기게
      if (!sparse || pos % 2 === 0) {
        var k = ARP[pos], m = k === 3 ? tones[0] + 12 : tones[Math.min(k, tones.length - 1)];
        piano(t, m, 1, (pos === 0 ? 0.95 : 0.7) * hum());
      }
    }
    if (cycle === 0 && bi < 8 && !end) return;                           // 첫 바퀴 앞 8마디는 반주만
    var voice = end ? soft : (cycle % 2 === 1 ? bell : piano), up = (!end && cycle % 2 === 1 && bi >= 8) ? 12 : 0;
    MELODY[bi].forEach(function (n) { if (n[0] === pos) voice(t, n[1] + up, n[2], (voice === piano ? 1.15 : 1) * hum()); });
  }

  function schedule() {
    var c = M.ctx; if (!c || c.state !== 'running') return;
    if (M.next < c.currentTime) M.next = c.currentTime + 0.05;         // 밀렸으면(탭이 쉬었다 왔으면) 지금부터
    while (M.next < c.currentTime + 0.3) { playStep(M.step, M.next); M.step++; M.next += EIGHTH; }
  }

  // ── 화면에 맞춘 소리 크기 ─────────────────────────────────────────
  function modeNow() {
    var play = doc.getElementById('screen-play');
    if (!play || play.hidden) return 'input';
    var cur = root.PaljaUI && root.PaljaUI.current && root.PaljaUI.current();
    if (!cur) return 'input';
    if (cur.life && cur.life !== M.life) { M.life = cur.life; M.step = 0; }   // 새 이야기가 시작되면 곡도 처음부터
    if (cur.ended) return 'ending';
    if (cur.started && cur.userPaused) return 'paused';
    return 'play';
  }
  function apply() {
    var mode = modeNow(), want = (!M.on || doc.hidden) ? 0 : LEVEL[mode];
    if (mode === 'ending' && !M.ending) M.ending = true;
    if (mode !== 'ending' && M.ending) M.ending = false;
    M.mode = mode;
    var c = M.ctx; if (!c) return;
    if (want > 0 && c.state === 'suspended') { c.resume().then(function () { M.next = c.currentTime + 0.08; }, function () {}); }
    if (want !== M.level) {
      M.level = want;
      var now = c.currentTime; M.out.gain.cancelScheduledValues(now);
      M.out.gain.setTargetAtTime(want * MASTER, now, want === 0 ? 0.25 : 0.7);
      M.suspendAt = want === 0 ? Date.now() + 1800 : 0;
    }
    if (M.suspendAt && Date.now() > M.suspendAt && c.state === 'running') { M.suspendAt = 0; c.suspend(); }
  }
  function start() {
    if (!M.on) return;
    var c = ensureCtx(); if (!c) return;
    if (c.state === 'suspended') c.resume();
    if (!M.timer) M.timer = setInterval(schedule, 60);
    M.level = -1; apply();
  }

  // ── 켜고 끄는 단추 ─────────────────────────────────────────────────
  var NOTE = 'M9 17.5V6l10-2v11.5M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM9 9.5l10-2';
  var SLASH = 'M3.5 3.5l17 17';
  var NS = 'http://www.w3.org/2000/svg';
  function icon(on) {
    var s = doc.createElementNS(NS, 'svg');
    [['viewBox', '0 0 24 24'], ['width', '20'], ['height', '20'], ['aria-hidden', 'true'], ['focusable', 'false'], ['class', 'icon icon-music'],
      ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.8'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']].forEach(function (a) { s.setAttribute(a[0], a[1]); });
    var p = doc.createElementNS(NS, 'path'); p.setAttribute('d', on ? NOTE : NOTE + SLASH); s.appendChild(p);
    return s;
  }
  function span(cls, text) { var e = doc.createElement('span'); e.className = cls; e.textContent = text; return e; }
  function render() {
    var a = doc.getElementById('in-music'), b = doc.getElementById('ctl-music'), lab = M.on ? '배경음악 끄기' : '배경음악 켜기';
    if (a) { a.textContent = ''; a.appendChild(icon(M.on)); a.setAttribute('aria-pressed', String(M.on)); a.setAttribute('aria-label', lab); a.title = lab + ' (M)'; }
    if (b) {
      b.textContent = ''; b.appendChild(icon(M.on)); b.appendChild(span('ctl-label', '배경음악')); b.appendChild(span('ctl-state', M.on ? '켜짐' : '꺼짐'));
      b.setAttribute('aria-pressed', String(M.on)); b.setAttribute('aria-label', '배경음악 ' + (M.on ? '켜짐' : '꺼짐'));
      if (root.matchMedia && root.matchMedia('(min-width: 900px)').matches) b.setAttribute('data-tip', lab + ' (M)'); else b.removeAttribute('data-tip');
    }
  }
  function toggle() {
    M.on = !M.on; savePref(); render();
    if (M.on) start(); else apply();
  }

  function install() {
    var st = doc.createElement('style'); st.id = 'school-music-css';
    st.textContent = '.in-top { display: flex; gap: 6px; }\n#in-music[aria-pressed="false"], #ctl-music[aria-pressed="false"] { color: var(--ink-3); }\n#ctl-music[aria-pressed="true"] .icon { color: var(--accent); }';
    doc.head.appendChild(st);
    var top = doc.querySelector('.in-top'), theme = doc.getElementById('in-theme');
    if (top && !doc.getElementById('in-music')) {
      var a = doc.createElement('button'); a.type = 'button'; a.className = 'ctl-btn'; a.id = 'in-music';
      top.insertBefore(a, theme || null); a.addEventListener('click', function (ev) { ev.stopPropagation(); toggle(); });
    }
    var menu = doc.getElementById('ctl-menu'), home = doc.getElementById('ctl-home');
    if (menu && !doc.getElementById('ctl-music')) {
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'ctl-item'; b.id = 'ctl-music';
      menu.insertBefore(b, home || null); b.addEventListener('click', function (ev) { ev.stopPropagation(); toggle(); });
    }
    render();
    // 브라우저가 허락하는 첫 순간(누르기 · 키 입력)에 소리를 켠다
    var unlock = function () { if (M.on) start(); if (M.ctx) { ['pointerdown', 'keydown', 'touchend'].forEach(function (n) { doc.removeEventListener(n, unlock, true); }); } };
    ['pointerdown', 'keydown', 'touchend'].forEach(function (n) { doc.addEventListener(n, unlock, true); });
    doc.addEventListener('keydown', function (ev) {
      if ((ev.key !== 'm' && ev.key !== 'M' && ev.key !== 'ㅡ') || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      var t = ev.target, tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
      ev.preventDefault(); toggle();
    });
    doc.addEventListener('visibilitychange', apply);
    M.poll = setInterval(apply, 250);
    root.addEventListener('resize', render);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(install, 0); });
  else setTimeout(install, 0);

  root.SchoolMusic = { toggle: toggle, isOn: function () { return M.on; }, state: function () { return { on: M.on, mode: M.mode, level: M.level, ctx: M.ctx ? M.ctx.state : 'none', step: M.step }; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
