# Backoffice — VagaSaúde

Documento de apoio ao [`PLANO.md`](./PLANO.md). Define o painel privado usado
por um único administrador para gerir vagas, fontes, scrapers, taxonomias,
alertas e operação da plataforma.

---

## 1. Âmbito e acesso

O backoffice faz parte da aplicação Next.js e fica disponível em `/admin`.
Não é necessário criar uma segunda aplicação ou subdomínio.

Como existe apenas um administrador:

- o email autorizado é definido em `ADMIN_EMAIL`;
- a autenticação é feita por *magic link* enviado pelo Resend;
- o acesso a `/admin/*` é adicionalmente protegido pelo Cloudflare Access;
- não existe RBAC, gestão de equipas ou convite de administradores no MVP;
- todas as ações destrutivas exigem confirmação e ficam no registo de auditoria.

O backoffice nunca deve depender apenas de uma URL difícil de adivinhar.

---

## 2. Navegação

```text
/admin
├── Visão geral
├── Vagas
│   ├── Publicadas
│   ├── Em revisão
│   ├── Ocultas
│   ├── Expiradas
│   └── Duplicadas
├── Fontes
├── Execuções dos scrapers
├── Taxonomias
│   ├── Profissões
│   ├── Distritos e concelhos
│   └── Tipos de contrato
├── Alertas e subscritores
├── Auditoria
└── Sistema
```

---

## 3. Dashboard

Indicadores essenciais:

- vagas ativas, novas hoje, expiradas e pendentes de revisão;
- vagas por fonte, profissão, distrito e setor;
- última execução e estado de cada scraper;
- alertas ativos e emails enviados/falhados;
- estado da aplicação, PostgreSQL, backups e espaço em disco.

O dashboard privilegia informação operacional. Métricas comerciais avançadas
ficam fora do MVP.

---

## 4. Gestão de vagas

O administrador pode:

- pesquisar e filtrar por estado, fonte, profissão, distrito, setor e data;
- abrir, editar e pré-visualizar uma vaga;
- criar uma vaga manualmente;
- ocultar, republicar, expirar ou eliminar;
- executar ações em massa;
- comparar e resolver potenciais duplicados;
- corrigir profissão, localização, contrato e outros dados normalizados;
- abrir a publicação original.

### Estados

| Estado | Significado |
|---|---|
| `published` | Vaga válida e visível publicamente |
| `pending_review` | Dados incompletos ou suspeitos; exige revisão |
| `hidden` | Ocultada manualmente |
| `expired` | Prazo terminado ou removida da fonte |
| `duplicate` | Duplicada de outra vaga |

---

## 5. Publicação automática

```text
Fonte
  ↓
Scraper
  ↓
Validação → normalização → deduplicação
  ├── válida e completa → published
  ├── incompleta/suspeita → pending_review
  └── duplicada → duplicate
```

Uma vaga é publicada automaticamente quando:

- possui título, entidade, localização, descrição e URL válidos;
- a profissão e o setor podem ser normalizados;
- não corresponde a um duplicado;
- a data de expiração não está no passado;
- a fonte está ativa e autorizada para publicação automática.

---

## 6. Fontes e scrapers

Por fonte é possível:

- ativar ou desativar a recolha;
- permitir ou suspender a publicação automática;
- consultar URL, frequência, última execução e último erro;
- executar manualmente;
- consultar o histórico de execuções;
- ver vagas criadas, atualizadas, ignoradas e rejeitadas.

Cada execução cria um `ScraperRun` com datas, estado, contadores e mensagem de
erro. A execução manual é assíncrona e não mantém o pedido web aberto.

---

## 7. Alertas e GDPR

O administrador pode:

- pesquisar um subscritor por email;
- consultar alertas, estado de confirmação e último envio;
- desativar um alerta;
- reenviar confirmação quando solicitado;
- apagar integralmente os dados do subscritor;
- consultar entregas e falhas sem expor conteúdo sensível desnecessário.

Não existe acesso às caixas de correio nem armazenamento de palavras-passe.

---

## 8. Auditoria

Registar:

- data e hora;
- ação;
- entidade e identificador afetados;
- resumo dos valores anteriores e novos;
- IP e agente do utilizador quando apropriado.

Mesmo com um único administrador, isto ajuda a diagnosticar alterações
acidentais. Tokens, segredos e dados sensíveis nunca entram no registo.

---

## 9. Segurança

- Cloudflare Access antes da aplicação.
- Autorização verificada no servidor em todas as rotas e Server Actions.
- Cookies `HttpOnly`, `Secure` e `SameSite=Lax`.
- *Magic links* de utilização única, com prazo curto.
- CSRF, rate limiting e validação Zod.
- Segredos apenas no ambiente do servidor.
- Confirmação explícita para eliminação e ações em massa.
- Dependências e imagens Docker atualizadas regularmente.

---

## 10. Fora do MVP

- equipas e diferentes níveis de permissão;
- portal para empregadores;
- aprovação manual obrigatória de todas as vagas;
- edição visual de emails;
- analytics comerciais avançados;
- aplicação móvel administrativa.
