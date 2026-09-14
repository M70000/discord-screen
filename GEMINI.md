# Regras e Diretrizes do Projeto - Discord Screen Relay

## 1. Controle de Versão e Git (CRÍTICO)
- **NUNCA execute `git commit` ou `git push` automaticamente.**
- O agente deve realizar as alterações nos arquivos e mantê-las na árvore de trabalho (*working tree*) para revisão do usuário.
- Apenas execute `git commit` ou `git push` quando o usuário solicitar **expressamente** na mensagem (ex: "faça o commit", "envie para o github").

## 2. Performance e Exclusão de Dependências
- **NUNCA pesquise, liste ou indexe a pasta `node_modules/`, `.venv/` ou `.git/`.**
- O diretório de dependências contém dezenas de milhares de arquivos de pacotes de terceiros que deixam o agente lento e esgotam o contexto desnecessariamente.
- Todas as operações de busca e leitura de código devem ser estritamente focadas nas pastas de desenvolvimento do projeto:
  - `src/` (incluindo `commands/`, `events/`, `utils/`)
  - `config/`
  - Arquivos de configuração da raiz (`package.json`, `tsconfig.json`, `.env.example`)
- Arquivos de build (`dist/`, `build/`) e caches temporários (`.turbo/`, `.tsbuildinfo`, logs) nunca devem ser lidos ou indexados em lote.

## 3. Testes, Diagnósticos e Validação (REGRA RÍGIDA)
- **PROIBIDO CRIAR ARQUIVOS DE TESTE:** NUNCA crie novos arquivos de teste ou scripts descartáveis de diagnóstico (como `test_*.js`, `test_*.ts`, `check_*.js`, `scratch_*.js`, etc.), a menos que o usuário peça com as palavras exatas: "crie um teste".
- **PROIBIDO POLUIR A RAIZ:** Não use a raiz do projeto como rascunho de experimentação. Se precisar validar a sintaxe de uma URL do VDO.ninja, regex ou lógica do `node:crypto`, execute testes inline efêmeros via terminal (ex: `node -e "..."`) sem salvar arquivos residuais no disco.
- **PROIBIDO RODAR A SUÍTE COMPLETA:** NUNCA execute `npm test` indiscriminadamente. Se houver um teste pontual estritamente necessário para validar a geração de URLs ou embeds, execute apenas o arquivo específico diretamente.
- Foque 100% na implementação sólida, limpa e funcional do código do bot e da integração WebRTC, sem burocracia de testes artificiais.