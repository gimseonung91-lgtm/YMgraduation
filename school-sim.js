/* =====================================================================
 * SchoolSim — 학교생활 시뮬레이터 (원본 LifeSim 과 같은 API · 같은 life 모양)
 * ---------------------------------------------------------------------
 *   SchoolSim.generate(chart, seed) → life      원본 CONTRACT 5절의 모양(years[].state/rels/events, npcs, summary, death …).
 *                                               seed(이야기 번호)마다 학년별 장면 · 문장 · 친구를 사귄 학년 · 중학교 · 꿈을 새로 뽑는다.
 *                                               같은 학생 + 같은 seed = 같은 영상(원본 화면은 시작할 때마다 새 seed 를 준다)
 *   SchoolSim.buildSchedule(life) → schedule    원본 PaljaPacing.build 와 같은 모양(자막을 읽을 시간 · 카메라 연출 간격 · 부드러운 걸음)
 *   SchoolSim.normProfile(raw, chart?)          입력 화면에서 받은 값(문자열 그대로여도 된다)을 다듬는다. 저장·생성은 모두 이것을 거친다
 *   SchoolSim.dateFor(profile)                  학년 → 출생 연도, 이름·반 해시 → 월·일(사주 엔진에 넣을 날짜일 뿐, 화면에는 나오지 않는다)
 *   SchoolSim.schoolifyChart(chart)             사주 엔진 결과의 "대운 문"을 "인생의 문"(SchoolLifeData.GATES)으로 바꾼다
 *   SchoolSim.profiles                          학생 정보 저장소(localStorage, 막혀 있으면 이번 창에서만): get · put · remove · list · current
 *   LifeSim 과 같은 이름: newSeed / seedToText / textToSeed / parseName / stats / VERSION / TARGETS
 *
 * 실리면 window.LifeSim 을 대신하고 SajuEngine.compute · PaljaPacing.build 를 감싼다. 원본의 무대·인물·연출·화면 모듈은 같은 life 를 받아 그대로 그린다.
 * 규칙만 여기에 있고, 사건·문장·연출·이름은 school-life-data.js 에 있다.
 * ===================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SchoolSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var VERSION = 'school-2.0.0';
  function DATA() { return root.SchoolLifeData; }
  function tpl(str, vars) { return root.PaljaText ? root.PaljaText.tpl(str, vars) : String(str); }

  // ------------------------------------------------------------------ 1. 작은 도구
  function hash(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rngFor(key) { var a = hash(key) || 1; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pickW(rng, list) { var s = 0, i; for (i = 0; i < list.length; i++) s += list[i].w || 1; var r = rng() * s; for (i = 0; i < list.length; i++) { r -= list[i].w || 1; if (r < 0) return list[i]; } return list[list.length - 1]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newSeed() { return (Math.floor(Math.random() * 4294967296)) >>> 0; }
  function seedToText(seed) { seed = seed >>> 0; var s = ''; for (var i = 0; i < 7; i++) { s = B32.charAt(seed & 31) + s; seed = Math.floor(seed / 32); } return s; }
  function textToSeed(t) {
    t = String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!t) return newSeed();
    var n = 0; for (var i = 0; i < t.length; i++) { var k = B32.indexOf(t.charAt(i)); if (k < 0) return hash(t); n = (n * 32 + k) >>> 0; } return n;
  }
  var TWO_SYLLABLE_SURNAMES = ['남궁', '황보', '제갈', '선우', '독고', '사공', '서문', '동방'];
  function parseName(name) {
    var s = String(name || '').trim();
    if (!s) return { surname: '', givenName: '' };
    if (s.length >= 3 && TWO_SYLLABLE_SURNAMES.indexOf(s.slice(0, 2)) >= 0) return { surname: s.slice(0, 2), givenName: s.slice(2) };
    return { surname: s.charAt(0), givenName: s.slice(1) };
  }
  /** 이름 다듬기: 한글 이름은 띄어쓰기를 붙이고("김 민준" → "김민준"), 그 밖에는 겹친 공백만 하나로. 12자까지 */
  function cleanName(raw) {
    var s = String(raw || '').replace(/\s+/g, ' ').trim();
    return (/^[가-힣 ]+$/.test(s) ? s.replace(/ /g, '') : s).slice(0, 12);
  }

  // ------------------------------------------------------------------ 2. 학생 정보
  /** 입력값 → 다듬은 학생 정보. friends 는 쉼표로 이은 문자열이어도 되고, teachers 는 {학년: 이름} · 배열 · 쉼표 문자열("정다운, , 김하늘") 모두 된다 */
  function normProfile(raw, chart) {
    raw = raw || {};
    var input = (chart && chart.input) || {};
    var name = cleanName(raw.name || input.name) || '졸업생';
    var grade = +raw.grade ? clamp(Math.round(+raw.grade), 1, 6)
      : chart && chart.solar ? clamp(DATA().SCHOOL_YEAR_NOW - (chart.solar.y + 7) + 1, 1, 6) : 6;
    var friends = [], seen = {};
    seen[name] = 1;
    (Array.isArray(raw.friends) ? raw.friends : String(raw.friends || '').split(/[,，、\n]/)).forEach(function (f) {
      f = cleanName(f); if (f && !seen[f] && friends.length < 4) { seen[f] = 1; friends.push(f); }
    });
    var teachers = {}, tsrc = raw.teachers || {};
    if (typeof tsrc === 'string') tsrc = tsrc.split(/[,，]/);
    if (Array.isArray(tsrc)) tsrc.forEach(function (t, i) { teachers[i + 1] = t; }); else for (var g in tsrc) teachers[g] = tsrc[g];
    for (var k in teachers) { var t = cleanName(String(teachers[k] || '').replace(/\s*선생님\s*$/, '')); if (t && +k >= 1 && +k <= 6) teachers[k] = t; else delete teachers[k]; }
    var opts = {}; DATA().OPTIONAL.forEach(function (o) { opts[o.key] = !!(raw.opts && raw.opts[o.key]); });
    var gender = raw.gender === 'M' || raw.gender === 'F' ? raw.gender : input.gender === 'M' || input.gender === 'F' ? input.gender : '';
    return { name: name, gender: gender, grade: grade, classNo: clamp(Math.round(+raw.classNo || 1), 1, 15),
             daycare: String(raw.daycare || '').trim().slice(0, 24), kinder: String(raw.kinder || '').trim().slice(0, 24), dream: cleanDream(raw.dream),
             friends: friends, teachers: teachers, opts: opts };
  }
  // ------------------------------------------------------------------ 나의 꿈: 목록에서 고른 꿈 · 직접 적은 꿈(비슷한 직업을 알아본다) · 비워 두면 조사 목록에서 응답 비율대로
  // "수의사가 될래요" · "선생님이 되고 싶어요" → 직업 이름만(문장 "{job|이/가} 되었다" 에 들어간다)
  function cleanDream(s) {
    return String(s || '').replace(/[<>{}|\\"]/g, '').replace(/\s+/g, ' ').trim()
      .replace(/\s*(이|가)?\s*(되고\s*싶(어요|어|다|습니다)?|될\s*(래요|래|거야|거예요|겁니다)|되기|되는\s*것)[.!~\s]*$/, '').trim().slice(0, 16);
  }
  /** → { short(문장에 쓰는 이름), job(엔딩 카드), jobKind, set(꿈을 이룬 장면), scenes, how: list|guess|own|pick, like(알아본 직업), tip(근거 칩) } */
  function dreamFor(p, rng) {
    var D = DATA(), t = p.dream, hit = null, byShort = {}, i;
    if (!t) { var r = weighted(rng, D.DREAMS.map(function (d) { return { d: d, weight: d.pct }; })).d; return mkDream(r, r.short, 'pick'); }
    for (i = 0; i < D.DREAMS.length && !hit; i++) if (D.DREAMS[i].short === t) hit = D.DREAMS[i];
    if (hit) return mkDream(hit, t, 'list');
    D.DREAMS.concat(D.DREAM_EXTRA).forEach(function (d) { byShort[d.short] = d; });
    for (i = 0; i < D.DREAM_WORDS.length && !hit; i++) if (D.DREAM_WORDS[i][0].test(t)) hit = byShort[D.DREAM_WORDS[i][1]];
    return mkDream(hit || D.DREAM_ANY, t, hit ? 'guess' : 'own');
  }
  function mkDream(base, short, how) {
    var D = DATA(), fromList = how === 'list' || how === 'pick';
    var tip = how === 'pick' ? '꿈을 적지 않아서, 초등학생 희망 직업 상위 20개 가운데 하나를 그려 보았습니다 — ' + D.DREAM_SOURCE
      : how === 'list' ? '입력 화면에서 고른 꿈 — 초등학생 희망 직업 ' + base.rank + '위(' + base.survey + ', ' + D.DREAM_SOURCE + ')'
      : '입력 화면에 직접 적은 꿈';
    return { short: short, job: fromList ? base.job : short, jobKind: base.jobKind, set: base.set, scenes: base.scenes, how: how, like: base.short || '', tip: tip };
  }
  function dateFor(p) {
    var c = DATA().cohort(p.grade || 6), h = hash((p.name || '') + '|' + (p.classNo || 1));
    return { year: c.birthYear, month: 1 + (h % 12), day: 1 + ((h >>> 4) % 28) };
  }

  // 저장소: 이름 · 학년 · 반이 같아야 같은 학생이다(같은 이름의 다른 반 친구를 덮어쓰지 않는다)
  var LS_KEY = 'yongam.profiles.v1', mem = null;
  function keyOf(p) { return p.name + '|' + (p.grade || 6) + '|' + (p.classNo || 1); }
  function readAll() {
    if (mem) return mem;
    var all = {};
    try { var v = root.localStorage && root.localStorage.getItem(LS_KEY); if (v) all = JSON.parse(v) || {}; } catch (e) { all = {}; }
    var out = {}; for (var k in all) if (all[k] && all[k].name) { var p = all[k]; out[keyOf(p)] = p; }     // 예전 판(이름만 열쇠)도 새 열쇠로
    return (mem = out);
  }
  function writeAll() { try { if (root.localStorage) root.localStorage.setItem(LS_KEY, JSON.stringify(mem)); } catch (e) { /* 저장소가 막혀 있으면 이번 창에서만 기억한다 */ } }
  var profiles = {
    key: keyOf,
    list: function () { var all = readAll(), out = []; for (var k in all) out.push(all[k]);
      return out.sort(function (a, b) { return a.grade - b.grade || a.classNo - b.classNo || String(a.name).localeCompare(String(b.name), 'ko'); }); },
    /** 이름(과 출생 연도)으로 찾는다. 여럿이면 가장 최근에 저장한 학생 */
    find: function (name, birthYear) {
      name = cleanName(name); var best = null;
      profiles.list().forEach(function (p) { if (p.name === name && (!birthYear || DATA().cohort(p.grade).birthYear === birthYear) && (!best || (p.savedAt || 0) > (best.savedAt || 0))) best = p; });
      return best;
    },
    put: function (p) { if (!p || !p.name) return; readAll()[keyOf(p)] = p; p.savedAt = Date.now(); writeAll(); },
    remove: function (p) { delete readAll()[keyOf(p)]; writeAll(); },
    current: null,
    _reset: function () { mem = null; }
  };

  // ------------------------------------------------------------------ 3. 사주 결과 → 인생의 문
  var BRANCH_OF_EL = [2, 5, 4, 8, 11];        // 오행 → 그 오행의 지지(인·사·진·신·해): 원본 무대가 풍경의 계절을 고르는 값
  var STEM_OF_EL = [0, 2, 4, 6, 8];           // 오행 → 그 오행의 천간(갑·병·무·경·임): 현판 글자 색
  function schoolifyChart(chart) {
    if (!chart || chart.__school) return chart;
    var G = DATA().GATES, list = G.map(function (g, i) {
      return { index: i, startAge: g.age, endAge: (G[i + 1] ? G[i + 1].age : 130) - 1, startYear: chart.solar.y + g.age, stem: STEM_OF_EL[g.el], branch: BRANCH_OF_EL[g.el],
               hanja: g.hanja, ko: g.ko, stemEl: g.el, branchEl: g.el, fav: 0.6, tenStem: '', tenBranch: '', label: g.ko, stop: !!g.stop };
    });
    chart.daeun = { forward: !(chart.daeun && chart.daeun.forward === false), su: G[0].age, firstAge: G[0].age, list: list, school: true };
    chart.__school = true;
    return chart;
  }

  // ------------------------------------------------------------------ 4. 사람들(엄마·아빠 · 친구 넷 · 담임 여섯)
  // 띠·일간·궁합은 넣지 않는다: 원본 화면은 이 값이 있을 때만 그린다
  function makePeople(p, by, rng) {
    var D = DATA(), all = [], n = 0, nm = parseName(p.name);
    function add(o) { o.id = 'n' + (++n); o.zodiacName = ''; o.dayStemName = ''; o.compat = null; o.deathAge = null; if (o.leftAge === undefined) o.leftAge = null; all.push(o); return o; }
    var father = add({ role: 'father', roleLabel: '가족', name: '아빠', surname: nm.surname, gender: 'M', birthYear: by - 33 - Math.floor(rng() * 4), metAge: 0 });
    var mother = add({ role: 'mother', roleLabel: '가족', name: '엄마', surname: '', gender: 'F', birthYear: by - 31 - Math.floor(rng() * 4), metAge: 0 });
    var taken = {}, pool = D.FRIEND_NAMES[p.gender === 'M' ? 'M' : 'F'].slice(), friends = [], META = [[5, null, '유치원 친구'], [7, 14, '친구'], [9, 14, '친구'], [12, null, '친구']];
    taken[p.name] = 1; p.friends.forEach(function (f) { taken[f] = 1; });
    META.forEach(function (m, i) {
      var full = p.friends[i];
      while (!full) {     // 비어 있으면 그 무렵 흔한 이름으로 짓되, 이미 있는 이름과 겹치지 않게
        var given = pool.length ? pool.splice(Math.floor(rng() * pool.length), 1)[0] : '친구' + (i + 1), cand = D.SURNAMES[Math.floor(rng() * D.SURNAMES.length)] + given;
        if (!taken[cand]) { full = cand; taken[cand] = 1; }
      }
      friends.push(add({ role: 'friend', roleLabel: m[2], name: full, surname: parseName(full).surname, gender: p.gender === 'M' ? 'M' : 'F', birthYear: by, metAge: m[0], leftAge: m[1], given: !!p.friends[i] }));
    });
    var teachers = {};
    for (var g = 1; g <= 6; g++) {
      var tn = p.teachers[g] || '', tg = rng() < 0.7 ? 'F' : 'M';
      teachers[g] = add({ role: 'mentor', roleLabel: g + '학년 담임', name: tn || '선생님', surname: tn ? parseName(tn).surname : '',
                          gender: tg, birthYear: by - 22 - Math.floor(rng() * 20), metAge: 6 + g, leftAge: 7 + g, given: !!tn });
    }
    function around(age) { return friends.filter(function (f) { return f.metAge <= age && (f.leftAge === null || age < f.leftAge); }); }
    return { all: all, father: father, mother: mother, friends: friends, teachers: teachers, around: around };
  }
  /** 사건표의 cast 이름 → 인물 id 목록(순서 유지, 겹침 없음) */
  function castIds(row, age, P) {
    var tokens = row.cast || (age >= 5 && age <= 13 ? ['classmates'] : []), out = [];
    function put(n) { if (n && out.indexOf(n.id) < 0) out.push(n.id); }
    tokens.forEach(function (t) {
      if (t === 'father' || t === 'mother') put(P[t]);
      else if (t === 'teacher') put(P.teachers[row.teacher]);
      else if (t === 'teacher6') put(P.teachers[6]);
      else if (t === 'friend') put(P.friends[row.friend]);
      else if (t === 'classmates') P.around(age).slice(-2).forEach(put);
      else if (t === 'bestFriends') { put(P.friends[3]); put(P.friends[0]); }
      else throw new Error('SchoolSim: 모르는 cast 이름 — ' + t);
    });
    return out;
  }

  // ------------------------------------------------------------------ 5. 한 해의 상태
  function stateAt(age, env) {
    var p = env.p, D = DATA(), g = age - 6;
    var s = { job: '', jobDetail: '', jobKind: 'child', workplace: '', school: '', edu: '', residence: D.SCHOOL.town, housing: 'family', wealth: 0, health: 90, happiness: 62, marital: '', sick: 0 };
    if (age <= 2) { s.job = '아기'; s.jobDetail = '아기'; s.jobKind = 'infant'; }
    else if (age <= 4) { s.job = '어린이집 원아'; s.jobDetail = env.daycare; s.school = env.daycare; }
    else if (age <= 6) { s.job = '유치원생'; s.jobDetail = env.kinder + ' ' + (age + 1) + '세반'; s.school = env.kinder; }
    else if (g <= 6) { s.job = '초등학생'; s.jobDetail = D.SCHOOL.short + ' ' + g + '학년 ' + p.classNo + '반'; s.jobKind = 'student'; s.school = D.SCHOOL.name; }
    else if (age <= 15) { s.job = '중학생'; s.jobDetail = env.middle.name + ' ' + (age - 12) + '학년'; s.jobKind = 'student'; s.school = env.middle.name; s.edu = 'elementary'; }
    else if (age <= 18) { s.job = '고등학생'; s.jobDetail = '고등학교 ' + (age - 15) + '학년'; s.jobKind = 'student'; s.school = '고등학교'; s.edu = 'middle'; }
    else if (age <= 25) { s.job = '대학생'; s.jobDetail = '꿈을 향해 공부하는 대학생'; s.jobKind = 'univ'; s.school = '대학교'; s.edu = 'high'; s.residence = '천안'; }
    else { s.job = env.future.short; s.jobDetail = env.future.job; s.jobKind = env.future.jobKind; s.edu = 'univ'; s.residence = '천안'; s.housing = age >= 30 ? 'own' : 'rent'; s.wealth = 3000 + (age - 26) * 2500; }
    s.happiness = clamp(Math.round(60 + Math.min(age, 13) * 1.4 + (age > 13 ? (age - 13) * 0.5 : 0) + env.hapBonus), 0, 96);
    s.health = clamp(Math.round(92 - Math.max(0, age - 25) * 0.2), 60, 96);
    return s;
  }
  function stageOf(age) {
    if (age <= 2) return ['childhood', '아기'];
    if (age <= 4) return ['childhood', '어린이집'];
    if (age <= 6) return ['childhood', '유치원'];
    if (age <= 12) return ['childhood', '초등학교 ' + (age - 6) + '학년'];
    if (age === 13) return ['teen', '졸업 · 중학교 1학년'];      // 졸업식(2월)이 이 해에 있다: "중학생"만 쓰면 졸업식 장면과 어긋난다
    if (age <= 15) return ['teen', '중학교 ' + (age - 12) + '학년'];
    if (age <= 18) return ['teen', '고등학교 ' + (age - 15) + '학년'];
    if (age <= 25) return ['youth', '청년'];
    return ['youth', '어른'];
  }
  function seasonOf(month) { return month <= 2 ? 0 : month <= 5 ? 1 : month <= 8 ? 2 : month <= 11 ? 3 : 4; }
  /** 고정 장면의 나이 · 달(13월 = 이듬해 1월) */
  function whenOf(r) { var age = r.age !== undefined ? r.age : 6 + r.grade, month = r.month || 3; if (month > 12) { age += 1; month -= 12; } return { age: age, month: month }; }
  /** 고정 장면의 마지막 나이(영상의 끝) */
  function endAge() { var m = 0; DATA().ANCHORS.forEach(function (r) { var a = r.friendGrades ? 6 + r.friendGrades[1] : whenOf(r).age; if (a > m) m = a; }); return m; }

  // ------------------------------------------------------------------ 6. 한 생애 만들기
  /** 이번 영상의 재료: 학생 · 학년도 · 사람들(이름은 학생마다 고정) · 이야기 번호(seed) · 중학교와 꿈(seed 마다) */
  function makeEnv(chart, seed) {
    var D = DATA(), name = cleanName(chart.input.name), cur = profiles.current;
    var raw = cur && cleanName(cur.name) === name && D.cohort(cur.grade).birthYear === chart.solar.y ? cur : profiles.find(name, chart.solar.y);
    var p = normProfile(raw, chart);
    if (!p.gender) p.gender = 'F';
    var C = D.cohort(p.grade), by = chart.solar.y || C.birthYear, key = p.name + '|' + p.classNo + '|' + by;
    var story = seed === undefined || seed === null || seed === '' ? hash(key) : seed >>> 0, endRng = rngFor(key + '|' + story + '|ending');
    var env = { p: p, C: C, by: by, key: key, seed: story, rng: rngFor(key + '|' + story + '|story'), END: endAge(), hapBonus: 0,
      daycare: p.daycare || '어린이집', kinder: p.kinder || '유치원', middle: pickW(endRng, D.MIDDLE_SCHOOLS), future: dreamFor(p, endRng),
      targetCohort: C.entryYear === D.cohort(6).entryYear };
    env.dreamScene = env.future.scenes[Math.floor(endRng() * env.future.scenes.length)];
    env.P = makePeople(p, by, rngFor(key));
    return env;
  }
  // ------------------------------------------------------------------ 이야기 짜기: 고정 장면 + 학년마다 뽑기 상자 + 문장 고르기
  function weighted(rng, items) { var s = 0, i; for (i = 0; i < items.length; i++) s += items[i].weight || 1; var r = rng() * s; for (i = 0; i < items.length; i++) { r -= items[i].weight || 1; if (r < 0) return items[i]; } return items[items.length - 1]; }
  /** 문장 후보 가운데 조건(달력 연도 · 학년 · 친구가 곁에 있나 · 이미 쓴 문장)이 맞는 것 */
  function usedKey(o, c) { return o.t.indexOf('{grade}') >= 0 ? o.t + '|' + c.grade : o.t; }      // {grade} 가 든 문장은 학년마다 다르게 읽힌다
  function textChoices(list, c) {
    return (list || []).map(function (t) { return typeof t === 'string' ? { t: t } : t; }).filter(function (o) {
      return (!o.cal || (c.calYear >= o.cal[0] && c.calYear <= o.cal[1])) && (!o.grades || o.grades.indexOf(c.grade) >= 0) && (c.hasFriend || o.t.indexOf('{friend') < 0) && !c.used[usedKey(o, c)];
    });
  }
  function pickText(list, c, rng) { var cs = textChoices(list, c); if (!cs.length) return null; var o = cs[Math.floor(rng() * cs.length)]; c.used[usedKey(o, c)] = 1; return o; }
  /** 뽑기 상자의 한 칸이 g 학년에 나올 수 있나(relax 면 한 영상 최대 횟수는 보지 않는다 — 아직 안 쓴 문장이 있을 때만) */
  function poolFits(item, g, calYear, count, used, friendNear, relax) {
    if (item.grades.indexOf(g) < 0 || (item.cal && (calYear < item.cal[0] || calYear > item.cal[1])) || (!relax && (count[item.kind] || 0) >= (item.max || 1))) return false;
    return textChoices(item.texts, { calYear: calYear, grade: g, hasFriend: friendNear, used: used }).length > 0;
  }
  function composeStory(env) {
    var D = DATA(), rng = env.rng, P = env.P, p = env.p, rows = [], used = {}, count = {};
    function take(row, list, c) {
      var o = pickText(list, c, rng); if (!o) return false;
      row.text = o.t; if (o.note) row.note = o.note; count[row.kind] = (count[row.kind] || 0) + 1; rows.push(row); return true;
    }
    // (1) 학교 친구를 사귄 학년
    D.ANCHORS.forEach(function (r) { if (r.friendGrades) P.friends[r.friend].metAge = 6 + r.friendGrades[0] + Math.floor(rng() * (r.friendGrades[1] - r.friendGrades[0] + 1)); });
    // (2) 고정 장면: 문장만 고른다
    D.ANCHORS.forEach(function (r) {
      var row = {}, k; for (k in r) row[k] = r[k];
      if (r.friendGrades) { row.grade = P.friends[r.friend].metAge - 6; delete row.age; }
      var w = whenOf(row), calYear = env.by + w.age;
      if (w.age > env.END || (r.cal && (calYear < r.cal[0] || calYear > r.cal[1])) || (r.opt && !p.opts[r.opt])) return;
      var list = r.teacher !== undefined && !P.teachers[r.teacher].given ? r.textsNoName : r.texts;
      take(row, list, { calYear: calYear, grade: row.grade, hasFriend: true, used: used });
    });
    // (3) 학년마다 뽑기 상자에서 큰 장면 · 작은 장면
    function drawFor(g, wantMajor, chosen) {
      var age = 6 + g, calYear = env.by + age, near = P.around(age);
      var fit = function (relax) { return D.POOL.filter(function (it) { return !chosen[it.kind] && (!wantMajor || it.major) && poolFits(it, g, calYear, count, used, near.length > 0, relax); }); };
      var cands = fit(false); if (!cands.length) cands = fit(true);      // 해마다 하는 활동을 이미 다 썼으면, 안 쓴 문장으로 한 번 더
      if (!cands.length) return;
      var it = weighted(rng, cands), row = { grade: g, month: it.months[Math.floor(rng() * it.months.length)], kind: it.kind, major: !!wantMajor, src: it.src, note: it.note, tone: it.tone };
      if (it.cast) row.cast = it.cast.slice();
      if (row.cast && row.cast.indexOf('teacher') >= 0) row.teacher = g;
      if (it.friend && near.length) row.friend = P.friends.indexOf(near[Math.floor(rng() * near.length)]);
      chosen[it.kind] = 1;
      if (!take(row, it.texts, { calYear: calYear, grade: g, hasFriend: row.friend !== undefined, used: used })) return;
      if (row.friend !== undefined && row.text.indexOf('{friend') >= 0) row.cast = ['friend', 'classmates'].concat(row.cast || []);
      else delete row.friend;
    }
    for (var g = 1; g <= 6; g++) {
      var pick = D.PICKS[g] || { major: 0, minor: [1, 2] }, chosen = {}, a, n = pick.minor[0] + Math.floor(rng() * (pick.minor[1] - pick.minor[0] + 1));
      for (a = 0; a < pick.major; a++) drawFor(g, true, chosen);
      for (a = 0; a < n; a++) drawFor(g, false, chosen);
    }
    return rows;
  }
  /** 이야기의 한 줄 → 사건 하나 */
  function eventFromRow(row, env) {
    var D = DATA(), p = env.p, age = row.age !== undefined ? row.age : 6 + row.grade, month = row.month || 3;
    if (month > 12) { age += 1; month -= 12; }
    var calYear = env.by + age, schoolYear = month >= 3 ? calYear : calYear - 1;
    if (age > env.END || (row.cal && (calYear < row.cal[0] || calYear > row.cal[1])) || (row.opt && !p.opts[row.opt])) return null;
    var K = D.KINDS[row.kind]; if (!K) throw new Error('SchoolSim: KINDS 에 없는 사건 — ' + row.kind);
    var vars = { name: p.name, year: calYear, calYear: calYear, school: D.SCHOOL.name, gradNo: env.C.gradNo, daycare: env.daycare, kinder: env.kinder,
                 middle: env.middle.name, job: env.future.short, grade: row.grade || '' }, text = row.text;
    vars.dreamScene = tpl(env.dreamScene, vars);
    if (row.friend !== undefined) vars.friend = env.P.friends[row.friend].name;
    if (row.teacher !== undefined) { var t = env.P.teachers[row.teacher]; if (t.given) vars.teacher = t.name; }
    // 근거 칩: 출처 · 아직 오지 않은 학년 · 다른 학년도의 가정통신문
    var src = row.src, tip = row.kind === 'grown_up' ? env.future.tip : row.note || D.SRC_TIP[src] || '';
    if (src !== 'dream' && schoolYear > D.SCHOOL_YEAR_NOW) { src = 'future'; tip = D.SRC_TIP.future; }
    else if (src === 'board' && !env.targetCohort) tip += D.SRC_TIP.otherCohort;
    var SL = D.SRC_LABEL[src] || ['학교생활', 'env'], dir = D.DIRECTION[row.kind];
    var SIGN = { school: D.SCHOOL.name, kinder: env.kinder, daycare: env.daycare, middle: env.middle.name };
    var ev = { id: '', age: age, year: calYear, cat: K[0], catLabel: '', kind: row.kind, title: tpl(row.title || K[1], vars).slice(0, 24), text: tpl(text, vars),
      major: !!row.major, tone: row.tone || 'good', basis: [{ label: SL[0], tip: tip || SL[0], kind: SL[1] }], npcIds: castIds(row, age, env.P),
      delta: { happiness: row.tone === 'bad' ? -3 : 2 }, season: seasonOf(month), _month: month };
    if (row.sign) ev.sign = String(SIGN[row.sign] || '').slice(0, 12);
    ev._set = dir && dir.set === 'future' ? env.future.set : dir && dir.set ? dir.set : null;      // 장면 세트(school-stage.js 의 규칙이 읽는다)
    return ev;
  }
  /** 멈춰 올려다보는 문(stop) 앞의 사건. 원본의 daeun 사건 자리라 무대가 문 연출을 건다 */
  function gateEvent(g, env) {
    var GE = DATA().GATE_EVENT;
    return { id: '', age: g.startAge, year: env.by + g.startAge, cat: GE.cat, catLabel: GE.catLabel, kind: 'daeun', title: g.ko + '의 문', text: g.ko + '의 문을 지났다.',
      major: false, tone: 'neutral', basis: [GE.basis], npcIds: [], delta: {}, season: 1, _month: 2.5 };
  }
  function generate(chart, seed) {
    var V = root.PaljaVocab, env = makeEnv(chart, seed), years = [], events = [], evN = 0, i;
    for (i = 0; i <= env.END; i++) years.push({ age: i, year: env.by + i, events: [] });
    composeStory(env).forEach(function (row) { var ev = eventFromRow(row, env); if (ev) years[ev.age].events.push(ev); });
    chart.daeun.list.forEach(function (g) { if (g.stop && g.startAge <= env.END) years[g.startAge].events.unshift(gateEvent(g, env)); });
    var gates = chart.daeun.list;
    years.forEach(function (y) {
      y.events.sort(function (a, b) { return a._month - b._month; });
      y.events.forEach(function (e) {
        e.id = 'e' + (++evN); if (!e.catLabel) e.catLabel = V && V.CATS ? (V.CATS[e.cat] || '') : '';
        env.hapBonus += (e.delta.happiness || 0) * 0.25; delete e._month; events.push(e);
      });
      var st = stageOf(y.age), gi = -1; gates.forEach(function (g, k) { if (g.startAge <= y.age) gi = k; });
      y.stage = st[0]; y.stageLabel = st[1]; y.label = st[1];
      y.daeun = gi < 0 ? { index: -1, ko: '', hanja: '', pre: true, changed: false, fav: 0.6 } : { index: gi, ko: gates[gi].ko, hanja: gates[gi].hanja, pre: false, changed: gates[gi].startAge === y.age, fav: 0.6 };
      y.seun = { ko: st[1], hanja: '', tenStemName: '', fav: 0.5 };
      y.state = stateAt(y.age, env);
      y.rels = env.P.all.filter(function (n) { return n.metAge <= y.age && (n.leftAge === null || y.age < n.leftAge); }).map(function (n) {
        var close = n.role === 'mother' ? 92 : n.role === 'father' ? 88 : n.role === 'mentor' ? 72 : clamp(58 + (y.age - n.metAge) * 4, 50, 90);
        return { id: n.id, closeness: close, status: 'active', label: n.roleLabel };
      });
    });
    return assemble(env, years, events);
  }
  /** 원본 화면이 읽는 나머지 칸(요약 · 깃발 · 마지막 해)을 채운다 */
  function assemble(env, years, events) {
    var D = DATA(), p = env.p, nm = parseName(p.name), seed = env.seed, last = years[years.length - 1];
    var tp = events.filter(function (e) { return e.major && e.kind !== 'birth'; }).slice(0, 8).map(function (e) { return { age: e.age, year: e.year, title: e.title, text: e.text, eventId: e.id }; });
    return {
      simVersion: VERSION, seed: seed, seedText: seedToText(seed), name: p.name, gender: p.gender, birthYear: env.by, surname: nm.surname, givenName: nm.givenName, timeKnown: false,
      traits: { extraversion: 60, conscientiousness: 60, adventure: 60, sensitivity: 60, wealth: 50, office: 50, bond: 70, constitution: 60 },
      family: { cls: 'middle', clsLabel: '', hometown: '천안', note: '' },
      npcs: env.P.all.map(function (n) { var o = {}; for (var q in n) if (q !== 'given') o[q] = n[q]; return o; }),
      years: years, events: events,
      death: { age: last.age, year: last.year, cause: '', causeKind: 'old', place: '', attendants: [], attendantsText: '', alone: false, lastWords: '', text: '', basis: [] },      // 임종 장면은 없다(사건이 없으면 무대가 만들지 않는다)
      summary: { lifeLine: D.SCHOOL.name + ' 제' + env.C.gradNo + '회 졸업생', epitaph: D.SCHOOL.motto, finalJob: env.future.short, mainJob: env.future.job, mainJobKind: env.future.jobKind,
        education: D.SCHOOL.name + ' 졸업', jobHistory: [], child: false, marriage: { status: 'never', count: 0, text: '' }, children: { count: 0, sons: 0, daughters: 0, text: '', estranged: 0, grandchildren: 0 },
        peakWealth: { amount: 0, age: 0, text: '' }, finalWealth: { amount: 0, text: '' }, turningPoints: tp, verdict: { tendencies: [], matched: [], diverged: [] } },
      flags: { everMarried: false, divorced: false, remarried: false, widowed: false, childCount: 0, estrangedChild: false, grandchildCount: 0, topSuccess: false, success: 0, successAge: null,
        bankrupt: false, longUnemployed: false, seriousIllness: false, emigrated: false, deathAge: last.age, jobClass: 'professional', eduLevel: 'univ', univTier: 0, hsType: 'general' },
      schoolLife: { profile: p, cohort: env.C, middle: env.middle, future: env.future, school: D.SCHOOL }
    };
  }

  // ------------------------------------------------------------------ 7. 재생 시간표(원본 PaljaPacing.build 와 같은 모양)
  // 정신없지 않게: ① 자막은 읽을 시간만큼 머문다 ② 카메라 연출(문 올려다보기 · 장면으로 날아가기)끼리 겹치지 않게 사이를 둔다
  //               ③ 걷는 속도는 원본의 평온한 해(초속 4.5m)를 넘지 않고, 빨라지고 느려질 때 부드럽게 바뀐다
  var PACE = {
    lead: 1200, tail: 1600,          // 한 해가 시작되고 첫 사건까지 · 마지막 사건 뒤
    readBase: 1300, readPerChar: 60, readMin: 2800, readMax: 4200,   // 작은 사건: 자막을 읽는 시간(글자 수에 맞춰 2.8~4.2초)
    majorBefore: 1500, majorHold: 4400, majorHold3: 3600, majorAfter: 2400,   // 큰 사건: 세트로 날아가(약 1.3초) 머물고(약 2초) 길로 돌아온다(약 1.5초) — PaljaCamPace 1.8 기준
    gateBefore: 3400, gateHold: 2500, gateAfter: 2200,                         // 문: 원본 카메라가 2.6초 전부터 올려다보기 시작해 1.9초에 걸쳐 돌아온다
    quietMin: 3100,                  // 사건 없는 해: 14m ÷ 3.1초 ≈ 초속 4.5m
    quietFast: 1400,                 // 졸업 뒤(상상의 미래) 사건 없는 해: 14m ÷ 1.4초 ≈ 초속 10m — 세월이 빠르게 흐른다
    ramp: 0.3,                       // 이웃한 해와 걷는 시간이 너무 벌어지지 않게(나머지 가감속은 아래 이동 평균이 맡는다)
    smoothMs: 3600, stepMs: 40       // 걷는 속도의 이동 평균(가감속을 3.6초에 걸쳐: 졸업 뒤 초속 10m에서 장면 앞에 멈출 때도 부드럽게)
  };
  function classOf(e) { return e.kind === 'daeun' ? 'gate' : e.major ? 'major' : 'minor'; }
  function gapBefore(c) { return c === 'gate' ? PACE.gateBefore : c === 'major' ? PACE.majorBefore : 0; }
  function gapAfter(c, e) { return c === 'gate' ? PACE.gateAfter : c === 'major' ? PACE.majorAfter : clamp(PACE.readBase + PACE.readPerChar * String(e.text || '').length, PACE.readMin, PACE.readMax); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  /** 해마다: 첫 사건까지(lead) · 사건 사이(gaps) · 멈춤(holds) · 걷는 시간(base). fastFrom 나이부터는 조용한 해를 빠르게 지난다 */
  function planYears(lifeYears, fastFrom) {
    var plan = lifeYears.map(function (y) {
      var evs = y.events || [], n = evs.length, c = evs.map(classOf), holds = [], gaps = [], nMajor = 0, j;
      for (j = 0; j < n; j++) holds.push(c[j] === 'gate' ? PACE.gateHold : c[j] === 'major' ? (++nMajor <= 2 ? PACE.majorHold : PACE.majorHold3) : 0);
      for (j = 0; j < n - 1; j++) gaps.push(Math.max(gapAfter(c[j], evs[j]), gapBefore(c[j + 1])));
      var lead = n ? Math.max(PACE.lead, gapBefore(c[0])) : 0, tail = n ? Math.max(PACE.tail, gapAfter(c[n - 1], evs[n - 1])) : 0;
      return { evs: evs, holds: holds, gaps: gaps, lead: lead, base: Math.max(n ? lead + sum(gaps) + tail : 0, y.age >= fastFrom ? PACE.quietFast : PACE.quietMin) };
    });
    for (var pass = 0; pass < 6; pass++) plan.forEach(function (P, i) {      // 이웃한 해와 걷는 시간을 잇는다. 늘어난 몫은 그해 끝에 붙는다
      P.base = Math.max(P.base, i > 0 ? plan[i - 1].base * PACE.ramp : 0, i < plan.length - 1 ? plan[i + 1].base * PACE.ramp : 0);
    });
    return plan;
  }
  /** 걷는 자리: 속도(멈춤 동안 0)를 이동 평균으로 다듬어 쌓은 표 → walkAgeAt(t) */
  function walkTable(years, total, indexAt) {
    var dt = PACE.stepMs, M = Math.ceil(total / dt) + 1, raw = new Float64Array(M), pre = new Float64Array(M + 1), cum = new Float64Array(M + 1), m, j;
    for (m = 0; m < M; m++) {
      var tm = Math.min(m * dt, total - 1e-6), Y = years[indexAt(tm)], local = tm - Y.start, v = 1 / Y.base;
      for (j = 0; j < Y.slots.length; j++) { var sl = Y.slots[j]; if (sl.hold > 0 && local >= sl.at && local < sl.at + sl.hold) { v = 0; break; } }
      raw[m] = v; pre[m + 1] = pre[m] + v;
    }
    var w = Math.max(1, Math.round(PACE.smoothMs / dt / 2));
    function rawSum(a, b) { var s = 0; if (a < 0) { s += -a * raw[0]; a = 0; } if (b > M - 1) { s += (b - M + 1) * raw[M - 1]; b = M - 1; } return s + pre[b + 1] - pre[a]; }      // 양 끝 바깥은 끝 값으로 잇는다
    for (m = 0; m < M; m++) cum[m + 1] = cum[m] + rawSum(m - w, m + w) / (2 * w + 1) * dt;
    var scale = cum[M] > 0 ? years.length / cum[M] : 1;
    return function walkAgeAt(t) { var x = clamp(t, 0, total) / dt, k = Math.min(M - 1, Math.floor(x)), f = x - k; return years[0].age + (cum[k] + (cum[k + 1] - cum[k]) * f) * scale; };
  }
  /** 상상의 미래가 시작되는 나이: 졸업식 다음 해(졸업식이 없으면 빠르게 가지 않는다) */
  function fastFromAge(life) { var g = null; life.events.forEach(function (e) { if (e.kind === 'graduation') g = e.age; }); return g === null ? Infinity : g + 1; }
  function buildSchedule(life) {
    var years = [], t = 0;
    planYears(life.years, fastFromAge(life)).forEach(function (P, i) {
      var slots = [], acc = P.lead, holdSum = 0;
      P.evs.forEach(function (ev, j) { slots.push({ event: ev, at: acc, hold: P.holds[j] }); holdSum += P.holds[j]; acc += P.holds[j] + (j < P.gaps.length ? P.gaps[j] : 0); });
      years.push({ age: life.years[i].age, start: t, dur: P.base + holdSum, base: P.base, lead: P.lead, slots: slots });
      t += P.base + holdSum;
    });
    var total = t, N = years.length;
    function indexAt(tm) { if (tm <= 0) return 0; if (tm >= total) return N - 1; var lo = 0, hi = N - 1; while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (years[mid].start <= tm) lo = mid; else hi = mid - 1; } return lo; }
    function ageAt(tm) { var idx = indexAt(tm), y = years[idx], f = y.dur > 0 ? (tm - y.start) / y.dur : 0; return years[0].age + idx + clamp(f, 0, 1); }
    var walkAgeAt = walkTable(years, total, indexAt), flat = [], byEvent = {};
    years.forEach(function (y, i) { y.slots.forEach(function (s0) {
      var item = { t: y.start + s0.at, hold: s0.hold, event: s0.event, yearIndex: i, walkAge: 0 };
      flat.push(item); if (s0.event && s0.event.id !== undefined) byEvent[s0.event.id] = item;
    }); });
    flat.forEach(function (it) { it.walkAge = walkAgeAt(it.t); });
    return { totalMs: total, msPerYear: total / N, years: years, slots: flat, byEvent: byEvent, indexAt: indexAt, ageAt: ageAt, walkAgeAt: walkAgeAt };
  }

  function stats() { return { n: 0, rows: [], extra: { note: '학교생활 영상에는 통계가 없습니다' } }; }

  var api = { generate: generate, buildSchedule: buildSchedule, schoolifyChart: schoolifyChart, dateFor: dateFor, normProfile: normProfile, cleanName: cleanName,
              profiles: profiles, endAge: endAge, fastFromAge: fastFromAge, PACE: PACE,
              newSeed: newSeed, seedToText: seedToText, textToSeed: textToSeed, parseName: parseName, stats: stats, TARGETS: [], VERSION: VERSION };

  // ------------------------------------------------------------------ 8. 원본 자리에 끼우기
  function install() {
    if (root.SajuEngine && !root.SajuEngine.__schoolWrapped) {
      var compute = root.SajuEngine.compute;
      root.SajuEngine.compute = function () { return schoolifyChart(compute.apply(this, arguments)); };
      root.SajuEngine.__schoolWrapped = true;
    }
    if (root.PaljaPacing && !root.PaljaPacing.__schoolWrapped) {
      var build = root.PaljaPacing.build;
      root.PaljaPacing.build = function (life, o) { return life && life.schoolLife ? buildSchedule(life) : build.call(this, life, o); };
      root.PaljaPacing.__schoolWrapped = true;
    }
    root.LifeSim = api;
  }
  api.install = install;
  install();
  return api;
});
