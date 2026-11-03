const express = require('express');
const db = require('../db');
const { asyncHandler, HttpError, autenticar, exigirBibliotecario, idValido } = require('../middleware');

const router = express.Router();

// Subconsultas reutilizadas na listagem e no detalhe
const CAMPOS_LIVRO = `
  l.id_livro, l.titulo, l.ano, l.isbn, l.sinopse, l.id_categoria, c.nome AS categoria,
  (SELECT GROUP_CONCAT(a.nome ORDER BY a.nome SEPARATOR ', ')
     FROM livro_autor la JOIN autores a ON a.id_autor = la.id_autor
     WHERE la.id_livro = l.id_livro) AS autores,
  (SELECT COUNT(*) FROM exemplares e WHERE e.id_livro = l.id_livro) AS total_exemplares,
  (SELECT COUNT(*) FROM exemplares e WHERE e.id_livro = l.id_livro AND e.status = 'disponivel') AS disponiveis,
  (SELECT ROUND(AVG(av.nota), 1) FROM avaliacoes av WHERE av.id_livro = l.id_livro) AS media_nota,
  (SELECT COUNT(*) FROM avaliacoes av WHERE av.id_livro = l.id_livro) AS total_avaliacoes,
  (SELECT COUNT(*) FROM reservas r WHERE r.id_livro = l.id_livro AND r.status = 'ativa') AS reservas_ativas`;

// ---- validação e gravação (usadas por POST e PUT) ----
function validarLivro(body) {
  const titulo = String(body.titulo || '').trim();
  const isbn = String(body.isbn || '').trim() || null;
  const sinopse = String(body.sinopse || '').trim() || null;
  const ano = body.ano === '' || body.ano == null ? null : Number(body.ano);
  const id_categoria = Number(body.id_categoria);
  let autores = body.autores;
  if (typeof autores === 'string') autores = autores.split(',');
  autores = [...new Set((autores || []).map((a) => String(a).trim()).filter(Boolean))];

  if (titulo.length < 1 || titulo.length > 150) throw new HttpError(400, 'Informe o título (até 150 caracteres).');
  if (ano !== null && (!Number.isInteger(ano) || ano < 1000 || ano > 2100)) throw new HttpError(400, 'Ano inválido (use entre 1000 e 2100).');
  if (isbn && isbn.length > 20) throw new HttpError(400, 'ISBN muito longo (máximo 20 caracteres).');
  if (!Number.isInteger(id_categoria) || id_categoria <= 0) throw new HttpError(400, 'Escolha uma categoria.');
  if (!autores.length) throw new HttpError(400, 'Informe pelo menos um autor (separe vários por vírgula).');
  if (autores.some((a) => a.length > 100)) throw new HttpError(400, 'Nome de autor muito longo.');
  return { titulo, isbn, sinopse, ano, id_categoria, autores };
}

async function gravarAutores(conn, id_livro, autores) {
  await conn.query('DELETE FROM livro_autor WHERE id_livro = ?', [id_livro]);
  for (const nome of autores) {
    await conn.query('INSERT IGNORE INTO autores (nome) VALUES (?)', [nome]);
    const [[a]] = await conn.query('SELECT id_autor FROM autores WHERE nome = ?', [nome]);
    await conn.query('INSERT IGNORE INTO livro_autor (id_livro, id_autor) VALUES (?, ?)', [id_livro, a.id_autor]);
  }
}

