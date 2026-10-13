# Extração privada de PDFs (2026-10-13)

## Implementado
- Upload continua separado. A ação explícita **Extrair texto** faz uma requisição Node limitada (não fila/worker durável); não há OCR no POST de upload nem promessa em background.
- PDF.js local extrai por página; páginas com menos de 12 letras/números passam pelo render local (@napi-rs/canvas, escala 2) e Tesseract.js com modelo português instalado via npm. O critério é heurístico, não uma avaliação semântica de qualidade. OCR pode conter erros; texto nativo significativo não dispara OCR mesmo se a mesma página também contiver uma imagem com texto.
- Documentos somente em stdin/memória/stdout de subprocesso local. Sem arquivo temporário de documento, CDN de modelo, serviço pago, chamada a IA, URL pública/assinada, exposição de instruções ou texto nas respostas API/UI. Modelo e core são locais; cache de traineddata desativado.
- Resultado completo por página (número, método text/ocr, texto) salvo em `agent_document_extractions`, com RLS baseado no documento/organização/agente autorizado. UI e GET selecionam apenas estado/contagens. Não gera embeddings, chunks, busca ou chat.
- Claim único por document_id, token de tentativa e lease de 3 minutos. Conclusão/falha condicionada ao token evita conclusão de tentativa obsoleta. Interrupção do servidor deixa estado processing; usuário pode tentar novamente após lease. Concluído não é reprocessado. Não há retry automático nem garantia de entrega durável.
- Limites: 10 MiB, 30 páginas, raster até 12 milhões de pixels/6000 por dimensão, texto total até 1 milhão de caracteres, stdout até 4 MiB, 120 segundos, heap V8 do filho 384 MiB. Um subprocesso por instância Node; não é quota global/por tenant e memória nativa/WASM não possui limite RSS rígido. Não constitui sandbox/malware scanner.
- Corrompido/protegido, OCR sem texto útil/confiança abaixo de 35 e limite excedido falham; nenhuma extração parcial vira sucesso. PDF com página realmente em branco também falha, intencionalmente, em vez de omitir uma página silenciosamente.

## Prérequisitos e pendências
- Migration anterior `20261013000100_agent_documents.sql`: usuário confirmou aplicação; não verificada remotamente por esta tarefa.
- **Aplicar separadamente** `supabase/migrations/20261013000200_document_extraction.sql`. Não aplicada por esta tarefa. Sem ela upload/lista continuam operando com extraction indisponível.
- Runtime suportado/exercitado: Windows, Node 26.7.0, Next 16.3.8, `npm install` e `npm run dev`/`npm start` na raiz do repositório, com scripts/ e node_modules/ presentes. Python não é dependência de produção.
- Não usar Edge/browser. Deploy serverless com timeout curto/sem child_process ou standalone que omita scripts, modelos e binários nativos não foi validado. Empacotamento futuro precisa outputFileTracingIncludes apropriado e teste no SO alvo; não copiar binários Windows para Linux.
- A autorização/RLS/claim/persistência real e interação autenticada no navegador precisam ser verificadas após migration. Testes de fronteira API/UI são estáticos; extração/OCR é executada, não mockada.
- A requisição de download Storage precede o timeout do subprocesso; o timeout global do host também se aplica.

## Prova sintética executada
`node --test tests/pdf-extraction.test.mjs`: 9 passam. Saída real:
- nativo: PRIVATE TEXT PAGE ALPHA 12345 (method text)
- misto: página 1 native; página 2 SCANNED PAGE BRAVO 67890 (method ocr)
- somente imagem: SCANNED PAGE BRAVO 67890 (method ocr)
- rejeições: corrompido, PDF protegido com senha, página em branco, 31 páginas, dimensões excessivas e timeout.
Fixture protegida foi gerada localmente com pypdf em ambiente uv descartável; senha e conteúdo são sintéticos. Nenhum documento real foi usado.

## Fontes primárias verificadas
- Tesseract.js docs/api.md e src/worker-script/index.js (GitHub e pacote local): createWorker, langPath local, cacheMethod none, terminate. Usar string de idioma com langPath: caminho de inicialização do pacote atual para objetos de idioma usa data em vez de code; teste detectou e corrigimos evitando essa API.
- Mozilla PDF.js examples/node/pdf2png/pdf2png.mjs (GitHub): import legacy/build/pdf.mjs, getDocument e page.render.
- Next docs output (pesquisa oficial) e documentação local node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md: Node route, promise params e tracing de assets.
- Backend web_extract falhou; pesquisa alternativa recuperou fontes oficiais, e docs GitHub atuais foram lidos diretamente por HTTPS. Nenhuma configuração Hermes foi alterada.

## Gates
`node --test tests/*.test.mjs`: 39/39 passam; `npx tsc --noEmit`, `npm run lint`, `npm run build` e `git diff --check` passam após a alteração final. Migration nova parseada localmente com pglast: 10 statements (não prova RLS/execução de função no banco). Build lê o ambiente configurado internamente; .env.local não foi aberto nem inspecionado. npm audit aponta 5 vulnerabilidades high na cadeia pré-existente eslint-config-next/fast-glob/micromatch/braces; nenhuma correção forçada/downgrade fora do escopo. Warnings Node MODULE_TYPELESS_PACKAGE_JSON pré-existentes permanecem. Sem commit/push, upload remoto, credenciais novas ou migração remota.
