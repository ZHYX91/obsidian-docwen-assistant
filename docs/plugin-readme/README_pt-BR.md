[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant

Plugin Obsidian para iniciar o conversor DocWen.

## Instalação

1. Copie esta pasta para o diretório `.obsidian/plugins/` do seu cofre Obsidian
2. Recarregue os plugins nas configurações do Obsidian
3. Ative o plugin "DocWen Assistant"
4. Configure o caminho para `DocWen.exe` ou `DocWenCLI.exe` nas configurações do plugin (um é suficiente)

## Uso

- Clique no ícone de documento na barra lateral esquerda para iniciar o DocWen
- Use a paleta de comandos (Ctrl/Cmd + P) e pesquise "DocWen"
- Se um arquivo estiver aberto, seu caminho será automaticamente passado para o DocWen

### Exportação em segundo plano (requer DocWenCLI.exe)

- “Exportar para Word (Docx) em segundo plano” — para arquivos `.md`/`.markdown`/`.txt`, selecione um modelo
- “Exportar para Excel (XLSX) em segundo plano” — para arquivos `.md`/`.markdown`/`.txt`, selecione um modelo
- “Exportar para Markdown (MD) em segundo plano” — selecione um tipo de otimização se disponível (ou pule)

### Numeração de títulos (requer DocWenCLI.exe)

- “Adicionar numeração aos títulos Markdown” — selecione um esquema de numeração
- “Remover numeração dos títulos Markdown”

Disponível apenas para arquivos `.md`.

### Diagnósticos (requer DocWenCLI.exe)

- “Verificação doctor do DocWen” — verificar ambiente e dependências

## Arquivos Incluídos

- `main.js` - Código principal do plugin
- `manifest.json` - Manifesto do plugin
- `styles.css` - Arquivo de estilos (se presente)
- `README*.md` - Documentação

Para mais informações, consulte a página de configurações do plugin.

## Links

- Repositório do plugin: https://github.com/ZHYX91/docwen-obsidian
- Repositório do DocWen: https://github.com/ZHYX91/docwen
