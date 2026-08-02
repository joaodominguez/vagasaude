# Design e Identidade Visual — VagaSaúde

Documento de apoio ao [`PLANO.md`](./PLANO.md). Define a direção visual
aprovada para o site público e o backoffice.

---

## 1. Direção

**Personalidade:** moderna, humana, simples e profissional.

O produto deve transmitir confiança sem parecer um portal institucional antigo
ou uma aplicação hospitalar. A interface dá prioridade às vagas e evita
fotografias genéricas de profissionais de saúde.

**Nome visual:** `VagaSaúde`
**Domínio:** `vagasaude.pt`
**Mensagem principal:** “A tua próxima oportunidade na saúde começa aqui.”

---

## 2. Logótipo

Marca combinada:

- símbolo geométrico baseado na letra **V**;
- pequeno sinal **+** integrado de forma subtil;
- `VagaSaúde` em Manrope, com “Saúde” ou o símbolo na cor primária.

O símbolo deve continuar reconhecível como favicon, sem estetoscópios,
corações, cruzes hospitalares dominantes ou detalhes pequenos.

Versões necessárias:

- horizontal, positiva e negativa;
- símbolo isolado;
- monocromática;
- favicon e ícone social.

---

## 3. Paleta

### Modo claro

| Token | Valor | Utilização |
|---|---|---|
| `background` | `#F8FAFC` | fundo da página |
| `surface` | `#FFFFFF` | cartões e painéis |
| `foreground` | `#0F172A` | texto principal |
| `muted` | `#64748B` | texto secundário |
| `primary` | `#0F766E` | botões e ações principais |
| `accent` | `#14B8A6` | destaques discretos |
| `border` | `#E2E8F0` | separadores e contornos |

### Modo escuro

| Token | Valor | Utilização |
|---|---|---|
| `background` | `#07111A` | fundo da página |
| `surface` | `#0F1C29` | cartões e painéis |
| `surface-raised` | `#162536` | painéis elevados |
| `foreground` | `#F8FAFC` | texto principal |
| `muted` | `#94A3B8` | texto secundário |
| `primary` | `#2DD4BF` | ações principais |
| `border` | `#26384A` | separadores e contornos |

Estados semânticos usam verde para sucesso, âmbar para aviso e vermelho para
erro. A cor nunca é o único meio de comunicar um estado.

---

## 4. Tipografia e composição

- **Família:** Manrope, carregada com `next/font`.
- Peso 700 para títulos, 600 para subtítulos e botões, 400/500 para corpo.
- Corpo base de 16 px; mínimo de 14 px apenas em metadados.
- Largura de leitura das descrições limitada a aproximadamente 70 caracteres.
- Escala de espaçamento baseada em 4 px.
- Cartões com raio de 12–16 px, borda fina e sombras mínimas.
- Alvos táteis com pelo menos 44 × 44 px.

---

## 5. Homepage

```text
Cabeçalho
├── Logótipo
├── Procurar vagas
├── Criar alerta
├── Sobre
└── Alternar tema

Hero
├── “A tua próxima oportunidade na saúde começa aqui.”
├── “Todas as vagas de saúde em Portugal num só sítio.”
├── Pesquisa por profissão/palavra-chave
├── Distrito
└── Encontrar vagas

Pesquisas rápidas
Vagas mais recentes
Profissões populares
Bloco de criação de alerta
Como funciona e fontes
Rodapé
```

Em dispositivos móveis, os campos da pesquisa ficam empilhados e o botão
ocupa toda a largura.

---

## 6. Listagem e detalhe

### Listagem

- filtros laterais no desktop;
- painel deslizante de filtros no telemóvel;
- filtros ativos visíveis como chips removíveis;
- cartões compactos com título, entidade, local, setor, contrato e data;
- paginação simples e URLs partilháveis;
- estado vazio com sugestão para criar alerta.

### Detalhe

- título, entidade, localização e etiquetas no topo;
- descrição legível e requisitos bem separados;
- botão “Candidatar no site da entidade” sempre evidente;
- indicação explícita de que a candidatura é externa;
- ação de candidatura fixa no fundo no telemóvel;
- vagas relacionadas e criação de alerta no final.

---

## 7. Backoffice

O backoffice reutiliza os tokens e componentes públicos, com maior densidade:

- navegação lateral recolhível;
- tabelas compactas e responsivas;
- indicadores de estado com ícone, texto e cor;
- ações frequentes junto dos registos;
- confirmação para ações destrutivas;
- modo escuro completo.

---

## 8. Tema e acessibilidade

- tema inicial segue `prefers-color-scheme`;
- alternador no cabeçalho permite `claro`, `escuro` e `sistema`;
- preferência guardada e aplicada antes da renderização para evitar *flash*;
- contraste mínimo WCAG 2.2 AA;
- foco visível, navegação por teclado e labels explícitas;
- suporte a `prefers-reduced-motion`;
- animações curtas e funcionais, sem parallax.

---

## 9. Implementação

- Tailwind CSS com tokens através de variáveis CSS.
- Componentes base acessíveis inspirados no shadcn/ui.
- Ícones Lucide com espessura consistente.
- Storybook é opcional; a página interna `/design-system` pode documentar os
  componentes durante o desenvolvimento e não é exposta em produção.
