# DevLibrary: sistema web de biblioteca

Projeto de **Análise e Projetos de Sistemas II** (Universidade Cruzeiro do Sul).
Sistema web para cadastrar livros e usuários, controlar empréstimos, devoluções e reservas, e gerar relatórios administrativos.

**Tecnologias:** HTML, CSS e JavaScript (front-end) · Node.js + Express (back-end) · MySQL (banco de dados).

---

## 1. O que você precisa instalar (uma vez só)

| Programa | Para quê | Onde baixar |
|---|---|---|
| **Node.js** (versão LTS, 18 ou mais nova) | Roda o servidor | nodejs.org |
| **MySQL Server 8** + **MySQL Workbench** | Banco de dados e a ferramenta gráfica | dev.mysql.com/downloads/installer (escolha "Developer Default") |

Durante a instalação do MySQL, anote a **senha do usuário `root`**: você vai usá-la no passo 4.

Para conferir que o Node foi instalado, abra o **Prompt de Comando** (ou o terminal do VS Code) e digite `node -v`. Deve aparecer algo como `v22.x.x`.

## 2. Colocar o projeto no computador

1. Extraia o arquivo `devlibrary.zip` em uma pasta (por exemplo, `C:\projetos\devlibrary`).
2. Abra o terminal **dentro dessa pasta** (no VS Code: *File > Open Folder* e depois *Terminal > New Terminal*).

## 3. Instalar as dependências

```bash
npm install
```

Isso baixa as bibliotecas (express, mysql2, bcryptjs, jsonwebtoken, dotenv) para a pasta `node_modules`. Pode demorar um minuto.

## 4. Configurar a conexão com o banco (arquivo `.env`)

1. Copie o arquivo `.env.example` e dê à cópia o nome **`.env`**.
   - Windows (Prompt de Comando): `copy .env.example .env`
   - Mac/Linux: `cp .env.example .env`
2. Abra o `.env` e troque `coloque_sua_senha_do_mysql_aqui` pela senha do `root` que você criou na instalação do MySQL.
3. Troque também o `JWT_SECRET` por qualquer frase longa e secreta.

> O `.env` guarda senhas. Ele **não** vai para o GitHub (já está no `.gitignore`).

## 5. Criar o banco de dados e os dados de teste

```bash
npm run setup-db
```

Resultado esperado:

```
Executando schema.sql ...
Executando seed.sql ...
Banco "devlibrary" criado com sucesso!
```

Esse comando executa `database/schema.sql` (cria o banco e as 9 tabelas) e `database/seed.sql` (livros, autores, usuários e movimentações **fictícias**). Pode rodar de novo quando quiser: ele recria tudo do zero.

### Alternativa: criar o banco pelo MySQL Workbench (interface gráfica)

1. Abra o **MySQL Workbench** e clique na conexão **Local instance MySQL80**. Digite a senha do `root`.
2. Menu **File > Open SQL Script...** e escolha `database/schema.sql`.
3. Clique no **raio** (⚡ *Execute*). As tabelas são criadas.
4. Repita os passos 2 e 3 com `database/seed.sql`.
5. Para conferir, execute `USE devlibrary; SELECT * FROM livros;`. Devem aparecer 14 livros.
6. Na pasta `database/` há também `consultas.sql`, com exemplos de SELECT para praticar.

## 6. Iniciar o sistema

```bash
npm start
```

Resultado esperado:

```
DevLibrary rodando em http://localhost:3000
Conexão com o MySQL: OK
```

Abra **http://localhost:3000** no navegador. Pronto, o site está no ar. Para parar o servidor, pressione `Ctrl + C` no terminal.

## Publicar na internet com Render

O arquivo `render.yaml` configura o serviço web do Render. Como o Render não fornece MySQL gerenciado, use um MySQL externo acessível pela internet e com TLS habilitado.

1. Crie um repositório GitHub seu e envie o projeto, sem a pasta `node_modules` e sem o arquivo `.env` (ambos estão no `.gitignore`).
2. No Render, crie um **Blueprint** e conecte esse repositório. O Render usará `render.yaml` para criar o serviço.
3. Configure no Render as variáveis solicitadas `DB_HOST`, `DB_USER` e `DB_PASSWORD` com os dados do seu MySQL. Mantenha `DB_PORT=3306`, `DB_NAME=devlibrary` (ou ajuste ao nome do banco) e `DB_SSL=true`. O `JWT_SECRET` é gerado pelo Blueprint; não use o valor de exemplo do `.env.example`.
4. No provedor MySQL, crie um banco vazio chamado `devlibrary` e permita a conexão de saída do Render. Se o provedor fornecer um certificado CA, configure `DB_SSL_CA` nas variáveis privadas do Render. Se o banco tiver outro nome, ajuste `DB_NAME` no Render e as instruções `CREATE DATABASE`/`USE` nos dois arquivos SQL antes de executá-los.
5. Execute `database/schema.sql` **uma única vez em um banco vazio**: esse script apaga e recria as tabelas. Depois execute `database/seed-public.sql` para cadastrar os livros e exemplares sem criar contas de teste. Não execute `database/seed.sql` em produção: ele inclui contas com senha conhecida (`123456`).
6. Abra o endereço público exibido pelo Render. Para habilitar a área administrativa, crie sua conta pelo site e, no MySQL, promova somente esse e-mail: `UPDATE usuarios SET perfil = 'bibliotecario' WHERE email = 'SEU_EMAIL';`.

