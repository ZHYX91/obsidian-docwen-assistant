# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant связывает Obsidian с локальной установкой [DocWen](https://github.com/ZHYX91/docwen) через публичный протокол `DocWenCLI.exe`. Требуются Windows, Obsidian 1.12.7 или новее и стабильная версия DocWen 0.9.x.

> **Требуется DocWen.** Эта версия исходников рассчитана на DocWen 0.9.0 и DocWen Assistant 2.0.0; версия исходников не подтверждает наличие GitHub Release. Устанавливайте только после публикации обеих числовых версий и предусмотренных файлов на страницах [DocWen Releases](https://github.com/ZHYX91/docwen/releases) и выпусков Assistant.

## Возможности

Плагин открывает файлы в DocWen, экспортирует Word/Excel/Markdown в явно выбранный файл, управляет нумерацией заголовков Markdown, выполняет проверку текста и диагностику doctor.

## Требования и совместимость

- Windows и Obsidian 1.12.7 или новее; плагин работает только на компьютере.
- Полностью распакованный пакет стабильной версии DocWen 0.9.x для Windows; плагин не загружает DocWen автоматически.
- DocWen Assistant 2.0 требует `docwen.machine.v1` и `docwen.artifact_bundle.v2`; отката к argv-командам или старым JSON-конвертам нет.

Можно выбрать полностью распакованную папку DocWen, `DocWen.exe` или `DocWenCLI.exe`. Плагин преобразует выбор в путь к `DocWenCLI.exe` в той же папке и сохраняет и вызывает только этот проверенный абсолютный путь. Он не запускает GUI как CLI, не выполняет рекурсивный поиск и не загружает программы автоматически.

## Установка

Сначала убедитесь на страницах [DocWen Releases](https://github.com/ZHYX91/docwen/releases) и [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases), что опубликованы соответствующие числовые версии. Затем загрузите `DocWen-windows-x64.zip` и соответствующий пакет плагина. Скопируйте `main.js`, `manifest.json` и `styles.css` в `<Vault>/.obsidian/plugins/docwen-assistant/`, включите плагин и выберите папку DocWen, `DocWen.exe` или `DocWenCLI.exe`.

Пакет выпуска содержит только `main.js`, `manifest.json` и `styles.css`; он никогда не содержит, не заменяет и не удаляет `data.json`. Удаляйте `data.json` только для намеренного сброса всех настроек.

## Использование

Значок, подменю **DocWen** и палитра команд позволяют запустить DocWen, экспортировать Word/Excel/Markdown, изменить нумерацию заголовков, проверить Markdown и выполнить doctor. Фоновый экспорт всегда требует явно выбранного выходного файла.

## Настройки

Obsidian 1.12.7 и новее использует пять верхних вкладок с горизонтальной прокруткой: «Общие», «Экспорт в Markdown», «Экспорт в Word», «Корректура» и «Использование». Вкладки поддерживают стрелки, включая RTL, Home/End, текст интерфейса 20 px и крупные цели для неточного указателя. По умолчанию язык соответствует Obsidian, но можно выбрать любой из 11 поддерживаемых языков.

## Ограничения

- Только для Windows на компьютере с совместимой локальной установкой DocWen.
- Нет рекурсивного поиска за пределами выбранной папки или программы DocWen.
- Операция отклоняется, если ответ CLI, исходный снимок, состояние редактора или цель нельзя безопасно проверить.

## Конфиденциальность и безопасность

Плагин передаёт локальному процессу CLI только изолированный снимок текущего редактора или файла Vault. Он не загружает документы и не перечисляет весь Vault. Подробнее: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Разработка

Используйте Node.js 24.19.0 и npm 11.17.0. Выполните `npm ci`, `npm run check` и `npm run release`. Исходный код находится в `src/`, тесты — в `tests/`; созданные файлы в `dist/` и `release/` не являются исходным кодом.

Стабильные контракты: [Требования к продукту](../product-requirements.en.md) · [Спецификация UX](../ux-spec.en.md) · [Архитектура](../architecture.en.md) · [Стратегия тестирования](../testing-strategy.en.md) · [Контракт выпуска](../release.en.md)

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
