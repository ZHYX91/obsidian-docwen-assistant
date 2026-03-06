[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

Плагин Obsidian для запуска конвертера DocWen.

## Установка

1. Скопируйте эту папку в каталог `.obsidian/plugins/` вашего хранилища Obsidian
2. Перезагрузите плагины в настройках Obsidian
3. Включите плагин «DocWen Assistant»
4. Укажите путь к `DocWen.exe` или `DocWenCLI.exe` в настройках плагина (достаточно одного)

## Использование

- Нажмите на значок документа на левой боковой панели, чтобы запустить DocWen
- Используйте палитру команд (Ctrl/Cmd + P) и найдите «DocWen»
- Если файл открыт, его путь будет автоматически передан в DocWen

### Фоновый экспорт (требуется DocWenCLI.exe)

- «Экспорт в Word (Docx) в фоне» — для файлов `.md`/`.markdown`/`.txt` выберите шаблон
- «Экспорт в Excel (XLSX) в фоне» — для файлов `.md`/`.markdown`/`.txt` выберите шаблон
- «Экспорт в Markdown (MD) в фоне» — выберите тип оптимизации, если доступно (или пропустите)

### Нумерация заголовков (требуется DocWenCLI.exe)

- «Добавить нумерацию к заголовкам Markdown» — выберите схему нумерации
- «Удалить нумерацию из заголовков Markdown»

Доступно только для файлов `.md`.

### Диагностика (требуется DocWenCLI.exe)

- «Проверка doctor DocWen» — проверить окружение и зависимости

## Включённые файлы

- `main.js` - Основной код плагина
- `manifest.json` - Манифест плагина
- `styles.css` - Файл стилей (при наличии)
- `README*.md` - Документация

Для получения дополнительной информации см. страницу настроек плагина.

## Ссылки

- Репозиторий плагина: https://github.com/ZHYX91/docwen-obsidian
- Репозиторий DocWen: https://github.com/ZHYX91/docwen