async function criarExemplares(conn, id_livro, quantidade) {
  const [[m]] = await conn.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(codigo, '-', -1) AS UNSIGNED)), 0) AS ultimo
     FROM exemplares WHERE id_livro = ?`, [id_livro]);
  for (let i = 1; i <= quantidade; i++) {
    const codigo = `LIV${id_livro}-${String(m.ultimo + i).padStart(2, '0')}`;
    await conn.query('INSERT INTO exemplares (id_livro, codigo, status) VALUES (?, ?, ?)', [id_livro, codigo, 'disponivel']);
  }
}

function tratarErroLivro(e) {
  if (e.code === 'ER_DUP_ENTRY') return new HttpError(409, 'Já existe um livro com este ISBN.');
  if (e.code === 'ER_NO_REFERENCED_ROW_2') return new HttpError(400, 'Categoria inexistente.');
  return e;
}

async function comTransacao(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// GET /api/livros?q=texto&categoria=ID&disponivel=1   (público)
router.get('/', asyncHandler(async (req, res) => {
  const where = [];
  const params = [];
  const q = String(req.query.q || '').trim();
  if (q) {
    const like = `%${q}%`;
    where.push(`(l.titulo LIKE ? OR l.isbn LIKE ? OR l.sinopse LIKE ?
      OR EXISTS (SELECT 1 FROM livro_autor la JOIN autores a ON a.id_autor = la.id_autor
                 WHERE la.id_livro = l.id_livro AND a.nome LIKE ?))`);
    params.push(like, like, like, like);
  }
  if (req.query.categoria) { where.push('l.id_categoria = ?'); params.push(idValido(req.query.categoria, 'categoria')); }
  if (req.query.disponivel === '1') {
    where.push(`EXISTS (SELECT 1 FROM exemplares e WHERE e.id_livro = l.id_livro AND e.status = 'disponivel')`);
  }

  const [rows] = await db.query(
    `SELECT ${CAMPOS_LIVRO} FROM livros l JOIN categorias c ON c.id_categoria = l.id_categoria
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.titulo`, params);
  res.json(rows);
}));

// GET /api/livros/:id (público) -> detalhes + avaliações
router.get('/:id', asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const [rows] = await db.query(
    `SELECT ${CAMPOS_LIVRO} FROM livros l JOIN categorias c ON c.id_categoria = l.id_categoria WHERE l.id_livro = ?`, [id]);
  if (!rows.length) throw new HttpError(404, 'Livro não encontrado.');
  const [avaliacoes] = await db.query(
    `SELECT av.id_avaliacao, av.id_usuario, av.nota, av.comentario, av.data_avaliacao, u.nome AS usuario
     FROM avaliacoes av JOIN usuarios u ON u.id_usuario = av.id_usuario
     WHERE av.id_livro = ? ORDER BY av.data_avaliacao DESC`, [id]);
  res.json({ ...rows[0], avaliacoes });
}));

// POST /api/livros (bibliotecário) -> cria o livro, os autores e os exemplares
router.post('/', autenticar, exigirBibliotecario, asyncHandler(async (req, res) => {
  const d = validarLivro(req.body);
  const qtd = req.body.exemplares === '' || req.body.exemplares == null ? 1 : Number(req.body.exemplares);
  if (!Number.isInteger(qtd) || qtd < 0 || qtd > 50) throw new HttpError(400, 'Quantidade de exemplares deve ser de 0 a 50.');
  try {
    const id = await comTransacao(async (conn) => {
      const [r] = await conn.query(
        'INSERT INTO livros (titulo, ano, isbn, sinopse, id_categoria) VALUES (?, ?, ?, ?, ?)',
        [d.titulo, d.ano, d.isbn, d.sinopse, d.id_categoria]);
      await gravarAutores(conn, r.insertId, d.autores);
      await criarExemplares(conn, r.insertId, qtd);
      return r.insertId;
    });
    res.status(201).json({ id_livro: id });
  } catch (e) { throw tratarErroLivro(e); }
}));

// PUT /api/livros/:id (bibliotecário)
router.put('/:id', autenticar, exigirBibliotecario, asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const d = validarLivro(req.body);
  try {
    await comTransacao(async (conn) => {
      const [r] = await conn.query(
        'UPDATE livros SET titulo=?, ano=?, isbn=?, sinopse=?, id_categoria=? WHERE id_livro=?',
        [d.titulo, d.ano, d.isbn, d.sinopse, d.id_categoria, id]);
      if (!r.affectedRows) throw new HttpError(404, 'Livro não encontrado.');
      await gravarAutores(conn, id, d.autores);
    });
    res.json({ ok: true });
  } catch (e) { throw tratarErroLivro(e); }
}));

// DELETE /api/livros/:id (bibliotecário) -> só se nunca foi emprestado (preserva o histórico)
router.delete('/:id', autenticar, exigirBibliotecario, asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const [[uso]] = await db.query(
    `SELECT COUNT(*) AS n FROM emprestimos em JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar WHERE ex.id_livro = ?`, [id]);
  if (uso.n > 0) throw new HttpError(409, 'Este livro possui histórico de empréstimos e não pode ser excluído. Marque os exemplares como indisponíveis.');
  const [r] = await db.query('DELETE FROM livros WHERE id_livro = ?', [id]);
  if (!r.affectedRows) throw new HttpError(404, 'Livro não encontrado.');
  res.json({ ok: true });
}));

// GET /api/livros/:id/exemplares (bibliotecário)
router.get('/:id/exemplares', autenticar, exigirBibliotecario, asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const [rows] = await db.query('SELECT id_exemplar, codigo, status FROM exemplares WHERE id_livro = ? ORDER BY codigo', [id]);
  res.json(rows);
}));

// POST /api/livros/:id/exemplares { quantidade } (bibliotecário)
router.post('/:id/exemplares', autenticar, exigirBibliotecario, asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const qtd = Number(req.body.quantidade);
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > 50) throw new HttpError(400, 'Quantidade deve ser de 1 a 50.');
  const [l] = await db.query('SELECT 1 FROM livros WHERE id_livro = ?', [id]);
  if (!l.length) throw new HttpError(404, 'Livro não encontrado.');
  await comTransacao((conn) => criarExemplares(conn, id, qtd));
  res.status(201).json({ ok: true });
}));

// PUT /api/livros/exemplares/:idExemplar/status { status } (bibliotecário): disponivel <-> indisponivel
router.put('/exemplares/:idExemplar/status', autenticar, exigirBibliotecario, asyncHandler(async (req, res) => {
  const idEx = idValido(req.params.idExemplar);
  const status = req.body.status;
  if (!['disponivel', 'indisponivel'].includes(status)) throw new HttpError(400, 'Status inválido.');
  const [r] = await db.query(
    `UPDATE exemplares SET status = ? WHERE id_exemplar = ? AND status <> 'emprestado'`, [status, idEx]);
  if (!r.affectedRows) throw new HttpError(409, 'Exemplar não encontrado ou está emprestado no momento.');
  res.json({ ok: true });
}));

// POST /api/livros/:id/avaliacoes { nota, comentario } (usuário logado) -> cria ou atualiza a sua avaliação
router.post('/:id/avaliacoes', autenticar, asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const nota = Number(req.body.nota);
  const comentario = String(req.body.comentario || '').trim() || null;
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new HttpError(400, 'A nota deve ser de 1 a 5.');
  if (comentario && comentario.length > 500) throw new HttpError(400, 'O comentário pode ter até 500 caracteres.');
  const [l] = await db.query('SELECT 1 FROM livros WHERE id_livro = ?', [id]);
  if (!l.length) throw new HttpError(404, 'Livro não encontrado.');
  await db.query(
    `INSERT INTO avaliacoes (id_usuario, id_livro, nota, comentario) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE nota = VALUES(nota), comentario = VALUES(comentario), data_avaliacao = CURRENT_TIMESTAMP`,
    [req.usuario.id_usuario, id, nota, comentario]);
  res.status(201).json({ ok: true });
}));

module.exports = router;
