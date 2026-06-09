# Dados Simulados

O MVP estático usa `js/mock-data.js` para centralizar exemplos de responsável, criança, tutor, ciclo, sessão semanal, atividade sugerida e status do acompanhamento.

## Arquivo principal

```text
js/mock-data.js
```

Os dados ficam disponíveis em:

```js
window.cognitaMock
```

## Como usar no HTML

Para preencher texto:

```html
<span data-mock="crianca.nome">João Pereira</span>
```

Para controlar largura de barra de progresso:

```html
<div data-mock-width="ciclo.progressoPercentual" style="width: 33%"></div>
```

Para atualizar atributos de acessibilidade:

```html
<div data-mock-aria="ciclo.progressoTexto" aria-label="33% do ciclo concluído"></div>
```

## Dados cobertos

| Grupo | Exemplos |
|---|---|
| `responsavel` | nome, primeiro nome, email |
| `crianca` | nome, idade, etapa escolar, foco |
| `tutor` | nome, formação, disponibilidade |
| `ciclo` | status, mês atual, progresso, cadastro, match, presenças |
| `sessaoAtual` | dia, horário, formato, tema |
| `atividadeSugerida` | título, descrição, semana |
| `observacaoTutor` | texto e tipo |

No futuro, esses caminhos podem ser preenchidos por dados reais sem reescrever os painéis.
