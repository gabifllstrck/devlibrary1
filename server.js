// DevLibrary - servidor principal (Express)
require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./src/db');

if (!process.env.JWT_SECRET) {
  console.error('ERRO: defina JWT_SECRET no arquivo .env (copie o .env.example para .env).');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/healthz', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'ok' });
  } catch (e) {
    console.error('Verificação de saúde falhou:', e.code || e.message);
    res.status(503).json({ status: 'unavailable' });
  }
});

// ---- API ----
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/usuarios', require('./src/routes/usuarios'));
app.use('/api/categorias', require('./src/routes/categorias'));
app.use('/api/livros', require('./src/routes/livros'));
app.use('/api/emprestimos', require('./src/routes/emprestimos'));
app.use('/api/reservas', require('./src/routes/reservas'));
app.use('/api/relatorios', require('./src/routes/relatorios'));
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// ---- Site (HTML/CSS/JS da pasta public) ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- Tratamento de erros ----
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  if (err.status) return res.status(err.status).json({ erro: err.message });
  if (['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'PROTOCOL_CONNECTION_LOST'].includes(err.code)) {
    console.error('Erro de conexão com o banco:', err.code, err.message);
    return res.status(503).json({ erro: 'Não foi possível conectar ao banco de dados. Verifique o MySQL e o arquivo .env.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, async () => {
  console.log(`DevLibrary rodando em http://localhost:${PORT}`);
  try {
    await db.query('SELECT 1');
    console.log('Conexão com o MySQL: OK');
  } catch (e) {
    console.error('\nATENÇÃO: não consegui conectar ao MySQL ->', e.code || e.message);
    console.error('Confira se o MySQL está ligado e se o .env está correto. (Rode "npm run setup-db" se o banco ainda não existe.)\n');
  }
});
