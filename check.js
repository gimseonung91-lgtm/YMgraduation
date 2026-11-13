// 「용암초 6년」 점검: 만든 yongam-graduation.html 에서 모듈을 꺼내(설치할 것 없음) 여러 학생 · 여러 이야기 번호로 영상을 만들어 보고 규칙을 확인한다.
// 사용법: 이 폴더에서  node build.js && node check.js        실패가 있으면 종료 코드 1
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const HTML = path.join(__dirname, 'yongam-graduation.html');
const MODS = ['text-kit', 'vocab', 'pacing', 'stage-director', 'stage-sets', 'stage-sets-work', 'school-life-data', 'school-sim', 'school-stage'];
const YEAR_LEN = 14;                     // 원본 무대: 1년 = 14m
const LIMITS = { walkMax: 4.6, walkMaxFast: 10.5, accelMax: 0.6, readMin: 2.8, epilogueMax: 45 };   // 걷기 m/s(학교 시절 · 졸업 뒤) · 0.2초 사이 속도 변화 · 자막 최소 초 · 졸업 뒤 최대 초
const CAST_TOKENS = ['father', 'mother', 'teacher', 'teacher6', 'friend', 'classmates', 'bestFriends'];

// ------------------------------------------------------------------ 모듈 싣기
const html = fs.readFileSync(HTML, 'utf8'), warnings = [];
const ctx = vm.createContext({ console: { log() {}, info() {}, error: (...a) => warnings.push(a.join(' ')), warn: (...a) => warnings.push(a.join(' ')) }, Math, Date, JSON });
for (const m of MODS) {
  const hit = new RegExp('<script id="mod-' + m + '" data-src="[^"]*">([\\s\\S]*?)</script>').exec(html);
  if (!hit) throw new Error('모듈을 찾지 못했습니다: ' + m);
  vm.runInContext(hit[1], ctx, { filename: m + '.js' });
}
const { SchoolSim: SIM, SchoolLifeData: D, PaljaDirector: DIR, PaljaSets: SETS, PaljaVocab: V, PaljaPacing: PACING } = ctx;

const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail: ok ? '' : detail }); }
function lifeFor(raw, seed) {
  const p = SIM.normProfile(raw), d = SIM.dateFor(p);
  SIM.profiles.current = p;
  const chart = SIM.schoolifyChart({ input: { name: p.name, gender: p.gender }, solar: { y: d.year, m: d.month, d: d.day } });
  return { p, chart, life: SIM.generate(chart, seed) };
}
const textsOf = list => (list || []).map(t => typeof t === 'string' ? t : t.t);

