const express = require('express');
const db = require('../db');
const { asyncHandler, HttpError, autenticar, exigirBibliotecario, idValido } = require('../middleware');

const router = express.Router();
router.use(autenticar);

const SELECT_RESERVA = `
  SELECT r.id_reserva, r.id_usuario, u.nome AS usuario, r.id_livro, l.titulo, r.data_reserva, r.status,
         (SELECT COUNT(*) FROM reservas r2 WHERE r2.id_livro = r.id_livro AND r2.status = 'ativa' AND r2.id_reserva <= r.id_reserva) AS posicao_fila,
         (SELECT COUNT(*) FROM exemplares e WHERE e.id_livro = r.id_livro AND e.status = 'disponivel') AS disponiveis
  FROM reservas r
  JOIN livros l ON l.id_livro = r.id_livro
  JOIN usuarios u ON u.id_usuario = r.id_usuario`;

// POST /api/reservas { id_livro } -> só é possível reservar quando não há exemplar livre para retirar
router.post('/', asyncHandler(async (req, res) => {
  const id_livro = idValido(req.body.id_livro, 'livro');
  const idUsuario = req.usuario.id_usuario;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [livro] = await conn.query('SELECT id_livro FROM livros WHERE id_livro = ? FOR UPDATE', [id_livro]);
    if (!livro.length) throw new HttpError(404, 'Livro não encontrado.');

    const [[ja]] = await conn.query(
      `SELECT COUNT(*) AS n FROM reservas WHERE id_livro = ? AND id_usuario = ? AND status = 'ativa'`, [id_livro, idUsuario]);
    if (ja.n > 0) throw new HttpError(409, 'Você já reservou este livro.');

    const [[comLivro]] = await conn.query(
      `SELECT COUNT(*) AS n FROM emprestimos em JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
       WHERE em.id_usuario = ? AND ex.id_livro = ? AND em.data_devolucao IS NULL`, [idUsuario, id_livro]);
    if (comLivro.n > 0) throw new HttpError(409, 'Você já está com um exemplar deste livro.');

    const [[livres]] = await conn.query(
      `SELECT COUNT(*) AS n FROM exemplares WHERE id_livro = ? AND status = 'disponivel'`, [id_livro]);
    const [[fila]] = await conn.query(
      `SELECT COUNT(*) AS n FROM reservas WHERE id_livro = ? AND status = 'ativa'`, [id_livro]);
    if (livres.n > fila.n) throw new HttpError(409, 'Há exemplar disponível! Faça o empréstimo direto.');

    const [r] = await conn.query('INSERT INTO reservas (id_usuario, id_livro) VALUES (?, ?)', [idUsuario, id_livro]);
    await conn.commit();
    res.status(201).json({ id_reserva: r.insertId });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}));

// GET /api/reservas/minhas
router.get('/minhas', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `${SELECT_RESERVA} WHERE r.id_usuario = ? ORDER BY r.status <> 'ativa', r.data_reserva DESC`, [req.usuario.id_usuario]);
  res.json(rows);
}));

// GET /api/reservas (bibliotecário)
router.get('/', exigirBibliotecario, asyncHandler(async (req, res) => {
  const [rows] = await db.query(`${SELECT_RESERVA} ORDER BY r.status <> 'ativa', r.data_reserva LIMIT 300`);
  res.json(rows);
}));

// DELETE /api/reservas/:id -> cancela (o dono da reserva ou um bibliotecário)
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const [rows] = await db.query('SELECT id_usuario, status FROM reservas WHERE id_reserva = ?', [id]);
  if (!rows.length) throw new HttpError(404, 'Reserva não encontrada.');
  if (rows[0].id_usuario !== req.usuario.id_usuario && req.usuario.perfil !== 'bibliotecario') {
    throw new HttpError(403, 'Você não pode cancelar a reserva de outra pessoa.');
  }
  if (rows[0].status !== 'ativa') throw new HttpError(409, 'Esta reserva já foi encerrada.');
  await db.query(`UPDATE reservas SET status = 'cancelada' WHERE id_reserva = ?`, [id]);
  res.json({ ok: true });
}));

module.exports = router;
