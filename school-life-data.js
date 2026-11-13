/* =====================================================================
 * SchoolLifeData — 「용암초 6년」 의 데이터 (팔자 앱의 LifeData + LifeCareer + PaljaVocab 자리)
 * ---------------------------------------------------------------------
 * 팔자 앱과 같은 원칙
 *  - 규칙(무엇을 언제 뽑나)은 school-sim.js 에, 이 파일에는 숫자·글·이름·근거만 둔다.
 *  - 사건 종류(kind)는 KINDS 의 닫힌 목록만 쓴다. 연출 표(DIRECTION)도 kind 마다 하나씩.
 *  - 볼 때마다 이야기가 달라진다: 고정 장면(ANCHORS)은 문장만 바뀌고, 학년마다 뽑기 상자(POOL)에서 큰 장면 · 작은 장면을 새로 뽑는다.
 *    같은 학생 + 같은 이야기 번호(seed) = 같은 영상.
 *
 * 사건의 출처(src) — 화면의 "근거 칩"에 그대로 나온다
 *  'board'    천안용암초 홈페이지 가정통신문 게시판의 글 제목·날짜(2021-03 ~ 2026-04, 990건)
 *  'site'     충남 학교공간혁신 사업 페이지      'news' 언론 보도
 *  'custom'   해마다 되풀이된 학사 관례(담임 확인 필요)      'input' 입력한 내용      'dream' 상상으로 그린 미래
 *  'teacher'  담임 선생님이 알려 준 내용(예: 2026 6학년은 수학여행 대신 교내 AI 체험)
 *
 * 문장은 texts(여러 개) 가운데 하나를 뽑는다. 한 칸은 문자열 또는 { t: 문장, cal: [첫해, 끝해], grades: [학년…], note: 근거 } —
 * 조건이 맞는 것만 후보가 된다. 틀: {name} {school} {friend} {teacher} {middle} {job} {gradNo} {calYear} {grade} {year}, 조사는 {name|은/는}.
 *
 * ── 고정 장면(ANCHORS) 한 줄의 칸 ─────────────────────────────────────
 *  age | grade   나이 또는 학년(학년 g 는 6+g 세, 달력 연도 = 입학 연도 + g - 1)      month 1~12 (13 = 이듬해 1월)
 *  kind · major · tone · src · note · cal(그 달력 연도에만) · opt(희망자 체크 상자)
 *  friend        친구 번호(0 유치원 단짝 · 1~3 학교 친구). friendGrades: [첫 학년, 끝 학년] 이면 그 사이에서 사귄 학년을 뽑는다
 *  teacher       담임 선생님의 학년. 이름을 적었으면 texts, 안 적었으면 textsNoName 에서 뽑는다
 *  cast          장면에 함께 서는 사람: father · mother · teacher · teacher6 · friend · classmates(곁의 친구 둘) · bestFriends
 *                (적지 않으면 5~13세에는 classmates, 그 밖에는 아무도)      sign  세트 간판: school · kinder · daycare · middle
 *
 * ── 뽑기 상자(POOL) 한 칸 ─────────────────────────────────────────────
 *  kind, grades(그 활동이 있는 학년), cal(그 달력 연도에만), months(달 후보), weight(뽑힐 무게, 기본 1), max(한 영상에 최대, 기본 1),
 *  major(true 면 그 학년의 큰 장면 후보), src, note, texts, cast, friend: true(곁의 친구 한 명을 {friend} 로)
 * ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SchoolLifeData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SCHOOL = { name: '천안용암초등학교', short: '용암초', town: '천안 쌍용동', motto: '바르고 굳세게',
                 firstGradYear: 1999 };     // 1999학년도 제1회 → 2024학년도 제26회(가정통신문)
  var SCHOOL_YEAR_NOW = 2026;               // 지금 학년도(2026-03 ~ 2027-02)

  /** 학년 → 출생 연도·입학 연도·졸업 회차. 6학년이면 2014년생, 2021년 입학, 2026학년도 제28회 졸업 */
  function cohort(grade, schoolYear) {
    schoolYear = schoolYear || SCHOOL_YEAR_NOW;
    grade = Math.max(1, Math.min(6, Math.round(+grade || 6)));
    var entry = schoolYear - (grade - 1), gradSY = entry + 5;
    return { grade: grade, birthYear: entry - 7, entryYear: entry, gradSchoolYear: gradSY, gradNo: gradSY - SCHOOL.firstGradYear + 1, gradCalYear: gradSY + 1 };
  }

  // ------------------------------------------------------------------ 쌍용동 일대 유치원·어린이집 (입력 화면의 선택지)
  // 목록 사이트 기준이라 지금의 운영 여부는 확인하지 못했다. 학생이 실제로 다닌 곳을 고르거나 직접 적는다.
  var PRESCHOOLS = [
    { name: '천안쌍용초등학교병설유치원', kind: 'kinder' }, { name: '유한유치원', kind: 'kinder' }, { name: '늘사랑유치원', kind: 'kinder' },
    { name: '젤라유치원', kind: 'kinder' }, { name: '아이숲유치원', kind: 'kinder' }, { name: '좋은유치원', kind: 'kinder' }, { name: '푸른별유치원', kind: 'kinder' },
    { name: '쌍용어린이집', kind: 'daycare' }, { name: '루소어린이집', kind: 'daycare' }, { name: '정진어린이집', kind: 'daycare' }, { name: '능수어린이집', kind: 'daycare' },
    { name: '세정어린이집', kind: 'daycare' }, { name: '한나어린이집', kind: 'daycare' }, { name: '엘림어린이집', kind: 'daycare' }, { name: '아이행복어린이집', kind: 'daycare' },
    { name: '근로복지공단천안어린이집', kind: 'daycare' }, { name: '지구마을어린이집', kind: 'daycare' }
  ];

  // 희망자 활동(입력 화면 체크 상자). 켜면 반드시 나오고, 켜지 않으면 나오지 않는다
  var OPTIONAL = [
    { key: 'band', label: '밴드부' }, { key: 'gugak', label: '가야금·해금' }, { key: 'ai', label: 'AI 동아리' }, { key: 'coding', label: 'AI 코딩대회' }
  ];

  // ------------------------------------------------------------------ 사건 종류(닫힌 목록) [분류, 이름]
  var KINDS = {
    birth: ['family', '태어남'], daycare_enter: ['study', '어린이집'], kinder_enter: ['study', '유치원'], kinder_grad: ['study', '유치원 졸업'],
    school_enter: ['study', '초등학교 입학'], covid_school: ['era', '마스크 쓴 교실'], teacher_meet: ['bond', '새 담임 선생님'], friend_new: ['friend', '새 친구'],
    field_trip: ['study', '현장체험학습'], farm_trip: ['study', '농촌체험학습'], survival_swim: ['study', '생존수영'], camp: ['study', '수련활동'],
    open_class: ['family', '학부모 공개수업'], busking: ['study', '등굣길 버스킹'], morning_event: ['study', '등굣길 행사'], walk_challenge: ['health', '아침 등교 걷기'],
    health_walk: ['health', '건강걷기 365'], library_event: ['study', '학교도서관'], reading_month: ['study', '독서의 달'], milk_time: ['health', '우유 급식'],
    care_class: ['family', '돌봄교실'], green_parents: ['family', '녹색어머니 등굣길'], after_school: ['study', '방과후학교'], english_camp: ['study', '여름 영어캠프'],
    character_week: ['friend', '인성교육 실천주간'], play_festival: ['friend', '인성·행복놀이 한마당'], safety_fest: ['health', '어린이 안전체험'], horse_riding: ['study', '승마체험'],
    eco_action: ['era', '환경사랑 실천'], eco_drawing: ['study', '환경그림대회'], plastic_zero: ['family', '플라스틱 제로 봉사'], poem_recital: ['study', '시 낭송 대회'],
    essay_contest: ['study', '국토사랑 글짓기'], english_speech: ['study', '영어 스피치'], teacher_day: ['bond', '스승의 날'], english_club: ['friend', '영어 동아리'],
    video_contest: ['family', '가정의 달 영상'], movie_day: ['study', '영화 관람'], robot_camp: ['study', '로봇코딩캠프'], ai_camp: ['study', 'AI 여름캠프'],
    band_club: ['friend', '밴드부'], gugak_club: ['friend', '가야금·해금'], ai_club: ['study', 'AI 동아리'], coding_contest: ['study', 'AI 코딩대회'],
    music_festival: ['friend', '학생음악축제'], dokdo_day: ['study', '독도의 날'], new_room: ['study', '새 교실'], trip_cancel: ['era', '멈춘 체험학습'],
    yearbook_photo: ['friend', '졸업앨범 촬영'], ai_experience: ['study', '교내 AI 체험'], graduation: ['study', '졸업'],
    middle_enter: ['study', '중학교 입학'], grown_up: ['career', '꿈을 이루다'], happy_life: ['family', '행복한 날들']
  };

  // ------------------------------------------------------------------ 인생의 문(원본의 "대운 문" 자리). 현판의 두 글자 · 아래 글씨 · 그 너머의 계절(0 봄 1 여름 2 들녘 3 가을 4 겨울)
  // stop: 문 앞에서 멈춰 현판을 올려다본다(입학 · 졸업). 나머지 문은 그해의 장면과 연출이 겹치거나, 졸업 뒤라 빠르게 지나가므로 길 위에 서 있기만 한다
  var GATES = [
    { age: 3, hanja: '童心', ko: '어린이집', el: 0 },
    { age: 5, hanja: '幼學', ko: '유치원', el: 1 },
    { age: 7, hanja: '入學', ko: '용암초 입학', el: 0, stop: true },
    { age: 13, hanja: '卒業', ko: '졸업', el: 3, stop: true },
    { age: 19, hanja: '成人', ko: '어른', el: 2 },
    { age: 26, hanja: '夢成', ko: '꿈', el: 1 },
    { age: 30, hanja: '幸福', ko: '행복', el: 0 }
  ];

  // ------------------------------------------------------------------ 고정 장면(모든 이야기에 나온다. 문장은 볼 때마다 바뀐다)
  var TEACHER_TEXTS = [
    '{grade}학년 교실 문을 여니 {teacher} 선생님이 기다리고 계셨다.',
    '{grade}학년, {teacher} 선생님 반이 되었다. 새 이름표를 가슴에 달았다.',
    '새 학년 새 교실. 담임 {teacher} 선생님이 출석부에서 {name|을/를} 불렀다.',
    '{grade}학년 담임은 {teacher} 선생님. 새 교과서 냄새가 좋았다.',
    '{grade}학년 첫날, {teacher} 선생님이 칠판에 반 친구들 이름을 하나씩 적어 주셨다.',
    '{grade}학년 {teacher} 선생님 반. 새 사물함에 내 이름표를 붙였다.',
    '새 학년 첫 시간, {teacher} 선생님과 우리 반 약속을 정했다.',
    { t: '마지막 담임 {teacher} 선생님을 만났다. 초등학교의 마지막 한 해가 시작되었다.', grades: [6] }
  ];
  var TEACHER_TEXTS_NO_NAME = [
    '{grade}학년, 새 담임 선생님을 만났다.',
    '{grade}학년 교실 문을 여니 새 담임 선생님이 기다리고 계셨다.',
    '새 학년 새 교실. 담임 선생님이 출석부에서 {name|을/를} 불렀다.',
    '{grade}학년이 되었다. 새 교과서에 이름을 꾹꾹 눌러 썼다.',
    '{grade}학년 첫날, 새 사물함에 내 이름표를 붙였다.',
    '새 학년 첫 시간, 담임 선생님과 우리 반 약속을 정했다.',
    '{grade}학년 교실은 한 층 더 높은 곳에 있었다. 창밖 운동장이 새로워 보였다.',
    { t: '6학년, 초등학교의 마지막 담임 선생님을 만났다.', grades: [6] }
  ];
  function teacherRow(g) { return { grade: g, month: 3, kind: 'teacher_meet', src: 'input', teacher: g, cast: ['teacher'], title: '{grade}학년 담임 선생님', texts: TEACHER_TEXTS, textsNoName: TEACHER_TEXTS_NO_NAME }; }

  var ANCHORS = [
    { age: 0, month: 4, kind: 'birth', major: true, src: 'input', tone: 'good', cast: ['father', 'mother'], texts: [
      '{year}년, {name|이/가} 태어났다. 온 집안이 환해졌다.',
      '{year}년 봄, 작은 울음소리와 함께 {name|이/가} 세상에 왔다.',
      '{year}년, {name|이/가} 태어났다. 엄마 아빠의 첫 사진 속 주인공이었다.'] },
    { age: 3, month: 3, kind: 'daycare_enter', src: 'input', cast: ['mother'], sign: 'daycare', texts: [
      '{daycare}에서 처음으로 엄마 손을 놓고 하루를 보냈다.',
      '{daycare} 첫날, 신발장에 붙은 내 이름을 찾았다.',
      '{daycare}에서 낮잠 이불을 처음 폈다.'] },
    { age: 5, month: 3, kind: 'kinder_enter', major: true, src: 'input', cast: ['mother', 'classmates'], sign: 'kinder', texts: [
      '{kinder}에 다니기 시작했다. 노란 가방이 등보다 컸다.',
      '{kinder} 첫 등원 날, 선생님 손을 잡고 교실에 들어갔다.',
      '{kinder}에서 처음으로 내 자리와 내 신발장이 생겼다.'] },
    { age: 5, month: 6, kind: 'friend_new', src: 'input', friend: 0, cast: ['friend'], title: '친구 {friend}', texts: [
      '{kinder}에서 {friend|을/를} 만났다. 둘은 금세 단짝이 되었다.',
      '{kinder} 모래놀이터에서 {friend|와/과} 처음 함께 놀았다.',
      '{friend|와/과} 손을 잡고 {kinder} 소풍 길을 걸었다.'] },
    { age: 7, month: 2, kind: 'kinder_grad', src: 'input', cast: ['mother', 'father', 'classmates'], sign: 'kinder', texts: [
      '{kinder} 졸업식. 이제 진짜 학교에 간다.',
      '{kinder} 졸업식에서 학사모를 썼다. 조금 컸다.'] },
    // 1학년
    { grade: 1, month: 3, kind: 'school_enter', major: true, src: 'custom', tone: 'good', cast: ['mother', 'classmates'], sign: 'school', texts: [
      '{calYear}년 3월, {school}에 입학했다. 개나리가 피어 있었다.',
      '{calYear}년 3월, 커다란 책가방을 메고 {school} 교문을 들어섰다.',
      '{calYear}년 3월, {school} 1학년이 되었다. 가슴에 단 이름표가 반짝였다.'] },
    { grade: 1, month: 3, kind: 'covid_school', src: 'news', cal: [2020, 2021], note: '2021년 유치원·초등 1~2학년은 매일 등교(교육부 방침)', texts: [
      '코로나19가 한창이었지만 1학년은 매일 학교에 갔다. 마스크 너머로도 웃는 눈은 보였다.',
      '칸막이가 있는 책상, 마스크 쓴 짝꿍. 그래도 1학년의 교실은 시끌벅적했다.'] },
    teacherRow(1), teacherRow(2), teacherRow(3), teacherRow(4), teacherRow(5), teacherRow(6),
    // 학교 친구 셋: 사귄 학년은 볼 때마다 뽑는다
    { friendGrades: [1, 2], month: 5, kind: 'friend_new', src: 'input', friend: 1, cast: ['friend'], title: '친구 {friend}', texts: [
      '{grade}학년 교실에서 {friend|와/과} 짝꿍이 되었다.',
      '{friend|이/가} 지우개를 빌려주었다. 그날부터 친구가 되었다.',
      '쉬는 시간마다 {friend|와/과} 운동장으로 뛰어나갔다.'] },
    { friendGrades: [3, 4], month: 5, kind: 'friend_new', src: 'input', friend: 2, cast: ['friend'], title: '친구 {friend}', texts: [
      '{friend|와/과} 같은 반이 되었다. 쉬는 시간이 짧게 느껴졌다.',
      '모둠 활동에서 {friend|와/과} 한 팀이 되었다.',
      '{friend|와/과} 비밀 이야기를 나누는 사이가 되었다.'] },
    { friendGrades: [5, 6], month: 4, kind: 'friend_new', src: 'input', friend: 3, cast: ['friend'], title: '친구 {friend}', texts: [
      '{grade}학년, {friend|와/과} 가장 친한 사이가 되었다.',
      '{friend|와/과} 같은 중학교에 가자고 새끼손가락을 걸었다.',
      '{friend|와/과} 졸업 사진을 나란히 찍기로 약속했다.'] },
    // 희망자 활동(체크 상자를 켠 학생에게만, 늘)
    { grade: 4, month: 4, kind: 'band_club', opt: 'band', src: 'board', note: '2024-04-05 「밴드동아리」', texts: ['밴드부에 들어갔다. 처음 잡은 스틱이 떨렸다.', '밴드부 합주실에서 처음으로 한 곡을 끝까지 맞췄다.'] },
    { grade: 4, month: 4, kind: 'gugak_club', opt: 'gugak', src: 'board', note: '2024-04-19 「예술동아리(가야금, 해금) 모집」', texts: ['가야금·해금 동아리에서 줄을 뜯었다.', '해금 활을 처음 당기자 낯선 소리가 났다.'] },
    { grade: 4, month: 4, kind: 'ai_club', opt: 'ai', src: 'board', note: '2024-03-27 「AI학생자율동아리 모집」', texts: ['AI 학생자율동아리에 이름을 올렸다.', 'AI 동아리에서 컴퓨터에게 그림을 알아보게 가르쳤다.'] },
    { grade: 4, month: 10, kind: 'music_festival', opt: 'band', major: true, src: 'board', tone: 'good', note: '2024-10-11 「충청남도학생음악축제 밴드부 공연 안내」', texts: [
      '충청남도 학생음악축제 무대에 밴드부로 섰다.', '학생음악축제 무대, 조명이 켜지자 손이 저절로 움직였다.'] },
    { grade: 5, month: 4, kind: 'coding_contest', opt: 'coding', src: 'board', note: '2025-04-03 「AI코딩대회 개최 안내」', texts: [
      '교내 AI 코딩대회에 나갔다. 내가 만든 프로그램이 움직였다.', 'AI 코딩대회 마감 직전, 마지막 오류를 고쳤다.'] },
    // 6학년(사실로 확인된 것)
    { grade: 6, month: 5, kind: 'yearbook_photo', src: 'custom', note: '해마다 5월에 졸업앨범 촬영 안내(2023·2024)', texts: [
      '졸업앨범 사진을 찍었다. 친구들과 브이.', '졸업앨범 단체 사진, 맨 뒷줄에서 까치발을 들었다.'] },
    { grade: 6, month: 5, kind: 'ai_experience', major: true, src: 'teacher', tone: 'good', cal: [2026, 2026],
      note: '2026학년도 6학년은 수학여행을 가지 않고, 교내 AI 체험으로 현장체험학습을 대신했다(담임 선생님이 알려 준 내용)', texts: [
      '6학년은 수학여행 대신 학교 안에서 AI 체험을 했다. 친구들과 함께 AI를 직접 다뤄 본 현장체험학습.',
      '수학여행 대신 교내 AI 체험. 친구들과 AI에게 질문을 던지며 한참을 웃었다.'] },
    { grade: 6, month: 13, kind: 'graduation', major: true, src: 'custom', tone: 'good', note: '해마다 12월 말 졸업식 안내(2021~2024학년도 제23~26회)',
      cast: ['teacher6', 'mother', 'father', 'classmates'], sign: 'school', title: '제{gradNo}회 졸업식', texts: [
      '{school} 제{gradNo}회 졸업식. {name}, 졸업을 진심으로 축하해!',
      '{school} 제{gradNo}회 졸업식. 6년 동안 드나든 교문을 꽃다발을 들고 나섰다. 졸업 축하해!',
      '{school} 제{gradNo}회 졸업식. 친구들과 마지막 단체 사진을 찍었다. {name}, 졸업 축하해!'] },
    // 마무리(상상) — 연도 대신 계절과 나이로만 말한다
    { age: 13, month: 3, kind: 'middle_enter', major: true, src: 'dream', tone: 'good', cast: ['mother', 'father', 'classmates'], sign: 'middle', title: '{middle} 입학', texts: [
      '봄, {name|은/는} {middle}에 입학했다. 새 교복이 조금 컸다.',
      '봄, {middle} 교문 앞. {name|은/는} 새 교복 단추를 다시 여몄다.'] },
    // {job} = 나의 꿈(입력 화면), {dreamScene} = 그 꿈을 이룬 모습 한 줄(DREAMS 의 scenes)
    { age: 26, month: 4, kind: 'grown_up', major: true, src: 'dream', tone: 'good', title: '꿈을 이룬 {job}', texts: [
      '시간이 흘러 {name|은/는} {job|이/가} 되었다. {dreamScene}',
      '어릴 적 꿈 그대로, {name|은/는} {job|이/가} 되었다. {dreamScene}',
      '{name|은/는} 정말로 {job|이/가} 되었다. {dreamScene}'] },
    { age: 30, month: 5, kind: 'happy_life', major: true, src: 'dream', tone: 'good', cast: ['mother', 'father', 'bestFriends'], texts: [
      '그리고 {name|은/는} 소중한 사람들과 함께 오래오래 행복하게 살았다.',
      '그리고 {name|은/는} 가족, 오랜 친구들과 함께 오래오래 행복하게 살았다.'] }
  ];

  // ------------------------------------------------------------------ 뽑기 상자: 학교 가정통신문 · 공간혁신 사업에서 찾은 활동
  // 학년마다 PICKS 의 개수만큼 뽑는다. 같은 활동은 max 번까지, 같은 문장은 한 번만.
  var POOL = [
    // 현장체험학습(그 학생들이 그 학년이던 해의 안내)
    { kind: 'field_trip', grades: [2], months: [10], major: true, weight: 1.2, max: 2, src: 'board', note: '2022-10-06 「2학년 현장체험학습 정산 결과 안내」', friend: true, texts: [
      '2학년 현장체험학습. 버스 창밖으로 손을 흔들었다.', '2학년 가을 현장체험학습, {friend|와/과} 버스 옆자리에 앉았다.', '현장체험학습 날 아침, 도시락 가방이 유난히 무거웠다.'] },
    { kind: 'field_trip', grades: [3], months: [5], major: true, weight: 1.2, max: 2, src: 'board', note: '2023-05-02 「3학년 1학기 현장체험학습」', friend: true, texts: [
      '3학년 1학기 현장체험학습. 도시락이 제일 맛있었다.', '3학년 현장체험학습, {friend|와/과} 김밥을 하나씩 바꿔 먹었다.'] },
    { kind: 'field_trip', grades: [4], months: [5, 10], major: true, weight: 1.2, max: 2, src: 'board', note: '2024-04-23 「4학년 현장체험학습 안내」 · 2024-09-27 「4학년 2학기 현장체험학습」', friend: true, texts: [
      '4학년 현장체험학습을 떠났다.', '4학년 현장체험학습, 단풍이 든 길을 {friend|와/과} 나란히 걸었다.', '현장체험학습 버스에서 반 친구들과 노래를 불렀다.'] },
    { kind: 'farm_trip', grades: [3], months: [5], major: true, weight: 0.8, src: 'board', note: '2022-04-29 「3학년 우리고장 농촌체험학습 안내」 — 용암초 3학년의 체험(해마다 다를 수 있음)', texts: [
      '우리 고장 농촌체험. 흙 묻은 손으로 모종을 심었다.', '농촌체험학습에서 처음으로 밭고랑 사이를 걸어 보았다.'] },
    { kind: 'trip_cancel', grades: [3], cal: [2023, 2023], months: [9], weight: 1.2, src: 'board', tone: 'bad', note: '2023-09-06 「현장체험학습 및 수학여행 중단 안내」', texts: [
      '2학기 체험학습이 갑자기 멈췄다. 대신 교실에서 더 많이 웃었다.', '기다리던 2학기 체험학습이 취소되었다. 아쉬움은 반 친구들과 나눠 가졌다.'] },
    { kind: 'survival_swim', grades: [3, 5], months: [4], major: true, weight: 1.6, src: 'board', note: '2023-03-24 「수영장 생존수영 실기교육 참가신청 안내」 · 2025-04-03 「생존수영 수영장 실기교육 신청 안내」', texts: [
      { t: '수영장에서 생존수영을 배웠다. 물 위에 누워 천장을 보는 법.', grades: [3] },
      { t: '처음 들어간 깊은 물, 생존수영 선생님 말대로 숨을 크게 쉬었다.', grades: [3] },
      { t: '5학년, 다시 수영장. 이번에는 친구를 돕는 법도 배웠다.', grades: [5] },
      { t: '생존수영 시간, 페트병 하나로 물에 뜨는 법을 배웠다.', grades: [5] }] },
    { kind: 'camp', grades: [5], months: [6], major: true, weight: 3, src: 'board', tone: 'good', note: '2024-11-27 「5학년 수련활동 수요조사」 — 날짜·장소는 담임 확인', texts: [
      '처음으로 친구들과 하룻밤을 보낸 수련활동. 밤새 이야기가 끝나지 않았다.', '수련활동 캠프파이어 앞에서 반 친구들과 어깨동무를 했다.'] },
    // 학교의 하루
    { kind: 'open_class', grades: [1, 2, 3, 4, 5, 6], months: [10, 11], major: true, weight: 1, max: 1, src: 'board', cast: ['father', 'mother'],
      note: '해마다 열리는 행사: 2021-11-01 「학부모 수업공개의 날」 · 2022-10-14 · 2023-10-16 · 2024-10-07 「학부모 공개 수업 안내」', texts: [
      '학부모 공개수업. 교실 뒤에 엄마 아빠가 서 있었다.', '학부모 공개수업 날, 손을 번쩍 들고 발표했다.', '공개수업 시간, 뒤를 돌아보니 엄마가 손을 흔들었다.'] },
    { kind: 'milk_time', grades: [1, 2, 3, 4, 5, 6], months: [4, 9], weight: 0.7, friend: true, src: 'board', note: '2022-01-25 「우유급식 수요조사」 · 2024-03-06 「천안시 우유바우처 시범사업」', texts: [
      '아침 우유 급식, {friend|와/과} 누가 먼저 마시나 시합을 했다.', '급식 시간, 오늘의 반찬을 맞히는 게 작은 즐거움이었다.'] },
    { kind: 'care_class', grades: [1, 2], months: [3, 7], weight: 0.9, src: 'board', note: '2021-12-27 「초등돌봄교실 참가신청서 안내」 · 2022-03-10 「토요돌봄교실 신청 안내」', texts: [
      '방과 후에는 돌봄교실에서 숙제를 하고 놀았다.', '돌봄교실 창가에서 엄마가 데리러 올 시간을 기다렸다.'] },
    { kind: 'green_parents', grades: [1, 2, 3, 4, 5, 6], months: [3, 4], weight: 0.7, src: 'board', note: '해마다 활동 안내: 2023-03-10 「녹색어머니 활동 안내」 · 2024-03-07 「녹색학부모회 활동 안내」', texts: [
      '아침 등굣길, 노란 깃발을 든 녹색어머니가 웃으며 인사해 주었다.', '녹색어머니회 깃발 아래로 횡단보도를 건넜다.'] },
    { kind: 'busking', grades: [1, 2, 3, 4, 5, 6], cal: [2022, 2022], months: [3], weight: 1, src: 'board', note: '2022-03-17 「등굣길 버스킹 신청 안내」', texts: [
      '아침마다 교문 앞에서 등굣길 버스킹 음악이 들렸다.', '등굣길 버스킹 노래에 맞춰 발걸음이 가벼워졌다.'] },
    { kind: 'morning_event', grades: [1, 2, 3, 4, 5, 6], cal: [2023, 2023], months: [6], weight: 0.9, src: 'board', note: '2023-06-12 「제2회 등굣길 행사 안내」', texts: [
      '등굣길 행사가 열린 날, 교문 앞이 축제처럼 북적였다.'] },
    { kind: 'health_walk', grades: [1, 2, 3, 4, 5, 6], cal: [2022, 2022], months: [4], weight: 0.6, src: 'board', note: '2022-03-24 「건강걷기 365 도전과제 안내」', texts: [
      '건강걷기 365 도전! 하루하루 걸음 수를 채웠다.'] },
    { kind: 'walk_challenge', grades: [1, 2, 3, 4, 5, 6], cal: [2023, 2099], months: [3, 4], weight: 0.9, src: 'board', note: '2023-03-29 · 2024-04-02 「아침 등교 걷기 실시 및 걷쥬 앱 가입」', texts: [
      '"걷쥬" 앱을 켜고 아침 등교 걷기를 시작했다.', '아침 등교 걷기, 오늘도 걸음 수가 하나 늘었다.'] },
    { kind: 'library_event', grades: [1, 2, 3, 4, 5, 6], months: [5], major: true, weight: 1, max: 2, src: 'board', texts: [
      { t: '학교도서관에서 처음으로 책을 빌렸다. 대출증이 자랑스러웠다.', grades: [1, 2], cal: [2022, 2026], note: '2022-04-27 「학교도서관 개방 안내」' },
      { t: '학교도서관 어울림 행사에 다녀왔다.', cal: [2022, 2022], note: '2022-05-25 「학교도서관 어울림 행사 안내」' },
      { t: '달빛도서관 어울림 행사에서 책 한 권을 골랐다.', cal: [2023, 2023], note: '2023-05-24 「달빛도서관 어울림 행사 안내」' },
      { t: '학교 전자도서관으로 집에서도 책을 읽었다.', cal: [2022, 2024], note: '2022-05-12 · 2024-05-03 「학교전자도서관 이용 안내」' },
      { t: '쉬는 시간마다 학교도서관에 들러 읽던 책을 마저 읽었다.', grades: [3, 4, 5, 6], note: '해마다 학교도서관 개방 안내(2022-04-27 · 2023-03-20 · 2024-08-23)' }] },
    { kind: 'reading_month', grades: [1, 2, 3, 4, 5, 6], months: [9], weight: 0.9, src: 'board', texts: [
      { t: '독서의 달, 낭독극 「아들과 아버지」 공연을 보았다.', cal: [2022, 2022], note: '2022-09-19 「독서의 달 낭독극 \'아들과 아버지\' 공연 안내」' },
      { t: '독서의 달 프로그램에 참여해 두꺼운 책 한 권을 끝까지 읽었다.', cal: [2024, 2024], note: '2024-08-30 「독서의 달 프로그램 안내」' }] },
    { kind: 'after_school', grades: [1, 2, 3, 4, 5, 6], months: [4, 7], weight: 1, max: 2, src: 'board', texts: [
      { t: '방과후 난타교실에서 북을 신나게 두드렸다.', cal: [2023, 2024], note: '2023-03-16 · 2024-03-18 「방과후 난타교실」' },
      { t: '여름방학 창의수학 교실에서 수 퍼즐을 풀었다.', cal: [2022, 2022], note: '2022-06-29 「여름방학 창의수학 교실 운영 안내」' },
      { t: '두드림 수학교실에서 어려운 문제를 하나씩 풀어냈다.', cal: [2023, 2024], note: '2023-03-27 · 2024-03-27 「두드림 수학교실」' },
      { t: '방과후학교 공개수업에서 그동안 배운 것을 보여 주었다.', cal: [2021, 2024], note: '2021-11-09 · 2022-06-17 · 2023-06-12 「방과후학교 공개수업 · 활동 공개 안내」' },
      { t: '새 학기 방과후학교에서 처음 듣는 수업을 골랐다.', note: '해마다 방과후학교 수강 신청 안내(2021~2024)' }] },
    { kind: 'english_camp', grades: [2, 3, 4, 5, 6], months: [7], major: true, weight: 0.8, src: 'board', note: '해마다 여름방학 안내: 2022-07-08 · 2023-07-04 · 2024-07-08 「여름방학 교내 영어캠프 안내」', texts: [
      '여름방학 교내 영어캠프에 참가했다. 영어 이름표를 달았다.', '여름 영어캠프에서 처음으로 영어로 자기소개를 했다.'] },
    { kind: 'character_week', grades: [1, 2, 3, 4, 5, 6], cal: [2023, 2023], months: [4], weight: 0.8, src: 'board', note: '2023-04-24 「1학기 인성교육 실천주간 안내」', friend: true, texts: [
      '인성교육 실천주간, {friend}에게 고마운 마음을 쪽지에 적었다.', '인성교육 실천주간, 반 친구들과 서로 칭찬 한마디씩을 건넸다.'] },
    { kind: 'play_festival', grades: [1, 2, 3, 4, 5, 6], cal: [2023, 2099], months: [5], major: true, weight: 1, src: 'board', note: '2023-05-04 「충남 인성·행복놀이 한마당」 · 2024-04-09 「2024 충남 인성·행복놀이 한마당 참가 신청」', texts: [
      '충남 인성·행복놀이 한마당에서 친구들과 신나게 놀았다.', '인성·행복놀이 한마당, 처음 보는 친구와도 금세 한 팀이 되었다.'] },
    { kind: 'safety_fest', grades: [1, 2, 3, 4, 5, 6], cal: [2023, 2099], months: [5], weight: 0.6, src: 'board', note: '2023-04-26 「천안 어린이 안전체험 페스티벌 참가 안내」 · 2024-03-21 「제7회 어린이 안전 체험 페스티벌」', texts: [
      '어린이 안전체험 페스티벌에서 안전하게 지내는 법을 직접 해 보며 배웠다.'] },
    { kind: 'horse_riding', grades: [1, 2, 3, 4, 5, 6], cal: [2023, 2023], months: [4], major: true, weight: 0.4, src: 'board', note: '2023-03-15 「학생승마체험교육 참가신청 안내」(희망자)', texts: [
      '학생 승마체험 교육에서 처음으로 말 등에 올랐다.'] },
    { kind: 'eco_action', grades: [1, 2, 3, 4, 5, 6], cal: [2022, 2022], months: [11], weight: 0.6, src: 'board', note: '2022-11-07 「환경사랑 실천과제 안내」', texts: [
      '환경사랑 실천과제로 집에서 분리배출을 꼼꼼히 했다.'] },
    { kind: 'eco_drawing', grades: [1, 2, 3, 4, 5, 6], cal: [2022, 2024], months: [7], weight: 0.6, src: 'board', texts: [
      { t: '어린이 환경그림대회에 지구를 지키는 그림을 그려 냈다.', cal: [2022, 2022], note: '2022-06-16 「중부재단 어린이환경그림대회 참가 안내」' },
      { t: '제3회 어린이 환경그림대회에 푸른 숲 그림을 냈다.', cal: [2024, 2024], note: '2024-07-12 「제3회 어린이 환경그림대회 안내」' }] },
    { kind: 'plastic_zero', grades: [1, 2, 3, 4, 5, 6], cal: [2022, 2024], months: [5], weight: 0.4, src: 'board', cast: ['father', 'mother'], note: '2022-04-11 · 2024-04-09 「도전! 플라스틱 제로 1365 가족자원봉사단 모집」(희망자)', texts: [
      '가족과 함께 "도전! 플라스틱 제로" 봉사에 나섰다.'] },
    { kind: 'poem_recital', grades: [3, 4, 5, 6], cal: [2023, 2024], months: [6], major: true, weight: 0.5, src: 'board', note: '2023-06-15 「천안시 나라사랑 시낭송 대회」 · 2024-05-24 「시 낭송 대회 안내」', texts: [
      '시 낭송 대회에서 떨리는 목소리로 시를 읊었다.', '시 낭송 대회 무대, 외운 시가 끝날 때까지 숨을 골랐다.'] },
    { kind: 'essay_contest', grades: [2, 3, 4, 5, 6], cal: [2022, 2023], months: [9], weight: 0.5, src: 'board', note: '2022-09-02 「제27회」 · 2023-09-12 「제28회 전국 초등학생 국토사랑 글짓기대회」', texts: [
      '국토사랑 글짓기대회에 우리 동네 이야기를 써서 냈다.'] },
    { kind: 'english_speech', grades: [3, 4, 5, 6], cal: [2023, 2026], months: [5], major: true, weight: 0.4, src: 'board', note: '2023-05-24 「전국 청소년(3~6학년) 영어 스피치 콘테스트」 · 2026-04-27 「전국 청소년 영어 스피치 콘테스트 안내」', texts: [
      '영어 스피치 콘테스트에서 준비한 이야기를 끝까지 말했다.'] },
    { kind: 'teacher_day', grades: [1, 2, 3, 4, 5, 6], months: [5], weight: 0.8, src: 'board', note: '2024-05-07 「스승의 날 기념 이벤트 안내」', cast: ['teacher'], texts: [
      '스승의 날, 담임 선생님께 감사 편지를 썼다.', '스승의 날, 반 친구들과 칠판 가득 감사 인사를 적었다.'] },
    { kind: 'english_club', grades: [4], cal: [2024, 2024], months: [5], weight: 0.4, src: 'board', note: '2024-04-23 「영어 자율동아리 모집 안내」(희망자)', texts: [
      '영어 자율동아리에서 친구들과 영어 그림책을 읽었다.'] },
    { kind: 'video_contest', grades: [5], cal: [2025, 2025], months: [5], weight: 0.5, src: 'board', cast: ['father', 'mother'], note: '2025-04-22 「가정의 달 영상 공모전 신청 안내」', texts: [
      '가정의 달 영상 공모전에 가족 영상을 만들어 냈다.'] },
    { kind: 'movie_day', grades: [1, 4], months: [12], major: true, weight: 0.6, src: 'board', note: '2022-12-12 「1학년 영화관람 안내」 · 「4학년 문화예술(영화) 체험학습」 — 용암초 학년 행사(해마다 다를 수 있음)', texts: [
      '반 친구들과 함께 영화관에서 영화를 보았다.', '문화예술 체험으로 영화를 보았다. 팝콘 냄새가 가득했다.'] },
    { kind: 'robot_camp', grades: [4], cal: [2024, 2024], months: [8], major: true, weight: 0.4, src: 'board', note: '2024-07-08 「천안 학생로봇코딩캠프 신청 안내」(희망자)', texts: [
      '여름방학 로봇코딩캠프에서 로봇이 내 명령대로 움직였다.'] },
    { kind: 'ai_camp', grades: [2, 4], cal: [2022, 2024], months: [8], weight: 0.4, src: 'board', note: '2022-07-08 · 2024-07-01 「천안AI꿈키움터 여름방학캠프 안내」(희망자)', texts: [
      'AI꿈키움터 여름캠프에서 인공지능과 처음 이야기를 나눴다.'] },
    { kind: 'dokdo_day', grades: [1, 2, 3, 4, 5, 6], cal: [2024, 2024], months: [10], weight: 1, src: 'board', note: '2024-10-11 「독도의 날 기념 행사 안내」 · 2024-10-18 「[우리의 독도] 주간」', texts: [
      '독도의 날, 우리 땅 독도를 그렸다.', '독도의 날 행사에서 독도에 사는 새 이야기를 들었다.'] },
    { kind: 'new_room', grades: [1, 2, 3, 4, 5, 6], months: [4, 9], weight: 0.9, src: 'site', texts: [
      { t: '선배들이 직접 설계에 참여한 "꿈이룸"과 "행복 꿈터"에서 놀았다.', cal: [2022, 2099], note: '2021 학교공간혁신: 학생 30명이 설계에 참여한 2층 꿈이룸 · 5층 행복 꿈터' },
      { t: '여름방학 동안 AI융합교육실이 새로 생겼다.', cal: [2024, 2024], note: '2024-07-24 「AI융합교육실 구축공사 안내」' }] }
  ];
  // 학년마다 뽑는 개수: 큰 장면(major) · 작은 장면(minor, [최소, 최대])
  var PICKS = {
    1: { major: 0, minor: [2, 3] }, 2: { major: 1, minor: [2, 3] }, 3: { major: 1, minor: [2, 3] },
    4: { major: 1, minor: [2, 3] }, 5: { major: 1, minor: [1, 2] }, 6: { major: 0, minor: [1, 2] }
  };

  var SRC_LABEL = {
    board: ['학교 가정통신문', 'env'], site: ['학교공간혁신 사업', 'env'], news: ['시대의 일', 'era'], custom: ['해마다 하는 학교 행사', 'env'],
    input: ['우리가 적은 이야기', 'chance'], dream: ['상상으로 그린 미래', 'chance'], teacher: ['선생님이 알려 준 이야기', 'env'],
    future: ['앞으로의 일', 'chance']      // 아직 오지 않은 학년의 일(1~5학년 학생의 영상)
  };
  var SRC_TIP = {
    input: '입력 화면에 적은 내용으로 만든 장면', dream: '실제 일이 아니라, 졸업을 축하하며 그려 본 미래',
    future: '아직 오지 않은 학년의 일이라, 용암초에서 해마다 하는 활동으로 그려 보았습니다',
    otherCohort: ' — 2026학년도 6학년이 그 학년일 때의 가정통신문입니다. 해마다 조금씩 다를 수 있습니다'
  };
  // 문을 지나는 사건(원본의 daeun 사건 자리)의 분류와 근거
  var GATE_EVENT = { cat: 'luck', catLabel: '새로운 문', basis: { label: '새로운 문', tip: '삶의 마디마다 길 위에 문이 선다', kind: 'env' } };

  // ------------------------------------------------------------------ 마무리: 중학교(이야기마다 뽑는다)
  // 실제 배정은 교육지원청 추첨이다. 엔딩 화면에 "상상으로 그린 미래"라고 밝힌다
  var MIDDLE_SCHOOLS = [
    { name: '천안쌍용중학교', w: 4 }, { name: '천안월봉중학교', w: 4 }, { name: '천안불당중학교', w: 2 }
  ];

  // ------------------------------------------------------------------ 나의 꿈(장래희망) — 입력 화면에서 고르거나 직접 적는다
  // 목록: 교육부 · 한국직업능력연구원 「2025 초·중등 진로교육 현황조사」(2025.11.28 보도자료 <표 1> 학생의 희망 직업 상위 20개)의
  //       초등학생 1~20위(20위 동률 포함 21개 직업군). 아이들이 고르기 쉽게 '법률전문가'(3.5%)는 판사 · 검사 · 변호사로, '배우/모델'(2.9%)은 둘로 나눴다
  //       (나눈 쪽의 pct 는 합계를 나눠 둔 뽑기 무게일 뿐, 조사표에는 합계만 있다).
  // 칸: short(목록 · 문장에 쓰는 이름) · label(선택 상자에 보이는 글) · job(엔딩 카드의 긴 이름) · jobKind(원본 PaljaVocab.JOB_KINDS — 어른이 된 모습의 옷차림)
  //     set(꿈을 이룬 장면: 원본 세트 [이름, { variant, as }]) · rank · pct(초등학생 응답 비율 %, 꿈을 비워 두었을 때 뽑는 무게) · survey(조사표의 직업명) · scenes(꿈을 이룬 모습 한 줄)
  var DREAM_SOURCE = '교육부 · 한국직업능력연구원 「2025 초·중등 진로교육 현황조사」 초등학생 희망 직업 상위 20개(2025.11.28 발표)';
  var DREAMS = [
    { short: '운동선수', job: '땀 흘려 꿈을 이룬 운동선수', jobKind: 'athlete', set: ['gym', { variant: 'ball', as: 'athlete' }], rank: 1, pct: 14.1, survey: '운동선수', scenes: [
      '경기장에 {name}의 이름이 울려 퍼졌다. 관중석에서 박수가 쏟아졌다.', '마지막 경기가 끝나고, 땀에 젖은 유니폼으로 두 팔을 번쩍 들었다.'] },
    { short: '의사', job: '아픈 사람을 낫게 하는 의사', jobKind: 'medical', set: ['hospital_office', { as: 'doctor' }], rank: 2, pct: 6.6, survey: '의사', scenes: [
      '진료실에 들어온 아이에게 "이제 괜찮아질 거야" 하고 웃어 주었다.', '오늘도 하얀 가운을 입고 아픈 사람의 이야기를 끝까지 들었다.'] },
    { short: '크리에이터', label: '크리에이터 (유튜버)', job: '모두를 웃게 하는 크리에이터', jobKind: 'entertainer', set: ['stage', { variant: 'youtube' }], rank: 3, pct: 4.8, survey: '크리에이터', scenes: [
      '카메라 앞에서 오늘의 영상을 시작했다. 응원 댓글이 줄줄이 달렸다.', '내가 만든 영상을 보고 웃었다는 댓글이 가장 좋았다.'] },
    { short: '선생님', label: '선생님 (교사)', job: '아이들을 가르치는 선생님', jobKind: 'teacher', set: ['classroom', { as: 'teacher' }], rank: 4, pct: 4.5, survey: '교사', scenes: [
      '교실 문을 열자 아이들이 "선생님!" 하고 달려왔다. 용암초 시절 담임 선생님이 떠올랐다.', '칠판에 아이들 이름을 하나씩 적었다. 이번에는 내가 선생님이다.'] },
    { short: '요리사', job: '맛있는 음식을 만드는 요리사', jobKind: 'chef', set: ['kitchen', {}], rank: 5, pct: 3.9, survey: '요리사/조리사', scenes: [
      '내가 만든 요리를 먹은 손님이 엄지를 치켜세웠다.', '주방에 맛있는 냄새가 가득했다. 오늘의 특별 요리가 완성되었다.'] },
    { short: '판사', job: '공정하게 판단하는 판사', jobKind: 'lawyer', set: ['court', { as: 'judge' }], rank: 6, pct: 1.2, survey: '법률전문가(판사·검사·변호사)', scenes: [
      '법정에서 양쪽 이야기를 끝까지 듣고 공정하게 판결했다.', '용암초에서 배운 "바르고 굳세게"를 마음에 새기고 법복을 입었다.'] },
    { short: '검사', job: '진실을 밝히는 검사', jobKind: 'lawyer', set: ['court', { as: 'prosecutor' }], rank: 6, pct: 1.1, survey: '법률전문가(판사·검사·변호사)', scenes: [
      '사건의 진실을 끝까지 밝혀 억울한 사람이 없도록 했다.', '꼼꼼히 모은 증거로 사건의 진실을 밝혀냈다.'] },
    { short: '변호사', job: '어려운 사람을 돕는 변호사', jobKind: 'lawyer', set: ['court', { as: 'lawyer' }], rank: 6, pct: 1.2, survey: '법률전문가(판사·검사·변호사)', scenes: [
      '도움이 필요한 사람의 편에 서서 끝까지 함께했다.', '법정에서 의뢰인을 위해 또박또박 변론했다.'] },
    { short: '제빵사', label: '제빵사 (파티시에)', job: '맛있는 빵을 굽는 제빵사', jobKind: 'chef', set: ['kitchen', { variant: 'bakery' }], rank: 7, pct: 3.2, survey: '제과·제빵원', scenes: [
      '갓 구운 빵 냄새가 골목까지 퍼졌다. 아침마다 빵집 앞에 줄이 섰다.', '내가 만든 케이크로 누군가의 생일이 더 즐거워졌다.'] },
    { short: '가수', job: '노래로 마음을 전하는 가수', jobKind: 'entertainer', set: ['stage', { variant: 'concert' }], rank: 8, pct: 3.2, survey: '가수/성악가', scenes: [
      '무대에서 노래를 부르자 객석이 함께 따라 불렀다.', '첫 공연이 끝나고 박수가 오래오래 이어졌다.'] },
    { short: '배우', job: '사람들을 웃고 울리는 배우', jobKind: 'entertainer', set: ['stage', { variant: 'theater' }], rank: 9, pct: 1.5, survey: '배우/모델', scenes: [
      '무대 위에서 맡은 역할로 살아 숨 쉬었다. 관객들이 함께 웃고 울었다.', '커튼콜에서 고개를 숙이자 박수가 쏟아졌다.'] },
    { short: '모델', job: '멋진 모습을 보여 주는 모델', jobKind: 'entertainer', set: ['stage', { variant: 'runway' }], rank: 9, pct: 1.4, survey: '배우/모델', scenes: [
      '런웨이 끝에 멈춰 서서 환하게 웃었다. 사진기 불빛이 반짝였다.', '패션쇼 무대를 당당하게 걸었다.'] },
    { short: '경찰관', job: '이웃의 안전을 지키는 경찰관', jobKind: 'police', set: ['police', { variant: 'police' }], rank: 10, pct: 2.8, survey: '경찰관/수사관', scenes: [
      '길을 잃은 아이의 손을 잡고 가족을 찾아 주었다.', '오늘도 동네를 한 바퀴 돌며 이웃의 안전을 지켰다.'] },
    { short: '작가', job: '마음을 울리는 책을 쓰는 작가', jobKind: 'writer', set: ['writer_room', { variant: 'study' }], rank: 11, pct: 2.5, survey: '작가', scenes: [
      '내 이름이 적힌 책이 서점에 놓였다. 첫 장에는 용암초 이야기를 적었다.', '밤늦게까지 쓴 이야기가 마침내 한 권의 책이 되었다.'] },
    { short: '수의사', job: '동물 친구들을 치료하는 수의사', jobKind: 'medical', set: ['hospital_office', { variant: 'vet', as: 'doctor' }], rank: 12, pct: 2.3, survey: '수의사', scenes: [
      '아팠던 강아지가 다시 꼬리를 흔들었다. 보호자가 고맙다며 웃었다.', '작은 동물 친구들의 숨소리에 귀를 기울였다.'] },
    { short: '웹툰 작가', label: '웹툰 작가 (만화가)', job: '재미있는 이야기를 그리는 웹툰 작가', jobKind: 'artist', set: ['studio', { variant: 'comic' }], rank: 13, pct: 2.2, survey: '만화가/웹툰작가', scenes: [
      '새 화가 올라가자 독자들의 응원 댓글이 쏟아졌다.', '어릴 적 공책 귀퉁이에 그리던 그림이 웹툰이 되었다.'] },
    { short: '프로게이머', job: '세계 대회에 나간 프로게이머', jobKind: 'athlete', set: ['gym', { variant: 'esports', as: 'athlete' }], rank: 14, pct: 2.2, survey: '프로게이머', scenes: [
      '결승전 마지막 판, 함성 속에서 우승을 차지했다.', '팀원들과 하이파이브를 하며 우승 트로피를 들어 올렸다.'] },
    { short: '회사원', job: '동료들과 함께 일하는 회사원', jobKind: 'office', set: ['office', {}], rank: 15, pct: 2.0, survey: '회사원', scenes: [
      '동료들과 함께 준비한 일을 멋지게 해냈다. 모두 함께 박수를 쳤다.', '아침마다 사원증을 목에 걸고 힘차게 출근했다.'] },
    { short: '과학자', job: '세상을 밝히는 과학자', jobKind: 'research', set: ['lab', { variant: 'wet', as: 'researcher' }], rank: 16, pct: 1.6, survey: '과학자', scenes: [
      '실험실에서 오래 기다린 결과가 마침내 나왔다.', '세상을 조금 더 좋게 만들 새로운 발견을 했다.'] },
    { short: '음악가', label: '음악가 (작곡·연주·지휘)', job: '아름다운 곡을 만드는 음악가', jobKind: 'artist', set: ['studio', { variant: 'music' }], rank: 17, pct: 1.6, survey: '지휘자/작곡가/연주가', scenes: [
      '내가 만든 곡이 연주회장에 울려 퍼졌다.', '악기를 연주하자 사람들이 눈을 감고 귀를 기울였다.'] },
    { short: '뷰티 디자이너', label: '뷰티 디자이너 (헤어·메이크업)', job: '사람들을 빛나게 하는 뷰티 디자이너', jobKind: 'service', set: ['shop', { variant: 'salon' }], rank: 18, pct: 1.5, survey: '뷰티디자이너', scenes: [
      '손님의 머리를 멋지게 다듬어 주자 거울 속 얼굴이 환해졌다.', '내 손길로 사람들이 더 자신 있게 웃게 되었다.'] },
    { short: '댄서', label: '댄서 (무용가 · 안무가)', job: '무대를 누비는 댄서', jobKind: 'artist', set: ['studio', { variant: 'dance' }], rank: 19, pct: 1.3, survey: '무용가(댄서)/안무가', scenes: [
      '음악이 시작되자 마음껏 춤을 추었다.', '내가 만든 안무를 따라 추는 사람들이 생겼다.'] },
    { short: '화가', label: '화가 (조각가)', job: '멋진 그림을 그리는 화가', jobKind: 'artist', set: ['studio', { variant: 'paint' }], rank: 20, pct: 1.3, survey: '화가/조각가', scenes: [
      '내 그림이 걸린 전시회에 사람들이 오래 머물렀다.', '하얀 캔버스에 오늘도 좋아하는 색을 가득 칠했다.'] },
    { short: '동물 사육사', job: '동물을 돌보는 사육사', jobKind: 'farmer', set: ['farm', { variant: 'livestock' }], rank: 20, pct: 1.3, survey: '동물사육사/보호/관리사(20위 동률)', scenes: [
      '아기 동물에게 우유를 먹이며 하루를 시작했다.', '동물 친구들이 내 목소리를 알아듣고 다가왔다.'] }
  ];
  // 직접 적은 꿈을 알아보는 데만 쓰는 직업(목록에는 없다). 칸은 DREAMS 와 같다
  var DREAM_EXTRA = [
    { short: '소방관', job: '사람들을 구하는 소방관', jobKind: 'police', set: ['police', { variant: 'fire' }], scenes: ['불길 속에서 사람들을 구해 내고, 모두 무사하다는 말에 숨을 돌렸다.'] },
    { short: '간호사', job: '환자를 돌보는 간호사', jobKind: 'medical', set: ['hospital_office', { as: 'nurse' }], scenes: ['환자의 손을 잡고 "금방 나을 거예요" 하고 웃었다.'] },
    { short: '약사', job: '약을 지어 주는 약사', jobKind: 'medical', set: ['shop', { variant: 'pharmacy' }], scenes: ['약을 건네며 먹는 방법을 꼼꼼히 알려 주었다.'] },
    { short: '개발자', job: '세상을 바꾸는 개발자', jobKind: 'dev', set: ['dev_office', {}], scenes: ['내가 만든 앱을 많은 사람들이 쓰게 되었다.'] },
    { short: '군인', job: '나라를 지키는 군인', jobKind: 'military', set: ['army_office', {}], scenes: ['나라를 지키는 군복이 자랑스러웠다.'] },
    { short: '조종사', job: '하늘을 나는 조종사', jobKind: 'driver', set: ['garage', { variant: 'air' }], scenes: ['조종석에 앉아 구름 위를 날았다.'] },
    { short: '승무원', job: '하늘길을 안내하는 승무원', jobKind: 'service', set: ['garage', { variant: 'air' }], scenes: ['비행기에 오르는 승객들을 환한 얼굴로 맞이했다.'] },
    { short: '건축가', job: '멋진 건물을 짓는 건축가', jobKind: 'office', set: ['studio', { variant: 'design' }], scenes: ['내가 그린 설계도대로 멋진 건물이 세워졌다.'] },
    { short: '디자이너', job: '아름다운 것을 만드는 디자이너', jobKind: 'artist', set: ['studio', { variant: 'design' }], scenes: ['내가 디자인한 것을 사람들이 즐겨 쓰게 되었다.'] },
    { short: '아나운서', job: '소식을 전하는 아나운서', jobKind: 'entertainer', set: ['stage', { variant: 'news' }], scenes: ['오늘의 소식을 또박또박 전했다.'] },
    { short: '감독', job: '영화를 만드는 감독', jobKind: 'artist', set: ['stage', { variant: 'film' }], scenes: ['내가 만든 영화가 극장에 걸렸다.'] },
    { short: '사장', job: '회사를 이끄는 사장', jobKind: 'business', set: ['office', { as: 'boss' }], scenes: ['내가 세운 회사에서 동료들과 함께 꿈을 키웠다.'] },
    { short: '공무원', job: '이웃을 돕는 공무원', jobKind: 'public', set: ['gov_office', {}], scenes: ['동네 사람들의 불편을 하나씩 해결해 주었다.'] },
    { short: '농부', job: '정성껏 농사짓는 농부', jobKind: 'farmer', set: ['farm', { variant: 'field' }], scenes: ['내가 기른 작물을 거두며 활짝 웃었다.'] },
    { short: '교수', job: '대학에서 가르치는 교수', jobKind: 'professor', set: ['lecture', { as: 'professor' }], scenes: ['강의실 가득한 학생들 앞에서 수업을 했다.'] },
    { short: '기자', job: '세상 소식을 전하는 기자', jobKind: 'writer', set: ['writer_room', { variant: 'press' }], scenes: ['내가 쓴 기사가 신문 첫 면에 실렸다.'] },
    { short: '유치원 선생님', job: '어린이를 돌보는 유치원 선생님', jobKind: 'teacher', set: ['classroom', { variant: 'kinder', as: 'teacher' }], scenes: ['꼬마들이 "선생님!" 하고 내 품에 안겼다.'] },
    { short: '바리스타', job: '향긋한 커피를 내리는 바리스타', jobKind: 'shop', set: ['shop', { variant: 'cafe' }], scenes: ['손님에게 정성껏 내린 커피를 건넸다.'] },
    { short: '사진작가', job: '순간을 담는 사진작가', jobKind: 'artist', set: ['shop', { variant: 'photo' }], scenes: ['내가 찍은 사진 속 사람들이 환하게 웃고 있었다.'] },
    { short: '격투기 선수', job: '땀 흘려 꿈을 이룬 운동선수', jobKind: 'athlete', set: ['gym', { variant: 'ring', as: 'athlete' }], scenes: ['시합이 끝나고 심판이 내 손을 높이 들어 올렸다.'] },
    { short: '육상 선수', job: '땀 흘려 꿈을 이룬 운동선수', jobKind: 'athlete', set: ['gym', { variant: 'track', as: 'athlete' }], scenes: ['결승선을 가장 먼저 통과하며 두 팔을 번쩍 들었다.'] }
  ];
  // 알아보지 못한 꿈: 시상식 무대에서 꿈을 이룬 모습으로
  var DREAM_ANY = { short: '', job: '', jobKind: 'freelance', set: ['award_stage', { variant: 'culture' }], scenes: [
    '어릴 적 공책에 적어 둔 꿈을 정말로 이루었다.', '좋아하는 일을 하며 날마다 즐겁게 일했다.'] };
  // 직접 적은 꿈 → 위 목록의 어느 직업과 같은가(앞에서부터 먼저 맞는 것). 더 좁은 말을 앞에 둔다(수의사 → 의사, 웹툰 작가 → 작가, 유치원 선생님 → 선생님)
  var DREAM_WORDS = [
    [/수의|동물\s*병원/, '수의사'], [/사육|동물원|동물\s*(보호|관리|조련)|아쿠아리움|조련/, '동물 사육사'], [/웹툰|만화/, '웹툰 작가'], [/유치원|보육/, '유치원 선생님'],
    [/간호/, '간호사'], [/약사|약국/, '약사'], [/의사|닥터|외과|내과|치과|한의/, '의사'],
    [/유튜|크리에이터|스트리머|BJ|비제이|인플루언서/i, '크리에이터'], [/선생|교사|강사/, '선생님'], [/교수/, '교수'],
    [/제빵|제과|빵|파티시|케이크|쇼콜라/, '제빵사'], [/요리|셰프|쉐프|조리|주방장/, '요리사'], [/바리스타|카페/, '바리스타'],
    [/판사/, '판사'], [/검사/, '검사'], [/변호|법조|법률/, '변호사'],
    [/가수|아이돌|성악|싱어|보컬|래퍼/, '가수'], [/모델/, '모델'], [/배우|연기|탤런트|뮤지컬/, '배우'],
    [/경찰|형사|수사/, '경찰관'], [/소방/, '소방관'], [/군인|장교|부사관|해군|공군|육군|해병/, '군인'],
    [/사진/, '사진작가'], [/작가|소설|시인|동화/, '작가'], [/기자/, '기자'], [/아나운서|앵커/, '아나운서'], [/감독|PD|피디|연출/i, '감독'],
    [/게이머|e\s*스포츠|이스포츠/i, '프로게이머'], [/태권|유도|복싱|권투|씨름|레슬링|격투|주짓수/, '격투기 선수'], [/육상|달리기|마라톤|단거리/, '육상 선수'],
    [/선수|국가대표|축구|야구|농구|배구|수영|골프|테니스|배드민턴|탁구|양궁|체조|스케이트|빙상|피겨|스키|펜싱|운동/, '운동선수'],
    [/개발|프로그래머|코딩|코더|소프트웨어|게임\s*(제작|개발)|AI|인공지능|로봇/i, '개발자'], [/과학|연구|박사|발명|우주|천문|생명|화학|물리/, '과학자'],
    [/작곡|연주|지휘|피아니스트|바이올린|첼로|음악/, '음악가'], [/미용|헤어|메이크업|네일|뷰티/, '뷰티 디자이너'], [/댄서|안무|무용|발레|춤/, '댄서'],
    [/화가|조각|미술|그림/, '화가'], [/건축/, '건축가'], [/디자이너|디자인/, '디자이너'],
    [/조종|파일럿|비행기\s*기장|기장/, '조종사'], [/승무원|스튜어디스/, '승무원'], [/사장|CEO|대표|사업|창업/i, '사장'], [/공무원|시청|구청/, '공무원'],
    [/농부|농사|농업|어부/, '농부'], [/회사|직장인|사무/, '회사원']
  ];

  // ------------------------------------------------------------------ 연출 표 — 원본 PaljaDirector.DIRECTION 과 같은 모양
  // set: 원본 앱에 있는 장면 세트(큰 장면일 때만 쓴다). re: [동작, 표정, 손소품], cast: 관련 인물의 [동작, 표정], lead: 'npc'(사건의 첫 인물이 상대역) | 'mother'
  var DIRECTION = {
    birth:          { set: ['maternity', {}], bubble: 'sprout', mood: 'joy', fx: 'motes', re: ['lie_baby', 'neutral'], cast: ['clap', 'smile'], lead: 'mother' },
    daycare_enter:  { set: ['nursery', {}], bubble: 'baby', mood: 'joy', fx: null, re: ['toddle', 'smile'], cast: ['wave', 'smile'], lead: 'mother' },
    kinder_enter:   { set: ['classroom', { variant: 'kinder' }], bubble: 'bag', mood: 'joy', fx: 'petals', re: ['wave', 'smile', 'bag_school'], cast: ['wave', 'smile'] },
    kinder_grad:    { set: ['grad_ceremony', { level: 'elementary' }], bubble: 'grad_cap', mood: 'joy', fx: 'confetti', re: ['bow', 'smile', 'bouquet'], cast: ['clap', 'smile'] },
    school_enter:   { set: ['school_gate', { variant: 'enter' }], bubble: 'bag', mood: 'joy', fx: 'petals', re: ['walk', 'smile', 'bag_school'], cast: ['wave', 'smile'], lead: 'mother' },
    covid_school:   { set: null, bubble: 'umbrella', mood: 'calm', fx: null, re: ['stand', 'calm', 'bag_school'], cast: null },
    teacher_meet:   { set: null, bubble: 'smile', mood: 'joy', fx: null, re: ['bow', 'smile'], cast: ['wave', 'smile'], lead: 'npc' },
    friend_new:     { set: ['playground', {}], bubble: 'together', mood: 'joy', fx: 'sparkle', re: ['wave', 'laugh'], cast: ['wave', 'laugh'], lead: 'npc' },
    field_trip:     { set: ['garage', { variant: 'bus' }], bubble: 'travel', mood: 'joy', fx: 'petals', re: ['wave', 'laugh', 'bag_school'], cast: ['wave', 'laugh'] },
    farm_trip:      { set: ['farm', { variant: 'field' }], bubble: 'leaf', mood: 'joy', fx: 'motes', re: ['farm', 'smile'], cast: ['farm', 'laugh'] },
    survival_swim:  { set: ['travel_sea', {}], bubble: 'check', mood: 'joy', fx: 'sparkle', re: ['sport', 'laugh'], cast: ['cheer', 'laugh'] },
    camp:           { set: ['travel_mountain', {}], bubble: 'star', mood: 'joy', fx: 'motes', re: ['cheer', 'laugh'], cast: ['laugh', 'laugh'] },
    open_class:     { set: ['classroom', { as: 'student' }], bubble: 'exclaim', mood: 'joy', fx: null, re: ['present', 'smile'], cast: ['clap', 'smile'] },
    busking:        { set: null, bubble: 'star', mood: 'joy', fx: 'motes', re: ['clap', 'smile', 'bag_school'], cast: null },
    morning_event:  { set: null, bubble: 'star', mood: 'joy', fx: 'confetti', re: ['wave', 'laugh', 'bag_school'], cast: null },
    walk_challenge: { set: null, bubble: 'sun', mood: 'calm', fx: null, re: ['walk', 'smile', 'bag_school'], cast: null },
    health_walk:    { set: null, bubble: 'heart_pulse', mood: 'calm', fx: null, re: ['walk', 'smile'], cast: null },
    library_event:  { set: ['library', { variant: 'library' }], bubble: 'book', mood: 'calm', fx: null, re: ['sit_study', 'smile', 'book'], cast: null },
    reading_month:  { set: null, bubble: 'book_stack', mood: 'calm', fx: null, re: ['sit_study', 'smile', 'book'], cast: null },
    milk_time:      { set: null, bubble: 'cup', mood: 'joy', fx: null, re: ['sit_eat', 'smile'], cast: ['sit_eat', 'laugh'] },
    care_class:     { set: null, bubble: 'house_heart', mood: 'calm', fx: null, re: ['sit_study', 'calm', 'book'], cast: null },
    green_parents:  { set: null, bubble: 'signpost', mood: 'calm', fx: null, re: ['walk', 'smile', 'bag_school'], cast: null },
    after_school:   { set: null, bubble: 'palette', mood: 'joy', fx: null, re: ['clap', 'smile'], cast: null },
    english_camp:   { set: ['classroom', { as: 'student' }], bubble: 'book', mood: 'joy', fx: 'sparkle', re: ['talk', 'smile'], cast: ['talk', 'smile'] },
    character_week: { set: null, bubble: 'hearts', mood: 'joy', fx: null, re: ['give', 'smile'], cast: ['wave', 'smile'] },
    play_festival:  { set: ['playground', {}], bubble: 'smile', mood: 'joy', fx: 'confetti', re: ['run', 'laugh'], cast: ['run', 'laugh'] },
    safety_fest:    { set: null, bubble: 'helmet', mood: 'calm', fx: null, re: ['look_up', 'surprised'], cast: null },
    horse_riding:   { set: ['farm', { variant: 'livestock' }], bubble: 'star', mood: 'joy', fx: 'sparkle', re: ['cheer', 'laugh'], cast: ['clap', 'smile'] },
    eco_action:     { set: null, bubble: 'leaf', mood: 'calm', fx: null, re: ['carry_load', 'smile'], cast: null },
    eco_drawing:    { set: null, bubble: 'palette', mood: 'calm', fx: null, re: ['paint', 'smile'], cast: null },
    plastic_zero:   { set: null, bubble: 'leaf', mood: 'joy', fx: null, re: ['carry_load', 'smile'], cast: ['carry_load', 'smile'] },
    poem_recital:   { set: ['award_stage', { variant: 'school' }], bubble: 'scroll', mood: 'calm', fx: 'sparkle', re: ['present', 'calm'], cast: ['clap', 'smile'] },
    essay_contest:  { set: null, bubble: 'scroll', mood: 'calm', fx: null, re: ['sit_study', 'calm', 'book'], cast: null },
    english_speech: { set: ['award_stage', { variant: 'school' }], bubble: 'exclaim', mood: 'joy', fx: 'sparkle', re: ['present', 'smile'], cast: ['clap', 'smile'] },
    teacher_day:    { set: null, bubble: 'heart', mood: 'joy', fx: null, re: ['give', 'smile'], cast: ['wave', 'smile'], lead: 'npc' },
    english_club:   { set: null, bubble: 'book', mood: 'joy', fx: null, re: ['talk', 'smile'], cast: null },
    video_contest:  { set: null, bubble: 'heart', mood: 'joy', fx: null, re: ['photo', 'laugh', 'camera'], cast: ['wave', 'laugh'] },
    movie_day:      { set: ['cinema_front', {}], bubble: 'star', mood: 'joy', fx: null, re: ['sit', 'laugh'], cast: ['laugh', 'laugh'] },
    robot_camp:     { set: ['lab', { variant: 'dry' }], bubble: 'lightning', mood: 'joy', fx: 'sparkle', re: ['sit_type', 'smile'], cast: null },
    ai_camp:        { set: null, bubble: 'lightning', mood: 'joy', fx: 'sparkle', re: ['sit_type', 'smile'], cast: null },
    ai_experience:  { set: ['lab', { variant: 'dry' }], bubble: 'lightning', mood: 'joy', fx: 'sparkle', re: ['sit_type', 'smile'], cast: ['cheer', 'laugh'] },
    band_club:      { set: ['studio', { variant: 'music' }], bubble: 'star', mood: 'joy', fx: 'sparkle', re: ['sing', 'smile'], cast: null },
    gugak_club:     { set: ['studio', { variant: 'music' }], bubble: 'palette', mood: 'calm', fx: null, re: ['sit', 'calm'], cast: null },
    ai_club:        { set: null, bubble: 'lightning', mood: 'joy', fx: 'sparkle', re: ['stand', 'smile'], cast: null },
    coding_contest: { set: ['lab', { variant: 'dry' }], bubble: 'trophy', mood: 'joy', fx: 'sparkle', re: ['sit_type', 'calm'], cast: null },
    music_festival: { set: ['stage', { variant: 'concert' }], bubble: 'medal', mood: 'joy', fx: 'confetti', re: ['sing', 'laugh', 'mic'], cast: ['cheer', 'laugh'] },
    dokdo_day:      { set: null, bubble: 'palette', mood: 'calm', fx: null, re: ['paint', 'smile'], cast: null },
    new_room:       { set: null, bubble: 'house_heart', mood: 'joy', fx: 'sparkle', re: ['look_up', 'surprised'], cast: null },
    trip_cancel:    { set: null, bubble: 'cloud', mood: 'sad', fx: 'rain', re: ['slump', 'sad'], cast: null },
    yearbook_photo: { set: null, bubble: 'smile', mood: 'joy', fx: null, re: ['photo', 'laugh', 'camera'], cast: ['laugh', 'laugh'] },
    graduation:     { set: ['grad_ceremony', { level: 'elementary' }], bubble: 'grad_cap', mood: 'joy', fx: 'confetti', re: ['cap_throw', 'laugh', 'diploma'], cast: ['clap', 'cry'] },
    middle_enter:   { set: ['school_gate', { variant: 'enter' }], bubble: 'bag', mood: 'joy', fx: 'petals', re: ['walk', 'smile', 'bag_school'], cast: ['wave', 'smile'] },
    grown_up:       { set: 'future', bubble: 'star', mood: 'joy', fx: 'gold', re: ['stand', 'smile'], cast: ['clap', 'smile'] },
    happy_life:     { set: ['park', {}], bubble: 'house_heart', mood: 'joy', fx: 'motes', re: ['hug', 'laugh'], cast: ['hug', 'laugh'], lead: 'npc' }
  };

  // 친구 이름이 비었을 때 쓰는 이름(2014년 무렵 흔한 이름)
  var FRIEND_NAMES = { F: ['서연', '하은', '지우', '서윤', '하윤', '민서', '지유', '윤서'], M: ['민준', '서준', '도윤', '하준', '예준', '시우', '주원', '지호'] };
  var SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오'];

  return { SCHOOL: SCHOOL, SCHOOL_YEAR_NOW: SCHOOL_YEAR_NOW, cohort: cohort, PRESCHOOLS: PRESCHOOLS, OPTIONAL: OPTIONAL, KINDS: KINDS, GATES: GATES,
           ANCHORS: ANCHORS, POOL: POOL, PICKS: PICKS, SRC_LABEL: SRC_LABEL, SRC_TIP: SRC_TIP, GATE_EVENT: GATE_EVENT,
           MIDDLE_SCHOOLS: MIDDLE_SCHOOLS, DREAMS: DREAMS, DREAM_EXTRA: DREAM_EXTRA, DREAM_ANY: DREAM_ANY, DREAM_WORDS: DREAM_WORDS, DREAM_SOURCE: DREAM_SOURCE, DIRECTION: DIRECTION, FRIEND_NAMES: FRIEND_NAMES, SURNAMES: SURNAMES, VERSION: '2.1.0' };
});
