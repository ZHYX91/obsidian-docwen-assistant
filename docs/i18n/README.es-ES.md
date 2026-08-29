# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

DocWen Assistant conecta Obsidian con una instalación local de [DocWen](https://github.com/ZHYX91/docwen). Requiere Windows, Obsidian 1.12.7 o posterior y una versión estable de DocWen 0.9.x.

> **DocWen es obligatorio.** Instala una versión compatible desde [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) o extrae por completo el ZIP portátil de [DocWen Releases](https://github.com/ZHYX91/docwen/releases).

## Capturas de pantalla

Estas capturas muestran el complemento empaquetado con DocWen CLI en Obsidian para escritorio.

### Barra lateral de revisión

Revisa problemas por línea o regla y vuelve al intervalo de origen correspondiente sin reescribir la nota.

![Barra lateral de revisión de DocWen](../assets/docwen-assistant-proofread-en.png)

### Configuración con pestañas superiores y capacidades de CLI

Usa las cinco pestañas superiores para elegir el entorno exacto de DocWen, ajustar conversiones y revisión y verificar las capacidades Machine.

![Configuración de DocWen Assistant](../assets/docwen-assistant-settings-en.png)

### Exportación según capacidades

Elige una ruta de conversión disponible y una ubicación de salida explícita sin modificar la nota de origen.

![Exportación de DocWen Assistant según capacidades](../assets/docwen-assistant-export-en.png)

## Funciones

El complemento abre archivos en DocWen, exporta Word/Excel/Markdown a una salida elegida, gestiona la numeración de encabezados Markdown, revisa Markdown y ejecuta el diagnóstico doctor.

## Requisitos y compatibilidad

- Windows y Obsidian 1.12.7 o posterior; el complemento es solo para escritorio.
- Un paquete completo de una versión estable de DocWen 0.9.x para Windows, totalmente extraído; el complemento no descarga DocWen automáticamente.
- El complemento requiere `docwen.machine.v1` y `docwen.artifact_bundle.v2`; una versión incompatible de DocWen se rechaza en lugar de usar otro protocolo.

La detección automática usa de forma predeterminada el alias registrado `docwen.exe` y sigue funcionando tras las actualizaciones de Microsoft Store. Para el ZIP portátil, selecciona la instalación manual y la carpeta extraída de DocWen. El complemento no examina `WindowsApps` ni carpetas arbitrarias y no descarga software automáticamente.

## Instalación

### Instalar DocWen y el complemento

Instala DocWen desde [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) o extrae el ZIP portátil de [DocWen Releases](https://github.com/ZHYX91/docwen/releases). Instala DocWen Assistant desde Community Plugins o copia `main.js`, `manifest.json` y `styles.css` en `<Vault>/.obsidian/plugins/docwen-assistant/`. La detección automática no requiere elegir archivos; para el ZIP portátil, elige instalación manual y la carpeta de DocWen en los ajustes.

### Seguridad de la instalación

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

El complemento entrega a DocWen únicamente una instantánea aislada del editor actual o del archivo del Vault. Solo accede fuera del Vault para iniciar el alias registrado de DocWen o la aplicación portátil elegida manualmente, gestionar entradas temporales y artefactos validados y escribir en el destino elegido. No abre ni guarda la ruta versionada del paquete de Microsoft Store, no sube documentos ni enumera todo el Vault. Detalles: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Desarrollo

Usa Node.js 24.19.0 y npm 11.17.0. Ejecuta `npm ci`, `npm run check` y `npm run release`. El código fuente está en `src/`, las pruebas en `tests/`; los archivos generados en `dist/` y `release/` no son código fuente.

Documentos estables: [Requisitos del producto](../product-requirements.en.md) · [Especificación de UX](../ux-spec.en.md) · [Arquitectura](../architecture.en.md) · [Estrategia de pruebas](../testing-strategy.en.md) · [Proceso de publicación](../release.en.md)

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
