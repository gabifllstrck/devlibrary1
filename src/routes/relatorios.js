const express = require('express');
const db = require('../db');
const { asyncHandler, autenticar, exigirBibliotecario } = require('../middleware');

const router = express.Router();
router.use(autenticar, exigirBibliotecario);

// GET /api/relatorios/resumo -> números e rankings para o painel administrativo
router.get('/resumo', asyncHandler(async (req, res) => {
  const [[t]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM usuarios) AS usuarios,
      (SELECT COUNT(*) FROM livros) AS livros,
      (SELECT COUNT(*) FROM exemplares) AS exemplares,
      (SELECT COUNT(*) FROM exemplares WHERE status = 'disponivel') AS disponiveis,
      (SELECT COUNT(*) FROM emprestimos WHERE data_devolucao IS NULL) AS emprestimos_abertos,
      (SELECT COUNT(*) FROM emprestimos WHERE data_devolucao IS NULL AND data_prevista < CURDATE()) AS atrasados,
      (SELECT COUNT(*) FROM reservas WHERE status = 'ativa') AS reservas_ativas,
      (SELECT COUNT(*) FROM emprestimos) AS total_emprestimos`);

  const [maisEmprestados] = await db.query(`
    SELECT l.id_livro, l.titulo, COUNT(*) AS total
    FROM emprestimos em JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar JOIN livros l ON l.id_livro = ex.id_livro
    GROUP BY l.id_livro, l.titulo ORDER BY total DESC, l.titulo LIMIT 5`);

  const [porCategoria] = await db.query(`
    SELECT c.nome, COUNT(DISTINCT l.id_livro) AS livros, COUNT(em.id_emprestimo) AS emprestimos
    FROM categorias c
    LEFT JOIN livros l ON l.id_categoria = c.id_categoria
    LEFT JOIN exemplares ex ON ex.id_livro = l.id_livro
    LEFT JOIN emprestimos em ON em.id_exemplar = ex.id_exemplar
    GROUP BY c.id_categoria, c.nome ORDER BY emprestimos DESC, c.nome`);

  const [leitoresAtivos] = await db.query(`
    SELECT u.nome, COUNT(*) AS total
    FROM emprestimos em JOIN usuarios u ON u.id_usuario = em.id_usuario
    GROUP BY u.id_usuario, u.nome ORDER BY total DESC, u.nome LIMIT 5`);

  res.json({ totais: t, maisEmprestados, porCategoria, leitoresAtivos });
}));

module.exports = router;