// ------------------------------------------------------------------ 1. 데이터 표
const known = { action: DIR.ACTIONS, expr: DIR.EXPRESSIONS, prop: DIR.PROPS, bubble: DIR.BUBBLES, fx: DIR.FX };
const nameErrs = [], setErrs = [], dataErrs = [];
function checkSet(label, s) { if (s && s !== 'future' && !SETS.LIST[s[0]]) setErrs.push(label + ' → ' + s[0]); }
for (const [k, d] of Object.entries(D.DIRECTION)) {
  if (!D.KINDS[k]) nameErrs.push(k + ': KINDS 에 없음');
  if (d.bubble && known.bubble.indexOf(d.bubble) < 0) nameErrs.push(k + ': 그림 ' + d.bubble);
  if (d.fx && known.fx.indexOf(d.fx) < 0) nameErrs.push(k + ': 입자 ' + d.fx);
  const [a, e, pr] = d.re; if (known.action.indexOf(a) < 0) nameErrs.push(k + ': 동작 ' + a); if (known.expr.indexOf(e) < 0) nameErrs.push(k + ': 표정 ' + e); if (pr && known.prop.indexOf(pr) < 0) nameErrs.push(k + ': 소품 ' + pr);
  if (d.cast) { if (known.action.indexOf(d.cast[0]) < 0) nameErrs.push(k + ': 함께한 사람 동작 ' + d.cast[0]); if (known.expr.indexOf(d.cast[1]) < 0) nameErrs.push(k + ': 함께한 사람 표정 ' + d.cast[1]); }
  checkSet('연출 ' + k, d.set);
}
D.DREAMS.concat(D.DREAM_EXTRA, [D.DREAM_ANY]).forEach(f => {
  checkSet('꿈 ' + (f.short || '모름'), f.set);
  if (!V.JOB_KINDS[f.jobKind]) dataErrs.push('꿈 ' + f.short + ': jobKind ' + f.jobKind);
  if (!(f.scenes || []).length) dataErrs.push('꿈 ' + f.short + ': 꿈을 이룬 모습 문장 없음');
});
{
  const shorts = new Set(D.DREAMS.concat(D.DREAM_EXTRA).map(d => d.short));
  D.DREAM_WORDS.forEach(([re, to]) => { if (!shorts.has(to)) dataErrs.push('꿈 알아보기 → 없는 직업 ' + to + ' (' + re + ')'); });
}
for (const k of Object.keys(D.KINDS)) if (!D.DIRECTION[k]) nameErrs.push(k + ': 연출 표에 없음');
const dirCheck = DIR.checkTable(V).bad.filter(b => Object.keys(D.KINDS).some(k => b.indexOf(k + ':') === 0));
check('연출 표의 이름이 모두 원본 목록에 있다', !nameErrs.length && !dirCheck.length, nameErrs.concat(dirCheck).join(' / '));
check('장면 세트가 모두 원본에 있다', !setErrs.length, setErrs.join(' / '));
D.ANCHORS.concat(D.POOL).forEach((r, i) => {
  const tag = (r.kind || '?') + '#' + i;
  if (!D.KINDS[r.kind]) dataErrs.push(tag + ': 종류');
  if (r.src && !D.SRC_LABEL[r.src]) dataErrs.push(tag + ': 출처 ' + r.src);
  (r.cast || []).forEach(c => { if (CAST_TOKENS.indexOf(c) < 0) dataErrs.push(tag + ': cast ' + c); });
  if (!textsOf(r.texts).length) dataErrs.push(tag + ': 문장 없음');
  if (r.grades && r.grades.some(g => g < 1 || g > 6)) dataErrs.push(tag + ': 학년');
  if (r.months && r.months.some(m => m < 3 || m > 12)) dataErrs.push(tag + ': 달');
  if (r.major && !(D.DIRECTION[r.kind] || {}).set) dataErrs.push(tag + ': 큰 장면인데 세트 없음');
});
check('사건표 · 뽑기 상자의 칸이 바르다', !dataErrs.length, dataErrs.slice(0, 8).join(' / '));

