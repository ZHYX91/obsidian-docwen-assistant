# DocWen Assistant

[English](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/README.md) · [简体中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-CN.md) · [繁體中文](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.zh-TW.md) · [Deutsch](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.de-DE.md) · [Français](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.fr-FR.md) · [Русский](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ru-RU.md) · [Português](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.pt-BR.md) · [日本語](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ja-JP.md) · [Español](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.es-ES.md) · [한국어](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.ko-KR.md) · [Tiếng Việt](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/i18n/README.vi-VN.md)

O DocWen Assistant conecta o Obsidian a uma instalação local do [DocWen](https://github.com/ZHYX91/docwen). Requer Windows, Obsidian 1.12.7 ou superior e uma versão estável do DocWen 0.9.x.

> **O DocWen é obrigatório.** Instale uma versão compatível pela [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) ou extraia totalmente o ZIP portátil disponível em [DocWen Releases](https://github.com/ZHYX91/docwen/releases).

## Capturas de tela

Estas imagens mostram o plugin empacotado com o DocWen CLI no Obsidian para desktop.

### Barra lateral de revisão

Revise problemas por linha ou regra e volte ao trecho correspondente da origem sem reescrever a nota.

![Barra lateral de revisão do DocWen](../assets/docwen-assistant-proofread-en.png)

### Configurações em abas superiores e recursos da CLI

Use as cinco abas superiores para escolher o ambiente exato do DocWen, ajustar conversões e revisão e verificar os recursos Machine.

![Configurações do DocWen Assistant](../assets/docwen-assistant-settings-en.png)

### Exportação orientada por recursos

Escolha uma rota de conversão disponível e um local de saída explícito sem alterar a nota de origem.

![Exportação do DocWen Assistant orientada por recursos](../assets/docwen-assistant-export-en.png)

## Recursos

O plugin abre arquivos no DocWen, exporta Word/Excel/Markdown para um destino escolhido, gerencia numeração de títulos Markdown, revisa Markdown e executa o diagnóstico doctor.

## Requisitos e compatibilidade

- Windows e Obsidian 1.12.7 ou superior; o plugin funciona apenas no desktop.
- Um pacote completo de uma versão estável do DocWen 0.9.x para Windows, totalmente extraído; o plugin não baixa o DocWen automaticamente.
- O plugin exige `docwen.machine.v1` e `docwen.artifact_bundle.v2`; uma versão incompatível do DocWen é recusada em vez de usar outro protocolo.

A detecção automática usa por padrão o alias registrado `docwen.exe` e continua válida após atualizações da Microsoft Store. Para o ZIP portátil, escolha a instalação manual e a pasta extraída do DocWen. O plugin não examina `WindowsApps` nem pastas arbitrárias e não baixa software automaticamente.

## Instalação

### Instalar o DocWen e o plugin

Instale o DocWen pela [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) ou extraia o ZIP portátil de [DocWen Releases](https://github.com/ZHYX91/docwen/releases). Instale o DocWen Assistant pelos Community Plugins ou copie `main.js`, `manifest.json` e `styles.css` para `<Vault>/.obsidian/plugins/docwen-assistant/`. A detecção automática não exige escolher arquivo; no ZIP portátil, selecione instalação manual e a pasta do DocWen nas configurações.

### Segurança da instalação

O pacote de lançamento contém somente `main.js`, `manifest.json` e `styles.css`; ele nunca contém, substitui ou exclui `data.json`. Exclua `data.json` apenas para redefinir deliberadamente todas as preferências.

## Uso

O ícone, o submenu **DocWen** e a paleta de comandos permitem iniciar o DocWen, exportar Word/Excel/Markdown, alterar a numeração de títulos, revisar Markdown e executar doctor. A exportação em segundo plano sempre exige um arquivo de saída escolhido explicitamente.

Ao exportar Markdown resolvido para DOCX, o DocWen fornece um arquivo adjacente `<documento>.docwen`. O Assistant o valida e publica atomicamente com o DOCX; se ele estiver ausente, corrompido ou relacionado de forma ambígua, nenhum dos dois arquivos será publicado. Mova-os ou faça backup sempre juntos. Na conversão inversa, um arquivo complementar ausente ou incompatível desativa apenas a restauração literal; a semântica Markdown canônica autenticada continua disponível.

Com uma versão compatível do [Number Suite](https://github.com/ZHYX91/obsidian-number-suite) ativada, a exportação para Word preserva números virtuais validados de títulos e legendas e referências da mesma nota sem adicionar esses números ao Markdown.

## Configurações

O Obsidian 1.12.7 ou superior usa cinco abas superiores com rolagem horizontal: Geral, Exportar para Markdown, Exportar para Word, Revisão e Uso. As abas aceitam setas, inclusive em RTL, Início/Fim, texto de interface de 20 px e alvos amplos para ponteiros imprecisos. O idioma segue o Obsidian por padrão e pode ser alterado para qualquer um dos 11 idiomas compatíveis.

## Limitações

- Apenas para desktop Windows com uma instalação local compatível do DocWen.
- Não há pesquisa recursiva fora da pasta ou programa DocWen selecionado.
- Uma operação é recusada quando a resposta da CLI, o instantâneo de origem, o estado do editor ou o destino não podem ser verificados com segurança.

## Privacidade e segurança

O plugin fornece ao DocWen apenas um instantâneo isolado do editor atual ou do arquivo do Vault. O acesso fora do Vault serve somente para iniciar o alias registrado do DocWen ou o aplicativo portátil escolhido manualmente, gerenciar entradas temporárias e artefatos validados e gravar no destino escolhido. Ele não abre nem salva o caminho versionado do pacote da Microsoft Store, não envia documentos e não enumera todo o Vault. Detalhes: [CLI integration contract](https://github.com/ZHYX91/obsidian-docwen-assistant/blob/main/docs/cli-integration.md)

## Desenvolvimento

Use Node.js 24.19.0 e npm 11.17.0. Execute `npm ci`, `npm run check` e `npm run release`. O código-fonte fica em `src/`, os testes em `tests/`; os arquivos gerados em `dist/` e `release/` não são código-fonte.

Documentos estáveis: [Requisitos do produto](../product-requirements.en.md) · [Especificação de UX](../ux-spec.en.md) · [Arquitetura](../architecture.en.md) · [Estratégia de testes](../testing-strategy.en.md) · [Procedimento de lançamento](../release.en.md)

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
