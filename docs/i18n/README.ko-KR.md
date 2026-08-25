# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant는 공개 `DocWenCLI.exe` 프로토콜을 통해 Obsidian을 로컬 [DocWen](https://github.com/ZHYX91/docwen)에 연결합니다. Windows, Obsidian 1.12.7 이상, 안정적인 DocWen 0.9.x 버전이 필요합니다.

> **DocWen 본체가 필요합니다.** 현재 소스는 DocWen 0.9.0과 DocWen Assistant 2.0.0을 대상으로 하지만 소스 버전은 GitHub Release 공개를 증명하지 않습니다. 두 숫자 버전과 지정 파일이 [DocWen Releases](https://github.com/ZHYX91/docwen/releases)와 Assistant 릴리스 페이지에 모두 공개된 뒤에만 설치하세요.

## 기능

DocWen에서 파일 열기, 명시적 출력 파일을 사용하는 Word/Excel/Markdown 변환, Markdown 제목 번호 추가·제거, 교정 및 doctor 진단을 제공합니다.

## 요구 사항 및 호환성

- Windows와 Obsidian 1.12.7 이상. 플러그인은 데스크톱 전용입니다.
- 완전히 압축 해제한 안정적인 DocWen 0.9.x Windows 전체 패키지. 플러그인은 DocWen을 자동으로 다운로드하지 않습니다.
- DocWen Assistant 2.0은 `docwen.machine.v1`과 `docwen.artifact_bundle.v2`이 필요하며 argv 명령이나 이전 JSON 봉투로 돌아가지 않습니다.

완전히 압축 해제한 DocWen 폴더, `DocWen.exe` 또는 `DocWenCLI.exe`를 선택할 수 있습니다. 플러그인은 같은 폴더의 `DocWenCLI.exe`로 확인한 뒤 검증된 절대 CLI 경로만 저장하고 사용합니다. GUI를 CLI로 실행하거나 재귀 검색 또는 소프트웨어 자동 다운로드를 하지 않습니다.

## 설치

[DocWen Releases](https://github.com/ZHYX91/docwen/releases)와 [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases)에서 일치하는 숫자 버전이 공개되었는지 먼저 확인하고 `DocWen-windows-x64.zip`과 해당 플러그인 패키지를 다운로드하세요. `main.js`, `manifest.json`, `styles.css`를 `<Vault>/.obsidian/plugins/docwen-assistant/`에 복사하고 플러그인을 활성화한 다음 DocWen 폴더, `DocWen.exe` 또는 `DocWenCLI.exe`를 선택하세요.

릴리스 패키지에는 `main.js`, `manifest.json`, `styles.css`만 포함되며 `data.json`을 포함하거나 덮어쓰거나 삭제하지 않습니다. 모든 설정을 의도적으로 초기화할 때만 `data.json`을 삭제하세요.

## 사용

리본 아이콘, **DocWen** 하위 메뉴 또는 명령 팔레트에서 DocWen 실행, Word/Excel/Markdown 내보내기, 제목 번호 변경, Markdown 교정, doctor 실행을 할 수 있습니다. 백그라운드 내보내기는 항상 출력 파일을 명시적으로 선택해야 합니다.

## 설정

Obsidian 1.12.7 이상은 가로로 스크롤할 수 있는 상단 탭 5개(일반, Markdown으로, Word로, 교정, 사용 방법)를 사용합니다. 탭은 RTL을 포함한 화살표 키, Home/End, 20px UI 글자 및 굵은 포인터용 큰 터치 영역을 지원합니다. 언어는 기본적으로 Obsidian을 따르며 지원되는 11개 언어 중 하나로 지정할 수 있습니다.

## 제한 사항

- 호환되는 로컬 DocWen이 설치된 Windows 데스크톱에서만 지원됩니다.
- 선택한 DocWen 폴더 또는 실행 파일 밖을 재귀적으로 검색하지 않습니다.
- CLI 응답, 원본 스냅샷, 편집기 상태 또는 대상을 안전하게 검증할 수 없으면 작업을 거부합니다.

## 개인정보 보호 및 보안

플러그인은 현재 편집기 또는 Vault 파일의 격리된 스냅샷만 로컬 CLI에 전달합니다. 문서를 업로드하거나 Vault 전체를 열거하지 않습니다. 자세히: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## 개발

Node.js 24.19.0과 npm 11.17.0을 사용합니다. `npm ci`, `npm run check`, `npm run release`를 실행합니다. 소스는 `src/`, 테스트는 `tests/`에 있으며 생성된 `dist/`와 `release/` 파일은 소스가 아닙니다.

안정 계약: [제품 요구사항](../product-requirements.en.md) · [UX 사양](../ux-spec.en.md) · [아키텍처](../architecture.en.md) · [테스트 전략](../testing-strategy.en.md) · [릴리스 계약](../release.en.md)

저장소 거버넌스: [변경 기록](../../CHANGELOG.md) · [기여 안내](../../CONTRIBUTING.md) · [보안](../../SECURITY.md)

## 지원

- 워크플로 아이디어와 일반 피드백은 [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general)을 사용하세요.
- 사용 및 설정 질문은 [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a)를 사용하세요.
- 재현 가능한 Obsidian 통합 버그와 구체적인 기능 제안은 [DocWen Assistant 이슈 양식](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose)으로 제출하세요.
- Obsidian 외부의 변환, OCR, 교정 또는 CLI 동작은 [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues)에 제출하세요.
- 취약점은 [보안 정책](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy)에 따라 비공개로 신고하세요.

공개 게시 전 비공개 문서 내용, 파일 및 Vault 경로, CLI 로그, 실행 파일 위치와 자격 증명을 제거하세요.

## 라이선스

MIT © ZhengYX
