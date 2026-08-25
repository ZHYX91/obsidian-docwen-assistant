# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

O DocWen Assistant conecta o Obsidian a uma instalação local do [DocWen](https://github.com/ZHYX91/docwen) pelo protocolo público `DocWenCLI.exe`. Requer Windows, Obsidian 1.12.7 ou superior e uma versão estável do DocWen 0.9.x.

> **O DocWen é obrigatório.** Este código-fonte tem como alvo o DocWen 0.9.0 e o DocWen Assistant 2.0.0; uma versão do código não comprova a existência de uma GitHub Release. Instale somente após a publicação das duas versões numéricas e de seus arquivos definidos em [DocWen Releases](https://github.com/ZHYX91/docwen/releases) e na página de versões do Assistant.

## Recursos

O plugin abre arquivos no DocWen, exporta Word/Excel/Markdown para um destino escolhido, gerencia numeração de títulos Markdown, revisa Markdown e executa o diagnóstico doctor.

## Requisitos e compatibilidade

- Windows e Obsidian 1.12.7 ou superior; o plugin funciona apenas no desktop.
- Um pacote completo de uma versão estável do DocWen 0.9.x para Windows, totalmente extraído; o plugin não baixa o DocWen automaticamente.
- O DocWen Assistant 2.0 exige `docwen.machine.v1` e `docwen.artifact_bundle.v2`, sem fallback para comandos argv ou envelopes JSON antigos.

Você pode selecionar a pasta do DocWen totalmente extraída, `DocWen.exe` ou `DocWenCLI.exe`. O plugin resolve a escolha para o `DocWenCLI.exe` na mesma pasta e salva e chama somente esse caminho absoluto validado. Ele não executa a interface como CLI, não pesquisa recursivamente e não baixa software automaticamente.

## Instalação

Confirme primeiro em [DocWen Releases](https://github.com/ZHYX91/docwen/releases) e [DocWen Assistant Releases](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) que versões numéricas correspondentes foram publicadas. Baixe então `DocWen-windows-x64.zip` e o pacote correspondente. Copie `main.js`, `manifest.json` e `styles.css` para `<Vault>/.obsidian/plugins/docwen-assistant/`, ative o plugin e escolha a pasta do DocWen, `DocWen.exe` ou `DocWenCLI.exe`.

O pacote de lançamento contém somente `main.js`, `manifest.json` e `styles.css`; ele nunca contém, substitui ou exclui `data.json`. Exclua `data.json` apenas para redefinir deliberadamente todas as preferências.

## Uso

O ícone, o submenu **DocWen** e a paleta de comandos permitem iniciar o DocWen, exportar Word/Excel/Markdown, alterar a numeração de títulos, revisar Markdown e executar doctor. A exportação em segundo plano sempre exige um arquivo de saída escolhido explicitamente.

## Configurações

O Obsidian 1.12.7 ou superior usa cinco abas superiores com rolagem horizontal: Geral, Exportar para Markdown, Exportar para Word, Revisão e Uso. As abas aceitam setas, inclusive em RTL, Início/Fim, texto de interface de 20 px e alvos amplos para ponteiros imprecisos. O idioma segue o Obsidian por padrão e pode ser alterado para qualquer um dos 11 idiomas compatíveis.

## Limitações

- Apenas para desktop Windows com uma instalação local compatível do DocWen.
- Não há pesquisa recursiva fora da pasta ou programa DocWen selecionado.
- Uma operação é recusada quando a resposta da CLI, o instantâneo de origem, o estado do editor ou o destino não podem ser verificados com segurança.

## Privacidade e segurança

O plugin fornece ao processo CLI local apenas um instantâneo isolado do editor atual ou do arquivo do Vault. Ele não envia documentos nem enumera todo o Vault. Detalhes: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Desenvolvimento

Use Node.js 24.19.0 e npm 11.17.0. Execute `npm ci`, `npm run check` e `npm run release`. O código-fonte fica em `src/`, os testes em `tests/`; os arquivos gerados em `dist/` e `release/` não são código-fonte.

Contratos estáveis: [Requisitos do produto](../product-requirements.en.md) · [Especificação de UX](../ux-spec.en.md) · [Arquitetura](../architecture.en.md) · [Estratégia de testes](../testing-strategy.en.md) · [Contrato de lançamento](../release.en.md)

Governança do repositório: [Registro de alterações](../../CHANGELOG.md) · [Como contribuir](../../CONTRIBUTING.md) · [Segurança](../../SECURITY.md)

## Suporte

- Use [General](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/general) para ideias de fluxo de trabalho e comentários gerais.
- Use [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a) para dúvidas de uso e configuração.
- Envie bugs reproduzíveis de integração com o Obsidian e propostas concretas pelos [formulários de issue do DocWen Assistant](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Para conversão, OCR, revisão ou comportamento da CLI fora do Obsidian, use [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues).
- Relate vulnerabilidades de forma privada conforme a [política de segurança](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Antes de publicar, remova conteúdo privado de documentos, caminhos de arquivos e Vault, logs da CLI, locais de executáveis e credenciais.

## Licença

MIT © ZhengYX
