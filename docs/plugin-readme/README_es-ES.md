[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

Plugin de Obsidian para iniciar el convertidor DocWen.

## Instalación

1. Copia esta carpeta a `.obsidian/plugins/` en tu bóveda de Obsidian
2. Recarga los plugins en la configuración de Obsidian
3. Habilita el plugin “DocWen Assistant”
4. Configura la ruta a `DocWen.exe` o `DocWenCLI.exe` en los ajustes del plugin (uno es suficiente)

## Uso

- Haz clic en el icono de documento en la barra lateral para iniciar DocWen
- Usa la paleta de comandos (Ctrl/Cmd + P) y busca “DocWen”
- Si hay un archivo abierto, su ruta se pasará automáticamente a DocWen

### Exportación en segundo plano (requiere DocWenCLI.exe)

- “Exportar a Word (Docx) en segundo plano” — para archivos `.md`/`.markdown`/`.txt`, selecciona una plantilla
- “Exportar a Excel (XLSX) en segundo plano” — para archivos `.md`/`.markdown`/`.txt`, selecciona una plantilla
- “Exportar a Markdown (MD) en segundo plano” — selecciona un tipo de optimización si está disponible (o sáltalo)

### Numeración de títulos (requiere DocWenCLI.exe)

- “Agregar numeración a títulos Markdown” — selecciona un esquema de numeración
- “Eliminar numeración de títulos Markdown”

Solo disponible para archivos `.md`.

### Diagnósticos (requiere DocWenCLI.exe)

- “Comprobación doctor de DocWen” — comprobar el entorno y las dependencias

## Archivos incluidos

- `main.js` - Código principal del plugin
- `manifest.json` - Manifest del plugin
- `styles.css` - Estilos (si existe)
- `README*.md` - Documentación

Para más información, revisa la página de ajustes del plugin.

## Enlaces

- Repo del plugin: https://github.com/ZHYX91/docwen-obsidian
- Repo de DocWen: https://github.com/ZHYX91/docwen
