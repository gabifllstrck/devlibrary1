const express = require('express');
const db = require('../db');
const { asyncHandler, HttpError, autenticar, exigirBibliotecario, idValido } = require('../middleware');

const router = express.Router();
router.use(autenticar);

const DIAS = Number(process.env.DIAS_EMPRESTIMO || 14);
const MAX_ATIVOS = Number(process.env.MAX_EMPRESTIMOS_ATIVOS || 3);

const SELECT_EMPRESTIMO = `
  SELECT em.id_emprestimo, em.id_usuario, u.nome AS usuario, u.email,
         ex.id_exemplar, ex.codigo, l.id_livro, l.titulo,
         em.data_emprestimo, em.data_prevista, em.data_devolucao,
         CASE WHEN em.data_devolucao IS NOT NULL THEN 'devolvido'
              WHEN em.data_prevista < CURDATE() THEN 'atrasado'
              ELSE 'ativo' END AS status,
         CASE WHEN em.data_devolucao IS NULL AND em.data_prevista < CURDATE()
              THEN DATEDIFF(CURDATE(), em.data_prevista) ELSE 0 END AS dias_atraso
  FROM emprestimos em
  JOIN usuarios u   ON u.id_usuario = em.id_usuario
  JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
  JOIN livros l     ON l.id_livro = ex.id_livro`;

// POST /api/emprestimos { id_livro } -> o usuário logado pega um livro emprestado
// Usa TRANSAÇÃO + "FOR UPDATE": se duas pessoas tentarem o mesmo exemplar ao mesmo tempo,
// o banco faz uma esperar a outra terminar. Assim ninguém pega o mesmo exemplar.
router.post('/', asyncHandler(async (req, res) => {
  const id_livro = idValido(req.body.id_livro, 'livro');
  const idUsuario = req.usuario.id_usuario;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [livro] = await conn.query('SELECT titulo FROM livros WHERE id_livro = ?', [id_livro]);
    if (!livro.length) throw new HttpError(404, 'Livro não encontrado.');

    const [[ativos]] = await conn.query(
      'SELECT COUNT(*) AS n FROM emprestimos WHERE id_usuario = ? AND data_devolucao IS NULL', [idUsuario]);
    if (ativos.n >= MAX_ATIVOS) throw new HttpError(409, `Você já atingiu o limite de ${MAX_ATIVOS} empréstimos ao mesmo tempo.`);

    const [[atrasados]] = await conn.query(
      'SELECT COUNT(*) AS n FROM emprestimos WHERE id_usuario = ? AND data_devolucao IS NULL AND data_prevista < CURDATE()', [idUsuario]);
    if (atrasados.n > 0) throw new HttpError(409, 'Você tem livros em atraso. Devolva-os antes de pegar outro.');

    const [[mesmo]] = await conn.query(
      `SELECT COUNT(*) AS n FROM emprestimos em JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
       WHERE em.id_usuario = ? AND ex.id_livro = ? AND em.data_devolucao IS NULL`, [idUsuario, id_livro]);
    if (mesmo.n > 0) throw new HttpError(409, 'Você já está com um exemplar deste livro.');

    // Trava os exemplares disponíveis deste livro até o fim da transação
    const [livres] = await conn.query(
      `SELECT id_exemplar FROM exemplares WHERE id_livro = ? AND status = 'disponivel' ORDER BY id_exemplar FOR UPDATE`, [id_livro]);
    if (!livres.length) throw new HttpError(409, 'Não há exemplares disponíveis. Você pode reservar este livro.');

    // Respeita a fila: exemplares livres podem estar "guardados" para quem reservou antes
    const [[mine]] = await conn.query(
      `SELECT COUNT(*) AS n FROM reservas WHERE id_livro = ? AND id_usuario = ? AND status = 'ativa'`, [id_livro, idUsuario]);
    const [[outros]] = await conn.query(
      `SELECT COUNT(*) AS n FROM reservas WHERE id_livro = ? AND id_usuario <> ? AND status = 'ativa'`, [id_livro, idUsuario]);
    if (mine.n === 0 && outros.n >= livres.length) {
      throw new HttpError(409, 'Os exemplares disponíveis estão reservados para outros leitores.');
    }

    const idExemplar = livres[0].id_exemplar;
    const [r] = await conn.query(
      `INSERT INTO emprestimos (id_usuario, id_exemplar, data_emprestimo, data_prevista)
       VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY))`, [idUsuario, idExemplar, DIAS]);
    await conn.query(`UPDATE exemplares SET status = 'emprestado' WHERE id_exemplar = ?`, [idExemplar]);
    await conn.query(
      `UPDATE reservas SET status = 'atendida' WHERE id_livro = ? AND id_usuario = ? AND status = 'ativa'`, [id_livro, idUsuario]);

    await conn.commit();
    const [rows] = await db.query(`${SELECT_EMPRESTIMO} WHERE em.id_emprestimo = ?`, [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

// GET /api/emprestimos/meus -> histórico completo do usuário logado
router.get('/meus', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `${SELECT_EMPRESTIMO} WHERE em.id_usuario = ? ORDER BY em.data_devolucao IS NOT NULL, em.data_emprestimo DESC, em.id_emprestimo DESC`,
    [req.usuario.id_usuario]);
  res.json(rows);
}));

// GET /api/emprestimos?status=ativo|atrasado|devolvido  (bibliotecário)
router.get('/', exigirBibliotecario, asyncHandler(async (req, res) => {
  const filtros = { ativo: 'em.data_devolucao IS NULL AND em.data_prevista >= CURDATE()',
                    atrasado: 'em.data_devolucao IS NULL AND em.data_prevista < CURDATE()',
                    devolvido: 'em.data_devolucao IS NOT NULL',
                    abertos: 'em.data_devolucao IS NULL' };
  const f = filtros[req.query.status];
  const [rows] = await db.query(
    `${SELECT_EMPRESTIMO} ${f ? 'WHERE ' + f : ''} ORDER BY em.data_devolucao IS NOT NULL, em.data_prevista, em.id_emprestimo DESC LIMIT 300`);
  res.json(rows);
}));

// POST /api/emprestimos/:id/devolver (bibliotecário) -> registra a devolução
router.post('/:id/devolver', exigirBibliotecario, asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT id_exemplar, data_devolucao FROM emprestimos WHERE id_emprestimo = ? FOR UPDATE', [id]);
    if (!rows.length) throw new HttpError(404, 'Empréstimo não encontrado.');
    if (rows[0].data_devolucao) throw new HttpError(409, 'Este empréstimo já foi devolvido.');
    await conn.query('UPDATE emprestimos SET data_devolucao = CURDATE() WHERE id_emprestimo = ?', [id]);
    await conn.query(`UPDATE exemplares SET status = 'disponivel' WHERE id_exemplar = ?`, [rows[0].id_exemplar]);
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

module.exports = router;
