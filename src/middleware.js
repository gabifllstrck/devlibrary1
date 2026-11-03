const jwt = require('jsonwebtoken');
const db = require('./db');

// Envolve rotas async para que erros caiam no tratador de erros do Express
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Erro "esperado" com código HTTP (ex.: 400 validação, 409 conflito)
class HttpError extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

// Exige login: lê o token do cabeçalho "Authorization: Bearer <token>"
const autenticar = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Faça login para continuar.');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw new HttpError(401, 'Sessão expirada. Faça login novamente.'); }
  const [rows] = await db.query(
    'SELECT id_usuario, nome, email, telefone, perfil FROM usuarios WHERE id_usuario = ?', [payload.id]);
  if (!rows.length) throw new HttpError(401, 'Usuário não encontrado. Faça login novamente.');
  req.usuario = rows[0]; // perfil sempre vem do banco (se mudar, vale na hora)
  next();
});

// Exige perfil de bibliotecário (use depois de "autenticar")
const exigirBibliotecario = (req, res, next) => {
  if (req.usuario.perfil !== 'bibliotecario') {
    return next(new HttpError(403, 'Acesso restrito a bibliotecários.'));
  }
  next();
};

// Converte para inteiro positivo ou lança erro 400
const idValido = (valor, nome = 'id') => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${nome} inválido.`);
  return n;
};

module.exports = { asyncHandler, HttpError, autenticar, exigirBibliotecario, idValido };
