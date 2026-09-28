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

## Fora do escopo atual

- diagnóstico clínico;
- marketplace;
- ranking público;
- gamificação competitiva.

Este arquivo registra apenas o estado e as prioridades atuais. O histórico de decisões permanece no Git.
