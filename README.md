# 용암초 6년 — 학교 모듈 소스

초등학생 한 명의 6년(어린이집 → 졸업 → 꿈)을 3D 길 위의 이야기로 보여 주는 졸업 영상 앱의 **학교용 모듈과 빌드 도구**입니다.

> 이 저장소만으로는 앱이 실행되지 않습니다.
> 3D 무대·화면·재생 장치는 다른 사람이 만든 앱(`saju-life.html`)의 것이라 여기에 넣지 않았습니다.
> 그 원본 파일을 가진 사람만 아래 방법으로 완성본을 만들 수 있습니다.

## 들어 있는 것

| 파일 | 하는 일 |
| --- | --- |
| `school-life-data.js` | 내용: 학교 정보, 인생의 문, 고정 장면, 학년별 활동(뽑기 상자), 문장, 유치원·어린이집, 중학교, 꿈 목록, 출처 |
| `school-sim.js` | 규칙: 학생 정보 + 이야기 번호 → 이야기, 재생 시간표, 브라우저 저장소 |
| `school-stage.js` | 3D 무대에 학교 사건·연출 등록 |
| `school-ui.js` | 입력 칸, 저장된 이야기 목록, 졸업 축하 엔딩 |
| `school-music.js` | 배경음악(Web Audio로 직접 합성, 음원 파일 없음) |
| `build.js` | 원본 + 패치 + 학교 모듈 + 라이브러리 → `yongam-graduation.html` 한 파일 |
| `check.js` | 완성본 규칙 점검(설치 없이 Node만) |

## 완성본 만들기 (원본을 가진 경우)

1. Node.js 20 이상을 설치합니다.
2. 원본 `saju-life.html`을 이 폴더에 둡니다. 다른 곳에 있으면 환경 변수 `SAJU_LIFE_HTML`에 경로를 적습니다.
3. 인터넷 없이도 열리도록 라이브러리 3개를 `vendor/`에 받습니다. 빌드가 원본이 고정한 해시와 같은지 확인합니다.
   ```
   mkdir vendor
   curl -L -o vendor/three.min.js https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js
   curl -L -o vendor/lunar.js https://cdn.jsdelivr.net/npm/lunar-javascript@1.7.7/lunar.js
   curl -L -o vendor/korean-lunar-calendar.min.js https://cdn.jsdelivr.net/npm/korean-lunar-calendar@0.4.0/dist/korean-lunar-calendar.min.js
   ```
4. 빌드하고 점검합니다.
   ```
   node build.js
   node check.js
   ```
5. 생긴 `yongam-graduation.html` 한 파일을 크롬·엣지로 엽니다.

## 자료와 개인정보

- 학교 정보와 활동은 학교 홈페이지 가정통신문 제목 등 **공개 자료**에서 가져왔고, 출처는 데이터의 `src`·`note`에 적혀 있습니다.
- 중학교 진학과 어른이 된 모습은 **상상**이며 화면에도 그렇게 표시됩니다.
- 학생 실명은 들어 있지 않습니다. 학생이 입력한 이름은 그 컴퓨터의 브라우저(localStorage)에만 저장되고 어디로도 보내지 않습니다.
- `build.js`의 패치 목록에는 원본에서 찾아 바꿀 짧은 글귀가 들어 있습니다.
