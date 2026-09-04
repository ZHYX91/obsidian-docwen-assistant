# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant는 Obsidian을 로컬 [DocWen](https://github.com/ZHYX91/docwen)에 연결합니다. Windows, Obsidian 1.12.7 이상, 안정적인 DocWen 0.9.x 버전이 필요합니다.

> **DocWen 본체가 필요합니다.** [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97)에서 호환 버전을 설치하거나 [DocWen Releases](https://github.com/ZHYX91/docwen/releases)의 휴대용 ZIP을 완전히 압축 해제하세요.

## 스크린샷

다음 화면은 패키징된 플러그인과 DocWen CLI가 데스크톱 Obsidian에서 실행되는 모습입니다.

### 교정 사이드바

줄이나 규칙별로 문제를 검토하고 노트를 다시 쓰지 않은 채 해당 소스 범위로 이동합니다.

![DocWen 교정 사이드바](../assets/docwen-assistant-proofread-en.png)

### 상단 탭 설정과 CLI 기능

4개의 상단 탭과 각 탭의 설명 카드에서 정확한 DocWen 런타임을 선택하고 변환과 교정을 조정하며 Machine 기능을 확인합니다.

![DocWen Assistant 상단 탭 설정](../assets/docwen-assistant-settings-en.png)

### 기능에 따른 내보내기

사용 가능한 변환 경로와 명시적인 출력 위치를 선택하면서 원본 노트는 변경하지 않습니다.

![DocWen Assistant 기능별 내보내기](../assets/docwen-assistant-export-en.png)

## 기능

DocWen에서 파일 열기, 명시적 출력 파일을 사용하는 Word/Excel/Markdown 변환, Markdown 제목 번호 추가·제거, 교정 및 doctor 진단을 제공합니다.

## 요구 사항 및 호환성

- Windows와 Obsidian 1.12.7 이상. 플러그인은 데스크톱 전용입니다.
- 완전히 압축 해제한 안정적인 DocWen 0.9.x Windows 전체 패키지. 플러그인은 DocWen을 자동으로 다운로드하지 않습니다.
- 플러그인은 `docwen.machine.v1`과 `docwen.artifact_bundle.v2`이 필요합니다. 호환되지 않는 DocWen은 다른 프로토콜로 전환하지 않고 거부됩니다.

기본 자동 감지는 등록된 `docwen.exe` 별칭을 사용하며 Microsoft Store 업데이트 후에도 유지됩니다. 휴대용 ZIP은 수동 설치로 전환해 압축을 푼 DocWen 폴더를 선택합니다. `WindowsApps`나 임의 폴더를 검색하지 않으며 소프트웨어를 자동 다운로드하지 않습니다.

## 설치

### DocWen과 플러그인 설치

[Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97)에서 DocWen을 설치하거나 [DocWen Releases](https://github.com/ZHYX91/docwen/releases)의 휴대용 ZIP을 압축 해제하세요. DocWen Assistant는 Community Plugins에서 설치할 수 있습니다. 수동 설치 시 `main.js`, `manifest.json`, `styles.css`를 `<Vault>/.obsidian/plugins/docwen-assistant/`에 복사하세요. 자동 감지는 파일 선택이 필요 없으며 휴대용 버전만 설정에서 수동 설치와 DocWen 폴더를 선택합니다.

### 설치 안전성

릴리스 패키지에는 `main.js`, `manifest.json`, `styles.css`만 포함되며 `data.json`을 포함하거나 덮어쓰거나 삭제하지 않습니다. 모든 설정을 의도적으로 초기화할 때만 `data.json`을 삭제하세요.

## 사용

리본 아이콘, **DocWen** 하위 메뉴 또는 명령 팔레트에서 DocWen 실행, Word/Excel/Markdown 내보내기, 제목 번호 변경, Markdown 교정, doctor 실행을 할 수 있습니다. 백그라운드 내보내기는 항상 출력 파일을 명시적으로 선택해야 합니다.

해석된 Markdown을 DOCX로 내보내면 DocWen이 인접한 `<문서>.docwen` 파일을 제공합니다. Assistant는 이를 검증하고 DOCX와 원자적으로 한 쌍으로 게시합니다. 필수 파일이 없거나 손상되었거나 관계가 모호하면 두 파일 모두 게시되지 않습니다. 항상 DOCX와 함께 이동하거나 백업하세요. 역변환에서는 동반 파일이 없거나 일치하지 않아도 정확한 원문 복원만 비활성화되고, 인증된 정규화 Markdown 의미는 계속 복원할 수 있습니다.

호환되는 [Number Suite](https://github.com/ZHYX91/obsidian-number-suite)를 활성화하면 Word 내보내기는 Markdown 노트에 번호를 추가하지 않고 검증된 가상 제목 및 캡션 번호와 같은 노트 안의 참조를 유지합니다.

## 설정

Obsidian 1.12.7 이상은 가로로 스크롤할 수 있는 상단 탭 4개(일반, Markdown으로, Word로, 교정)를 사용합니다. 설명은 관련 탭 안에 표시되며 별도의 사용 방법 페이지는 없습니다. 탭은 RTL을 포함한 화살표 키, Home/End, 20px UI 글자 및 굵은 포인터용 큰 터치 영역을 지원합니다. 언어는 기본적으로 Obsidian을 따르며 지원되는 11개 언어 중 하나로 지정할 수 있습니다.

## 제한 사항

- 호환되는 로컬 DocWen이 설치된 Windows 데스크톱에서만 지원됩니다.
- 선택한 DocWen 폴더 또는 실행 파일 밖을 재귀적으로 검색하지 않습니다.
- CLI 응답, 원본 스냅샷, 편집기 상태 또는 대상을 안전하게 검증할 수 없으면 작업을 거부합니다.

## 개인정보 보호 및 보안

플러그인은 현재 편집기 또는 Vault 파일의 격리된 스냅샷만 DocWen에 전달합니다. Vault 외부 접근은 등록된 DocWen 별칭이나 수동으로 선택한 휴대용 앱 실행, 임시 입력과 검증된 산출물 관리, 사용자가 선택한 출력 경로 쓰기에만 사용됩니다. 버전이 포함된 Microsoft Store 패키지 경로는 열거나 저장하지 않습니다. 문서를 업로드하거나 Vault 전체를 열거하지 않습니다. 자세히: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## 개발

Node.js 24.19.0과 npm 11.17.0을 사용합니다. `npm ci`, `npm run check`, `npm run release`를 실행합니다. 소스는 `src/`, 테스트는 `tests/`에 있으며 생성된 `dist/`와 `release/` 파일은 소스가 아닙니다.

안정 문서: [제품 요구사항](../product-requirements.en.md) · [UX 사양](../ux-spec.en.md) · [아키텍처](../architecture.en.md) · [테스트 전략](../testing-strategy.en.md) · [릴리스 절차](../release.en.md)

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
