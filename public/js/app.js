/* DevLibrary - front-end (HTML + JavaScript puro).
   O navegador NUNCA fala com o MySQL: ele chama a API (/api/...) e o servidor Node consulta o banco.

   MAPA DO ARQUIVO (use Ctrl+F nos títulos "// ----------"):
   1. utilidades ........ api() (chamadas às rotas), toast, modal, formulários, ícones, capas
   2. login / sessão .... entrar, sair, menu fixo do topo
   3. telas públicas .... início, catálogo, detalhe do livro, login, cadastro
   4. área do leitor .... perfil, empréstimos, reservas
   5. painel admin ...... visão geral, livros (CRUD), empréstimos, reservas, categorias, usuários
   6. rotas ............. cada #/endereço chama uma tela */
(() => {
  'use strict';

  const app = document.getElementById('conteudo');
  const state = { token: localStorage.getItem('dl_token'), user: null, voltarPara: null };

  // ---------- utilidades ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtData = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
  const ehAdmin = () => state.user && state.user.perfil === 'bibliotecario';

  async function api(caminho, { method = 'GET', body } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    let resp;
    try {
      resp = await fetch('/api' + caminho, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error('Sem conexão com o servidor. Verifique se ele está rodando.');
    }
    let dados = null;
    try { dados = await resp.json(); } catch { /* resposta sem corpo */ }
    if (!resp.ok) {
      if (resp.status === 401 && state.token) {
        sair(false);
        toast('Sua sessão expirou. Entre novamente.', 'erro');
        location.hash = '#/login';
      }
      const erro = new Error((dados && dados.erro) || 'Erro inesperado (' + resp.status + ').');
      erro.status = resp.status;
      throw erro;
    }
    return dados;
  }

  function toast(msg, tipo = 'ok') {
    const el = document.createElement('div');
    el.className = 'toast' + (tipo === 'erro' ? ' erro' : '');
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  const modal = document.getElementById('modal');
  function abrirModal(html) {
    modal.innerHTML = html;
    if (modal.showModal) { if (!modal.open) modal.showModal(); } else modal.setAttribute('open', '');
    modal.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharModal));
    const primeiro = modal.querySelector('input, select, textarea, button');
    if (primeiro) primeiro.focus();
  }
  function fecharModal() {
    if (modal.close) { if (modal.open) modal.close(); } else modal.removeAttribute('open');
  }
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });

  // Envia um formulário: bloqueia o botão, mostra o erro dentro do próprio formulário
  function ligarForm(form, acao) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const erroEl = form.querySelector('.erro-form');
      const botao = form.querySelector('button:not([type="button"])');
      if (erroEl) erroEl.textContent = '';
      if (botao) { botao.disabled = true; botao.setAttribute('aria-busy', 'true'); }
      try {
        await acao(Object.fromEntries(new FormData(form).entries()));
      } catch (err) {
        if (erroEl) erroEl.textContent = err.message; else toast(err.message, 'erro');
      } finally {
        if (botao) { botao.disabled = false; botao.removeAttribute('aria-busy'); }
      }
    });
  }

  const matiz = (t) => { let h = 0; for (const c of String(t)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  function capaAcervo(l) {
    if (!l.id_livro) return null;
    const slug = String(l.titulo).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return `/images/capas/${String(l.id_livro).padStart(2, '0')}_${slug}.jpg`;
  }
  // Prefere uma capa cadastrada e usa a coleção local para os livros do acervo inicial.
  function capa(l, extra = '') {
    const url = l.capa_url || l.capa || l.imagem || capaAcervo(l);
    const alt = 'Capa do livro ' + l.titulo;
    return `<div class="capa ${extra}">${url ? `<img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ''}
      <div class="capa-ph v${matiz(l.titulo) % 6}"${url ? ' hidden' : ` role="img" aria-label="${esc(alt)}"`}>
        <div><strong>${esc(l.titulo)}</strong><small>${esc(l.autores || '')}</small></div></div></div>`;
  }
  const plural = (n, s, p) => (n === 1 ? s : p);

  function badgeDisp(l) {
    if (!l.total_exemplares) return '<span class="badge neutro">Sem exemplares</span>';
    if (l.disponiveis > 0) return `<span class="badge ok">${l.disponiveis} de ${l.total_exemplares} ${plural(l.disponiveis, 'disponível', 'disponíveis')}</span>`;
    return '<span class="badge off">Todos emprestados</span>';
  }
  function estrelas(media) {
    if (media == null) return '<span class="sem-nota">Sem avaliações</span>';
    const m = Number(media), r = Math.round(m);
    return `<span class="estrelas" role="img" aria-label="Nota ${m.toFixed(1)} de 5">${'★'.repeat(r)}${'☆'.repeat(5 - r)}</span> <span class="nota-num">${m.toFixed(1)}</span>`;
  }
  function badgeStatus(s) {
    const mapa = { ativo: ['ok', 'Em andamento'], atrasado: ['off', 'Atrasado'], devolvido: ['neutro', 'Devolvido'],
      ativa: ['alerta', 'Na fila'], atendida: ['ok', 'Atendida'], cancelada: ['neutro', 'Cancelada'] };
    const [cls, txt] = mapa[s] || ['neutro', s];
    return `<span class="badge ${cls}">${txt}</span>`;
  }
  const cardLivro = (l) => `
    <a class="card-livro" href="#/livro/${l.id_livro}">
      ${capa(l)}
      <div class="card-corpo">
        <h3>${esc(l.titulo)}</h3>
        <p>${esc(l.autores)}</p>
        <p>${esc(l.categoria)}</p>
        ${badgeDisp(l)}
        <div>${estrelas(l.media_nota)}</div>
      </div>
    </a>`;

  const carregando = () => { app.innerHTML = '<div class="carregando" role="status"><span class="spin"></span>Carregando…</div>'; };
  const titulo = (t) => { document.title = t ? `${t} · DevLibrary` : 'DevLibrary'; };
  function erroTela(e) {
    app.innerHTML = `<div class="vazio"><p><strong>Não foi possível carregar esta página.</strong></p><p>${esc(e.message)}</p><a class="btn sec" href="#/">Voltar ao início</a></div>`;
  }

  // ---------- login / sessão ----------
  function entrar(token, user) {
    state.token = token; state.user = user;
    localStorage.setItem('dl_token', token);
    renderNav();
  }
  function sair(redirecionar = true) {
    state.token = null; state.user = null;
    localStorage.removeItem('dl_token');
    renderNav();
    if (redirecionar) { location.hash = '#/'; toast('Você saiu da sua conta.'); }
  }
  function exigirLogin() {
    if (state.user) return true;
    state.voltarPara = location.hash;
    toast('Entre na sua conta para continuar.', 'erro');
    location.hash = '#/login';
    return false;
  }

  function renderNav() {
    const h = location.hash || '#/';
    const atual = (rota) => (h === rota || h.startsWith(rota + '/') || h.startsWith(rota + '?') ? ' aria-current="page"' : '');
    let html = `<a href="#/"${h === '#/' || h === '#' ? ' aria-current="page"' : ''}>Início</a><a href="#/catalogo"${atual('#/catalogo')}>Catálogo</a>`;
    if (state.user) {
      html += `<a href="#/perfil"${atual('#/perfil')}>Meu perfil</a>`;
      if (ehAdmin()) html += `<a href="#/admin"${atual('#/admin')}>Painel</a>`;
      html += `<span class="quem">${esc(state.user.nome.split(' ')[0])}</span><button class="link" id="btn-sair" type="button">Sair</button>`;
    } else {
      html += `<a href="#/login"${atual('#/login')}>Entrar</a><a class="cta" href="#/cadastro">Criar conta</a>`;
    }
    const nav = document.getElementById('nav');
    nav.innerHTML = html;
    const b = document.getElementById('btn-sair');
    if (b) b.addEventListener('click', () => sair(true));
  }
  const menuBtn = document.getElementById('menu-btn');
  menuBtn.addEventListener('click', () => {
    const aberto = document.getElementById('nav').classList.toggle('aberto');
    menuBtn.setAttribute('aria-expanded', String(aberto));
    menuBtn.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    menuBtn.textContent = aberto ? 'Fechar' : 'Menu';
  });
  function fecharMenu() {
    document.getElementById('nav').classList.remove('aberto');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Abrir menu');
    menuBtn.textContent = 'Menu';
  }

  // ---------- telas ----------
  async function telaInicio() {
    titulo('');
    carregando();
    const [livros, categorias] = await Promise.all([api('/livros'), api('/categorias')]);
    const disponiveis = livros.filter((l) => l.disponiveis > 0);
    const destaques = (disponiveis.length ? disponiveis : livros).slice(0, 3);
    app.innerHTML = `
      <section class="hero">
        <div class="hero-conteudo">
          <p class="hero-etiqueta"><span></span> Seu próximo capítulo começa aqui</p>
          <h1>Boas histórias.<br>Novas possibilidades.</h1>
          <p class="hero-descricao">Explore o acervo, encontre uma leitura para o seu momento e deixe a curiosidade escolher o caminho.</p>
        <form class="busca-hero" id="f-busca" role="search">
          <input type="search" name="q" placeholder="Título, autor ou palavra-chave" aria-label="Pesquisar livros">
            <button class="btn mint">Explorar acervo</button>
        </form>
        </div>
        <div class="hero-arte" aria-hidden="true">
          ${destaques.map((l, i) => `<div class="hero-livro livro-${i + 1}">${capa(l, 'hero-capa')}</div>`).join('')}
        </div>
      </section>
      <section class="categorias secao">
        <div class="secao-topo"><div><p class="sobrelinha">Encontre seu ritmo</p><h2>Explore por categoria</h2></div><a href="#/catalogo">Ver catálogo completo <span aria-hidden="true">↗</span></a></div>
        <div class="chips" aria-label="Categorias">${categorias.map((c) => `<a class="chip" href="#/catalogo?categoria=${c.id_categoria}"><span>${esc(c.nome)}</span><b>${c.total_livros}</b></a>`).join('')}</div>
      </section>
      <section class="secao">
        <div class="secao-topo"><div><p class="sobrelinha">Prontos para uma nova estante</p><h2>Disponíveis agora</h2></div><a href="#/catalogo?disponivel=1">Ver todos <span aria-hidden="true">↗</span></a></div>
        ${disponiveis.length ? `<div class="grade">${disponiveis.slice(0, 12).map(cardLivro).join('')}</div>` : '<p class="vazio">Nenhum livro disponível no momento.</p>'}
      </section>
      <section class="secao">
        <div class="secao-topo"><div><p class="sobrelinha">Leia algo diferente</p><h2>Todo o acervo</h2></div><a href="#/catalogo">Abrir catálogo <span aria-hidden="true">↗</span></a></div>
        ${livros.length ? `<div class="grade">${livros.map(cardLivro).join('')}</div>` : '<p class="vazio">O acervo ainda está vazio.</p>'}
      </section>`;
    document.getElementById('f-busca').addEventListener('submit', (e) => {
      e.preventDefault();
      location.hash = '#/catalogo?q=' + encodeURIComponent(new FormData(e.target).get('q').trim());
    });
  }

  async function telaCatalogo(consulta) {
    titulo('Catálogo');
    const p = new URLSearchParams(consulta || '');
    const q = p.get('q') || '', cat = p.get('categoria') || '', so = p.get('disponivel') === '1';
    carregando();
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    if (cat) qs.set('categoria', cat);
    if (so) qs.set('disponivel', '1');
    const [livros, categorias] = await Promise.all([api('/livros?' + qs), api('/categorias')]);
    app.innerHTML = `
      <h1>Catálogo</h1>
      <form class="filtros" id="f-filtros" role="search">
        <label>Pesquisar<input type="search" name="q" value="${esc(q)}" placeholder="Título, autor, ISBN ou palavra-chave"></label>
        <label>Categoria<select name="categoria"><option value="">Todas</option>
          ${categorias.map((c) => `<option value="${c.id_categoria}"${String(c.id_categoria) === cat ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
        <label class="check"><input type="checkbox" name="disponivel" value="1"${so ? ' checked' : ''}>Só disponíveis</label>
        <button class="btn">Filtrar</button>
      </form>
      <p class="muted" aria-live="polite">${livros.length} ${plural(livros.length, 'livro encontrado', 'livros encontrados')}</p>
      ${livros.length ? `<div class="grade">${livros.map(cardLivro).join('')}</div>`
        : '<p class="vazio">Nenhum livro encontrado com esses filtros. <a href="#/catalogo">Limpar filtros</a></p>'}`;
    document.getElementById('f-filtros').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target), n = new URLSearchParams();
      if (f.get('q').trim()) n.set('q', f.get('q').trim());
      if (f.get('categoria')) n.set('categoria', f.get('categoria'));
      if (f.get('disponivel')) n.set('disponivel', '1');
      const novo = '#/catalogo' + (n.toString() ? '?' + n : '');
      if (novo === location.hash) rotear(); else location.hash = novo;
    });
  }

  async function telaLivro(id) {
    carregando();
    const l = await api('/livros/' + id);
    titulo(l.titulo);
    let meusEmp = [], minhasRes = [];
    if (state.user) [meusEmp, minhasRes] = await Promise.all([api('/emprestimos/meus'), api('/reservas/minhas')]);
    const comEsteLivro = meusEmp.find((e) => e.id_livro === l.id_livro && !e.data_devolucao);
    const reservaAtiva = minhasRes.find((r) => r.id_livro === l.id_livro && r.status === 'ativa');
    const minhaAval = state.user ? l.avaliacoes.find((a) => a.id_usuario === state.user.id_usuario) : null;

    let acao;
    if (!state.user) acao = `<a class="btn" href="#/login" id="ir-login">Entre para pegar emprestado ou reservar</a>`;
    else if (comEsteLivro) acao = `<span class="aviso">Você está com este livro. Devolução prevista para ${fmtData(comEsteLivro.data_prevista)}.</span>`;
    else if (reservaAtiva) acao = `<span class="aviso">Você está na fila de reservas (posição ${reservaAtiva.posicao_fila}).</span>
        <button class="btn sec" id="btn-cancelar-res" type="button">Cancelar reserva</button>`;
    else if (l.disponiveis > 0) acao = `<button class="btn mint" id="btn-emprestar" type="button">Pegar emprestado</button>`;
    else if (l.total_exemplares > 0) acao = `<button class="btn" id="btn-reservar" type="button">Reservar este livro</button>`;
    else acao = '<span class="aviso">Este livro ainda não tem exemplares cadastrados.</span>';

    app.innerHTML = `
      <a class="voltar" href="#/catalogo">Voltar ao catálogo</a>
      <article class="detalhe">
        ${capa(l, 'grande')}
        <div class="info">
          <h1>${esc(l.titulo)}</h1>
          <p class="autor">${esc(l.autores)}</p>
          <div>${estrelas(l.media_nota)} ${l.total_avaliacoes ? `<span class="nota-num">(${l.total_avaliacoes} ${plural(l.total_avaliacoes, 'avaliação', 'avaliações')})</span>` : ''}</div>
          <dl>
            <dt>Categoria</dt><dd><a href="#/catalogo?categoria=${l.id_categoria}">${esc(l.categoria)}</a></dd>
            <dt>Ano</dt><dd>${l.ano || '—'}</dd>
            <dt>ISBN</dt><dd>${esc(l.isbn) || '—'}</dd>
            <dt>Disponibilidade</dt><dd>${badgeDisp(l)}${l.reservas_ativas ? ` <span class="muted">· ${l.reservas_ativas} ${plural(l.reservas_ativas, 'reserva', 'reservas')} na fila</span>` : ''}</dd>
          </dl>
          <p>${esc(l.sinopse) || '<span class="muted">Sem sinopse cadastrada.</span>'}</p>
          <div class="acao-livro">${acao}</div>
        </div>
      </article>
      <section class="secao">
        <h2>Avaliações</h2>
        ${state.user ? `
        <form class="form painel" id="f-aval" style="margin-bottom:18px">
          <fieldset class="estrelas-input"><legend>${minhaAval ? 'Atualizar a sua avaliação' : 'Avalie este livro'}</legend>
            ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="nota" value="${n}"${minhaAval && minhaAval.nota === n ? ' checked' : ''} required> ${n} ★</label>`).join('')}
          </fieldset>
          <label>Comentário (opcional)<textarea name="comentario" rows="3" maxlength="500">${esc(minhaAval ? minhaAval.comentario : '')}</textarea></label>
          <p class="erro-form" role="alert"></p>
          <div class="acoes"><button class="btn">Enviar avaliação</button></div>
        </form>` : '<p class="muted"><a href="#/login">Entre</a> para avaliar este livro.</p>'}
        ${l.avaliacoes.length ? l.avaliacoes.map((a) => `
          <div class="avaliacao"><strong>${esc(a.usuario)}</strong> <span class="estrelas" aria-label="Nota ${a.nota} de 5">${'★'.repeat(a.nota)}${'☆'.repeat(5 - a.nota)}</span>
          <span class="muted"> · ${fmtData(a.data_avaliacao)}</span>${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}</div>`).join('')
          : '<p class="vazio">Ainda não há avaliações. Seja a primeira pessoa a avaliar.</p>'}
      </section>`;

    const login = document.getElementById('ir-login');
    if (login) login.addEventListener('click', () => { state.voltarPara = location.hash; });

    const ligar = (idBtn, fn) => {
      const b = document.getElementById(idBtn);
      if (!b) return;
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { await fn(); } catch (e) { toast(e.message, 'erro'); b.disabled = false; }
      });
    };
    ligar('btn-emprestar', async () => {
      const e = await api('/emprestimos', { method: 'POST', body: { id_livro: l.id_livro } });
      toast(`Empréstimo realizado! Devolva até ${fmtData(e.data_prevista)}.`);
      rotear();
    });
    ligar('btn-reservar', async () => {
      await api('/reservas', { method: 'POST', body: { id_livro: l.id_livro } });
      toast('Reserva feita! Você está na fila deste livro.');
      rotear();
    });
    ligar('btn-cancelar-res', async () => {
      await api('/reservas/' + reservaAtiva.id_reserva, { method: 'DELETE' });
      toast('Reserva cancelada.');
      rotear();
    });
    const fa = document.getElementById('f-aval');
    if (fa) ligarForm(fa, async (d) => {
      await api(`/livros/${l.id_livro}/avaliacoes`, { method: 'POST', body: { nota: Number(d.nota), comentario: d.comentario } });
      toast('Avaliação salva. Obrigada!');
      rotear();
    });
  }

  function telaLogin() {
    titulo('Entrar');
    if (state.user) { location.hash = '#/perfil'; return; }
    app.innerHTML = `
      <form class="painel form form-estreito" id="f-login" novalidate>
        <h1>Entrar</h1>
        <label>E-mail<input type="email" name="email" autocomplete="email" required></label>
        <label>Senha<input type="password" name="senha" autocomplete="current-password" required></label>
        <p class="erro-form" role="alert"></p>
        <button class="btn mint">Entrar</button>
        <p class="muted" style="margin:0">Ainda não tem conta? <a href="#/cadastro">Crie a sua</a>.</p>
      </form>`;
    ligarForm(document.getElementById('f-login'), async (d) => {
      if (!d.email.trim() || !d.senha) throw new Error('Informe e-mail e senha.');
      const r = await api('/auth/login', { method: 'POST', body: d });
      entrar(r.token, r.usuario);
      toast('Bem-vinda(o), ' + r.usuario.nome.split(' ')[0] + '!');
      const destino = state.voltarPara || (r.usuario.perfil === 'bibliotecario' ? '#/admin' : '#/');
      state.voltarPara = null;
      location.hash = destino;
    });
  }

  function telaCadastro() {
    titulo('Criar conta');
    if (state.user) { location.hash = '#/perfil'; return; }
    app.innerHTML = `
      <form class="painel form form-estreito" id="f-cad" novalidate>
        <h1>Criar conta</h1>
        <label>Nome completo<input name="nome" autocomplete="name" maxlength="100" required></label>
        <label>E-mail<input type="email" name="email" autocomplete="email" maxlength="100" required></label>
        <label>Telefone (opcional)<input type="tel" name="telefone" autocomplete="tel" maxlength="20"></label>
        <label>Senha <small>mínimo 6 caracteres</small><input type="password" name="senha" autocomplete="new-password" minlength="6" required></label>
        <label>Repita a senha<input type="password" name="senha2" autocomplete="new-password" required></label>
        <p class="erro-form" role="alert"></p>
        <button class="btn mint">Criar conta</button>
        <p class="muted" style="margin:0">Já tem conta? <a href="#/login">Entrar</a>.</p>
      </form>`;
    ligarForm(document.getElementById('f-cad'), async (d) => {
      if (d.nome.trim().length < 2) throw new Error('Informe seu nome.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) throw new Error('Informe um e-mail válido.');
      if (d.senha.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
      if (d.senha !== d.senha2) throw new Error('As senhas não são iguais.');
      const r = await api('/auth/cadastro', { method: 'POST', body: { nome: d.nome, email: d.email, telefone: d.telefone, senha: d.senha } });
      entrar(r.token, r.usuario);
      toast('Conta criada com sucesso!');
      const destino = state.voltarPara || '#/catalogo';
      state.voltarPara = null;
      location.hash = destino;
    });
  }

  async function telaPerfil() {
    if (!exigirLogin()) return;
    titulo('Meu perfil');
    carregando();
    const [emprestimos, reservas] = await Promise.all([api('/emprestimos/meus'), api('/reservas/minhas')]);
    const abertos = emprestimos.filter((e) => !e.data_devolucao);
    const historico = emprestimos.filter((e) => e.data_devolucao);
    const resAtivas = reservas.filter((r) => r.status === 'ativa');
    const resEncerradas = reservas.filter((r) => r.status !== 'ativa');
    const u = state.user;

    app.innerHTML = `
      <h1>Olá, ${esc(u.nome.split(' ')[0])}</h1>
      <p class="muted">${esc(u.email)} · ${u.perfil === 'bibliotecario' ? 'Bibliotecário(a)' : 'Leitor(a)'}</p>

      <section class="secao"><h2>Livros que estão com você</h2>
        ${abertos.length ? `<div class="itens">${abertos.map((e) => `
          <div class="item ${e.status === 'atrasado' ? 'atrasado' : ''}">
            <div><h3><a href="#/livro/${e.id_livro}">${esc(e.titulo)}</a></h3>
              <p>Retirado em ${fmtData(e.data_emprestimo)} · devolver até <strong>${fmtData(e.data_prevista)}</strong> · exemplar ${esc(e.codigo)}</p>
              ${e.status === 'atrasado' ? `<p><strong>${e.dias_atraso} ${plural(e.dias_atraso, 'dia', 'dias')} de atraso.</strong> Leve o livro à biblioteca para registrar a devolução.</p>` : ''}</div>
            ${badgeStatus(e.status)}
          </div>`).join('')}</div>`
          : '<p class="vazio">Você não está com nenhum livro. <a href="#/catalogo">Explorar o catálogo</a></p>'}
      </section>

      <section class="secao"><h2>Minhas reservas</h2>
        ${resAtivas.length ? `<div class="itens">${resAtivas.map((r) => `
          <div class="item">
            <div><h3><a href="#/livro/${r.id_livro}">${esc(r.titulo)}</a></h3>
              <p>Reservado em ${fmtData(r.data_reserva)} · posição na fila: ${r.posicao_fila}</p>
              ${r.posicao_fila <= r.disponiveis ? '<p><strong>Já há exemplar para você!</strong> Abra o livro e toque em "Pegar emprestado".</p>' : ''}</div>
            <button class="btn perigo mini" data-cancelar="${r.id_reserva}" type="button">Cancelar reserva</button>
          </div>`).join('')}</div>`
          : '<p class="vazio">Nenhuma reserva ativa.</p>'}
      </section>

      <section class="secao"><h2>Histórico</h2>
        ${historico.length || resEncerradas.length ? `<div class="tabela-wrap"><table>
          <thead><tr><th>Livro</th><th>Tipo</th><th>Data</th><th>Devolução</th><th>Situação</th></tr></thead><tbody>
          ${historico.map((e) => `<tr><td><a href="#/livro/${e.id_livro}">${esc(e.titulo)}</a></td><td>Empréstimo</td><td>${fmtData(e.data_emprestimo)}</td><td>${fmtData(e.data_devolucao)}</td><td>${badgeStatus('devolvido')}</td></tr>`).join('')}
          ${resEncerradas.map((r) => `<tr><td><a href="#/livro/${r.id_livro}">${esc(r.titulo)}</a></td><td>Reserva</td><td>${fmtData(r.data_reserva)}</td><td>—</td><td>${badgeStatus(r.status)}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="vazio">Seu histórico aparecerá aqui.</p>'}
      </section>

      <section class="secao"><h2>Meus dados</h2>
        <form class="painel form" id="f-dados" style="max-width:520px">
          <label>Nome<input name="nome" value="${esc(u.nome)}" maxlength="100" required></label>
          <label>Telefone<input name="telefone" value="${esc(u.telefone)}" maxlength="20"></label>
          <label>E-mail <small>não pode ser alterado</small><input value="${esc(u.email)}" disabled></label>
          <details><summary>Alterar senha</summary>
            <div class="form" style="margin-top:12px">
              <label>Senha atual<input type="password" name="senha_atual" autocomplete="current-password"></label>
              <label>Nova senha<input type="password" name="nova_senha" autocomplete="new-password" minlength="6"></label>
            </div></details>
          <p class="erro-form" role="alert"></p>
          <div class="acoes"><button class="btn">Salvar alterações</button></div>
        </form>
      </section>`;

    app.querySelectorAll('[data-cancelar]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await api('/reservas/' + b.dataset.cancelar, { method: 'DELETE' }); toast('Reserva cancelada.'); rotear(); }
      catch (e) { toast(e.message, 'erro'); b.disabled = false; }
    }));
    ligarForm(document.getElementById('f-dados'), async (d) => {
      const r = await api('/usuarios/me', { method: 'PUT', body: { nome: d.nome, telefone: d.telefone, senha_atual: d.senha_atual, nova_senha: d.nova_senha } });
      state.user = r.usuario;
      renderNav();
      toast('Dados atualizados.');
      rotear();
    });
  }

  // ---------- painel do bibliotecário ----------
  const ABAS = [['geral', 'Visão geral'], ['livros', 'Livros'], ['emprestimos', 'Empréstimos'], ['reservas', 'Reservas'], ['categorias', 'Categorias'], ['usuarios', 'Usuários']];

  async function telaAdmin(aba = 'geral') {
    if (!exigirLogin()) return;
    if (!ehAdmin()) {
      titulo('Acesso restrito');
      app.innerHTML = '<div class="vazio"><p><strong>Acesso restrito a bibliotecários.</strong></p><a class="btn sec" href="#/">Voltar ao início</a></div>';
      return;
    }
    titulo('Painel');
    if (!ABAS.some((a) => a[0] === aba)) aba = 'geral';
    app.innerHTML = `<h1>Painel do bibliotecário</h1>
      <nav class="tabs" aria-label="Seções do painel">${ABAS.map(([k, nome]) => `<a href="#/admin/${k}"${k === aba ? ' aria-current="page"' : ''}>${nome}</a>`).join('')}</nav>
      <div id="aba"><p class="carregando">Carregando…</p></div>`;
    const alvo = document.getElementById('aba');
    const f = { geral: abaGeral, livros: abaLivros, emprestimos: abaEmprestimos, reservas: abaReservas, categorias: abaCategorias, usuarios: abaUsuarios }[aba];
    try { await f(alvo); } catch (e) { alvo.innerHTML = `<p class="erro-form">${esc(e.message)}</p>`; }
  }

  async function abaGeral(el) {
    const r = await api('/relatorios/resumo');
    const t = r.totais;
    const maxCat = Math.max(1, ...r.porCategoria.map((c) => Number(c.emprestimos)));
    el.innerHTML = `
      <div class="stats">
        <div class="stat"><b>${t.livros}</b><span>títulos no acervo</span></div>
        <div class="stat"><b>${t.disponiveis}<small style="font-size:1rem"> / ${t.exemplares}</small></b><span>exemplares disponíveis</span></div>
        <div class="stat"><b>${t.emprestimos_abertos}</b><span>empréstimos em aberto</span></div>
        <div class="stat ${t.atrasados > 0 ? 'alerta' : ''}"><b>${t.atrasados}</b><span><a href="#/admin/emprestimos?status=atrasado">empréstimos atrasados</a></span></div>
        <div class="stat"><b>${t.reservas_ativas}</b><span>reservas na fila</span></div>
        <div class="stat"><b>${t.usuarios}</b><span>usuários cadastrados</span></div>
      </div>
      <div class="duas-col">
        <section class="painel"><h2>Livros mais emprestados</h2>
          ${r.maisEmprestados.length ? `<ul class="lista-simples">${r.maisEmprestados.map((m) => `<li><a href="#/livro/${m.id_livro}">${esc(m.titulo)}</a><b>${m.total}</b></li>`).join('')}</ul>` : '<p class="muted">Sem empréstimos ainda.</p>'}</section>
        <section class="painel"><h2>Leitores mais ativos</h2>
          ${r.leitoresAtivos.length ? `<ul class="lista-simples">${r.leitoresAtivos.map((m) => `<li>${esc(m.nome)}<b>${m.total}</b></li>`).join('')}</ul>` : '<p class="muted">Sem empréstimos ainda.</p>'}</section>
      </div>
      <section class="painel" style="margin-top:22px"><h2>Empréstimos por categoria</h2>
        <ul class="lista-simples">${r.porCategoria.map((c) => `<li style="align-items:center"><span style="min-width:120px">${esc(c.nome)}</span>
          <span class="barra" style="flex:1"><i style="width:${(Number(c.emprestimos) / maxCat) * 100}%"></i></span><b>${c.emprestimos}</b></li>`).join('')}</ul></section>`;
  }

  async function abaLivros(el) {
    const [livros, categorias] = await Promise.all([api('/livros'), api('/categorias')]);
    el.innerHTML = `
      <div class="barra-topo"><p class="muted" style="margin:0">${livros.length} ${plural(livros.length, 'título', 'títulos')} cadastrados</p>
        <button class="btn mint" id="novo-livro" type="button">Novo livro</button></div>
      <div class="tabela-wrap"><table><thead><tr><th>Título</th><th>Autores</th><th>Categoria</th><th>Exemplares</th><th>Ações</th></tr></thead><tbody>
      ${livros.map((l) => `<tr><td><a href="#/livro/${l.id_livro}">${esc(l.titulo)}</a></td><td>${esc(l.autores)}</td><td>${esc(l.categoria)}</td>
        <td>${l.disponiveis} / ${l.total_exemplares}</td>
        <td class="acoes"><button class="btn sec mini" data-ed="${l.id_livro}" type="button">Editar</button>
          <button class="btn sec mini" data-ex="${l.id_livro}" type="button">Exemplares</button>
          <button class="btn perigo mini" data-del="${l.id_livro}" type="button">Excluir</button></td></tr>`).join('')}
      </tbody></table></div>`;
    const recarregar = () => telaAdmin('livros');
    document.getElementById('novo-livro').addEventListener('click', () => formLivro(null, categorias, recarregar));
    el.querySelectorAll('[data-ed]').forEach((b) => b.addEventListener('click', () => formLivro(livros.find((l) => String(l.id_livro) === b.dataset.ed), categorias, recarregar)));
    el.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => modalExemplares(b.dataset.ex, livros.find((l) => String(l.id_livro) === b.dataset.ex).titulo, recarregar)));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const l = livros.find((x) => String(x.id_livro) === b.dataset.del);
      if (!confirm(`Excluir "${l.titulo}"? Esta ação não pode ser desfeita.`)) return;
      try { await api('/livros/' + l.id_livro, { method: 'DELETE' }); toast('Livro excluído.'); recarregar(); }
      catch (e) { toast(e.message, 'erro'); }
    }));
  }

  function formLivro(l, categorias, aoSalvar) {
    abrirModal(`
      <form class="form" id="f-livro" novalidate>
        <h2>${l ? 'Editar livro' : 'Novo livro'}</h2>
        <label>Título<input name="titulo" maxlength="150" required value="${esc(l && l.titulo)}"></label>
        <label>Autores <small>separe vários por vírgula</small><input name="autores" required value="${esc(l && l.autores)}"></label>
        <div class="linha">
          <label>Categoria<select name="id_categoria" required>${categorias.map((c) => `<option value="${c.id_categoria}"${l && l.id_categoria === c.id_categoria ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
          <label>Ano<input name="ano" type="number" min="1000" max="2100" value="${esc(l && l.ano)}"></label>
        </div>
        <label>ISBN<input name="isbn" maxlength="20" value="${esc(l && l.isbn)}"></label>
        <label>Sinopse<textarea name="sinopse" rows="4">${esc(l && l.sinopse)}</textarea></label>
        ${l ? '' : '<label>Quantidade de exemplares<input name="exemplares" type="number" min="0" max="50" value="1"></label>'}
        <p class="erro-form" role="alert"></p>
        <div class="acoes"><button class="btn sec" type="button" data-fechar>Cancelar</button><button class="btn mint">Salvar livro</button></div>
      </form>`);
    ligarForm(document.getElementById('f-livro'), async (d) => {
      if (!d.titulo.trim()) throw new Error('Informe o título.');
      if (!d.autores.trim()) throw new Error('Informe pelo menos um autor.');
      await api(l ? '/livros/' + l.id_livro : '/livros', { method: l ? 'PUT' : 'POST', body: d });
      fecharModal();
      toast(l ? 'Livro atualizado.' : 'Livro cadastrado.');
      aoSalvar();
    });
  }

  async function modalExemplares(id, tituloLivro, aoFechar) {
    const desenhar = async () => {
      const ex = await api(`/livros/${id}/exemplares`);
      abrirModal(`
        <h2>Exemplares</h2><p class="muted">${esc(tituloLivro)}</p>
        ${ex.length ? `<div class="tabela-wrap"><table><thead><tr><th>Código</th><th>Situação</th><th></th></tr></thead><tbody>
          ${ex.map((e) => `<tr><td>${esc(e.codigo)}</td>
            <td>${e.status === 'disponivel' ? '<span class="badge ok">Disponível</span>' : e.status === 'emprestado' ? '<span class="badge alerta">Emprestado</span>' : '<span class="badge neutro">Indisponível</span>'}</td>
            <td>${e.status === 'emprestado' ? '' : `<button class="btn sec mini" data-st="${e.id_exemplar}" data-novo="${e.status === 'disponivel' ? 'indisponivel' : 'disponivel'}" type="button">${e.status === 'disponivel' ? 'Marcar indisponível' : 'Marcar disponível'}</button>`}</td></tr>`).join('')}
          </tbody></table></div>` : '<p class="vazio">Nenhum exemplar cadastrado.</p>'}
        <form class="form" id="f-ex" style="margin-top:16px"><div class="linha">
          <label>Adicionar exemplares<input name="quantidade" type="number" min="1" max="50" value="1"></label>
          <div style="display:flex;align-items:end"><button class="btn mint">Adicionar</button></div></div>
          <p class="erro-form" role="alert"></p></form>
        <div class="acoes" style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn sec" type="button" data-fechar>Fechar</button></div>`);
      modal.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', async () => {
        try { await api('/livros/exemplares/' + b.dataset.st + '/status', { method: 'PUT', body: { status: b.dataset.novo } }); desenhar(); }
        catch (e) { toast(e.message, 'erro'); }
      }));
      ligarForm(document.getElementById('f-ex'), async (d) => {
        await api(`/livros/${id}/exemplares`, { method: 'POST', body: { quantidade: Number(d.quantidade) } });
        toast('Exemplares adicionados.');
        desenhar();
      });
    };
    modal.addEventListener('close', aoFechar, { once: true });
    await desenhar();
  }

  async function abaEmprestimos(el) {
    const p = new URLSearchParams((location.hash.split('?')[1]) || '');
    const status = p.get('status') || 'abertos';
    const lista = await api('/emprestimos?status=' + (status === 'todos' ? '' : status));
    el.innerHTML = `
      <div class="barra-topo">
        <label style="display:flex;gap:8px;align-items:center;font-weight:600">Mostrar
          <select id="filtro-emp" class="campo-inline" style="width:auto">
            ${[['abertos', 'Em aberto'], ['atrasado', 'Atrasados'], ['devolvido', 'Devolvidos'], ['todos', 'Todos']].map(([v, n]) => `<option value="${v}"${v === status ? ' selected' : ''}>${n}</option>`).join('')}
          </select></label>
        <span class="muted">${lista.length} ${plural(lista.length, 'registro', 'registros')}</span></div>
      ${lista.length ? `<div class="tabela-wrap"><table><thead><tr><th>Livro</th><th>Exemplar</th><th>Leitor</th><th>Retirada</th><th>Previsto</th><th>Devolvido</th><th>Situação</th><th></th></tr></thead><tbody>
      ${lista.map((e) => `<tr><td>${esc(e.titulo)}</td><td>${esc(e.codigo)}</td><td>${esc(e.usuario)}<br><small>${esc(e.email)}</small></td>
        <td>${fmtData(e.data_emprestimo)}</td><td>${fmtData(e.data_prevista)}</td><td>${fmtData(e.data_devolucao)}</td>
        <td>${badgeStatus(e.status)}${e.dias_atraso ? `<br><small>${e.dias_atraso} ${plural(e.dias_atraso, 'dia', 'dias')}</small>` : ''}</td>
        <td>${e.data_devolucao ? '' : `<button class="btn mint mini" data-dev="${e.id_emprestimo}" type="button">Registrar devolução</button>`}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="vazio">Nenhum empréstimo nesta lista.</p>'}`;
    document.getElementById('filtro-emp').addEventListener('change', (e) => {
      const novo = '#/admin/emprestimos?status=' + e.target.value;
      if (novo === location.hash) rotear(); else location.hash = novo;
    });
    el.querySelectorAll('[data-dev]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await api(`/emprestimos/${b.dataset.dev}/devolver`, { method: 'POST' }); toast('Devolução registrada.'); rotear(); }
      catch (e) { toast(e.message, 'erro'); b.disabled = false; }
    }));
  }

  async function abaReservas(el) {
    const lista = await api('/reservas');
    el.innerHTML = lista.length ? `<div class="tabela-wrap"><table><thead><tr><th>Livro</th><th>Leitor</th><th>Reservado em</th><th>Fila</th><th>Situação</th><th></th></tr></thead><tbody>
      ${lista.map((r) => `<tr><td>${esc(r.titulo)}</td><td>${esc(r.usuario)}</td><td>${fmtData(r.data_reserva)}</td>
        <td>${r.status === 'ativa' ? r.posicao_fila + 'º' + (r.posicao_fila <= r.disponiveis ? ' <span class="badge ok">exemplar liberado</span>' : '') : '—'}</td>
        <td>${badgeStatus(r.status)}</td>
        <td>${r.status === 'ativa' ? `<button class="btn perigo mini" data-cancelar="${r.id_reserva}" type="button">Cancelar</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="vazio">Nenhuma reserva registrada.</p>';
    el.querySelectorAll('[data-cancelar]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Cancelar esta reserva?')) return;
      try { await api('/reservas/' + b.dataset.cancelar, { method: 'DELETE' }); toast('Reserva cancelada.'); rotear(); }
      catch (e) { toast(e.message, 'erro'); }
    }));
  }

  async function abaCategorias(el) {
    const cats = await api('/categorias');
    el.innerHTML = `
      <form class="form painel" id="f-cat" style="max-width:480px;margin-bottom:20px">
        <label>Nova categoria<input name="nome" maxlength="50" required></label>
        <p class="erro-form" role="alert"></p>
        <div class="acoes"><button class="btn mint">Adicionar categoria</button></div>
      </form>
      <div class="tabela-wrap"><table><thead><tr><th>Categoria</th><th>Livros</th><th>Ações</th></tr></thead><tbody>
      ${cats.map((c) => `<tr><td>${esc(c.nome)}</td><td>${c.total_livros}</td>
        <td class="acoes"><button class="btn sec mini" data-ren="${c.id_categoria}" type="button">Renomear</button>
        <button class="btn perigo mini" data-del="${c.id_categoria}" type="button">Excluir</button></td></tr>`).join('')}
      </tbody></table></div>`;
    ligarForm(document.getElementById('f-cat'), async (d) => {
      await api('/categorias', { method: 'POST', body: { nome: d.nome } });
      toast('Categoria adicionada.');
      telaAdmin('categorias');
    });
    el.querySelectorAll('[data-ren]').forEach((b) => b.addEventListener('click', () => {
      const c = cats.find((x) => String(x.id_categoria) === b.dataset.ren);
      abrirModal(`<form class="form" id="f-ren" novalidate><h2>Renomear categoria</h2>
        <label>Nome<input name="nome" maxlength="50" required value="${esc(c.nome)}"></label>
        <p class="erro-form" role="alert"></p>
        <div class="acoes"><button class="btn sec" type="button" data-fechar>Cancelar</button><button class="btn mint">Salvar</button></div></form>`);
      ligarForm(document.getElementById('f-ren'), async (d) => {
        await api('/categorias/' + c.id_categoria, { method: 'PUT', body: { nome: d.nome } });
        fecharModal(); toast('Categoria atualizada.'); telaAdmin('categorias');
      });
    }));
    el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const c = cats.find((x) => String(x.id_categoria) === b.dataset.del);
      if (!confirm(`Excluir a categoria "${c.nome}"?`)) return;
      try { await api('/categorias/' + c.id_categoria, { method: 'DELETE' }); toast('Categoria excluída.'); telaAdmin('categorias'); }
      catch (e) { toast(e.message, 'erro'); }
    }));
  }

  async function abaUsuarios(el) {
    const lista = await api('/usuarios');
    el.innerHTML = `<div class="tabela-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Cadastro</th><th>Empréstimos</th><th>Perfil</th></tr></thead><tbody>
      ${lista.map((u) => `<tr><td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td>${esc(u.telefone) || '—'}</td><td>${fmtData(u.criado_em)}</td><td>${u.emprestimos_ativos}</td>
        <td>${u.id_usuario === state.user.id_usuario ? '<span class="badge neutro">Bibliotecário (você)</span>'
          : `<select class="campo-inline" data-perfil="${u.id_usuario}" aria-label="Perfil de ${esc(u.nome)}" style="width:auto">
              <option value="leitor"${u.perfil === 'leitor' ? ' selected' : ''}>Leitor</option>
              <option value="bibliotecario"${u.perfil === 'bibliotecario' ? ' selected' : ''}>Bibliotecário</option></select>`}</td></tr>`).join('')}
      </tbody></table></div>`;
    el.querySelectorAll('[data-perfil]').forEach((s) => s.addEventListener('change', async () => {
      try { await api(`/usuarios/${s.dataset.perfil}/perfil`, { method: 'PUT', body: { perfil: s.value } }); toast('Perfil atualizado.'); }
      catch (e) { toast(e.message, 'erro'); abaUsuarios(el); }
    }));
  }

  // ---------- rotas ----------
  const rotas = [
    [/^#?\/?$/, telaInicio],
    [/^#\/catalogo(?:\?(.*))?$/, telaCatalogo],
    [/^#\/livro\/(\d+)$/, telaLivro],
    [/^#\/login$/, telaLogin],
    [/^#\/cadastro$/, telaCadastro],
    [/^#\/perfil$/, telaPerfil],
    [/^#\/admin(?:\/(\w+))?(?:\?.*)?$/, telaAdmin],
  ];
  let ultimoHash = null;
  async function rotear() {
    const hash = location.hash || '#/';
    const mudou = hash !== ultimoHash;
    ultimoHash = hash;
    fecharMenu();
    document.body.classList.toggle('area-admin', hash.startsWith('#/admin'));
    renderNav();
    for (const [re, fn] of rotas) {
      const m = hash.match(re);
      if (m) {
        try { await fn(...m.slice(1)); } catch (e) { erroTela(e); }
        if (mudou) { window.scrollTo(0, 0); app.focus({ preventScroll: true }); }
        return;
      }
    }
    titulo('Página não encontrada');
    app.innerHTML = '<div class="vazio"><p><strong>Página não encontrada.</strong></p><a class="btn sec" href="#/">Voltar ao início</a></div>';
  }
  window.addEventListener('hashchange', rotear);

  (async function iniciar() {
    if (state.token) {
      try { state.user = (await api('/auth/me')).usuario; }
      catch { state.token = null; localStorage.removeItem('dl_token'); }
    }
    rotear();
  })();
})();