// ------------------------------------------------------------------ 2. 여러 학생 × 여러 이야기 번호
const MATRIX = [];
for (const grade of [6, 5, 4, 3, 2, 1]) for (const gender of ['F', 'M']) {
  MATRIX.push({ name: '김테스트', gender, grade, classNo: 3, opts: {} });
  MATRIX.push({ name: '남궁 가 나', gender, grade, classNo: 7, kinder: '유한유치원', daycare: '쌍용어린이집', friends: '이서연, 이서연, 박하은, 김테스트, 최지호, 강민준',
                teachers: '정다운 선생님, , 김하늘, , , 박바름', opts: { band: true, gugak: true, ai: true, coding: true }, dream: gender === 'F' ? '수의사' : '축구 선수' });
}
const SEEDS = [1, 77, 4242];
const perStudent = [];
for (const raw of MATRIX) {
  const tag = `${raw.grade}학년 ${raw.gender} ${raw.name}`, errs = [];
  let stat = null;
  for (const seed of SEEDS) {
    const warn0 = warnings.length;
    let r; try { r = lifeFor(raw, seed); } catch (e) { errs.push('만들기 ' + e.message); continue; }
    const { life, chart, p } = r, sch = PACING.build(life);
    const ids = new Set(life.npcs.map(n => n.id)), evIds = new Set(), texts = new Set();
    life.events.forEach((e, i) => {
      if (evIds.has(e.id)) errs.push('사건 번호 겹침 ' + e.id); evIds.add(e.id);
      if (i && e.age < life.events[i - 1].age) errs.push('나이 순서 ' + e.id);
      if (/[{}]|undefined|null|NaN/.test(e.text + e.title)) errs.push('빈칸 문장: ' + e.title + ' / ' + e.text);
      if (e.kind !== 'daeun' && texts.has(e.text)) errs.push('같은 문장 반복: ' + e.text); texts.add(e.text);
      e.npcIds.forEach(id => { if (!ids.has(id)) errs.push('없는 인물 ' + id); });
      if (e.kind === 'daeun' && !chart.daeun.list.some(g => g.stop && g.startAge === e.age)) errs.push('멈추지 않는 문에 사건 ' + e.age);
      if (e.major && e._set) {
        const y = life.years[e.age], q = { purpose: 'event', kind: e.kind, event: Object.assign({}, e), state: y.state, prevState: y.state, year: y.year, age: y.age, family: life.family, gender: life.gender };
        const got = SETS.pick(q); if (!got || got.name !== e._set[0]) errs.push(e.kind + ' 세트 ' + (got && got.name) + ' ≠ ' + e._set[0]);
      }
    });
    for (let g = 1; g <= 6; g++) { const n = life.events.filter(e => e.age === 6 + g && e.kind !== 'daeun').length; if (n < 3) errs.push(g + '학년 장면 ' + n + '개뿐'); }
    life.npcs.forEach(n => { if (n.zodiacName || n.dayStemName || n.compat) errs.push('띠·일간·궁합이 남은 인물 ' + n.name); });
    const names = life.npcs.filter(n => n.role === 'friend').map(n => n.name);
    if (new Set(names).size !== names.length || names.indexOf(life.name) >= 0) errs.push('친구 이름 겹침 ' + names.join(','));
    if (warnings.length > warn0) errs.push('경고 ' + warnings.slice(warn0).join(' | '));
    if (JSON.stringify(lifeFor(raw, seed).life) !== JSON.stringify(life)) errs.push('같은 이야기 번호인데 결과가 다르다');
    // 속도
    let walkMax = 0, walkMaxFast = 0, accelMax = 0, prev = null, gapMin = Infinity;
    const fastFrom = SIM.fastFromAge(life);
    for (let t = 0; t < sch.totalMs - 200; t += 200) {
      const v = (sch.walkAgeAt(t + 200) - sch.walkAgeAt(t)) * YEAR_LEN / 0.2;
      if (sch.walkAgeAt(t) < fastFrom - 0.5) walkMax = Math.max(walkMax, v); else walkMaxFast = Math.max(walkMaxFast, v);
      if (prev !== null) accelMax = Math.max(accelMax, Math.abs(v - prev)); prev = v;
    }
    for (let i = 1; i < sch.slots.length; i++) gapMin = Math.min(gapMin, (sch.slots[i].t - sch.slots[i - 1].t) / 1000);
    const mid = sch.slots.find(s => s.event.kind === 'middle_enter'), epilogue = mid ? (sch.totalMs - mid.t - mid.hold) / 1000 : 0;
    if (walkMax > LIMITS.walkMax) errs.push('학교 시절 걷기 ' + walkMax.toFixed(1) + 'm/s');
    if (walkMaxFast > LIMITS.walkMaxFast) errs.push('졸업 뒤 걷기 ' + walkMaxFast.toFixed(1) + 'm/s');
    if (accelMax > LIMITS.accelMax) errs.push('속도 변화 ' + accelMax.toFixed(2) + 'm/s');
    if (gapMin < LIMITS.readMin) errs.push('자막 ' + gapMin.toFixed(1) + '초');
    if (epilogue > LIMITS.epilogueMax) errs.push('졸업 뒤 ' + epilogue.toFixed(0) + '초');
    const future = life.events.filter(e => e.basis[0].label === '앞으로의 일').length;
    if (p.grade === 6 && future) errs.push('6학년인데 앞으로의 일 ' + future);
    if (p.grade < 6 && !future) errs.push(p.grade + '학년인데 앞으로의 일이 없다');
    if (!stat) stat = `${life.birthYear}년생 · 사건 ${life.events.length} · ${(sch.totalMs / 1000).toFixed(0)}초 · 걷기 ${walkMax.toFixed(1)}/${walkMaxFast.toFixed(1)}m/s · 자막 최소 ${gapMin.toFixed(1)}초`;
  }
  check(tag + ` (이야기 번호 ${SEEDS.length}개)`, !errs.length, [...new Set(errs)].slice(0, 6).join(' / '));
  perStudent.push(tag + ': ' + stat);
}

