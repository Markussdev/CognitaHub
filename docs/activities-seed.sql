-- Seed: habilidades + 4 atividades iniciais
-- Rodar no SQL Editor do Supabase, um bloco por vez.

-- ── 1. Skills ────────────────────────────────────────────────────────────────

insert into public.skills (id, label, sort_order) values
  ('reconhecer-numeros',   'Reconhecer números',       1),
  ('contar-1-1',           'Contar 1:1',                2),
  ('comparar-quantidades', 'Comparar quantidades',      3),
  ('correspondencia',      'Número ↔ quantidade',       4)
on conflict (id) do update set label = excluded.label, sort_order = excluded.sort_order;

-- ── 2. Atividade A1 — Toque no número ────────────────────────────────────────

insert into public.activities (
  slug, title, summary_short, skill_id,
  age_min, age_max, formats, estimated_minutes, level, sensory_load,
  objective, before_start,
  steps, say, avoid,
  if_difficult, if_easy, success_signal, tea_note, status
) values (
  'toque-no-numero',
  'Toque no número',
  'Identifica e nomeia os algarismos de 1 a 10 com apoio visual e toque.',
  'reconhecer-numeros',
  5, 8,
  ARRAY['visual', 'digital'],
  5, 'facil', 'baixa',
  'A criança identifica e nomeia os algarismos de 1 a 10 de forma independente.',
  'Prepare uma tela (tablet ou computador) com números grandes visíveis. Certifique-se de que o ambiente está tranquilo. Se possível, use fones de ouvido para bloquear ruído externo.',
  ARRAY[
    'Mostre o número na tela e diga o nome em voz alta ("Este é o quatro!").',
    'Peça à criança para repetir o nome e tocar o número na tela.',
    'Mude para o próximo número somente quando ela tocar com confiança.',
    'Após 5 números, faça uma rodada de revisão: "Qual é este?".',
    'Celebre cada acerto com um sinal combinado (joinha, bater palmas).'
  ],
  ARRAY[
    'Muito bem! Esse é o número…',
    'Mostre-me onde está o três.',
    'Você conseguiu! Próximo!'
  ],
  ARRAY[
    'Corrigi-la em voz alta na frente de outras pessoas.',
    'Avançar rápido demais sem consolidar o número anterior.',
    'Usar números menores que 60px na tela — ela pode não enxergar bem.'
  ],
  'Reduza para 3 números por sessão. Coloque um adesivo físico com o número ao lado do ecrã como referência.',
  'Inclua números de 11 a 20. Peça para ela escrever o número no ar enquanto o toca.',
  'A criança nomeia o número antes de tocar, sem esperar a sua dica.',
  'Evite temporizador sonoro — o sinal auditivo pode criar ansiedade. Prefira feedback visual (borda verde na tela).',
  'published'
)
on conflict (slug) do update set
  title = excluded.title, summary_short = excluded.summary_short,
  objective = excluded.objective, status = excluded.status;

-- ── 3. Atividade A2 — Conte os dinossauros ───────────────────────────────────

insert into public.activities (
  slug, title, summary_short, skill_id,
  age_min, age_max, formats, estimated_minutes, level, sensory_load,
  objective, before_start,
  steps, say, avoid,
  if_difficult, if_easy, success_signal, tea_note, status
) values (
  'conte-os-dinossauros',
  'Conte os dinossauros',
  'Conta objetos tocando um por vez e informa o total corretamente.',
  'contar-1-1',
  5, 8,
  ARRAY['visual', 'jogo', 'digital'],
  8, 'medio', 'media',
  'A criança conta objetos de 1 em 1, tocando cada item apenas uma vez, e informa o total corretamente.',
  'Use 10 figurinhas de dinossauros (ou qualquer objeto favorito da criança) alinhadas em fileira. Garanta que a superfície está limpa e não tem outros objetos por perto.',
  ARRAY[
    'Coloque 3 dinossauros na fileira. Conte junto com a criança, tocando um por um.',
    'Peça à criança para contar sozinha: "Quantos dinossauros tem?".',
    'Anote o resultado. Se correto, adicione 2 mais e repita.',
    'Se errar, reorganize e conte junto devagar antes de pedir que ela tente.',
    'Siga até 10 objetos ou até a criança demonstrar cansaço.'
  ],
  ARRAY[
    'Um… dois… três! Muito bem!',
    'Agora é a sua vez — conta para mim.',
    'Que número você chegou?'
  ],
  ARRAY[
    'Mexer nos objetos enquanto ela conta.',
    'Passar para um número maior antes de ela acertar o atual 2 vezes seguidas.',
    'Elogiar só o resultado final — elogie também o processo de tocar um por um.'
  ],
  'Reduza para 5 objetos e use cores diferentes para facilitar o rastreio visual. Conte batendo levemente na mesa enquanto toca.',
  'Use dois grupos separados e peça para ela dizer qual tem mais. Integre com "Comparar quantidades".',
  'A criança conta sem pular nem repetir itens e responde o total sem re-contar.',
  'A mudança de objeto (um brinquedo favorito vs. blocos genéricos) pode interromper a concentração. Mantenha o mesmo objeto por toda a sessão.',
  'published'
)
on conflict (slug) do update set
  title = excluded.title, summary_short = excluded.summary_short,
  objective = excluded.objective, status = excluded.status;

