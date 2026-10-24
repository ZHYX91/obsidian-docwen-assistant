# DocWen Assistant

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

DocWen Assistant는 Obsidian을 로컬 [DocWen](https://github.com/ZHYX91/docwen)에 연결합니다. Windows 또는 Linux, Obsidian 1.12.7 이상, 안정적인 DocWen 0.17.0 이상 버전이 필요합니다.

> **DocWen 본체가 필요합니다.** [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97)에서 호환 버전을 설치하거나 [DocWen Releases](https://github.com/ZHYX91/docwen/releases)의 휴대용 ZIP을 완전히 압축 해제하세요.

인터페이스 언어는 Assistant 자체의 문구와 레이아웃만 바꿉니다. 변환 언어, 템플릿 및 OCR은 작업 옵션과 DocWen 설정에서 관리합니다.

## 스크린샷

데스크톱 화면 예시입니다. 교정 예시는 테스트용 노트를 사용합니다.

### 교정 사이드바

줄이나 규칙별로 문제를 검토하고 노트를 다시 쓰지 않은 채 해당 소스 범위로 이동합니다.

![DocWen 교정 사이드바](../assets/docwen-assistant-proofread-en.png)

### 설정과 DocWen 연결

네 설정 탭에서 DocWen 연결을 확인하고 변환 및 교정 옵션을 고릅니다.

![DocWen Assistant 상단 탭 설정](../assets/docwen-assistant-settings-en.png)

### 파일 내보내기

출력 형식과 설정을 확인하고 결과를 저장할 폴더를 선택합니다.

![DocWen Assistant 기능별 내보내기](../assets/docwen-assistant-export-en.png)

## 기능

DocWen에서 파일 열기, 출력 폴더를 선택하는 Word/Excel/Markdown 변환, Markdown 제목 번호 추가·제거, 교정 및 **DocWen 연결 확인** 명령을 제공합니다.

## 요구 사항 및 호환성

- Windows 또는 Linux와 Obsidian 1.12.7 이상. 플러그인은 데스크톱 전용입니다.
- Windows에서는 Store 버전 또는 완전히 압축 해제한 휴대용 DocWen 0.17.0 이상을 사용하고, Linux에서는 완전히 압축 해제한 패키지를 수동으로 선택합니다. Linux 내보내기에는 x64와 기존 데이터를 덮어쓰지 않고 결과를 저장할 수 있는 파일 시스템이 필요합니다. 플러그인은 DocWen을 자동으로 다운로드하지 않습니다.
- 플러그인은 `docwen.machine.v2`과 `docwen.artifact_bundle.v3`이 필요합니다. 호환되지 않는 DocWen은 다른 프로토콜로 전환하지 않고 거부됩니다.
- 백그라운드 변환 연결이 호환되지 않아도 DocWen 데스크톱 앱은 별도로 열 수 있습니다.

Store 설치 버전이 이 요구 사항을 충족하지 않으면 호환되는 휴대용 패키지를 사용하고 수동 설치에서 선택하세요.

자동 감지는 Windows 전용이며 등록된 `docwen.exe` 별칭을 사용합니다. Linux에서는 수동 설치가 필수이며 압축을 푼 폴더, `DocWen` 또는 `DocWenCLI`를 선택합니다. 디스크에서 다른 프로그램을 검색하지 않으며 소프트웨어를 자동 다운로드하지 않습니다.

## 설치

### DocWen과 플러그인 설치

1. Windows에서는 [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97)에서 호환되는 DocWen 0.17.0 이상을 설치하거나 [DocWen Releases](https://github.com/ZHYX91/docwen/releases)의 Windows 패키지를 완전히 압축 해제하세요. Linux x64에서는 같은 페이지의 Linux 패키지를 압축 해제합니다.
2. Community Plugins에서 DocWen Assistant를 설치합니다. 수동 설치는 [플러그인 릴리스](https://github.com/ZHYX91/obsidian-docwen-assistant/releases)에서 `docwen-assistant-x.y.z.zip`을 받은 뒤 `main.js`, `manifest.json`, `styles.css`를 `<Vault>/.obsidian/plugins/docwen-assistant/`에 복사합니다.
3. Community Plugins를 다시 불러오고 DocWen Assistant를 활성화합니다.
4. Windows Store 버전은 자동 감지를 사용할 수 있습니다. Windows 휴대용 버전과 Linux에서는 **설정 → DocWen Assistant → 일반**에서 수동 연결을 선택하고 압축을 푼 폴더나 실행 파일을 지정하세요.

### 업데이트할 때 설정 유지

수동 업데이트에서는 `main.js`, `manifest.json`, `styles.css`만 교체하세요. 설정을 유지하려면 `data.json`을 보관하고, 초기화할 때만 삭제합니다. 폴더 이름은 `docwen-assistant`로 유지하세요.

## 사용

**현재 파일에서 가능한 작업만 표시됩니다.** 내보내기 명령은 파일 내용과 연결된 DocWen의 지원 기능에 따라 달라집니다. 내보내기는 선택한 폴더 안에 별도의 결과 폴더를 만들고, 교정은 노트를 바꾸지 않습니다. **제목 번호 추가·제거는 Markdown 원문을 수정합니다.** 저장되지 않은 편집 내용이나 저장된 파일을 확인한 뒤 반영하며, 같은 경로에 여러 편집기가 있어 하나를 확정할 수 없으면 작업을 중단합니다.

리본 아이콘, **DocWen** 하위 메뉴 또는 명령 팔레트에서 DocWen 실행, Word/Excel/Markdown 내보내기, 제목 번호 변경, Markdown 교정, **DocWen 연결 확인** 실행을 할 수 있습니다.

템플릿이나 변환 사전 설정이 표시되면 선택한 뒤 출력 폴더를 지정합니다. 원본, 형식, 저장 위치와 이번 작업의 옵션을 확인하고 **내보내기**를 누르세요. 확인 창은 해당 작업에서 가져온 설정을 사용하며, 취소하면 변환을 시작하지 않습니다. 결과와 연결된 이미지는 새 폴더에 저장됩니다. 완료 알림의 **결과 폴더 열기**로 확인할 수 있습니다. 기존 결과 폴더는 덮어쓰지 않습니다.

## 설정

Word로 내보내기 전에 **DocWen → 설정 → Markdown 문법**에서 필요한 **입력 확장**을 켜세요. 새 설치에서는 꺼져 있으며, Obsidian 입력 사전 설정으로 관련 확장을 함께 켤 수 있습니다.

| 노트 내용 또는 작업 | DocWen 설정 |
| --- | --- |
| Structural Tables 병합 셀 | Structural Tables 입력 확장 |
| Number Suite 캡션과 상호 참조 | 캡션 및 참조 입력 확장 |
| H7–H9 제목 / 유형별 미주 | 해당 제목 / 미주 입력 확장 |
| Word를 확장 Markdown으로 변환 | 해당 출력 확장 |

Number Suite가 설치되지 않아도 Word 내보내기는 Markdown의 해당 문법을 읽습니다. 출력 번호는 DocWen 설정을 따르며 Number Suite의 표시 전용 번호를 복사하지 않습니다. 별도의 제목 번호 추가·제거 명령은 원본 노트를 수정하지만 내보내기는 수정하지 않습니다.

설정은 일반, Markdown으로, Word로, 교정의 네 탭으로 나뉩니다. 각 탭에서 관련 설명을 확인할 수 있습니다. 언어는 기본적으로 Obsidian을 따르며 일반 설정에서 바꿀 수 있습니다. 화살표 키나 Home/End 키로 탭을 전환할 수 있습니다.

## 제한 사항

- 호환되는 로컬 DocWen이 설치된 Windows 또는 Linux 데스크톱을 지원합니다. Linux 내보내기에는 x64와 기존 데이터를 덮어쓰지 않고 결과를 저장할 수 있는 파일 시스템이 필요합니다.
- 선택한 DocWen 폴더 또는 실행 파일 밖을 재귀적으로 검색하지 않습니다.
- 처리 중 노트가 바뀌거나 결과를 안전하게 저장할 수 없으면 작업을 멈추고 확인을 요청합니다.

Word로 내보낸 뒤 다시 변환해도 원본 Markdown이 그대로 복원되지는 않습니다. 지원되는 표시 내용은 변환되지만 미지원 문법, 포함된 노트의 펼침, 일부 서식은 유지되지 않을 수 있습니다. 원본 노트를 보관하고 다시 변환한 문서를 확인하세요.

## 개인정보 보호 및 보안

문서는 컴퓨터 안에서 처리됩니다. 플러그인은 선택한 파일의 임시 복사본을 로컬 DocWen에 전달합니다. 해당 파일에 대응하는 편집기가 하나라면 저장하지 않은 내용도 포함합니다. 노트가 명시적으로 참조하는 이미지만 함께 처리하며, Vault 전체에서 무관한 파일을 찾거나 문서를 업로드하지 않습니다.

내보내기는 선택한 폴더에 저장하고, 교정은 노트를 수정하지 않습니다. 제목 번호는 원본 노트의 위치와 본문이 바뀌지 않았을 때만 반영합니다. 처리 중 이름을 바꾸거나 파일을 교체했다면 현재 노트에서 다시 실행하세요. Store 설치 경로는 플러그인 설정에 저장하지 않습니다. 개발자용 세부 사항은 [연동 명세](../cli-integration.md)를 참고하세요.

## 개발

Node.js 24.19.0과 npm 11.17.0을 사용합니다. `npm ci`, `npm run check`, `npm run release`를 실행합니다. 소스는 `src/`, 테스트는 `tests/`에 있으며 생성된 `dist/`와 `release/` 파일은 소스가 아닙니다.

안정 문서: [제품 요구사항](../product-requirements.en.md) · [UX 사양](../ux-spec.en.md) · [아키텍처](../architecture.en.md) · [테스트 전략](../testing-strategy.en.md)

저장소 거버넌스: [변경 기록](../../CHANGELOG.md) · [기여 안내](../../CONTRIBUTING.md) · [보안](../../SECURITY.md)

## 지원

Obsidian에서는 **일반 → 도움말**에서 **사용자 가이드** 또는 **문제 신고**를 열 수 있습니다.

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a): 사용 및 설정 질문.
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas): 초기 기능 및 워크플로 아이디어.
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell): 팁, 워크플로 및 참고 구현.
- 재현 가능한 Obsidian 통합 버그와 구체적인 기능 제안은 [DocWen Assistant 이슈 양식](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose)으로 제출하세요.
- Obsidian 외부의 변환, OCR, 교정 또는 CLI 동작은 [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues)에 제출하세요.
- 취약점은 [보안 정책](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy)에 따라 비공개로 신고하세요.

공개 게시 전 비공개 문서 내용, 파일 및 Vault 경로, CLI 로그, 실행 파일 위치와 자격 증명을 제거하세요.

## 라이선스

MIT © ZhengYX
