[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

DocWen 변환기를 실행하기 위한 Obsidian 플러그인입니다.

## 설치

1. 이 폴더를 Obsidian 보관함의 `.obsidian/plugins/` 경로로 복사합니다
2. Obsidian 설정에서 플러그인을 다시 로드합니다
3. “DocWen Assistant” 플러그인을 활성화합니다
4. 플러그인 설정에서 `DocWen.exe` 또는 `DocWenCLI.exe` 경로를 지정합니다(하나만 설정해도 됩니다)

## 사용 방법

- 왼쪽 사이드바의 문서 아이콘을 클릭하여 DocWen을 실행합니다
- 명령 팔레트(Ctrl/Cmd + P)에서 “DocWen”을 검색합니다
- 파일이 열려 있으면 해당 경로가 자동으로 DocWen에 전달됩니다

### 백그라운드 내보내기(DocWenCLI.exe 필요)

- “백그라운드에서 Word(Docx)로 내보내기” — `.md`/`.markdown`/`.txt` 파일은 템플릿을 선택합니다
- “백그라운드에서 Excel(XLSX)로 내보내기” — `.md`/`.markdown`/`.txt` 파일은 템플릿을 선택합니다
- “백그라운드에서 Markdown(MD)로 내보내기” — 가능한 경우 최적화 유형을 선택합니다(건너뛰기 가능)

### 제목 번호 매기기(DocWenCLI.exe 필요)

- “Markdown 제목에 번호 추가” — 번호 매기기 방식을 선택합니다
- “Markdown 제목 번호 제거”

`.md` 파일만 사용할 수 있습니다.

### 우클릭 컨텍스트 메뉴

파일 탐색기에서 파일을 우클릭하면 **DocWen** 하위 메뉴가 표시됩니다:

- **Markdown로 변환** — docx, xlsx, pdf, 이미지 파일 등
- **Word(Docx)로 변환** / **Excel(XLSX)로 변환** — `.md`/`.markdown`/`.txt` 파일용
- **제목 번호 추가/제거** — `.md` 파일만 해당
- **DocWen에서 열기** — 모든 파일에서 사용 가능

### 진단(DocWenCLI.exe 필요)

- “DocWen doctor 검사” — 환경과 의존성을 점검합니다

## 포함 파일

- `main.js` - 플러그인 핵심 코드
- `manifest.json` - 플러그인 매니페스트
- `styles.css` - 스타일(있는 경우)
- `README*.md` - 문서

자세한 내용은 플러그인 설정 페이지를 참고하세요.

## 링크

- 플러그인 저장소: https://github.com/ZHYX91/docwen-obsidian
- DocWen 저장소: https://github.com/ZHYX91/docwen
