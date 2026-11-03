// Teste automático da API. Com o servidor rodando (npm start), execute em OUTRO terminal: npm test
// Atenção: este teste cria alguns registros de teste no banco.
const BASE = process.env.BASE_URL || 'http://localhost:' + (process.env.PORT || 3000);
let ok = 0, falhas = 0;

async function req(metodo, rota, { token, body } = {}) {
  const r = await fetch(BASE + rota, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let dados = null;
  try { dados = await r.json(); } catch {}
  return { status: r.status, dados };
}
function checar(nome, condicao, extra = '') {
  if (condicao) { ok++; console.log('  OK  ', nome); } else { falhas++; console.log('  FALHOU', nome, extra); }
}
const login = async (email, senha = '123456') => (await req('POST', '/api/auth/login', { body: { email, senha } }));

(async () => {
  console.log('Testando', BASE);
  const sufixo = Date.now();

  console.log('\n[Catálogo e pesquisa]');
  let r = await req('GET', '/api/livros');
  checar('lista livros', r.status === 200 && r.dados.length >= 14);
  r = await req('GET', '/api/livros?q=Node');
  checar('pesquisa por título/palavra-chave', r.dados.length >= 1 && /Node/.test(r.dados[0].titulo));
  r = await req('GET', '/api/livros?q=Beatriz');
  checar('pesquisa por autor', r.dados.length >= 2);
  r = await req('GET', '/api/livros?categoria=1');
  checar('filtro por categoria', r.dados.length >= 3);
  r = await req('GET', '/api/livros/99999');
  checar('livro inexistente -> 404', r.status === 404);

  console.log('\n[Cadastro e login]');
  r = await req('POST', '/api/auth/cadastro', { body: { nome: '', email: 'x', senha: '1' } });
  checar('cadastro com dados inválidos -> 400', r.status === 400);
  const emailA = `a${sufixo}@teste.com`, emailB = `b${sufixo}@teste.com`;
  const ca = await req('POST', '/api/auth/cadastro', { body: { nome: 'Teste A', email: emailA, senha: 'abcdef' } });
  const cb = await req('POST', '/api/auth/cadastro', { body: { nome: 'Teste B', email: emailB, senha: 'abcdef' } });
  checar('cadastro válido -> 201', ca.status === 201 && cb.status === 201);
  r = await req('POST', '/api/auth/cadastro', { body: { nome: 'Teste A', email: emailA, senha: 'abcdef' } });
  checar('e-mail duplicado -> 409', r.status === 409);
  r = await login('leitor@devlibrary.com', 'senha-errada');
  checar('senha errada -> 401', r.status === 401);
  const leitor = (await login('leitor@devlibrary.com')).dados;
  const admin = (await login('bibliotecaria@devlibrary.com')).dados;
  checar('login leitor e bibliotecário', leitor?.token && admin?.token && admin.usuario.perfil === 'bibliotecario');

  console.log('\n[Permissões]');
  r = await req('GET', '/api/relatorios/resumo');
  checar('sem login -> 401', r.status === 401);
  r = await req('GET', '/api/relatorios/resumo', { token: leitor.token });
  checar('leitor no painel -> 403', r.status === 403);
  r = await req('POST', '/api/livros', { token: leitor.token, body: { titulo: 'X' } });
  checar('leitor não cadastra livro -> 403', r.status === 403);
  r = await req('GET', '/api/relatorios/resumo', { token: admin.token });
  checar('bibliotecário vê relatórios', r.status === 200 && r.dados.totais.livros >= 14);

  console.log('\n[CRUD de livros]');
  r = await req('POST', '/api/livros', { token: admin.token, body: { titulo: '', id_categoria: 1, autores: 'A' } });
  checar('livro sem título -> 400', r.status === 400);
  r = await req('POST', '/api/livros', { token: admin.token,
    body: { titulo: 'Livro de Teste ' + sufixo, ano: 2024, id_categoria: 1, autores: 'Autor Teste, Outro Autor', exemplares: 1 } });
  checar('cria livro com 1 exemplar', r.status === 201);
  const idTeste = r.dados.id_livro;
  r = await req('PUT', '/api/livros/' + idTeste, { token: admin.token,
    body: { titulo: 'Livro de Teste Editado', ano: 2025, id_categoria: 2, autores: 'Autor Teste' } });
  checar('edita livro', r.status === 200);
  r = await req('GET', '/api/livros/' + idTeste);
  checar('edição gravada', r.dados.titulo === 'Livro de Teste Editado' && r.dados.autores === 'Autor Teste' && r.dados.total_exemplares === 1);

  console.log('\n[Empréstimo simultâneo do último exemplar]');
  const ta = (await login(emailA, 'abcdef')).dados.token;
  const tb = (await login(emailB, 'abcdef')).dados.token;
  const [x, y] = await Promise.all([
    req('POST', '/api/emprestimos', { token: ta, body: { id_livro: idTeste } }),
    req('POST', '/api/emprestimos', { token: tb, body: { id_livro: idTeste } }),
  ]);
  const status = [x.status, y.status].sort();
  checar('só uma pessoa consegue (201 e 409)', status[0] === 201 && status[1] === 409, JSON.stringify(status));
  r = await req('GET', '/api/livros/' + idTeste);
  checar('disponibilidade zerada', r.dados.disponiveis === 0);

  console.log('\n[Reservas]');
  const perdedor = x.status === 409 ? ta : tb;
  const vencedor = x.status === 201 ? ta : tb;
  r = await req('POST', '/api/reservas', { token: perdedor, body: { id_livro: idTeste } });
  checar('reserva livro sem exemplar -> 201', r.status === 201);
  r = await req('POST', '/api/reservas', { token: perdedor, body: { id_livro: idTeste } });
  checar('reserva repetida -> 409', r.status === 409);
  r = await req('POST', '/api/reservas', { token: leitor.token, body: { id_livro: 1 } });
  checar('reservar livro disponível -> 409', r.status === 409);
  r = await req('DELETE', '/api/reservas/' + (await req('GET', '/api/reservas/minhas', { token: perdedor })).dados[0].id_reserva, { token: vencedor });
  checar('não cancela reserva de outra pessoa -> 403', r.status === 403);

  console.log('\n[Devolução e fila]');
  const meus = (await req('GET', '/api/emprestimos/meus', { token: vencedor })).dados;
  r = await req('POST', `/api/emprestimos/${meus[0].id_emprestimo}/devolver`, { token: vencedor });
  checar('leitor não registra devolução -> 403', r.status === 403);
  r = await req('POST', `/api/emprestimos/${meus[0].id_emprestimo}/devolver`, { token: admin.token });
  checar('bibliotecário registra devolução', r.status === 200);
  r = await req('POST', `/api/emprestimos/${meus[0].id_emprestimo}/devolver`, { token: admin.token });
  checar('devolver duas vezes -> 409', r.status === 409);
  r = await req('POST', '/api/emprestimos', { token: vencedor, body: { id_livro: idTeste } });
  checar('exemplar devolvido fica reservado para quem está na fila -> 409', r.status === 409);
  r = await req('POST', '/api/emprestimos', { token: perdedor, body: { id_livro: idTeste } });
  checar('quem reservou consegue pegar', r.status === 201);

  console.log('\n[Atrasos, avaliações e exclusão]');
  r = await req('GET', '/api/emprestimos?status=atrasado', { token: admin.token });
  checar('lista empréstimos atrasados', r.status === 200 && r.dados.length >= 1 && r.dados[0].dias_atraso > 0);
  r = await req('POST', `/api/livros/${idTeste}/avaliacoes`, { token: ta, body: { nota: 9 } });
  checar('nota inválida -> 400', r.status === 400);
  r = await req('POST', `/api/livros/${idTeste}/avaliacoes`, { token: ta, body: { nota: 4, comentario: 'Bom!' } });
  checar('avalia livro', r.status === 201);
  r = await req('DELETE', '/api/livros/' + idTeste, { token: admin.token });
  checar('livro com histórico não pode ser excluído -> 409', r.status === 409);
  r = await req('POST', '/api/livros', { token: admin.token, body: { titulo: 'Descartável', id_categoria: 1, autores: 'Z', exemplares: 0 } });
  r = await req('DELETE', '/api/livros/' + r.dados.id_livro, { token: admin.token });
  checar('livro sem histórico é excluído', r.status === 200);

  console.log(`\nResultado: ${ok} passaram, ${falhas} falharam.`);
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error('Erro no teste (o servidor está rodando?):', e.message); process.exit(1); });
