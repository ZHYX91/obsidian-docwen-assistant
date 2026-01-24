[English](README.md) | [简体中文](README_zh-CN.md) | [繁體中文](README_zh-TW.md) | [Deutsch](README_de-DE.md) | [Français](README_fr-FR.md) | [Русский](README_ru-RU.md) | [Português](README_pt-BR.md) | [日本語](README_ja-JP.md) | [Español](README_es-ES.md) | [한국어](README_ko-KR.md) | [Tiếng Việt](README_vi-VN.md)

# DocWen Assistant - Plugin Obsidian

Um plugin Obsidian para o aplicativo de desktop [DocWen](https://github.com/ZHYX91/docwen).

## ✨ Recursos

### Recursos principais
- ✅ **Lançamento rápido pela barra lateral**: Adicione um ícone à barra lateral do Obsidian para lançamento com um clique
- ✅ **Transmissão automática de arquivos**: Transmite automaticamente o caminho do arquivo atualmente aberto para o DocWen
- ✅ **Integração com paleta de comandos**: Acesso rápido via Ctrl/Cmd + P
- ✅ **Validação de caminho**: Validação em tempo real do caminho do executável
- ✅ **Navegador de arquivos**: Selecione facilmente o arquivo executável através do diálogo de navegação
- ✅ **Feedback de sucesso**: Notificações amigáveis no lançamento
- ✅ **Gerenciamento de instância única**: Envia automaticamente o arquivo para a instância em execução
- ✅ **Suporte multilíngue**: Suporta 11 idiomas (zh-CN, zh-TW, en, de, fr, ru, pt, ja, es-ES, ko-KR, vi-VN)

---

## 📦 Início rápido

### Pré-requisitos

1. **Instalar Node.js**
   - Visite o [site oficial do Node.js](https://nodejs.org/)
   - Baixe e instale a versão LTS
   - Verifique a instalação: `node -v` e `npm -v`

2. **Instalar dependências**
   ```bash
   npm install
   ```

### Modo de desenvolvimento

Use o modo watch durante o desenvolvimento para recompilação automática nas mudanças de código:

```bash
npm run dev
```

### Construir o plugin

#### Construção rápida (sem verificação de tipos)
```bash
npm run build:quick
```

#### Construção completa (com verificação de tipos e minificação)
```bash
npm run build
```

#### Construção de release (empacotamento automático)
```bash
npm run release
# Ou execute diretamente: node scripts/build.js
```

Este comando irá:
1. Compilar o código TypeScript
2. Criar o diretório de release
3. Copiar os arquivos necessários
4. Gerar instruções de uso

---

## 🚀 Instalar no Obsidian

### Método 1: Usando o script de release (Recomendado)

1. Execute a construção de release:
   ```bash
   npm run release
   ```

2. Copie a pasta `release/docwen-assistant` para:
   ```
   <Seu Vault>/.obsidian/plugins/
   ```

3. No Obsidian:
   - Abra `Configurações` → `Plugins da comunidade`
   - Clique em `Recarregar plugins`
   - Ative `DocWen Assistant`

### Método 2: Instalação manual

1. Construa o plugin:
   ```bash
   npm run build
   ```

2. Crie o diretório do plugin:
   ```
   <Seu Vault>/.obsidian/plugins/docwen-assistant/
   ```

3. Copie estes arquivos para o diretório:
   - `main.js`
   - `manifest.json`

4. Recarregue e ative o plugin no Obsidian

---

## ⚙️ Configuração

1. Abra Obsidian `Configurações` → `Plugins da comunidade` → `DocWen Assistant`

2. Configure o caminho do executável:
   - **Opção 1**: Digite o caminho diretamente
   - **Opção 2**: Clique no botão `Procurar...` para selecionar o arquivo

3. Validação de caminho:
   - ✓ Verde indica caminho válido
   - ✗ Vermelho indica caminho inválido ou arquivo não encontrado

---

## 📖 Uso

### Lançar DocWen

Três maneiras de lançar:

1. **Ícone da barra lateral**
   - Clique no ícone do documento na barra lateral esquerda

2. **Paleta de comandos**
   - Pressione `Ctrl/Cmd + P` para abrir a paleta de comandos
   - Procure por "Lançar DocWen"

3. **Lançar com arquivo atual**
   - Procure "Lançar DocWen com arquivo atual" na paleta de comandos
   - Disponível apenas quando um arquivo está aberto

### Transmissão automática de arquivos

- Se um arquivo Markdown estiver aberto, o plugin automaticamente transmite seu caminho completo para o DocWen
- Se nenhum arquivo estiver aberto, apenas lança o programa DocWen

### Gerenciamento de instância única

- **Primeiro clique** → Lança DocWen e transmite o arquivo atual
- **Clique novamente (com arquivo)** → Substitui pelo novo arquivo (Modo de arquivo único)
- **Clique novamente (sem arquivo)** → Ativa a janela do DocWen

---

## 🛠️ Scripts de desenvolvimento

### Comandos disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Modo de desenvolvimento (watch) |
| `npm run build` | Construção completa (verificação de tipos + minificação) |
| `npm run build:quick` | Construção rápida (sem verificação de tipos) |
| `node version-bump.js [patch\|minor\|major]` | Atualizar número da versão |
| `npm run release` | Construir pacote de release |

### Gerenciamento de versões

Atualizar número da versão:

```bash
# Versão patch (1.0.0 → 1.0.1)
node version-bump.js patch

# Versão minor (1.0.0 → 1.1.0)
node version-bump.js minor

# Versão major (1.0.0 → 2.0.0)
node version-bump.js major
```

---

## 📁 Estrutura do projeto

```
docwen-obsidian/
├── src/                 # 📁 Diretório do código fonte
│   ├── main.ts          # Lógica principal do plugin
│   ├── settings.ts      # Página de configurações
│   ├── i18n.ts          # Módulo de internacionalização
│   ├── utils/           # Funções utilitárias (futuro)
│   ├── types/           # Definições de tipos (futuro)
│   └── commands/        # Módulos de comandos (futuro)
├── dist/                # 🔨 Diretório de saída da construção
│   └── main.js          # Código compilado
├── scripts/             # 📜 Scripts de construção
│   ├── build.bat        # Construção com um clique para Windows
│   ├── build.js         # Script de construção multiplataforma
│   └── README.md        # Guia de uso dos scripts
├── release/             # 📦 Artefatos de release
├── .vscode/             # 🛠️ Configuração do editor
│   └── settings.json    # Configurações do VS Code
├── manifest.json        # Manifesto do plugin
├── package.json         # Configuração do projeto
├── tsconfig.json        # Configuração do TypeScript
├── .eslintrc.json       # Configuração do ESLint
├── .gitignore          # Arquivo Git ignore
├── version-bump.js     # Script de gerenciamento de versões
├── README.md           # Documentação em inglês
└── README_pt-BR.md     # Este documento (Português)
```

---

## 🐛 Solução de problemas

### Plugin não carrega

1. Verifique se `main.js` e `manifest.json` foram copiados corretamente
2. Clique em `Recarregar plugins` no Obsidian
3. Verifique o console do desenvolvedor (`Ctrl/Cmd + Shift + I`) para erros

### Não é possível lançar DocWen

1. Verifique se o caminho do executável está correto
2. Confirme que o status do caminho mostra verde ✓
3. Confirme que o executável tem as permissões adequadas

### Caminho do arquivo não transmitido

1. Confirme que um arquivo está atualmente aberto
2. Verifique se o caminho do arquivo contém caracteres especiais
3. Verifique os logs do console para os argumentos transmitidos

---

## 📜 Licença

Este projeto está licenciado sob a Licença MIT.

### Contato

- **GitHub**: https://github.com/ZHYX91/docwen-obsidian
- **Projeto principal DocWen**: https://github.com/ZHYX91/docwen
- **Contatar autor**: zhengyx91@hotmail.com

---

**Autor**: ZhengYX