// ------------------------------------------------------------------ 3. 다양함: 같은 학생을 여러 번 보면 이야기가 달라지는가
const VARIETY_N = 60, kid = { name: '김졸업', gender: 'F', grade: 6, classNo: 2, opts: {} };
const stories = new Set(), picked = {}, perGrade = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set(), 5: new Set(), 6: new Set() }, majors = {}, endings = new Set();
let aiAlways = true, graduationOrder = true;
for (let s = 1; s <= VARIETY_N; s++) {
  const life = lifeFor(kid, s * 7919).life, kinds = life.events.map(e => e.kind);
  stories.add(life.events.map(e => e.kind + ':' + e.text).join('|'));
  life.events.forEach(e => { picked[e.kind] = (picked[e.kind] || 0) + 1; const g = e.age - 6; if (perGrade[g]) perGrade[g].add(e.kind + ':' + e.text); if (e.major && g >= 2 && g <= 5) (majors[g] = majors[g] || new Set()).add(e.kind); });
  endings.add(life.schoolLife.middle.name + '/' + life.schoolLife.future.short);
  if (kinds.indexOf('ai_experience') < 0) aiAlways = false;
  if (kinds.filter(k => k !== 'daeun').slice(-4).join(',') !== 'graduation,middle_enter,grown_up,happy_life') graduationOrder = false;
}
const poolKinds = [...new Set(D.POOL.map(it => it.kind))], never = poolKinds.filter(k => !picked[k]);
check(`다양함: 같은 학생 ${VARIETY_N}번 → 서로 다른 이야기 ${stories.size}개`, stories.size >= VARIETY_N * 0.95, stories.size + '개');
check(`다양함: 뽑기 상자의 활동 ${poolKinds.length}가지가 모두 한 번 이상 나온다(2026 6학년 기준)`, !never.length, '안 나온 것: ' + never.join(', '));
check('다양함: 2~5학년의 큰 장면이 학년마다 2가지 이상', [2, 3, 4, 5].every(g => majors[g] && majors[g].size >= 2), JSON.stringify(Object.fromEntries(Object.entries(majors).map(([g, s]) => [g, [...s]]))));
check('6학년: 교내 AI 체험은 모든 이야기에 나온다(확인된 사실)', aiAlways, '');
check('6학년: 졸업 → 중학교 → 꿈 → 행복으로 끝난다(모든 이야기)', graduationOrder, '');
{
  const { life } = lifeFor(kid, 1), kinds = life.events.map(e => e.kind);
  check('6학년: 2014년생 · 2021년 입학 · 제28회 졸업', life.birthYear === 2014 && life.schoolLife.cohort.entryYear === 2021 && life.schoolLife.cohort.gradNo === 28, JSON.stringify(life.schoolLife.cohort));
  check('6학년: 수학여행을 간 이야기가 없다 · 임종 장면이 없다', !life.events.some(e => /수학여행을 (떠|갔)/.test(e.text)) && kinds.indexOf('death') < 0, '');
}