O endpoint `/healthz` verifica a conexão com o banco e é usado pelo Render para validar o serviço. O site só ficará público depois de conectar o repositório, preencher as variáveis e liberar o acesso ao MySQL.

## 7. Contas de teste (senha de todas: `123456`)

| Perfil | E-mail |
|---|---|
| Bibliotecária (administradora) | bibliotecaria@devlibrary.com |
| Leitor | leitor@devlibrary.com |
| Leitora | camila@devlibrary.com |

Quem se cadastra pelo site sempre vira **leitor**. Apenas um bibliotecário pode promover outro usuário (Painel > Usuários).

---

## 8. Funcionalidades (e de onde vieram)

| Funcionalidade | Origem no documento do projeto |
|---|---|
| Cadastro com e-mail e senha, login | Backlog do Trello e caso de uso "Fazer Login" |
| Consultar categorias | Caso de uso "Consultar Categorias de Livros" |
| Pesquisar por título, autor, categoria ou palavra-chave; ver detalhes | Caso de uso "Pesquisar e Visualizar Livros" e Trello |
| Reservar livro online, com fila | Caso de uso "Reservar Livro" |
| Pegar livro emprestado, prazo e limite | Caso de uso "Pegar Livro Emprestado" e Trello |
| Avaliar livro (nota de 1 a 5 e comentário) | Caso de uso "Avaliar Livro" |
| Perfil do usuário: dados, empréstimos, reservas e histórico | Trello ("API de perfil do usuário") |
| Bibliotecário: cadastrar, editar e excluir livros; gerenciar exemplares | Casos de uso "Administrar Acervo" e "Gerenciar Livros Disponíveis" |
| Bibliotecário: ver empréstimos em aberto e atrasados, registrar devoluções | Casos de uso "Gerenciar Livros Emprestados" e "Registrar Livros Entregues" |
| Relatórios administrativos | Resumo do projeto |
| API para listar livros (`GET /api/livros`) | Trello |
| Site responsivo (computador, tablet e celular) | Requisito do prompt |

**Não implementado:** *login social com Google*. Está só no *To Do* do Trello e exige criar credenciais no Google Cloud (Client ID), que dependem da sua conta. A estrutura de login (JWT) já está pronta para receber essa etapa depois.

## 9. Regras de negócio

- Prazo de empréstimo: **14 dias** (`DIAS_EMPRESTIMO` no `.env`).
- Máximo de **3 empréstimos** ao mesmo tempo (`MAX_EMPRESTIMOS_ATIVOS` no `.env`).
- Quem tem livro **atrasado** não pega outro até devolver.
- **Dois usuários nunca pegam o mesmo exemplar**: o empréstimo roda numa *transação* com `SELECT ... FOR UPDATE`, que trava o exemplar até a gravação terminar.
- **Reserva** só é possível quando não há exemplar livre. Quando um exemplar é devolvido, ele fica guardado para quem está na fila (a pessoa vê "Já há exemplar para você!" no perfil).
- Livros com **histórico de empréstimos não podem ser excluídos** (preserva o histórico). Use "Marcar indisponível" no exemplar.
- Senhas são guardadas com **bcrypt** (nunca em texto puro). O login usa **JWT** e o perfil do usuário é conferido no banco a cada requisição.

## 10. Estrutura de pastas

```
devlibrary/
├── server.js               Inicia o servidor, liga as rotas e trata erros
├── package.json            Dependências e comandos (npm start, npm run setup-db, npm test)
├── .env.example            Modelo de configuração (copie para .env)
├── database/
│   ├── schema.sql          CREATE DATABASE + 9 tabelas, chaves, CHECK, índices
│   ├── seed.sql            Dados fictícios de teste
│   └── consultas.sql       Consultas SQL de exemplo, explicadas
├── scripts/
│   ├── setup-db.js         Roda schema.sql + seed.sql
│   └── smoke-test.js       Teste automático da API (34 verificações)
├── src/
│   ├── db.js               Conexão (pool) com o MySQL
│   ├── middleware.js       Login obrigatório, permissão de bibliotecário, erros
│   └── routes/             auth, usuarios, categorias, livros, emprestimos, reservas, relatorios
└── public/                 O site
    ├── index.html
    ├── css/style.css
    └── js/app.js           Telas, rotas (#/catalogo, #/livro/1, #/admin...) e chamadas à API
```

