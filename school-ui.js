/* =====================================================================
 * SchoolApp — 화면 연결 (입력 화면 · 저장된 이야기 목록 · 졸업 축하 엔딩)
 * ---------------------------------------------------------------------
 *  - 입력: 원본의 이름 · 성별 칸 + 학년 · 반 · 나의 꿈 · 어린이집 · 유치원 · 친구 · 담임 선생님 · 참여한 활동.
 *    원본의 생년월일 칸은 숨긴 채 학년에 맞는 출생 연도로 채운다(사주 엔진은 풍경의 씨앗으로만 쓴다).
 *    입력값을 다듬는 일은 SchoolSim.normProfile 한 곳에서만 한다.
 *  - 저장된 이야기: 한 번 본 학생은 이 브라우저에 남는다(이름 · 학년 · 반이 같아야 같은 학생). 둘 이상이면 "차례로 모두 보기".
 *  - 엔딩: 원본의 임종 엔딩(PaljaViz.Ending) 자리에 같은 API(mount · show · hide · skip · phase)로 졸업 축하 카드를 끼운다.
 *  - 주소 끝의 ?auto=이름 은 그 학생을 바로 튼다(?auto=all 은 저장된 이야기를 차례로).
 * ===================================================================== */
(function (root) {
  'use strict';
  var doc = root.document, DATA = root.SchoolLifeData, SIM = root.SchoolSim;
  if (!doc || !DATA || !SIM) return;
  function $(id) { return doc.getElementById(id); }
  function el(tag, attrs, kids) {
    var n = doc.createElement(tag), k;
    for (k in attrs || {}) { if (k === 'text') n.textContent = attrs[k]; else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return n;
  }
  function josa(word, pair) { return root.PaljaText ? root.PaljaText.josa(word, pair) : word + pair.split('/')[0]; }
  function fire(node, type) { if (node) node.dispatchEvent(new Event(type, { bubbles: true })); }
  var COUNTDOWN_S = 15;                           // 차례로 보기: 엔딩 뒤 다음 친구까지
  var Q = { keys: [], i: -1 };                    // 차례로 보기 대기열(저장소 열쇠)

  // ------------------------------------------------------------------ 1. 스타일(사주 화면 요소를 감추고, 새 칸과 엔딩을 꾸민다)
  var CSS = [
    // 원본의 사주 칸 · 대운 막대 · 사주/그래프 탭 · 재산 막대 · 지난 인생 목록 · 날짜/시각 칸과 자세한 설정 · 이름/성별 안내 · 시작 막의 여덟 글자
    '#hud-top,#hud-daeun,#tab-saju,#panel-saju,#tab-graph,#panel-graph,#hc-m-wealth,#in-history,#in-hist-hint,#f-date,#f-time,#in-adv,#pv-notes,#pv-name,#pv-gender,.veil-pillars,.veil-reading{display:none!important}',
    '.sc-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '.sc-place{display:grid;gap:8px}.sc-place [hidden]{display:none!important}',
    '.sc-adv .in-adv-body{display:grid;gap:14px}',
    '.sc-checks{display:flex;flex-wrap:wrap;gap:8px 16px}',
    '.sc-note{font-size:var(--fs-xs);color:var(--ink-3);margin:4px 0 0}',
    '.sc-roster{margin:22px auto 0;max-width:640px;padding:0 16px}',
    '.sc-roster h2{font-family:var(--serif);font-size:var(--fs-lg);margin:0 0 10px;display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}',
    '.sc-class{margin:10px 0 4px;font-size:var(--fs-sm);color:var(--ink-3)}',
    '.sc-chips{display:flex;flex-wrap:wrap;gap:8px}',
    '.sc-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line-2);border-radius:var(--r-pill);background:var(--panel);color:var(--ink);padding:6px 6px 6px 12px;font:inherit;font-size:var(--fs-sm)}',
    '.sc-chip button{border:0;background:transparent;color:var(--ink-3);cursor:pointer;font:inherit;padding:2px 6px;border-radius:var(--r-pill)}',
    '.sc-chip .go{color:var(--ink);font-weight:600}',
    '.sc-chip button:hover,.sc-chip button:focus-visible{background:var(--accent-soft);color:var(--ink)}',
    '.sc-end{position:fixed;inset:0;z-index:var(--z-overlay);display:flex;align-items:flex-end;justify-content:center;padding:16px 16px calc(24px + var(--safe-b));pointer-events:none}',
    '.sc-card{pointer-events:auto;max-width:560px;width:100%;max-height:calc(100% - 32px);overflow:auto;background:var(--glass-2);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--line-2);border-radius:var(--r-lg);box-shadow:var(--shadow);padding:22px 22px 18px;opacity:0;transform:translateY(16px);transition:opacity .7s var(--ease),transform .7s var(--ease)}',
    '.sc-card.on{opacity:1;transform:none}',
    '.sc-kicker{margin:0;color:var(--accent);font-size:var(--fs-sm);letter-spacing:.08em}',
    '.sc-title{margin:4px 0 2px;font-family:var(--serif);font-size:var(--fs-2xl);line-height:1.2}',
    '.sc-sub{margin:0 0 14px;color:var(--ink-2);font-size:var(--fs-sm)}',
    '.sc-sec{margin:12px 0 6px;font-size:var(--fs-xs);color:var(--ink-3);letter-spacing:.06em}',
    '.sc-tags{display:flex;flex-wrap:wrap;gap:6px}',
    '.sc-tag{font-size:var(--fs-sm);border-radius:var(--r-pill);background:var(--accent-soft);padding:4px 10px}',
    '.sc-future{margin:0;line-height:1.7;font-size:var(--fs-md)}',
    '.sc-dream{font-size:var(--fs-xs);color:var(--ink-3);margin:6px 0 0}',
    '.sc-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}',
    '.sc-btns .btn{flex:1 1 auto}',
    '.sc-count{font-size:var(--fs-sm);color:var(--ink-3);margin:10px 0 0}',
    '@media (max-width:520px){.sc-title{font-size:var(--fs-xl)}.sc-row{grid-template-columns:1fr}.sc-card{padding:18px 16px 14px}}'
  ].join('\n');

  // ------------------------------------------------------------------ 2. 입력 칸
  function field(id, label, input, note) {
    return el('div', { class: 'in-field', id: 'f-' + id }, [el('label', { class: 'in-label', for: input.getAttribute('data-for') || input.id, text: label }), input, note ? el('p', { class: 'sc-note', text: note }) : null]);
  }
  function select(id, opts, val) {
    var s = el('select', { class: 'select', id: id });
    opts.forEach(function (o) { var op = el('option', { value: String(o[0]), text: o[1] }); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); });
    return s;
  }
  function textIn(id, ph) { return el('input', { class: 'input', id: id, type: 'text', placeholder: ph, autocomplete: 'off', spellcheck: 'false' }); }
  // 어린이집 · 유치원: 조사한 곳 전체가 늘 보이는 선택 상자(id-pick) + "목록에 없음"을 고르면 나타나는 직접 적는 칸(id).
  // (글자 칸 + 추천 목록은 칸에 이미 글자가 있으면 그 글자와 맞는 곳만 보여 줘서, 저장된 학생을 다시 열면 한 곳만 보였다)
  var OWN = '__own__';
  function placePicker(id, kind, what, ph) {
    var opts = [['', '모름 · 비워 두기']];
    DATA.PRESCHOOLS.forEach(function (p) { if (p.kind === kind) opts.push([p.name, p.name]); });
    return choicePicker(id, opts, what + ' 이름 직접 적기', ph);
  }
  // 나의 꿈: 초등학생 희망 직업 상위 20개(조사 순위대로) + 직접 적기. 비워 두면 그 목록에서 하나를 그려 본다
  function dreamPicker(id) {
    var opts = [['', '아직 몰라요 (하나를 그려 줘요)']];
    DATA.DREAMS.forEach(function (d) { opts.push([d.short, d.label || d.short]); });
    var box = choicePicker(id, opts, '나의 꿈 직접 적기', '예: 우주비행사');
    $id(box, id).setAttribute('maxlength', '16');
    return box;
  }
  function $id(node, id) { return node.querySelector('#' + id); }
  function choicePicker(id, opts, ownLabel, ph) {
    opts = opts.concat([[OWN, '직접 적기']]);
    var pick = select(id + '-pick', opts, ''), own = textIn(id, ph);
    own.setAttribute('aria-label', ownLabel); own.hidden = true;
    pick.addEventListener('change', function () { own.hidden = pick.value !== OWN; if (!own.hidden) own.focus(); });
    return el('div', { class: 'sc-place', 'data-for': pick.id }, [pick, own]);
  }
  function getPlace(id) { var pick = $(id + '-pick'), own = $(id); return pick && pick.value !== OWN ? pick.value : (own ? own.value : ''); }
  function setPlace(id, v) {
    var pick = $(id + '-pick'), own = $(id); v = v || '';
    if (!pick || !own) { if (own) own.value = v; return; }
    var known = !v || [].some.call(pick.options, function (o) { return o.value === v && o.value !== OWN; });
    pick.value = known ? v : OWN; own.value = known ? '' : v; own.hidden = known;
  }
  function buildForm() {
    var grid = doc.querySelector('#in-form .in-grid'); if (!grid || $('sc-grade')) return;
    var grades = [], classes = [], g, c;
    for (g = 6; g >= 1; g--) grades.push([g, g + '학년']);
    for (c = 1; c <= 10; c++) classes.push([c, c + '반']);
    grid.appendChild(el('div', { class: 'sc-row in-field', id: 'f-school' }, [field('grade', '학년', select('sc-grade', grades, 6)), field('class', '반', select('sc-class', classes, 1))]));
    grid.appendChild(field('dream', '나의 꿈', dreamPicker('sc-dream'), '영상 끝에 꿈을 이룬 모습이 나와요. 목록에 없으면 "직접 적기"'));
    var checks = el('div', { class: 'sc-checks' });
    DATA.OPTIONAL.forEach(function (o) { checks.appendChild(el('label', { class: 'check' }, [el('input', { type: 'checkbox', id: 'sc-opt-' + o.key }), o.label])); });
    grid.parentNode.insertBefore(el('details', { class: 'in-adv sc-adv', id: 'sc-adv' }, [
      el('summary', {}, [el('span', { class: 'in-adv-title', text: '이야기에 넣을 내용' }), el('span', { class: 'in-adv-sum', text: '비워 두면 기본 이야기로' })]),
      el('div', { class: 'in-adv-body' }, [
        el('div', { class: 'sc-row' }, [field('daycare', '다닌 어린이집', placePicker('sc-daycare', 'daycare', '어린이집', '어린이집 이름')),
                                         field('kinder', '다닌 유치원', placePicker('sc-kinder', 'kinder', '유치원', '유치원 이름'))]),
        field('friends', '친한 친구 (쉼표로 4명까지)', textIn('sc-friends', '예: 이서연, 박하은'), '처음 적은 친구는 유치원 단짝, 마지막 친구는 6학년 단짝으로 나옵니다.'),
        field('teachers', '담임 선생님 (1학년부터 쉼표로)', textIn('sc-teachers', '예: 정다운, , 김하늘, , , 박바름'), '모르는 학년은 비워 두세요. "새 담임 선생님"으로 나옵니다.'),
        el('div', { class: 'in-field' }, [el('div', { class: 'in-label', text: '참여한 활동' }), checks, el('p', { class: 'sc-note', text: '희망자만 했던 활동은 켠 학생에게만 나옵니다.' })])
      ])
    ]), grid.nextSibling);
    ['in-name', 'sc-grade', 'sc-class'].forEach(function (id) { var n = $(id); if (n) { n.addEventListener('input', syncDate); n.addEventListener('change', syncDate); } });
    var nm = $('in-name'); if (nm) nm.setAttribute('placeholder', '자기 이름');
  }
  /** 입력 칸 → 다듬은 학생 정보 */
  function readForm() {
    var g = doc.querySelector('input[name="gender"]:checked'), opts = {};
    DATA.OPTIONAL.forEach(function (o) { var c = $('sc-opt-' + o.key); opts[o.key] = !!(c && c.checked); });
    var val = function (id) { return ($(id) || {}).value || ''; };
    return SIM.normProfile({ name: val('in-name'), gender: g ? g.value : '', grade: val('sc-grade'), classNo: val('sc-class'), daycare: getPlace('sc-daycare'), kinder: getPlace('sc-kinder'), dream: getPlace('sc-dream'),
                             friends: val('sc-friends'), teachers: val('sc-teachers'), opts: opts });
  }
  function fillForm(p) {
    if (!p) return;
    var set = function (id, v) { var n = $(id); if (n) n.value = v === undefined || v === null ? '' : v; }, ts = [], i;
    set('in-name', p.name); set('sc-grade', p.grade || 6); set('sc-class', p.classNo || 1); setPlace('sc-daycare', p.daycare); setPlace('sc-kinder', p.kinder); setPlace('sc-dream', p.dream);
    set('sc-friends', (p.friends || []).join(', '));
    for (i = 1; i <= 6; i++) ts.push((p.teachers && p.teachers[i]) || '');
    while (ts.length && !ts[ts.length - 1]) ts.pop();
    set('sc-teachers', ts.join(', '));
    DATA.OPTIONAL.forEach(function (o) { var c = $('sc-opt-' + o.key); if (c) c.checked = !!(p.opts && p.opts[o.key]); });
    var r = p.gender === 'M' || p.gender === 'F' ? $(p.gender === 'M' ? 'in-gender-m' : 'in-gender-f') : null;
    if (r) { r.checked = true; fire(r, 'change'); }
    syncDate();
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** 숨긴 원본 칸을 맞춘다: 생년월일 = 학년의 출생 연도, 시각은 비움, 양력, 시드 비움 */
  function syncDate() {
    var d = SIM.dateFor(readForm()), date = $('in-date'), time = $('in-time'), solar = $('in-cal-solar'), seed = $('in-seed'), v = d.year + '.' + pad(d.month) + '.' + pad(d.day);
    if (solar && !solar.checked) { solar.checked = true; fire(solar, 'change'); }
    if (time && time.value) { time.value = ''; fire(time, 'input'); }
    if (seed) seed.value = '';
    if (date && date.value !== v) { date.value = v; fire(date, 'input'); }
  }
  /** 원본의 시작 처리보다 먼저(문서 단계의 붙잡기) 불린다. 이름이 없으면 막고, 성별이 없으면 원본이 알려 주게 둔다 */
  function onSubmit(e) {
    if (!e.target || e.target.id !== 'in-form') return;
    syncDate();
    var p = readForm(), err = $('err-name'), named = !!String(($('in-name') || {}).value || '').trim();
    if (!named) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (err) { err.textContent = '이름을 적어 주세요'; err.hidden = false; }
      stopQueue(); return;
    }
    if (err) err.hidden = true;
    if (!p.gender) { stopQueue(); return; }
    SIM.profiles.put(p); SIM.profiles.current = p;
    renderRoster();
  }

  // ------------------------------------------------------------------ 3. 저장된 이야기
  function stopQueue() { Q.keys = []; Q.i = -1; }
  function renderRoster() {
    var host = $('sc-roster'); if (!host) return;
    host.textContent = '';
    var all = SIM.profiles.list();
    host.hidden = !all.length;
    if (!all.length) return;
    var head = el('h2', {}, [el('span', { text: '이 컴퓨터에 저장된 이야기 ' + all.length + '개' })]);
    if (all.length > 1) {
      var playAll = el('button', { type: 'button', class: 'btn btn-sm btn-primary', text: '차례로 모두 보기' });
      playAll.addEventListener('click', function () { Q.keys = all.map(SIM.profiles.key); Q.i = -1; next(); });
      head.appendChild(playAll);
    }
    host.appendChild(head);
    var groups = {}, order = [];
    all.forEach(function (p) { var k = p.grade + '학년 ' + p.classNo + '반'; if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(p); });
    order.forEach(function (k) {
      var chips = el('div', { class: 'sc-chips' });
      groups[k].forEach(function (p) {
        var go = el('button', { type: 'button', class: 'go', text: p.name, 'aria-label': p.name + ' 이야기 보기' }), x = el('button', { type: 'button', text: '×', 'aria-label': p.name + ' 목록에서 지우기' });
        go.addEventListener('click', function () { stopQueue(); play(p); });
        x.addEventListener('click', function () {
          if (root.confirm && !root.confirm(josa(p.name, '의/의') + ' 이야기를 목록에서 지울까요?')) return;
          SIM.profiles.remove(p); renderRoster();
        });
        chips.appendChild(el('span', { class: 'sc-chip' }, [go, x]));
      });
      host.appendChild(el('p', { class: 'sc-class', text: k }));
      host.appendChild(chips);
    });
  }
  function play(p) {
    fillForm(p);
    var f = $('in-form');
    setTimeout(function () { if (f && f.requestSubmit) f.requestSubmit(); else if ($('in-start')) $('in-start').click(); }, 60);
  }
  function byKey(key) { var hit = null; SIM.profiles.list().forEach(function (p) { if (SIM.profiles.key(p) === key) hit = p; }); return hit; }
  function next() {
    while (++Q.i < Q.keys.length) { var p = byKey(Q.keys[Q.i]); if (p) { play(p); return true; } }
    stopQueue(); return false;
  }
  function nextName() { for (var i = Q.i + 1; i < Q.keys.length; i++) { var p = byKey(Q.keys[i]); if (p) return p.name; } return null; }

  // ------------------------------------------------------------------ 4. 졸업 축하 엔딩 (원본 PaljaViz.Ending 과 같은 API)
  var End = { host: null, node: null, state: 'off', timer: 0, tick: 0 };
  function endingCard(life) {
    var S = life.schoolLife || {}, p = S.profile || {}, C = S.cohort || {}, graduating = p.grade === 6;
    var tags = el('div', { class: 'sc-tags' });
    (life.summary.turningPoints || []).filter(function (t) { return t.age <= 13; }).forEach(function (t) { tags.appendChild(el('span', { class: 'sc-tag', text: t.title })); });
    return {
      kicker: S.school.name + ' 제' + C.gradNo + '회 ' + (graduating ? '졸업' : '졸업 예정'),
      title: graduating ? life.name + ', 졸업을 축하해!' : life.name + '의 초등학교 이야기',
      sub: p.grade + '학년 ' + p.classNo + '반 · ' + C.entryYear + '년 입학 · ' + C.gradCalYear + '년 졸업' + (graduating ? '' : ' 예정'),
      tags: tags,
      future: S.middle.name + '에 입학하고, 자라서 ' + josa(S.future.job, '이/가') + ' 되어, 소중한 사람들과 오래오래 행복하게 살았습니다.',
      dream: graduating ? '중학교와 미래의 모습은 졸업을 축하하며 그려 본 상상입니다. 실제 중학교 배정은 교육지원청 추첨으로 정해집니다.'
        : '아직 오지 않은 학년의 일과 중학교 · 미래의 모습은 그려 본 상상입니다.'
    };
  }
  var Ending = {
    mount: function (host) { End.host = host; },
    show: function (chart, life, handlers) {
      Ending.hide();
      var h = handlers || {}, c = endingCard(life), upNext = Q.keys.length ? nextName() : null;
      // 같은 이야기 = 같은 이야기 번호(life.seed)로 다시, 다른 이야기 = 원본이 새 번호를 뽑아 다시
      var again = el('button', { type: 'button', class: 'btn', text: '같은 이야기 다시 보기' }), other = el('button', { type: 'button', class: 'btn', text: '다른 이야기 보기' });
      var home = el('button', { type: 'button', class: 'btn', text: '처음으로' });
      var nextBtn = upNext ? el('button', { type: 'button', class: 'btn btn-primary', text: '다음 친구: ' + upNext }) : null, count = upNext ? el('p', { class: 'sc-count' }) : null;
      var card = el('div', { class: 'sc-card', role: 'dialog', 'aria-label': c.title }, [
        el('p', { class: 'sc-kicker', text: c.kicker }), el('h2', { class: 'sc-title', text: c.title }), el('p', { class: 'sc-sub', text: c.sub }),
        el('p', { class: 'sc-sec', text: '우리가 함께한 시간' }), c.tags,
        el('p', { class: 'sc-sec', text: '그리고 그 뒤의 이야기' }), el('p', { class: 'sc-future', text: c.future }), el('p', { class: 'sc-dream', text: c.dream }),
        el('div', { class: 'sc-btns' }, [nextBtn, other, again, home]), count
      ]);
      var wrap = el('div', { class: 'sc-end' }, [card]);
      function reveal() { card.classList.add('on'); End.state = 'summary'; }
      (End.host || doc.body).appendChild(wrap);
      End.node = wrap; End.state = 'peek';
      End.timer = setTimeout(reveal, 3200);              // 먼저 걸어온 길 전체를 잠시 보여 준다
      wrap.addEventListener('click', function (e) { if (e.target !== wrap) reveal(); });
      function leave(action, arg) {
        return function () {
          Ending.hide();
          if (action === 'next') { if (h.onNewPerson) h.onNewPerson(); setTimeout(next, 400); return; }
          stopQueue(); if (h[action]) h[action](arg);
        };
      }
      again.addEventListener('click', leave('onReplay', { input: chart.input, seed: life.seed }));     // 원본: start(entry.input, entry.seed)
      other.addEventListener('click', leave('onReplaySame'));                                         // 원본: start(input) → 새 이야기 번호
      home.addEventListener('click', leave('onNewPerson'));
      if (nextBtn) {
        var left = COUNTDOWN_S, say = function () { count.textContent = left + '초 뒤에 다음 친구의 이야기가 시작됩니다.'; };
        nextBtn.addEventListener('click', leave('next')); say();
        End.tick = setInterval(function () { if (--left <= 0) leave('next')(); else say(); }, 1000);
      }
      return Promise.resolve();
    },
    hide: function () { clearTimeout(End.timer); clearInterval(End.tick); if (End.node && End.node.parentNode) End.node.parentNode.removeChild(End.node); End.node = null; End.state = 'off'; },
    skip: function () { if (End.node) { var c = End.node.querySelector('.sc-card'); if (c) c.classList.add('on'); End.state = 'summary'; } },
    phase: function () { return End.state; }
  };

  // ------------------------------------------------------------------ 5. 원본 화면이 부르는 것
  root.SchoolApp = {
    /** 시작 막의 둘째 줄(원본은 생년월일) */
    veilText: function (life) {
      var S = life && life.schoolLife; if (!S) return '';
      return S.school.name + ' ' + S.profile.grade + '학년 ' + S.profile.classNo + '반 · 제' + S.cohort.gradNo + '회 ' + (S.profile.grade === 6 ? '졸업' : '졸업 예정');
    },
    readForm: readForm, fillForm: fillForm, play: play, Ending: Ending
  };

  // ------------------------------------------------------------------ 6. 설치(원본 화면이 준비된 뒤)
  function install() {
    var st = el('style', { id: 'school-css' }); st.textContent = CSS; doc.head.appendChild(st);
    buildForm();
    var below = doc.querySelector('.in-below');
    if (below && !$('sc-roster')) below.insertBefore(el('section', { class: 'sc-roster', id: 'sc-roster', 'aria-label': '저장된 이야기', hidden: 'hidden' }), below.firstChild);
    renderRoster();
    var last = null; SIM.profiles.list().forEach(function (p) { if (!last || (p.savedAt || 0) > (last.savedAt || 0)) last = p; });
    if (last) fillForm(last); else syncDate();
    doc.addEventListener('submit', onSubmit, true);
    if (root.PaljaViz) root.PaljaViz.Ending = Ending;
    var m = /[?&]auto=([^&]+)/.exec((root.location && root.location.search) || '');
    if (m) setTimeout(function () {
      var v = decodeURIComponent(m[1]);
      if (v === 'all') { Q.keys = SIM.profiles.list().map(SIM.profiles.key); Q.i = -1; next(); }
      else play(SIM.profiles.find(v) || { name: v, gender: 'F', grade: 6, classNo: 1 });
    }, 1500);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', function () { setTimeout(install, 0); });
  else setTimeout(install, 0);
})(typeof globalThis !== 'undefined' ? globalThis : this);
