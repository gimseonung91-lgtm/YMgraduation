// 「용암초 6년」 빌드: 원본 saju-life.html(수정하지 않음) + 학교 모듈 5개 + 라이브러리 3개(vendor/) → yongam-graduation.html (인터넷 없이 열린다)
// 사용법: 이 폴더에서  node build.js   (그다음  node check.js  로 점검)
//
// 원본에서 바꾸는 곳은 아래 PATCHES 뿐이다. 각 문자열이 원본에 정확히 그 횟수만큼 있어야 빌드된다(원본이 바뀌면 멈춘다).
// 코드를 바꾸는 패치는 가능한 한 "값이 있을 때만 그린다" 또는 "학교생활 영상일 때만(root.SchoolApp · life.schoolLife)" 꼴로 써서,
// 원본 팔자 앱으로서의 동작은 그대로 둔다.
'use strict';
const fs = require('fs'), path = require('path');
const here = __dirname, src = process.env.SAJU_LIFE_HTML || path.join(here, 'saju-life.html'), out = path.join(here, 'yongam-graduation.html');

const PATCHES = [
  // ── 1. 머리말과 첫 화면의 글
  ['제목', '<title>팔자(八字) — 한 사람의 일생 관찰기</title>', '<title>용암초 6년</title>'],
  ['설명', /<meta name="description" content="[^"]*">/, '<meta name="description" content="천안용암초등학교 졸업생 한 명 한 명의 6년을 3D 길 위의 이야기로 보여 주는 졸업 영상.">'],
  ['큰 제목', /<h1 class="in-title" id="in-title" aria-label="팔자 八字">[\s\S]*?<\/h1>/,
    '<h1 class="in-title" id="in-title" aria-label="용암초 6년">\n            <span class="in-hanja" aria-hidden="true"><i>六</i><i>年</i></span>\n            <span class="in-ko" aria-hidden="true">용암초 6년</span>\n          </h1>'],
  ['탭 아이콘', "font-weight='900'%3E八%3C/text%3E", "font-weight='900'%3E六%3C/text%3E"],
  // 휴대폰 파일 미리보기(카카오톡 · 아이폰 파일 앱 등)는 자바스크립트를 돌리지 않는다 → 학교 모듈이 못 돌아 원본의 생년월일 칸이 그대로 보였다.
  // 그래서 원본 칸은 JS 없이도(CSS 로) 숨기고, JS 가 돌지 않을 때만 보이는 안내를 둔다(JS 가 돌면 머리말의 한 줄이 곧바로 감춘다).
  ['미리보기 대비(머리말)', '</head>',
    '<style id="school-static">\n#f-date,#f-time,#in-adv{display:none!important}\n' +
    '.sc-nojs{margin:0 0 20px;padding:14px 16px;border:1px solid #d3a95c;border-radius:12px;background:rgba(211,169,92,.14);font-size:15px;line-height:1.65}\n' +
    '.sc-nojs strong{display:block;margin-bottom:4px;font-size:17px}\nhtml.sc-js .sc-nojs{display:none}\n</style>\n' +
    "<script>document.documentElement.classList.add('sc-js');</script>\n</head>"],
  ['미리보기 대비(안내)', '<div class="in-wrap">',
    '<div class="in-wrap">\n        <div class="sc-nojs" role="alert"><strong>앱이 아직 실행되지 않았어요</strong>' +
    '지금은 파일 <b>미리보기</b> 화면이라 버튼이 작동하지 않습니다. 휴대폰에서는 선생님이 알려 준 <b>웹 주소(링크)</b>로 열고, ' +
    '안드로이드는 파일을 저장한 뒤 <b>크롬</b>으로 열어 주세요. 카카오톡 안에서 열렸다면 오른쪽 위 메뉴의 "다른 브라우저로 열기"를 눌러 주세요. ' +
    '컴퓨터에서는 크롬이나 엣지로 열면 됩니다.</div>'],
  ['부제', '<p class="in-sub">한 사람의 일생 관찰기</p>', '<p class="in-sub">우리들의 초등학교 이야기</p>'],
  ['소개 글', /<p class="in-lead">[\s\S]*?<\/p>\n/, '<p class="in-lead">어린이집 첫날부터 졸업식까지, 그리고 그 너머의 꿈까지. 이름과 학년을 적으면 한 친구의 6년이 길 위에 펼쳐집니다. 볼 때마다 조금씩 다른 이야기가 나옵니다.</p>\n'],
  ['성별 안내', '<p class="in-preview" id="pv-gender">대운의 방향을 정합니다</p>', '<p class="in-preview" id="pv-gender"></p>'],
  ['시작 버튼', '<span id="in-start-label">일생 지켜보기</span>', '<span id="in-start-label">6년 돌아보기</span>'],
  ['아래 안내', '<p class="in-disclaimer">이 게임은 오락용 시뮬레이션이며, 보여지는 삶은 수많은 가능성 중 하나입니다.</p>',
    '<p class="in-disclaimer">학교 가정통신문 등 공개 자료를 바탕으로 재구성한 이야기입니다. 중학교 진학과 어른이 된 모습은 졸업을 축하하며 그려 본 상상입니다.</p>'],
  ['시작 막', '<p class="veil-kicker">한 사람의 여덟 글자</p>', '<p class="veil-kicker">우리들의 초등학교</p>'],
  ['서랍 설명(정적)', 'aria-label="기록과 사주 서랍 열기"', 'aria-label="기록 서랍 열기"'],
  ['서랍 탭 설명', 'aria-label="기록 · 관계 · 그래프 · 사주"', 'aria-label="기록 · 관계"'],
  ['빌드 표시', 'window.PALJA_BUILD = { version: "1.0.0", built: "2026-11-11", mode: "release" };',
    'window.PALJA_BUILD = { version: "1.0.0", built: "2026-11-11", mode: "release", variant: "yongam-graduation" };'],

  // ── 2. 화면 모듈(ui-core)의 글: 시작 버튼 · 불러오기 안내 · 서랍 설명
  ['시작 버튼(동적)', "D.startLabel.textContent = busy ? '여덟 글자를 세우는 중…' : loading ? '만세력을 불러오는 중…' : '일생 지켜보기';",
    "D.startLabel.textContent = busy ? '6년을 펼치는 중…' : loading ? '준비하는 중…' : '6년 돌아보기';"],
  ['불러오는 중', "'만세력을 불러오는 중입니다…'", "'준비하는 중입니다…'"],
  ['불러오기 실패', "'만세력 라이브러리를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.'", "'필요한 파일을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'"],
  ['아직 준비 중', "'만세력을 아직 불러오지 못했습니다. 잠시 뒤에 다시 눌러 주세요.'", "'아직 준비 중입니다. 잠시 뒤에 다시 눌러 주세요.'"],
  ['서랍 설명(동적)', "'기록과 사주 서랍 열기'", "'기록 서랍 열기'"],
  ['서랍 풀이말', "'기록 · 관계 · 그래프 · 사주'", "'기록 · 관계'"],
  ['관계도 안내(ui-viz)', "'선이 굵을수록 가까운 사이 · 인물을 누르면 궁합'", "'선이 굵을수록 가까운 사이 · 인물을 누르면 자세히'"],

  // ── 3. 화면 모듈(ui-core)의 동작
  ['학년 자막', "y.seun.ko + '년 · '", "(y.label ? y.label + ' · ' : y.seun.ko + '년 · ')", 2],      // "2023 · 계묘년 · 아홉 살" → "2023 · 초등학교 3학년 · 아홉 살"
  ['시작 막 둘째 줄', "D.veilBirth.textContent = birthText(c) + ' · ' + (c.input.gender === 'F' ? '여' : '남');",
    "D.veilBirth.textContent = root.SchoolApp ? root.SchoolApp.veilText(S.life) : birthText(c) + ' · ' + (c.input.gender === 'F' ? '여' : '남');"],
  ['사건 상세의 "그해의 운"', "    body.appendChild(h('section', { class: 'ev-sec' }, h('h3', { class: 'ev-h' }, '그해의 운'),",
    "    if (!S.life.schoolLife) body.appendChild(h('section', { class: 'ev-sec' }, h('h3', { class: 'ev-h' }, '그해의 운'),"],
  ['숨긴 탭은 고르지 않는다', "    if (['log', 'rel', 'graph', 'saju'].indexOf(name) < 0) name = 'log';",
    "    if ((root.SchoolApp ? ['log', 'rel'] : ['log', 'rel', 'graph', 'saju']).indexOf(name) < 0) name = 'log';"],

  // ── 4. 관계도(ui-viz): 띠 · 일간 · 궁합은 값이 있을 때만, 주인공 정보는 이름만
  ['인물의 띠 · 일간', "        h('span', { class: 'chip' }, npc.zodiacName + '띠'),\n        h('span', { class: 'chip ' + elClass(el), 'data-gloss': '일간', tabindex: '0' }, '일간 ' + npc.dayStemName + (E ? ' · ' + E.T.EL_KO[el] : '')),",
    "        npc.zodiacName ? h('span', { class: 'chip' }, npc.zodiacName + '띠') : null,\n        npc.dayStemName ? h('span', { class: 'chip ' + elClass(el), 'data-gloss': '일간', tabindex: '0' }, '일간 ' + npc.dayStemName + (E ? ' · ' + E.T.EL_KO[el] : '')) : null,"],
  ['인물의 궁합', "      box.appendChild(h('div', { class: 'pv-rel-info-row' }, h('span', { class: 'label', 'data-gloss': '궁합', tabindex: '0' }, '궁합'),",
    "      if (npc.compat) box.appendChild(h('div', { class: 'pv-rel-info-row' }, h('span', { class: 'label', 'data-gloss': '궁합', tabindex: '0' }, '궁합'),"],
  ['주인공 정보', "      if (id === 'self') {\n        var c = st.chart, day = c.pillars.day, yr = c.pillars.year;",
    "      if (id === 'self' && st.life && st.life.schoolLife) {      // 학교생활 영상: 이름과 얼굴만\n" +
    "        box.appendChild(h('div', { class: 'pv-rel-info-head' }, face('self', yi), h('div', { class: 'pv-rel-info-id' }, h('div', { class: 'pv-rel-info-name' }, h('b', null, st.life.name), h('span', { class: 'muted' }, '주인공'))), close));\n" +
    "        return;\n      }\n      if (id === 'self') {\n        var c = st.chart, day = c.pillars.day, yr = c.pillars.year;"],
  ['주인공 동그라미의 한자', "day ? day.stemHanja : '我')", "root.SchoolApp ? '' : day ? day.stemHanja : '我')"],

  // ── 5. 3D 무대: 문 현판 아래 글씨 · 장면으로 오가는 카메라의 빠르기(값은 school-stage.js)
  ['문 현판', "ctx.fillText((d.ko || '') + ' 대운', x + cw * 0.5, y + ch * 0.835);",
    "ctx.fillText((d.ko || '') + (root.PaljaGateSuffix !== undefined ? root.PaljaGateSuffix : ' 대운'), x + cw * 0.5, y + ch * 0.835);"],
  ['장면 카메라', "var inMs = clamp(540 + far * 10, 640, 860), outMs = death ? 0 : clamp(660 + far * 10, 780, 940);",
    "var CP = root.PaljaCamPace || 1, inMs = clamp((540 + far * 10) * CP, 640 * CP, 860 * CP), outMs = death ? 0 : clamp((660 + far * 10) * CP, 780 * CP, 940 * CP);"]
];