// ------------------------------------------------------------------ 4. 나의 꿈: 고른 꿈 · 직접 적은 꿈 → 꿈을 이룬 장면
const josa = (w, pr) => ctx.PaljaText.josa(w, pr);
function grownUp(dream, seed) {
  const { life } = lifeFor({ name: '김꿈', gender: 'F', grade: 6, classNo: 1, opts: {}, dream }, seed || 1);
  const e = life.events.find(x => x.kind === 'grown_up'), y = life.years[e.age];
  const got = SETS.pick({ purpose: 'event', kind: e.kind, event: Object.assign({}, e), state: y.state, prevState: y.state, year: y.year, age: y.age, family: life.family, gender: life.gender });
  return { life, e, y, got };
}
{
  const ranks = new Set(D.DREAMS.map(d => d.rank)), errs = [];
  for (let r = 1; r <= 20; r++) if (!ranks.has(r)) errs.push(r + '위 없음');
  D.DREAMS.forEach(d => {
    const { e, y, got, life } = grownUp(d.short);
    if (e.text.indexOf(josa(d.short, '이/가') + ' 되었다') < 0) errs.push(d.short + ': ' + e.text);
    if (!got || got.name !== d.set[0] || e._set[0] !== d.set[0]) errs.push(d.short + ': 장면 ' + (got && got.name));
    if (y.state.jobKind !== d.jobKind || y.state.job !== d.short) errs.push(d.short + ': 어른 모습 ' + y.state.jobKind);
    if (/[{}]|undefined/.test(e.text + e.title)) errs.push(d.short + ': 빈칸 ' + e.text);
    if (life.schoolLife.future.how !== 'list') errs.push(d.short + ': 목록에서 고른 꿈으로 알아보지 못함');
  });
  check(`나의 꿈: 목록의 ${D.DREAMS.length}가지(조사 1~20위)를 고르면 그 꿈을 이룬 장면 · 문장 · 옷차림이 나온다`, !errs.length, errs.slice(0, 6).join(' / '));
}
{
  // [적은 꿈, 기대하는 장면, 문장에 들어갈 이름(적은 그대로가 아니면)]
  const CASES = [['소방관', 'police'], ['유튜버', 'stage'], ['축구 선수', 'gym'], ['국가대표', 'gym'], ['태권도 사범', 'gym'], ['수의사가 될래요', 'hospital_office', '수의사'],
    ['선생님이 되고 싶어요', 'classroom', '선생님'], ['유치원 선생님', 'classroom'], ['사진작가', 'shop'], ['웹소설 작가', 'writer_room'], ['게임 개발자', 'dev_office'],
    ['아이돌', 'stage'], ['우주비행사', 'lab'], ['마법사', 'award_stage'], ['CEO', 'office'], ['파일럿', 'garage']], errs = [];
  CASES.forEach(([dream, set, word]) => {
    const { e, got } = grownUp(dream), w = word || dream;
    if (!got || got.name !== set) errs.push(dream + ' → ' + (got && got.name) + ' (기대 ' + set + ')');
    if (e.text.indexOf(josa(w, '이/가') + ' 되었다') < 0) errs.push(dream + ': ' + e.text);
  });
  check(`나의 꿈: 직접 적은 꿈 ${CASES.length}가지를 비슷한 직업 장면으로 알아본다(모르는 꿈은 시상식 무대)`, !errs.length, errs.join(' / '));
}
{
  const seen = new Set(), errs = [];
  for (let s = 1; s <= 60; s++) { const { life, e } = grownUp('', s * 31); seen.add(life.schoolLife.future.short); if (life.schoolLife.future.how !== 'pick') errs.push('비운 꿈 ' + life.schoolLife.future.how); if (/[{}]|undefined/.test(e.text)) errs.push(e.text); }
  const a = grownUp('의사').e.text, b = grownUp('선생님').e.text;
  if (a.indexOf('의사가 되었다') < 0 || b.indexOf('선생님이 되었다') < 0) errs.push('조사: ' + a + ' / ' + b);
  check(`나의 꿈: 비워 두면 조사 목록에서 고르고(60번 → ${seen.size}가지), "의사가 · 선생님이" 조사가 맞다`, !errs.length && seen.size >= 10, errs.slice(0, 4).join(' / ') || seen.size + '가지');
}

