# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant связывает Obsidian с локальной установкой [DocWen](https://github.com/ZHYX91/docwen). Требуются Windows, Obsidian 1.12.7 или новее и стабильная версия DocWen 0.9.x.

> **Требуется DocWen.** Установите совместимую версию из [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) либо полностью распакуйте переносимый ZIP со страницы [DocWen Releases](https://github.com/ZHYX91/docwen/releases).

## Снимки экрана

На этих снимках показан упакованный плагин с DocWen CLI в настольной версии Obsidian.

### Боковая панель проверки

Проверяйте проблемы по строкам или правилам и переходите к соответствующему фрагменту исходного текста без перезаписи заметки.

![Боковая панель проверки DocWen](../assets/docwen-assistant-proofread-en.png)

### Настройки с верхними вкладками и возможности CLI

Используйте четыре верхние вкладки и контекстные подсказки, чтобы выбрать точную среду DocWen, настроить преобразование и проверку и подтвердить возможности Machine.

![Настройки DocWen Assistant](../assets/docwen-assistant-settings-en.png)

### Экспорт с учётом возможностей

Выберите доступный способ преобразования и явное место вывода, не изменяя исходную заметку.

![Экспорт DocWen Assistant с учётом возможностей](../assets/docwen-assistant-export-en.png)

## Возможности

Плагин открывает файлы в DocWen, экспортирует Word/Excel/Markdown в явно выбранный файл, управляет нумерацией заголовков Markdown, выполняет проверку текста и диагностику doctor.

## Требования и совместимость

- Windows и Obsidian 1.12.7 или новее; плагин работает только на компьютере.
- Полностью распакованный пакет стабильной версии DocWen 0.9.x для Windows; плагин не загружает DocWen автоматически.
- Плагину требуются `docwen.machine.v1` и `docwen.artifact_bundle.v2`; несовместимая версия DocWen отклоняется без перехода на другой протокол.

По умолчанию автоматическое обнаружение использует зарегистрированный псевдоним `docwen.exe`, который сохраняется после обновлений Microsoft Store. Для переносимого ZIP выберите ручную установку и распакованную папку DocWen. Плагин не просматривает `WindowsApps` или произвольные папки и не загружает программы автоматически.

## Установка

### Установка DocWen и плагина

Установите DocWen из [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) или распакуйте переносимый ZIP из [DocWen Releases](https://github.com/ZHYX91/docwen/releases). Установите DocWen Assistant через Community Plugins либо скопируйте `main.js`, `manifest.json` и `styles.css` в `<Vault>/.obsidian/plugins/docwen-assistant/`. При автоматическом обнаружении файл выбирать не нужно; для переносимой версии выберите в настройках ручную установку и папку DocWen.

### Безопасность установки

Пакет выпуска содержит только `main.js`, `manifest.json` и `styles.css`; он никогда не содержит, не заменяет и не удаляет `data.json`. Удаляйте `data.json` только для намеренного сброса всех настроек.

## Использование

Значок, подменю **DocWen** и палитра команд позволяют запустить DocWen, экспортировать Word/Excel/Markdown, изменить нумерацию заголовков, проверить Markdown и выполнить doctor. Фоновый экспорт всегда требует явно выбранного выходного файла.

При экспорте разрешённого Markdown в DOCX DocWen предоставляет соседний файл `<документ>.docwen`. Assistant проверяет его и атомарно публикует вместе с DOCX; если обязательный файл отсутствует, повреждён или связан неоднозначно, не публикуется ни один из файлов. Всегда перемещайте и сохраняйте их вместе. При обратном преобразовании отсутствие или несоответствие файла-компаньона отключает только дословное восстановление; аутентифицированная каноническая семантика Markdown остаётся доступной.

Если включена совместимая версия [Number Suite](https://github.com/ZHYX91/obsidian-number-suite), экспорт в Word сохраняет проверенные виртуальные номера заголовков и подписей, а также ссылки внутри той же заметки, не добавляя эти номера в Markdown.

## Настройки

Obsidian 1.12.7 и новее использует четыре верхние вкладки с горизонтальной прокруткой: «Общие», «Экспорт в Markdown», «Экспорт в Word» и «Корректура». Контекстные подсказки находятся на соответствующих вкладках, а отдельной страницы «Использование» нет. Вкладки поддерживают стрелки, включая RTL, Home/End, текст интерфейса 20 px и крупные цели для неточного указателя. По умолчанию язык соответствует Obsidian, но можно выбрать любой из 11 поддерживаемых языков.

## Ограничения

- Только для Windows на компьютере с совместимой локальной установкой DocWen.
- Нет рекурсивного поиска за пределами выбранной папки или программы DocWen.
- Операция отклоняется, если ответ CLI, исходный снимок, состояние редактора или цель нельзя безопасно проверить.

## Конфиденциальность и безопасность

Плагин передаёт DocWen только изолированный снимок текущего редактора или файла Vault. Доступ вне Vault используется лишь для запуска зарегистрированного псевдонима DocWen или вручную выбранной переносимой программы, управления временными входами и проверенными артефактами и записи в явно выбранное место. Версионированный путь пакета Microsoft Store не открывается и не сохраняется. Плагин не загружает документы и не перечисляет весь Vault. Подробнее: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Разработка

Используйте Node.js 24.19.0 и npm 11.17.0. Выполните `npm ci`, `npm run check` и `npm run release`. Исходный код находится в `src/`, тесты — в `tests/`; созданные файлы в `dist/` и `release/` не являются исходным кодом.

Стабильные документы: [Требования к продукту](../product-requirements.en.md) · [Спецификация UX](../ux-spec.en.md) · [Архитектура](../architecture.en.md) · [Стратегия тестирования](../testing-strategy.en.md) · [Процедура выпуска](../release.en.md)

Управление репозиторием: [Журнал изменений](../../CHANGELOG.md) · [Как внести вклад](../../CONTRIBUTING.md) · [Безопасность](../../SECURITY.md)

## Поддержка

- Используйте [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general) для идей по рабочим процессам и общих отзывов.
- Используйте [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a) для вопросов по использованию и настройке.
- Воспроизводимые ошибки интеграции с Obsidian и конкретные предложения отправляйте через [формы Issues DocWen Assistant](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Вопросы преобразования, OCR, проверки текста или поведения CLI вне Obsidian отправляйте в [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues).
- Сообщайте об уязвимостях приватно в соответствии с [политикой безопасности](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Перед публичной публикацией удалите конфиденциальное содержимое документов, пути к файлам и Vault, журналы CLI, расположение исполняемых файлов и учётные данные.

## Лицензия

MIT © ZhengYX
