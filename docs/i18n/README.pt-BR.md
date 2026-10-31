# DocWen Assistant

[English](../../README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md) · [Deutsch](README.de-DE.md) · [Français](README.fr-FR.md) · [Español](README.es-ES.md) · [Português (Brasil)](README.pt-BR.md) · [Русский](README.ru-RU.md) · [Tiếng Việt](README.vi-VN.md) · [العربية](README.ar.md)

O DocWen Assistant conecta o Obsidian a uma instalação local do [DocWen](https://github.com/ZHYX91/docwen). Requer Windows ou Linux, Obsidian 1.12.7 ou superior e uma versão estável do DocWen 0.17.0 ou posterior.

> **O DocWen é obrigatório.** Instale uma versão compatível pela [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97) ou extraia totalmente o ZIP portátil disponível em [DocWen Releases](https://github.com/ZHYX91/docwen/releases).

O idioma da interface altera apenas os textos e o layout do Assistant. O idioma de conversão, os modelos e o OCR são controlados pelas opções da tarefa e pelas configurações do DocWen.

## Capturas de tela

Exemplos da interface no computador. A revisão usa uma nota de teste.

### Barra lateral de revisão

Revise problemas por linha ou regra e volte ao trecho correspondente da origem sem reescrever a nota.

![Barra lateral de revisão do DocWen](../assets/docwen-assistant-proofread-en.png)

### Configurações e conexão com o DocWen

Confira a conexão com o DocWen e escolha as opções de conversão e revisão nas quatro abas.

![Configurações do DocWen Assistant](../assets/docwen-assistant-settings-en.png)

### Exportar arquivos

Escolha o formato de saída, confira as opções e indique onde salvar o resultado.

![Exportação do DocWen Assistant orientada por recursos](../assets/docwen-assistant-export-en.png)

## Recursos

O plugin abre arquivos no DocWen, exporta Word/Excel/Markdown para um destino escolhido, gerencia numeração de títulos Markdown, revisa Markdown e oferece **Verificar conexão com o DocWen**.

## Requisitos e compatibilidade

- Windows ou Linux e Obsidian 1.12.7 ou superior; o plugin funciona apenas no desktop.
- No Windows, use uma versão compatível do DocWen 0.17.0 ou posterior da Store ou um pacote portátil totalmente extraído; no Linux, use um pacote totalmente extraído selecionado manualmente. A exportação no Linux exige x64 e um sistema de arquivos que salve novos resultados sem substituir dados existentes; o plugin não baixa o DocWen automaticamente.
- O plugin exige `docwen.machine.v2` e `docwen.artifact_bundle.v3`; uma versão incompatível do DocWen é recusada em vez de usar outro protocolo.
- Mesmo que a conexão para conversões em segundo plano seja incompatível, você pode tentar abrir o aplicativo DocWen separadamente.

Se a instalação da Store não atender a esses requisitos, use um pacote portátil compatível e selecione-o na instalação manual.

A detecção automática é exclusiva do Windows, usa o alias registrado `docwen.exe` e continua válida após atualizações da Microsoft Store. No Linux, a instalação manual é obrigatória e aceita a pasta extraída, `DocWen` ou `DocWenCLI`. O plugin não procura programas em pastas arbitrárias e não baixa software automaticamente.

## Instalação

### Instalar o DocWen e o plugin

1. No Windows, instale uma versão compatível do DocWen 0.17.0 ou posterior pela [Microsoft Store](https://apps.microsoft.com/detail/9NR2211SJH97), ou extraia o pacote Windows de [DocWen Releases](https://github.com/ZHYX91/docwen/releases). No Linux x64, extraia por completo o pacote Linux da mesma página.
2. Instale o DocWen Assistant pelos Community Plugins. Para a instalação manual, baixe `docwen-assistant-x.y.z.zip` nas [versões do plugin](https://github.com/ZHYX91/obsidian-docwen-assistant/releases) e copie `main.js`, `manifest.json` e `styles.css` para `<Vault>/.obsidian/plugins/docwen-assistant/`.
3. Recarregue os Community Plugins e ative o DocWen Assistant.
4. A versão Windows da Store pode ser detectada automaticamente. No Windows portátil ou Linux, abra **Configurações → DocWen Assistant → Geral**, escolha a conexão manual e selecione a pasta extraída ou o executável.

### Manter configurações ao atualizar

Na atualização manual, substitua apenas `main.js`, `manifest.json` e `styles.css`. Mantenha `data.json` para preservar suas configurações; apague-o somente para redefini-las. Mantenha o nome de pasta `docwen-assistant`.

## Uso

**Os comandos dependem do arquivo aberto.** A conversão só aparece quando o conteúdo e o DocWen conectado oferecem a capacidade correspondente. A exportação salva uma saída separada; a revisão não altera a nota. **Adicionar ou remover números de títulos altera o Markdown.** Antes da gravação, o conteúdo atual do editor, incluindo alterações não salvas, ou o arquivo salvo é conferido. Se houver vários editores ambíguos para o mesmo arquivo, a operação é interrompida.

O ícone, o submenu **DocWen** e a paleta de comandos permitem iniciar o DocWen, exportar Word/Excel/Markdown, alterar a numeração de títulos, revisar Markdown e executar **Verificar conexão com o DocWen**.

Escolha um modelo ou uma predefinição de conversão, se houver, e depois a pasta de saída. Confira a origem, o formato, o destino e as opções e clique em **Exportar**. A janela usa as configurações capturadas para essa tarefa; cancelar não inicia a conversão. Um único DOCX ou XLSX é salvo diretamente na pasta escolhida quando o DocWen retorna um arquivo. Markdown e saídas agrupadas mantêm sua própria pasta com imagens e anexos. Ao concluir, clique em **Abrir pasta do resultado** na notificação. Essa ação abre a pasta que contém a saída. Arquivos e pastas existentes não são substituídos.

## Configurações

Antes de exportar para Word, ative as **extensões de entrada** necessárias em **DocWen → Configurações → Sintaxe Markdown**. Elas vêm desativadas em uma nova instalação; a predefinição de entrada do Obsidian ativa o grupo correspondente.

| Conteúdo ou tarefa | Configuração no DocWen |
| --- | --- |
| Células mescladas do Structural Tables | Extensão de entrada Structural Tables |
| Legendas e referências do Number Suite | Extensão de entrada de legendas e referências |
| Títulos H7–H9 / notas finais tipadas | Extensões de entrada correspondentes |
| Word para Markdown estendido | Extensões de saída correspondentes |

A exportação para Word lê a sintaxe do Number Suite mesmo sem o plugin instalado. Os números exportados seguem as opções do DocWen, não os números que o Number Suite apenas exibe. Os comandos separados de adicionar ou remover números de títulos alteram a nota de origem; a exportação não altera.

**O que cada projeto altera**

| Projeto e guia | Exibição, origem e saída |
| --- | --- |
| [DocWen (Core)](https://github.com/ZHYX91/docwen/blob/main/docs/user-guides/README.pt-BR.md) | Cria os arquivos convertidos. As extensões de entrada interpretam a sintaxe original; as configurações de exportação definem a saída e sua numeração. |
| [DocWen Assistant](../product-requirements.en.md) | A exportação salva uma saída separada; a revisão apenas lê. As ações explícitas de numeração de títulos editam o Markdown original. |
| [Chrono Notes](https://github.com/ZHYX91/obsidian-chrono-notes/blob/main/docs/i18n/README.pt-BR.md) | As visualizações do calendário e das tarefas leem o índice. Alterar a conclusão ou a data de uma tarefa modifica seu Markdown original; as ações de criação adicionam notas. |
| [Property Order](https://github.com/ZHYX91/obsidian-property-order/blob/main/docs/i18n/README.pt-BR.md) | As configurações de sugestões mudam os menus. Reordenar ou mover valores edita as listas YAML envolvidas e pode converter valores não textuais em strings. |
| [Link Integrity](https://github.com/ZHYX91/obsidian-link-integrity/blob/main/docs/i18n/README.pt-BR.md) | As regras filtram os resultados da análise ou definem quais conexões do grafo contam. Elas não reescrevem os links nas notas. |
| [Folder Nodes](https://github.com/ZHYX91/obsidian-folder-nodes/blob/main/docs/i18n/README.pt-BR.md) | As visualizações mostram a estrutura dos nós. Criar, mover, renomear, mesclar e excluir altera notas, pastas ou propriedades estruturais. |
| [Number Suite](https://github.com/ZHYX91/obsidian-number-suite/blob/main/docs/i18n/README.pt-BR.md) | Os números virtuais mudam a exibição. As configurações por nota salvam propriedades; escrever, remover ou renumerar altera o texto dos títulos. |
| [Structural Tables](https://github.com/ZHYX91/obsidian-structural-tables/blob/main/docs/i18n/README.pt-BR.md) | Visualizar tabelas e a amostra de aparência não edita notas. Editar tabelas grava Markdown; a conversão para Base cria arquivos de registros. |

As configurações estão divididas em quatro abas: Geral, Exportar para Markdown, Exportar para Word e Revisão. As explicações ficam junto das opções correspondentes. O idioma segue o Obsidian por padrão e pode ser escolhido nas configurações gerais. Use as setas ou as teclas Início/Fim para mudar de aba.

## Limitações

- Para desktop Windows ou Linux com uma instalação local compatível do DocWen; a exportação no Linux exige x64 e um sistema de arquivos que salve os resultados sem substituir dados existentes.
- Não há pesquisa recursiva fora da pasta ou programa DocWen selecionado.
- Se a nota mudar durante o processamento ou se o resultado não puder ser salvo com segurança, a operação para e pede que você confira.

Converter para Word e voltar não substitui uma cópia do Markdown original. O conteúdo visível compatível pode ser reconvertido, mas algumas sintaxes, notas incorporadas e detalhes de layout podem se perder. Guarde a nota original e confira o documento reconvertido.

## Privacidade e segurança

Seus documentos ficam no seu computador. O plugin fornece ao DocWen local uma cópia temporária do arquivo selecionado, incluindo alterações não salvas quando há um único editor correspondente. Ele inclui as imagens referenciadas pela nota; não procura arquivos sem relação em todo o Vault nem envia documentos à Internet.

A exportação grava na pasta escolhida e a revisão não modifica a nota. A numeração de títulos só é aplicada enquanto a nota original continua no mesmo local e seu texto não mudou. Se a nota for renomeada ou substituída durante o processamento, execute a ação novamente na nota atual. O caminho de instalação da Store não é salvo nas configurações do plugin. Veja a [especificação de integração](../cli-integration.md) para detalhes técnicos.

## Desenvolvimento

Use Node.js 24.19.0 e npm 11.17.0. Execute `npm ci`, `npm run check` e `npm run release`. O código-fonte fica em `src/`, os testes em `tests/`; os arquivos gerados em `dist/` e `release/` não são código-fonte.

Documentos estáveis: [Requisitos do produto](../product-requirements.en.md) · [Especificação de UX](../ux-spec.en.md) · [Arquitetura](../architecture.en.md) · [Estratégia de testes](../testing-strategy.en.md)

Governança do repositório: [Registro de alterações](../../CHANGELOG.md) · [Como contribuir](../../CONTRIBUTING.md) · [Segurança](../../SECURITY.md)

## Suporte

No Obsidian, abra **Geral → Ajuda** e escolha **Guia do usuário** ou **Relatar um problema**.

- [Q&A](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/q-a): Dúvidas de uso e configuração.
- [Ideas](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/ideas): Ideias iniciais de recursos e fluxos de trabalho.
- [Show and tell](https://github.com/ZHYX91/obsidian-docwen-assistant/discussions/categories/show-and-tell): Dicas, fluxos de trabalho e implementações de referência.
- Envie bugs reproduzíveis de integração com o Obsidian e propostas concretas pelos [formulários de issue do DocWen Assistant](https://github.com/ZHYX91/obsidian-docwen-assistant/issues/new/choose).
- Para conversão, OCR, revisão ou comportamento da CLI fora do Obsidian, use [DocWen Core Issues](https://github.com/ZHYX91/docwen/issues).
- Relate vulnerabilidades de forma privada conforme a [política de segurança](https://github.com/ZHYX91/obsidian-docwen-assistant/security/policy).

Antes de publicar, remova conteúdo privado de documentos, caminhos de arquivos e Vault, logs da CLI, locais de executáveis e credenciais.

## Licença

MIT © ZhengYX
