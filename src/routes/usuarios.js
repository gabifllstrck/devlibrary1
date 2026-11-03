const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { asyncHandler, HttpError, autenticar, exigirBibliotecario, idValido } = require('../middleware');

const router = express.Router();
router.use(autenticar);

// PUT /api/usuarios/me -> atualiza o próprio perfil (nome, telefone e, se quiser, senha)
router.put('/me', asyncHandler(async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  const telefone = String(req.body.telefone || '').trim() || null;
  const novaSenha = String(req.body.nova_senha || '');
  if (nome.length < 2 || nome.length > 100) throw new HttpError(400, 'Informe seu nome (2 a 100 caracteres).');
  if (telefone && telefone.length > 20) throw new HttpError(400, 'Telefone muito longo (máximo 20 caracteres).');

  if (novaSenha) {
    if (novaSenha.length < 6) throw new HttpError(400, 'A nova senha deve ter pelo menos 6 caracteres.');
    const [rows] = await db.query('SELECT senha_hash FROM usuarios WHERE id_usuario = ?', [req.usuario.id_usuario]);
    const ok = await bcrypt.compare(String(req.body.senha_atual || ''), rows[0].senha_hash);
    if (!ok) throw new HttpError(400, 'A senha atual está incorreta.');
    await db.query('UPDATE usuarios SET nome=?, telefone=?, senha_hash=? WHERE id_usuario=?',
      [nome, telefone, await bcrypt.hash(novaSenha, 10), req.usuario.id_usuario]);
  } else {
    await db.query('UPDATE usuarios SET nome=?, telefone=? WHERE id_usuario=?', [nome, telefone, req.usuario.id_usuario]);
  }
  const [rows] = await db.query(
    'SELECT id_usuario, nome, email, telefone, perfil FROM usuarios WHERE id_usuario = ?', [req.usuario.id_usuario]);
  res.json({ usuario: rows[0] });
}));

// GET /api/usuarios -> lista todos (bibliotecário)
router.get('/', exigirBibliotecario, asyncHandler(async (req, res) => {
  const [rows] = await db.query(`
    SELECT u.id_usuario, u.nome, u.email, u.telefone, u.perfil, u.criado_em,
           (SELECT COUNT(*) FROM emprestimos e WHERE e.id_usuario = u.id_usuario AND e.data_devolucao IS NULL) AS emprestimos_ativos
    FROM usuarios u ORDER BY u.nome`);
  res.json(rows);
}));

// PUT /api/usuarios/:id/perfil -> muda o perfil (leitor <-> bibliotecário)
router.put('/:id/perfil', exigirBibliotecario, asyncHandler(async (req, res) => {
  const id = idValido(req.params.id);
  const perfil = req.body.perfil;
  if (!['leitor', 'bibliotecario'].includes(perfil)) throw new HttpError(400, 'Perfil inválido.');
  if (id === req.usuario.id_usuario) throw new HttpError(400, 'Você não pode alterar o seu próprio perfil.');
  const [r] = await db.query('UPDATE usuarios SET perfil=? WHERE id_usuario=?', [perfil, id]);
  if (!r.affectedRows) throw new HttpError(404, 'Usuário não encontrado.');
  res.json({ ok: true });
}));

module.exports = router;