## 11. Banco de dados (DER resumido)

```
 categorias 1 ───< livros >───< autores        (livros e autores: N:N via livro_autor)
                    │ 1
                    ^ N
                exemplares (cópias físicas; status: disponivel / emprestado / indisponivel)
                    │ 1
                    ^ N
 usuarios 1 ───< emprestimos       (data_devolucao NULL = ainda com o leitor)
    ├───────< reservas              (status: ativa / atendida / cancelada)
    └───────< avaliacoes            (uma por usuário por livro: UNIQUE)
```

Por que o navegador não acessa o MySQL direto? Porque o JavaScript do navegador é público: qualquer pessoa poderia ver a senha do banco e apagar dados. Por isso o navegador só chama a **API** (`/api/...`); o servidor Node guarda a senha no `.env`, valida os dados, confere as permissões e só então consulta o banco.

## 12. API (resumo)

| Método e rota | Quem acessa | O que faz |
|---|---|---|
| `POST /api/auth/cadastro`, `POST /api/auth/login`, `GET /api/auth/me` | todos / logado | Conta e sessão |
| `GET /api/livros?q=&categoria=&disponivel=1`, `GET /api/livros/:id` | todos | Catálogo e detalhes |
| `POST/PUT/DELETE /api/livros...`, `/api/livros/:id/exemplares` | bibliotecário | Gerenciar acervo |
| `POST /api/livros/:id/avaliacoes` | logado | Avaliar |
| `GET /api/categorias` · `POST/PUT/DELETE /api/categorias` | todos · bibliotecário | Categorias |
| `POST /api/emprestimos`, `GET /api/emprestimos/meus` | logado | Pegar livro e ver os meus |
| `GET /api/emprestimos`, `POST /api/emprestimos/:id/devolver` | bibliotecário | Controle e devolução |
| `POST /api/reservas`, `GET /api/reservas/minhas`, `DELETE /api/reservas/:id` | logado | Reservas |
| `GET /api/reservas`, `GET /api/usuarios`, `PUT /api/usuarios/:id/perfil`, `GET /api/relatorios/resumo` | bibliotecário | Administração |
| `PUT /api/usuarios/me` | logado | Editar o próprio perfil |

## 13. Testes

Com o servidor rodando (`npm start`), abra **outro terminal** na pasta do projeto e execute:

```bash
npm test
```

Ele verifica cadastro, login, pesquisa, permissões, CRUD de livros, empréstimo simultâneo do último exemplar, reservas, devoluções e atrasos. Deve terminar com `34 passaram, 0 falharam`. (O teste cria alguns registros de teste no banco; para limpar, rode `npm run setup-db`.)

Testes manuais sugeridos para a apresentação: (1) entrar como leitor e pegar um livro; (2) abrir o livro "A Cidade dos Relógios Parados", que está todo emprestado, e reservar; (3) entrar como bibliotecária, registrar a devolução; (4) ver o relatório; (5) abrir o site no celular (ou reduzir a janela) para mostrar o layout responsivo.

## 14. Problemas comuns

| Mensagem | O que fazer |
|---|---|
| `ECONNREFUSED` ou "O MySQL não está ligado" | Abra "Serviços" do Windows e inicie o **MySQL80**. |
| `ER_ACCESS_DENIED_ERROR` | A senha do `.env` (`DB_PASSWORD`) não é a do `root`. Corrija e rode de novo. |
| `ER_BAD_DB_ERROR` (banco desconhecido) | Você ainda não criou o banco. Rode `npm run setup-db`. |
| `'npm' não é reconhecido` | O Node.js não está instalado ou o terminal foi aberto antes da instalação. Feche e abra de novo. |
| `EADDRINUSE` (porta em uso) | Já há um servidor rodando. Feche o outro terminal ou mude `PORT` no `.env`. |
| `ERRO: defina JWT_SECRET` | Você não criou o arquivo `.env` (passo 4). |

## 15. Publicar na internet (opcional)

Serviços como Render ou Railway aceitam projetos Node.js. Você precisará de um MySQL na nuvem, de colocar as variáveis do `.env` no painel do serviço (nunca no código) e de rodar o `schema.sql` e o `seed.sql` nesse banco. Se quiser, eu te ajudo nesse passo.