// ------------------------------------------------------------------ 5. 저장소: 같은 이름 다른 반
{
  SIM.profiles._reset();
  const a = SIM.normProfile({ name: '김민준', gender: 'M', grade: 6, classNo: 2 }), b = SIM.normProfile({ name: '김민준', gender: 'M', grade: 6, classNo: 5 });
  SIM.profiles.put(a); SIM.profiles.put(b);
  check('저장소: 같은 이름의 다른 반 학생이 둘 다 남는다', SIM.profiles.list().length === 2, SIM.profiles.list().length + '명');
  SIM.profiles.remove(a);
  check('저장소: 한 명만 지운다', SIM.profiles.list().length === 1 && SIM.profiles.list()[0].classNo === 5, '');
  SIM.profiles.put(SIM.normProfile({ name: '이꿈', gender: 'F', grade: 6, classNo: 1, dream: '  우주   비행사<script>  ' }));
  const kept = SIM.profiles.list().find(p => p.name === '이꿈');
  check('저장소: 나의 꿈이 다듬어져 남는다', kept && kept.dream === '우주 비행사script', kept && kept.dream);
}

// ------------------------------------------------------------------ 한 파일로 나눠 줄 수 있나(인터넷 없이) · 배경음악
{
  const crypto = require('crypto'), libs = [['lunar-javascript', 'lunar-javascript@1.7.7'], ['korean-lunar-calendar', 'korean-lunar-calendar@0.4.0'], ['three', 'three@0.149.0']], miss = [];
  for (const [id, name] of libs) {
    const open = '<script id="vendor-' + id + '"', at = html.indexOf(open), from = html.indexOf('>\n', at) + 2, to = html.indexOf('\n</script>', from);
    const line = html.split('\n').find(l => l.includes('name: "' + name + '"')), sri = line && /sri: "([^"]+)"/.exec(line);
    if (at < 0 || !sri || 'sha384-' + crypto.createHash('sha384').update(html.slice(from, to), 'utf8').digest('base64') !== sri[1]) miss.push(name);
  }
  check('인터넷 없이: 라이브러리 3개가 HTML 안에 원본 해시 그대로 들어 있다', !miss.length, miss.join(', '));
  check('인터넷 없이: 로더보다 먼저 실린다(로더가 내려받지 않는다)', html.indexOf('<script id="vendor-three"') > 0 && html.indexOf('<script id="vendor-three"') < html.indexOf('<script id="lib-loader">'), '순서');
  const mus = /<script id="mod-school-music" data-src="[^"]*">([\s\S]*?)<\/script>/.exec(html);
  let musOk = false, musErr = '없음';
  if (mus) try { const c = vm.createContext({}); vm.runInContext(mus[1], c); musOk = c.SchoolMusic === undefined; musErr = '브라우저가 아닌데 실렸다'; } catch (e) { musErr = e.message; }
  check('배경음악: 모듈이 있고, 소리를 낼 수 없는 곳에서는 조용히 빠진다', musOk, musErr);
}

// ------------------------------------------------------------------ 결과
const bad = results.filter(r => !r.ok);
results.forEach(r => console.log((r.ok ? '  통과  ' : '  실패  ') + r.name + (r.ok ? '' : '\n         ' + r.detail)));
console.log('\n' + perStudent.slice(0, 4).join('\n') + '\n  …');
console.log(`\n같은 학생 ${VARIETY_N}번: 학년별 서로 다른 장면 수 ` + Object.entries(perGrade).map(([g, s]) => `${g}학년 ${s.size}`).join(' · ') + ` · 결말(중학교/꿈) ${endings.size}가지`);
console.log(`\n${results.length}개 중 ${results.length - bad.length}개 통과` + (bad.length ? `, ${bad.length}개 실패` : ''));
process.exit(bad.length ? 1 : 0);
