# Roadmap — Cognita Hub

Última revisão: 3 de setembro de 2026.

## Estado atual

### Implementado

- autenticação de responsável e tutor;
- confirmação de e-mail e controle de acesso por papel;
- cadastro de crianças e perfil de aprendizagem;
- candidatura e aprovação de tutores;
- painel administrativo;
- match entre tutor e criança;
- ciclos de acompanhamento;
- registro de sessões e execuções;
- catálogo e preparação de atividades;
- trilhas e jornadas personalizadas;
- progresso por módulos e missões;
- experiência infantil;
- autenticação anônima infantil;
- pareamento e revogação de dispositivos;
- personalização de nome e avatar infantil;
- documentos e aceites legais.

## Prioridades atuais

1. Estabilizar e consolidar o fluxo infantil.
2. Melhorar a experiência visual e a clareza da jornada.
3. Validar o uso real com crianças, responsáveis e tutores.
4. Melhorar métricas e visualização de progresso.
5. Reduzir dívida técnica antes de ampliar o escopo.

## Dívida técnica

- criar uma baseline reproduzível em `supabase/migrations/`;
- revisar e remover RPCs antigas quando não houver mais consumidores;
- auditar políticas RLS e permissões `EXECUTE` de funções `SECURITY DEFINER`;
- consolidar implementações paralelas da experiência infantil;
- remover comentários e código legado remanescentes;
- adicionar testes dos fluxos críticos de autenticação, pareamento e progresso;
- manter README e os três documentos de referência sincronizados com o produto.

### Identidade visual (Noite Maracajá): o que ficou para depois

As páginas públicas e de cadastro/login passaram a usar a camada `css/public-noite.css` (ver `docs/decisions/0001-camada-noite-nas-paginas-publicas.md`). Diferenças que **continuam** e foram deixadas de propósito:

- **Telas internas** ainda estão no layout claro: painéis do tutor, do responsável e da administração, Biblioteca (`atividades.html`), perfil da criança, trilha e construtor de jornada, além do app e do modo infantil. Cada uma tem superfície de trabalho e dependências próprias (`css/tutor-shell.css`, `css/cognita-os.css`, `css/internal.css`, `css/app-crianca.css`). Pede revisão própria, tela a tela.
- **CSS duplicado nas telas de entrada:** `login.html`, `cadastro.html` e `cadastro-responsavel.html` repetem o mesmo bloco inline (tokens, cabeçalho, botões), e `tutor-onboarding.css` repete de novo para os dois cadastros de tutor. A camada Noite cobre os quatro sem consolidar nada; unificar é tarefa à parte.
- **Cabeçalho das páginas de entrada:** a logo nova entra por CSS (`::before`) e o HTML antigo (`.public-brand__mark`, `.brand-mark`) continua no DOM, escondido. Limpar o HTML quando essas páginas forem consolidadas.
- **Rodapé repetido:** o fundo do rodapé público é reescrito em `public-noite.css` porque o Vite não garante a ordem entre `public-shell.css` e `brand-surface.css`. Se o rodapé migrar para um componente único, remover a duplicação.
- **Capturas de produto** (`public/assets/public-shots/*.png`) são PNGs opacos de fundo branco; sobre o noite aparecem como cartões claros. Gerar versões com fundo transparente ou já em tema escuro, se quiserem integrá-las melhor.
- **Superfícies claras mantidas por leitura:** cartões de formulário (login e cadastros), folha dos documentos legais, cartões de escolha do cadastro e as telas/celulares desenhados em "Como funciona".
- **Conteúdo não alterado por razões estéticas** (divergências a decidir pela equipe, fora do escopo visual): os Termos de Uso falam em crianças "de 5 a 11 anos" e em contato tutor–família "sempre mediado pela equipe", enquanto `docs/PRODUCT.md` e o README falam em 5 a 9 anos e listam o contato mediador–família como pergunta em aberto; as capturas e a página "Como funciona" usam o nome de exemplo "Mateus", que convém confirmar como fictício.

## Fora do escopo atual

- diagnóstico clínico;
- marketplace;
- ranking público;
- gamificação competitiva.

Este arquivo registra apenas o estado e as prioridades atuais. O histórico de decisões permanece no Git.
