const express = require('express');
const db = require('../db');
const { asyncHandler, HttpError, autenticar, exigirBibliotecario, idValido } = require('../middleware');

const router = express.Router();

function validarNome(body) {
  const nome = String(body.nome || '').trim();
  if (nome.length < 2 || nome.length > 50) throw new HttpError(400, 'O nome da categoria deve ter de 2 a 50 caracteres.');
  return nome;
}

// GET /api/categorias (público) -> com a quantidade de livros de cada uma
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.query(`
    SELECT c.id_categoria, c.nome, COUNT(l.id_livro) AS total_livros
    FROM categorias c LEFT JOIN livros l ON l.id_categoria = c.id_categoria
    GROUP BY c.id_categoria, c.nome ORDER BY c.nome`);
  res.json(rows);
}));

router.post('/', autenticar, exigirBibliotecario, asyncHandler(async (req, res) => {
  const nome = validarNome(req.body);
  try {
    const [r] = await db.query('INSERT INTO categorias (nome) VALUES (?)', [nome]);
    res.status(201).json({ id_categoria: r.insertId, nome });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Já existe uma categoria com esse nome.');
    throw e;
  }
}));

router.put('/:id', autenticar, exigirBibliotecario, asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const nome = validarNome(req.body);
  try {
    const [r] = await db.query('UPDATE categorias SET nome=? WHERE id_categoria=?', [nome, id]);
    if (!r.affectedRows) throw new HttpError(404, 'Categoria não encontrada.');
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Já existe uma categoria com esse nome.');
    throw e;
  }
}));

router.delete('/:id', autenticar, exigirBibliotecario, asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  try {
    const [r] = await db.query('DELETE FROM categorias WHERE id_categoria=?', [id]);
    if (!r.affectedRows) throw new HttpError(404, 'Categoria não encontrada.');
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_ROW_IS_REFERENCED_2') throw new HttpError(409, 'Não é possível excluir: existem livros nesta categoria.');
    throw e;
  }
}));

module.exports = router;
