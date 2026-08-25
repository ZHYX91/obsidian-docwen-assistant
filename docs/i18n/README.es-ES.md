# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant conecta Obsidian con una instalación local de [DocWen](https://github.com/ZHYX91/docwen) mediante el protocolo público `DocWenCLI.exe`. Requiere Windows, Obsidian 1.12.7 o posterior y una versión estable de DocWen 0.9.x.

> **DocWen es obligatorio.** Este código fuente apunta a DocWen 0.9.0 y DocWen Assistant 2.0.0; una versión del código no demuestra que exista una GitHub Release. Instala solo cuando ambas versiones numéricas y sus archivos definidos estén publicadas en [DocWen Releases](https://github.com/ZHYX91/docwen/releases) y en la página de versiones del Assistant.

## Funciones

El complemento abre archivos en DocWen, exporta Word/Excel/Markdown a una salida elegida, gestiona la numeración de encabezados Markdown, revisa Markdown y ejecuta el diagnóstico doctor.

## Requisitos y compatibilidad

- Windows y Obsidian 1.12.7 o posterior; el complemento es solo para escritorio.
- Un paquete completo de una versión estable de DocWen 0.9.x para Windows, totalmente extraído; el complemento no descarga DocWen automáticamente.
- DocWen Assistant 2.0 requiere `docwen.machine.v1` y `docwen.artifact_bundle.v2`; no conserva comandos argv ni sobres JSON heredados.

Puedes seleccionar la carpeta de DocWen totalmente extraída, `DocWen.exe` o `DocWenCLI.exe`. El complemento resuelve la selección al `DocWenCLI.exe` de la misma carpeta y guarda y usa únicamente esa ruta absoluta validada. No ejecuta la interfaz como CLI, no busca de forma recursiva ni descarga software automáticamente.

## Instalación

Comprueba primero en [DocWen Releases](https://github.com/ZHYX91/docwen/releases) y [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) que se hayan publicado versiones numéricas coincidentes. Descarga después `DocWen-windows-x64.zip` y el paquete correspondiente. Copia `main.js`, `manifest.json` y `styles.css` en `<Vault>/.obsidian/plugins/docwen-assistant/`, habilita el complemento y elige la carpeta de DocWen, `DocWen.exe` o `DocWenCLI.exe`.

El paquete de la versión contiene únicamente `main.js`, `manifest.json` y `styles.css`; nunca contiene, reemplaza ni elimina `data.json`. Elimina `data.json` solo para restablecer deliberadamente todas las preferencias.

## Uso

El icono, el submenú **DocWen** y la paleta de comandos permiten iniciar DocWen, exportar Word/Excel/Markdown, cambiar la numeración de encabezados, revisar Markdown y ejecutar doctor. La exportación en segundo plano siempre exige elegir explícitamente un archivo de salida.

## Configuración

Obsidian 1.12.7 o posterior usa cinco pestañas superiores con desplazamiento horizontal: General, Exportar a Markdown, Exportar a Word, Corrección y Uso. Las pestañas admiten flechas, incluida la dirección RTL, Inicio/Fin, texto de interfaz de 20 px y objetivos amplios para punteros gruesos. El idioma sigue a Obsidian de forma predeterminada y puede cambiarse a cualquiera de los 11 idiomas compatibles.

## Limitaciones

- Solo para escritorio Windows con una instalación local compatible de DocWen.
- No hay búsqueda recursiva fuera de la carpeta o programa DocWen seleccionado.
- Se rechaza una operación si no se pueden verificar de forma segura la respuesta CLI, la instantánea de origen, el estado del editor o el destino.

## Privacidad y seguridad

El complemento entrega al proceso CLI local únicamente una instantánea aislada del editor actual o del archivo del Vault. No sube documentos ni enumera todo el Vault. Detalles: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Desarrollo

Usa Node.js 24.19.0 y npm 11.17.0. Ejecuta `npm ci`, `npm run check` y `npm run release`. El código fuente está en `src/`, las pruebas en `tests/`; los archivos generados en `dist/` y `release/` no son código fuente.

Contratos estables: [Requisitos del producto](../product-requirements.en.md) · [Especificación de UX](../ux-spec.en.md) · [Arquitectura](../architecture.en.md) · [Estrategia de pruebas](../testing-strategy.en.md) · [Contrato de publicación](../release.en.md)

Gobernanza del repositorio: [Registro de cambios](../../CHANGELOG.md) · [Cómo contribuir](../../CONTRIBUTING.md) · [Seguridad](../../SECURITY.md)

## Soporte

- Usa [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general) para ideas de flujo de trabajo y comentarios generales.
- Usa [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a) para preguntas de uso y configuración.
- Envía errores reproducibles de integración con Obsidian y propuestas concretas mediante los [formularios de incidencias de DocWen Assistant](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Para conversión, OCR, revisión o comportamiento de CLI fuera de Obsidian, usa [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues).
- Informa de vulnerabilidades de forma privada según la [política de seguridad](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Antes de publicar, elimina contenido privado de documentos, rutas de archivos y Vault, registros de CLI, ubicaciones de ejecutables y credenciales.

## Licencia

MIT © ZhengYX