-- ── 4. Atividade A3 — Onde tem mais? ─────────────────────────────────────────

insert into public.activities (
  slug, title, summary_short, skill_id,
  age_min, age_max, formats, estimated_minutes, level, sensory_load,
  objective, before_start,
  steps, say, avoid,
  if_difficult, if_easy, success_signal, tea_note, status
) values (
  'onde-tem-mais',
  'Onde tem mais?',
  'Compara dois grupos e responde qual tem mais ou menos.',
  'comparar-quantidades',
  7, 9,
  ARRAY['visual', 'digital'],
  7, 'medio', 'baixa',
  'A criança distingue "mais" e "menos" comparando dois grupos de até 10 elementos.',
  'Prepare pares de imagens ou cartões com grupos de pontos (ex.: 4 pontos vs. 7 pontos). Apresente um par por vez para não sobrecarregar.',
  ARRAY[
    'Mostre dois grupos de pontos lado a lado e pergunte: "Qual tem mais?".',
    'Aguarde a resposta sem ajudar. Se errar, conte juntos e compare.',
    'Mude para um par com diferença menor (ex.: 5 vs. 6) após 3 acertos consecutivos.',
    'Introduza a palavra "menos": "Qual tem menos dinossauros?".',
    'Finalize com um par onde os grupos são iguais — pergunte se é igual.'
  ],
  ARRAY[
    'Conta este grupo… agora conta este. Qual é maior?',
    'E se eu perguntar qual tem menos?',
    'São iguais ou diferentes?'
  ],
  ARRAY[
    'Usar pontos muito pequenos (abaixo de 20px cada).',
    'Apresentar mais de dois grupos ao mesmo tempo.',
    'Perguntar "quanto a mais tem?" sem que ela já domine "qual tem mais".'
  ],
  'Use diferenças de pelo menos 3 entre os grupos. Coloque os objetos fisicamente em duas fileiras para contar com o dedo.',
  'Peça para ela ordenar 3 grupos do menor ao maior. Introduza os sinais > e <.',
  'A criança responde "mais" ou "menos" corretamente sem precisar re-contar, para diferenças de 2 ou mais.',
  'Evite fundo com padrões ou texturas nas imagens — use fundo branco sólido para reduzir distração visual.',
  'published'
)
on conflict (slug) do update set
  title = excluded.title, summary_short = excluded.summary_short,
  objective = excluded.objective, status = excluded.status;

-- ── 5. Atividade A4 — Leve os peixes para o aquário ─────────────────────────

insert into public.activities (
  slug, title, summary_short, skill_id,
  age_min, age_max, formats, estimated_minutes, level, sensory_load,
  objective, before_start,
  steps, say, avoid,
  if_difficult, if_easy, success_signal, tea_note, status
) values (
  'leve-os-peixes',
  'Leve os peixes para o aquário',
  'Associa o numeral escrito à quantidade correta de objetos físicos.',
  'correspondencia',
  5, 8,
  ARRAY['manipulavel', 'jogo', 'digital'],
  12, 'medio', 'media',
  'A criança associa um numeral escrito à quantidade correta de objetos físicos (1:1 com rótulo numérico).',
  'Prepare cartões com os números 1 a 5 e fichas ou figurinhas de peixe (pode ser papel). Separe "aquários" (caixinhas ou círculos no papel) identificados com um número cada.',
  ARRAY[
    'Coloque os aquários numerados na mesa (1, 2 e 3 primeiro).',
    'Mostre uma quantidade de peixes (ex.: 2) e diga: "Esses peixes querem ir para a casa número dois.".',
    'A criança coloca os peixes no aquário com o número correto.',
    'Confirme contando juntos: "Um, dois — certo! O aquário dois tem dois peixes.".',
    'Adicione os números 4 e 5 conforme avança.'
  ],
  ARRAY[
    'Quantos peixes você tem na mão?',
    'Onde fica o aquário com esse número?',
    'Conta os peixes dentro para ver se está certo.'
  ],
  ARRAY[
    'Deixar os cartões misturados na mesa — organize em sequência crescente.',
    'Avançar para 4 e 5 antes de consolidar 1, 2, 3.',
    'Usar objetos muito pequenos que caem e distraem.'
  ],
  'Trabalhe só com 1 e 2. Use dois aquários bem separados no espaço (um perto, um longe) para reforçar a diferença.',
  'Estenda até o número 10. Peça para ela montar o aquário da memória (sem ver o número enquanto pega os peixes).',
  'A criança distribui os peixes corretamente sem contar em voz alta, demonstrando reconhecimento direto.',
  'Se peixes de papel não fizerem sentido, substitua pelo objeto de interesse dela (carrinhos, estrelas). O tema é irrelevante — o vínculo numeral ↔ quantidade é o objetivo.',
  'published'
)
on conflict (slug) do update set
  title = excluded.title, summary_short = excluded.summary_short,
  objective = excluded.objective, status = excluded.status;

-- ── 6. Coluna activity_id em sessions (se ainda não existir) ─────────────────

alter table public.sessions
  add column if not exists activity_id uuid references public.activities(id);
