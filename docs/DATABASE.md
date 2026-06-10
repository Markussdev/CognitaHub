# Database do MVP

Este documento descreve a base de dados final prevista para o MVP do Cognita Hub. A estrutura foi pensada para um backend futuro com Firestore, mas tambem serve como guia para os dados simulados usados nas telas estaticas.

## Colecoes principais

```text
users
children
learningProfiles
tutorApplications
supportCycles
matches
sessions
activities
progressLogs
reports
adminNotes
consents
```

## users/{userId}

```js
{
  name,
  email,
  role: "guardian" | "tutor" | "admin",
  phone,
  status: "active" | "pending" | "inactive",
  createdAt
}
```

Guarda os dados basicos de acesso e identificacao dos usuarios do sistema.

## children/{childId}

```js
{
  guardianId,
  name,
  age,
  schoolYear,
  hasFormalDiagnosis: true | false | "not_informed",
  mainDifficulties,
  learningPreferences,
  interests,
  sensoryNotes,
  routineNotes,
  status: "waiting" | "matched" | "active" | "completed",
  createdAt
}
```

Representa a crianca cadastrada pelo responsavel e sua situacao dentro do fluxo do hub.

## consents/{consentId}

```js
{
  guardianId,
  childId,
  dataUseAccepted,
  contactAccepted,
  imageUseAccepted,
  termsVersion,
  acceptedAt
}
```

Registra o consentimento do responsavel para uso de dados, contato e imagem da crianca quando aplicavel.

## learningProfiles/{profileId}

```js
{
  childId,
  preferredFormats: ["visual", "concrete", "step_by_step"],
  attentionSpan: "short" | "medium" | "unknown",
  mathDifficulties: ["counting", "addition", "quantity_comparison"],
  strengths,
  motivators,
  avoidances,
  updatedAt
}
```

Concentra o perfil pedagogico inicial usado para orientar tutor, atividades e acompanhamento.

## tutorApplications/{applicationId}

```js
{
  tutorId,
  formation,
  linkedin,
  experience,
  weeklyAvailability,
  status: "pending" | "approved" | "rejected",
  reviewedBy,
  reviewedAt
}
```

Guarda a candidatura do tutor voluntario e o status da validacao manual pela equipe.

## supportCycles/{cycleId}

```js
{
  childId,
  tutorId,
  startDate,
  endDate,
  currentMonth: 1,
  status: "planned" | "active" | "completed" | "paused",
  mainGoal,
  currentPlan
}
```

Define o ciclo de acompanhamento educacional entre crianca e tutor.

## matches/{matchId}

```js
{
  childId,
  tutorId,
  reason,
  compatibility: {
    schedule: true,
    mathFocus: true,
    experience: true
  },
  status: "suggested" | "approved" | "rejected",
  createdAt
}
```

Registra as conexoes sugeridas ou aprovadas entre criancas e tutores.

## sessions/{sessionId}

```js
{
  cycleId,
  childId,
  tutorId,
  date,
  durationMinutes,
  topic,
  activityUsed,
  engagement: 1,
  difficulty: 1,
  result: "improved" | "stable" | "struggled",
  notes,
  nextStep,
  createdAt
}
```

Armazena os registros semanais do tutor durante o ciclo.

## activities/{activityId}

```js
{
  title,
  ageRange,
  mathSkill,
  format: "visual" | "concrete" | "game" | "routine",
  difficultyLevel: 1,
  estimatedMinutes,
  instructions,
  tags
}
```

Organiza atividades sugeridas para pratica entre sessoes.

## progressLogs/{logId}

```js
{
  childId,
  cycleId,
  skill,
  previousLevel,
  currentLevel,
  evidence,
  source: "session" | "report" | "guardian_feedback",
  createdAt
}
```

Registra pequenas evidencias de progresso por habilidade.

## reports/{reportId}

```js
{
  cycleId,
  childId,
  tutorId,
  month,
  summary,
  progress,
  difficulties,
  recommendations,
  createdAt
}
```

Resume o acompanhamento mensal e ajuda a equipe a monitorar o ciclo.

## adminNotes/{noteId}

```js
{
  relatedType: "child" | "tutor" | "cycle" | "match" | "report",
  relatedId,
  authorId,
  note,
  visibility: "internal",
  createdAt
}
```

Guarda anotacoes internas da equipe Cognita sobre analise, match, ciclo ou pendencias.

## Fluxo representado pelos dados

```text
Cadastro recebido
-> equipe analisa
-> tutor validado
-> match criado
-> ciclo iniciado
-> sessoes registradas
-> relatorio mensal gerado
```
