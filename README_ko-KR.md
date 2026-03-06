[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant - Obsidian 플러그인

[DocWen](https://github.com/ZHYX91/docwen) 데스크톱 앱을 위한 Obsidian 플러그인입니다.

## ✨ 기능

### 핵심 기능
- ✅ **사이드바 빠른 실행**: Obsidian 사이드바에 아이콘을 추가하여 원클릭 실행
- ✅ **자동 파일 전달**: 현재 열려 있는 파일 경로를 DocWen으로 자동 전달
- ✅ **명령 팔레트 통합**: Ctrl/Cmd + P로 빠르게 기능 실행
- ✅ **백그라운드 내보내기(CLI)**: DocWenCLI.exe로 Word/Excel/Markdown 내보내기(필요 시 선택기가 표시됨)
- ✅ **제목 번호 매기기(CLI)**: DocWenCLI.exe로 Markdown 제목 번호 추가/제거
- ✅ **doctor 점검(CLI)**: 환경/진단 점검을 원클릭 실행
- ✅ **경로 검증**: 실행 파일 경로를 실시간으로 검증
- ✅ **파일 선택**: 찾아보기 대화상자로 실행 파일을 쉽게 선택
- ✅ **성공 피드백**: 실행 시 친절한 알림 표시
- ✅ **단일 인스턴스 관리**: 실행 중인 인스턴스에 파일 자동 전송
- ✅ **다국어 지원**: 11개 언어(zh-CN, zh-TW, en, de, fr, ru, pt-BR, ja, ko, es, vi)

---

## 📦 빠른 시작

### 사전 준비

1. **Node.js 설치**
   - [Node.js 공식 사이트](https://nodejs.org/) 방문
   - LTS 버전 다운로드 및 설치
   - 설치 확인: `node -v`, `npm -v`

2. **의존성 설치**
   ```bash
   npm install
   ```

### 개발 모드

```bash
npm run dev
```

### 플러그인 빌드

#### 빠른 빌드(타입 검사 없음)
```bash
npm run build:quick
```

#### 전체 빌드(타입 검사 + 압축)
```bash
npm run build
```

#### 릴리스 빌드(자동 패키징)
```bash
npm run release
# 또는 직접 실행: node scripts/build.js
```

---

## 🚀 Obsidian에 설치

### 방법 1: 릴리스 스크립트 사용(권장)

1. 실행:
   ```bash
   npm run release
   ```

2. `release/docwen-assistant` 폴더를 다음 위치로 복사:
   ```
   <Your Vault>/.obsidian/plugins/
   ```

3. Obsidian에서:
   - `Settings` → `Community plugins`
   - `Reload plugins` 클릭
   - `DocWen Assistant` 활성화

### 방법 2: 수동 설치

1. 빌드:
   ```bash
   npm run build
   ```

2. 플러그인 디렉터리 생성:
   ```
   <Your Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. 다음 파일을 복사:
   - `main.js`
   - `manifest.json`

4. Obsidian에서 플러그인 재로딩 후 활성화

---

## ⚙️ 설정

1. Obsidian `Settings` → `Community plugins` → `DocWen Assistant` 열기

2. GUI 또는 CLI 실행 파일 경로 설정(하나만 설정하면 됨):
   - `DocWen.exe` 또는 `DocWenCLI.exe`의 전체 경로
   - 하나만 설정하면 같은 폴더에서 다른 하나를 자동 감지

3. 경로 검증:
   - ✓ 녹색은 유효한 경로
   - ✗ 빨간색은 유효하지 않거나 파일이 없음

---

## 📖 사용 방법

### DocWen 실행

세 가지 방법:

1. **사이드바 아이콘**
   - 왼쪽 사이드바의 문서 아이콘 클릭

2. **명령 팔레트**
   - `Ctrl/Cmd + P`를 누르고 “DocWen 실행” 검색

3. **현재 파일로 실행**
   - “현재 파일로 DocWen 실행” 검색
   - 파일이 열려 있을 때만 표시

### 백그라운드 내보내기(CLI, GUI 미실행)

명령 팔레트에서 검색:
- “백그라운드에서 Word(Docx)로 내보내기” — `.md`/`.markdown`/`.txt` 파일은 템플릿 선택기가 표시됩니다
- “백그라운드에서 Excel(XLSX)로 내보내기” — `.md`/`.markdown`/`.txt` 파일은 템플릿 선택기가 표시됩니다
- “백그라운드에서 Markdown(MD)로 내보내기” — 파일 유형과 언어에 대해 최적화 유형이 있으면 선택기가 표시됩니다(건너뛰기 가능)

`DocWenCLI.exe`가 필요합니다.

### 제목 번호 매기기(CLI)

명령 팔레트에서 검색:
- “Markdown 제목에 번호 추가” — 번호 매기기 방식을 선택합니다
- “Markdown 제목 번호 제거”

`.md` 파일이 열려 있을 때만 사용할 수 있습니다. `DocWenCLI.exe`가 필요합니다.

### doctor 점검(CLI)

검색:
- “DocWen doctor 검사”

`DocWenCLI.exe`가 필요합니다.

### 자동 파일 전달

- 파일이 열려 있으면 해당 파일의 전체 경로를 DocWen으로 자동 전달
- 파일이 없으면 DocWen만 실행

### 단일 인스턴스 관리

- **첫 클릭** → DocWen 실행 + 현재 파일 전달
- **다시 클릭(파일 있음)** → 새 파일로 교체(단일 파일 모드)
- **다시 클릭(파일 없음)** → DocWen 창 활성화

---

## 🛠️ 개발 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 모드(watch) |
| `npm run build` | 전체 빌드(타입 검사 + 압축) |
| `npm run build:quick` | 빠른 빌드(타입 검사 없음) |
| `node version-bump.js [patch\|minor\|major]` | 버전 업데이트 |
| `npm run release` | 릴리스 패키지 생성 |

---

## 📁 프로젝트 구조

```
docwen-obsidian/
├── src/
│   ├── main.ts
│   ├── settings.ts
│   ├── i18n.ts
│   └── utils/
│       └── suggest-modal.ts
├── dist/
│   └── main.js
├── docs/
│   └── plugin-readme/
├── scripts/
│   ├── build.bat
│   ├── build.js
│   └── README.md
├── release/
├── manifest.json
├── package.json
├── tsconfig.json
├── eslint.config.cjs
├── .gitignore
├── version-bump.js
└── README*.md
```

---

## 🐛 문제 해결

### 플러그인이 로드되지 않음
1. `main.js`와 `manifest.json`이 올바르게 복사되었는지 확인
2. Obsidian에서 `Reload plugins` 클릭
3. 개발자 콘솔(`Ctrl/Cmd + Shift + I`) 확인

### DocWen 실행 불가
1. 실행 파일 경로가 올바른지 확인
2. 경로 상태가 녹색 ✓ 인지 확인
3. 실행 권한 확인

### 파일 경로가 전달되지 않음
1. 파일이 실제로 열려 있는지 확인
2. 경로에 특수 문자가 있는지 확인
3. 콘솔 로그에서 인자 전달 여부 확인

---

## 📜 라이선스

이 프로젝트는 MIT 라이선스입니다.

### 연락처

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **DocWen**: https://github.com/ZHYX91/docwen
- **작성자**: zhengyx91@hotmail.com
