/* =====================================================================
 * SchoolStage — 학교 사건을 원본 3D 무대에 등록한다 (원본 모듈은 고치지 않고, 열려 있는 확장 지점만 쓴다)
 *   1) PaljaVocab.KINDS        새 사건 종류(분류 · 이름)
 *   2) PaljaDirector.DIRECTION 사건마다 머리 위 그림 · 분위기 · 입자 · 동작/표정/손소품 · 상대역
 *   3) PaljaSets.rule(fn)      큰 사건 → 장면 세트(사건에 실린 _set 을 가장 높은 점수로 고른다)
 *   4) PaljaGateSuffix = ''    문 현판 아래 글씨에서 " 대운"을 뗀다(빌드가 원본의 그 한 줄만 이 값을 읽게 바꿔 둔다)
 *   5) PaljaCamPace = 1.4      큰 사건 세트로 오가는 카메라 비행 시간 배율(원본 0.6~0.9초 → 약 0.9~1.3초)
 * ===================================================================== */
(function (root) {
  'use strict';
  var DATA = root.SchoolLifeData, V = root.PaljaVocab, DIR = root.PaljaDirector, SETS = root.PaljaSets;
  if (!DATA) return;
  var k;
  if (V && V.KINDS) for (k in DATA.KINDS) V.KINDS[k] = { cat: DATA.KINDS[k][0], label: DATA.KINDS[k][1] };
  if (DIR && DIR.DIRECTION) for (k in DATA.DIRECTION) {
    var d = DATA.DIRECTION[k];
    var row = { bubble: d.bubble, mood: d.mood || 'joy', fx: d.fx || null, re: d.re.slice(), cast: d.cast ? d.cast.slice() : null };
    if (d.lead) row.lead = d.lead;
    DIR.DIRECTION[k] = row;
  }
  if (SETS && SETS.rule) SETS.rule(function (q) {
    if (!q || q.purpose !== 'event' || !q.event || !q.event._set) return null;
    var s = q.event._set, o = {}, src = s[1] || {}, x;
    o.year = q.year; o.cls = 'middle'; o.seedKey = 'school|' + q.event.kind + '|' + q.age;
    if (q.event.sign) o.sign = q.event.sign;
    for (x in src) o[x] = src[x];
    return { name: s[0], opts: o, score: 1000 };
  });
  root.PaljaGateSuffix = '';
  root.PaljaCamPace = 1.8;          // 큰 사건 세트로 날아가고 돌아오는 카메라를 원본보다 1.4배 천천히(빌드가 원본의 그 한 줄만 이 값을 읽게 바꿔 둔다)
})(typeof globalThis !== 'undefined' ? globalThis : this);
