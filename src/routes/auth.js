const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { asyncHandler, HttpError, autenticar } = require('../middleware');

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function gerarToken(usuario) {
  return jwt.sign({ id: usuario.id_usuario }, process.env.JWT_SECRET, { expiresIn: '8h' });
}

// POST /api/auth/cadastro  -> cria um LEITOR (nunca bibliotecário por aqui)
router.post('/cadastro', asyncHandler(async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const telefone = String(req.body.telefone || '').trim() || null;
  const senha = String(req.body.senha || '');

  if (nome.length < 2 || nome.length > 100) throw new HttpError(400, 'Informe seu nome (2 a 100 caracteres).');
  if (!EMAIL_REGEX.test(email) || email.length > 100) throw new HttpError(400, 'Informe um e-mail válido.');
  if (senha.length < 6) throw new HttpError(400, 'A senha deve ter pelo menos 6 caracteres.');
  if (telefone && telefone.length > 20) throw new HttpError(400, 'Telefone muito longo (máximo 20 caracteres).');

  const senha_hash = await bcrypt.hash(senha, 10); // nunca guardamos a senha pura
  try {
    const [r] = await db.query(
      'INSERT INTO usuarios (nome, email, telefone, senha_hash, perfil) VALUES (?, ?, ?, ?, ?)',
      [nome, email, telefone, senha_hash, 'leitor']);
    const usuario = { id_usuario: r.insertId, nome, email, telefone, perfil: 'leitor' };
    res.status(201).json({ token: gerarToken(usuario), usuario });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'Já existe uma conta com este e-mail.');
    throw e;
  }
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');
  if (!email || !senha) throw new HttpError(400, 'Informe e-mail e senha.');

  const [rows] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
  const u = rows[0];
  // Mesma mensagem para e-mail ou senha errados (não revela se o e-mail existe)
  if (!u || !(await bcrypt.compare(senha, u.senha_hash))) throw new HttpError(401, 'E-mail ou senha incorretos.');

  const usuario = { id_usuario: u.id_usuario, nome: u.nome, email: u.email, telefone: u.telefone, perfil: u.perfil };
  res.json({ token: gerarToken(u), usuario });
}));

// GET /api/auth/me  -> dados do usuário logado
router.get('/me', autenticar, (req, res) => res.json({ usuario: req.usuario }));

module.exports = router;
