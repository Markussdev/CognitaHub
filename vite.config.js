const { resolve } = require('path')

module.exports = {
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),

        login: resolve(__dirname, 'pages/login.html'),
        cadastro: resolve(__dirname, 'pages/cadastro.html'),
        cadastroTutor: resolve(__dirname, 'pages/cadastro-tutor.html'),
        cadastroResponsavel: resolve(__dirname, 'pages/cadastro-responsavel.html'),

        admin: resolve(__dirname, 'pages/admin.html'),
        tutor: resolve(__dirname, 'pages/tutor.html'),
        responsavel: resolve(__dirname, 'pages/responsavel.html'),

        atividades: resolve(__dirname, 'pages/atividades.html'),
        perfilCrianca: resolve(__dirname, 'pages/perfil-crianca.html'),
      },
    },
  },
}