// 학교 모듈은 main.js 바로 앞에 끼운다(원본의 엔진·무대·화면 모듈이 모두 실린 뒤, 부팅 전)
const MODULES = ['school-life-data.js', 'school-sim.js', 'school-stage.js', 'school-ui.js', 'school-music.js'];
const ANCHOR = '<script id="mod-main" data-src="main.js">';
// 외부 라이브러리를 HTML 안에 싣는다 → 인터넷이 없거나 CDN 이 막힌 학교 컴퓨터에서도 열린다.
// 원본 로더(lib-loader)는 라이브러리가 이미 있으면 내려받지 않는다. 파일은 원본이 고정한 해시(SRI)와 같을 때만 싣는다.
const VENDOR = [
  ['vendor/lunar.js', 'lunar-javascript@1.7.7'],
  ['vendor/korean-lunar-calendar.min.js', 'korean-lunar-calendar@0.4.0'],
  ['vendor/three.min.js', 'three@0.149.0']
];
const LIB_ANCHOR = '<script id="lib-loader">';
function vendorScripts(html) {
  const crypto = require('crypto');
  return VENDOR.map(([file, name]) => {
    const buf = fs.readFileSync(path.join(here, file));
    const sri = 'sha384-' + crypto.createHash('sha384').update(buf).digest('base64');
    const line = html.split('\n').find(l => l.includes('name: "' + name + '"'));
    const want = line && /sri: "([^"]+)"/.exec(line);
    if (!want) throw new Error('원본 로더에서 ' + name + ' 을(를) 찾지 못했습니다');
    if (want[1] !== sri) throw new Error(file + ' 의 해시가 원본이 고정한 ' + name + ' 과 다릅니다');
    const code = buf.toString('utf8');
    if (/<\/script/i.test(code)) throw new Error(file + ' 안에 </script 가 있습니다');
    return `<script id="vendor-${name.replace(/@.*/, '')}" data-src="${file}">\n${code}\n</script>\n`;
  }).join('');
}

