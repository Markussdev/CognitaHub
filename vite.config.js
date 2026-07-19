const { resolve } = require('path')

module.exports = {
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),

        login: resolve(__dirname, 'pages/login.html'),
        cadastro: resolve(__dirname, 'pages/cadastro.html'),
        comoFunciona: resolve(__dirname, 'pages/como-funciona.html'),
        paraFamilias: resolve(__dirname, 'pages/para-familias.html'),
        paraTutores: resolve(__dirname, 'pages/para-tutores.html'),
        seguranca: resolve(__dirname, 'pages/seguranca.html'),
        cadastroTutor: resolve(__dirname, 'pages/cadastro-tutor.html'),
        cadastroResponsavel: resolve(__dirname, 'pages/cadastro-responsavel.html'),

        admin: resolve(__dirname, 'pages/admin.html'),
        tutor: resolve(__dirname, 'pages/tutor.html'),
        trilha: resolve(__dirname, 'pages/trilha.html'),
        builderJornada: resolve(__dirname, 'pages/builder-jornada.html'),
        appCrianca: resolve(__dirname, 'pages/app-crianca.html'),
        responsavel: resolve(__dirname, 'pages/responsavel.html'),

        atividades: resolve(__dirname, 'pages/atividades.html'),
        perfilCrianca: resolve(__dirname, 'pages/perfil-crianca.html'),
        modoCrianca: resolve(__dirname, 'pages/modo-crianca.html'),
      },
    },
  },
}
