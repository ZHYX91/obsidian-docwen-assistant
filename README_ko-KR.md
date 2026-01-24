[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant - Obsidian 플러그인

[DocWen](https://github.com/ZHYX91/docwen) 데스크톱 애플리케이션을 위한 Obsidian 플러그인입니다.

## ✨ 기능

### 핵심 기능
- ✅ **사이드바 빠른 실행**: Obsidian 사이드바에 아이콘을 추가하여 한 번 클릭으로 실행
- ✅ **파일 경로 자동 전달**: 현재 열려 있는 파일의 전체 경로를 DocWen에 자동으로 전달
- ✅ **명령 팔레트 통합**: Ctrl/Cmd + P로 빠르게 접근
- ✅ **경로 검증**: 실행 파일 경로를 실시간으로 검증
- ✅ **파일 선택기**: 찾아보기 대화상자로 실행 파일을 쉽게 선택
- ✅ **성공 피드백**: 실행 시 친절한 알림 표시
- ✅ **단일 인스턴스 관리**: 실행 중인 인스턴스로 파일을 자동 전송
- ✅ **다국어 지원**: 11개 언어 지원 (zh-CN, zh-TW, en, de, fr, ru, pt, ja, es-ES, ko-KR, vi-VN)

---

## 📦 빠른 시작

### 사전 준비

1. **Node.js 설치**
   - [Node.js 공식 웹사이트](https://nodejs.org/) 방문
   - LTS 버전을 다운로드하여 설치
   - 설치 확인: `node -v` 및 `npm -v`

2. **의존성 설치**
   ```bash
   npm install
   ```

### 개발 모드

개발 중에는 watch 모드를 사용하여 코드 변경 시 자동으로 재컴파일할 수 있습니다:

```bash
npm run dev
```

### 플러그인 빌드

#### 빠른 빌드(타입 체크 없음)
```bash
npm run build:quick
```

#### 전체 빌드(타입 체크 + 난독화/압축)
```bash
npm run build
```

#### 릴리스 빌드(자동 패키징)
```bash
npm run release
# 또는 직접 실행: node scripts/build.js
```

이 명령은 다음을 수행합니다:
1. TypeScript 코드 컴파일
2. 릴리스 디렉터리 생성
3. 필요한 파일 복사
4. 사용 방법 안내 생성

---

## 🚀 Obsidian에 설치하기

### 방법 1: 릴리스 스크립트 사용(권장)

1. 릴리스 빌드를 실행합니다:
   ```bash
   npm run release
   ```

2. `release/docwen-assistant` 폴더를 아래 위치로 복사합니다:
   ```
   <Your Vault>/.obsidian/plugins/
   ```

3. Obsidian에서:
   - `Settings` → `Community plugins` 열기
   - `Reload plugins` 클릭
   - `DocWen Assistant` 활성화

### 방법 2: 수동 설치

1. 플러그인을 빌드합니다:
   ```bash
   npm run build
   ```

2. 플러그인 디렉터리를 생성합니다:
   ```
   <Your Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. 아래 파일을 디렉터리에 복사합니다:
   - `main.js`
   - `manifest.json`

4. Obsidian에서 플러그인을 다시 로드하고 활성화합니다

---

## ⚙️ 설정

1. Obsidian에서 `Settings` → `Community plugins` → `DocWen Assistant`를 엽니다

2. 실행 파일 경로를 설정합니다:
   - **옵션 1**: 경로를 직접 입력
   - **옵션 2**: `Browse...` 버튼으로 파일 선택

3. 경로 검증:
   - ✓ 녹색은 유효한 경로를 의미
   - ✗ 빨간색은 유효하지 않은 경로 또는 파일 없음

---

## 📖 사용 방법

### DocWen 실행

실행 방법은 3가지가 있습니다:

1. **사이드바 아이콘**
   - 왼쪽 사이드바의 문서 아이콘 클릭

2. **명령 팔레트**
   - `Ctrl/Cmd + P`로 명령 팔레트 열기
   - \"DocWen\"을 검색한 뒤 \"DocWen 실행\"을 선택

3. **현재 파일과 함께 실행**
   - 명령 팔레트에서 \"DocWen\"을 검색한 뒤 \"현재 파일로 DocWen 실행\"을 선택
   - 파일이 열려 있을 때만 사용 가능

### 파일 경로 자동 전달

- Markdown 파일이 열려 있으면 플러그인이 전체 경로를 DocWen에 자동으로 전달합니다
- 열린 파일이 없으면 DocWen 프로그램만 실행합니다

### 단일 인스턴스 관리

- **첫 클릭** → DocWen 실행 + 현재 파일 전달
- **다시 클릭(파일 있음)** → 새 파일로 교체(단일 파일 모드)
- **다시 클릭(파일 없음)** → DocWen 창 활성화

---

## 🛠️ 개발 스크립트

### 사용 가능한 명령

| 명령 | 설명 |
|---------|-------------|
| `npm run dev` | 개발 모드(watch) |
| `npm run build` | 전체 빌드(타입 체크 + 압축) |
| `npm run build:quick` | 빠른 빌드(타입 체크 없음) |
| `node version-bump.js [patch\|minor\|major]` | 버전 번호 업데이트 |
| `npm run release` | 릴리스 패키지 빌드 |

### 버전 관리

버전 번호를 업데이트합니다:

```bash
# 패치 버전 (1.0.0 → 1.0.1)
node version-bump.js patch

# 마이너 버전 (1.0.0 → 1.1.0)
node version-bump.js minor

# 메이저 버전 (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 프로젝트 구조

```
docwen-obsidian/
├── src/                 # 📁 소스 코드 디렉터리
│   ├── main.ts          # 플러그인 메인 로직
│   ├── settings.ts      # 설정 페이지
│   ├── i18n.ts          # 국제화 모듈
│   ├── utils/           # 유틸리티 함수(향후)
│   ├── types/           # 타입 정의(향후)
│   └── commands/        # 커맨드 모듈(향후)
├── dist/                # 🔨 빌드 출력 디렉터리
│   └── main.js          # 컴파일된 코드
├── scripts/             # 📜 빌드 스크립트
│   ├── build.bat        # Windows 원클릭 빌드
│   ├── build.js         # 크로스플랫폼 빌드 스크립트
│   └── README.md        # 스크립트 사용 가이드
├── release/             # 📦 릴리스 산출물
├── .vscode/             # 🛠️ 에디터 설정
│   └── settings.json    # VS Code 설정
├── manifest.json        # 플러그인 매니페스트
├── package.json         # 프로젝트 설정
├── tsconfig.json        # TypeScript 설정
├── .eslintrc.json       # ESLint 설정
├── .gitignore          # Git ignore 파일
├── version-bump.js     # 버전 관리 스크립트
├── README.md           # 이 문서(영문)
└── README_zh-CN.md     # 중국어 문서
```

---

## 🐛 문제 해결

### 플러그인이 로드되지 않음

1. `main.js`와 `manifest.json`이 올바르게 복사되었는지 확인
2. Obsidian에서 `Reload plugins` 클릭
3. 개발자 콘솔(`Ctrl/Cmd + Shift + I`)에서 오류 확인

### DocWen을 실행할 수 없음

1. 실행 파일 경로가 올바른지 확인
2. 경로 상태가 녹색 ✓로 표시되는지 확인
3. 실행 파일 권한이 충분한지 확인

### 파일 경로가 전달되지 않음

1. 현재 파일이 열려 있는지 확인
2. 파일 경로에 특수 문자가 포함되어 있는지 확인
3. 콘솔 로그에서 전달된 인자를 확인

---

## 📜 라이선스

이 프로젝트는 MIT License로 배포됩니다.

### 연락처

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **DocWen 메인 프로젝트**: https://github.com/ZHYX91/docwen
- **작성자 연락처**: zhengyx91@hotmail.com

---

**작성자**: ZhengYX