function count(html, find) { return typeof find === 'string' ? html.split(find).length - 1 : (html.match(new RegExp(find.source, 'g')) || []).length; }
function build() {
  let html = fs.readFileSync(src, 'utf8');
  for (const [label, find, to, times = 1] of PATCHES) {
    const n = count(html, find);
    if (n !== times) throw new Error(`[${label}] 바꿀 곳이 ${times}번이 아니라 ${n}번 있습니다: ${String(find).slice(0, 80)}`);
    html = typeof find === 'string' ? html.split(find).join(to) : html.replace(find, () => to);
  }
  if (count(html, ANCHOR) !== 1) throw new Error('main.js 자리를 찾지 못했습니다');
  const inject = MODULES.map(f => {
    const code = fs.readFileSync(path.join(here, f), 'utf8');
    if (/<\/script/i.test(code)) throw new Error(f + ' 안에 </script 가 있습니다');
    return `<script id="mod-${f.replace(/\.js$/, '')}" data-src="${f}">\n${code}\n</script>\n`;
  }).join('');
  html = html.replace(ANCHOR, () => inject + ANCHOR);
  if (count(html, LIB_ANCHOR) !== 1) throw new Error('라이브러리 로더 자리를 찾지 못했습니다');
  const vendor = vendorScripts(html);
  html = html.replace(LIB_ANCHOR, () => vendor + LIB_ANCHOR);
  fs.writeFileSync(out, html);
  return { out, bytes: fs.statSync(out).size, patches: PATCHES.length };
}

if (require.main === module) {
  const r = build();
  console.log(`만들었습니다: ${r.out} (${(r.bytes / 1048576).toFixed(2)} MB, 원본 패치 ${r.patches}곳)`);
}
module.exports = { build, PATCHES, MODULES, VENDOR };
