-- =====================================================================
-- DevLibrary - Consultas SQL de exemplo (as mesmas ideias usadas pela API)
-- Rode no MySQL Workbench para treinar. Cada consulta tem um comentário
-- dizendo o que faz e em qual tela do site ela aparece.
-- =====================================================================
USE devlibrary;

-- 1) Listar todos os livros com autores e categoria  (tela: Catálogo)
SELECT l.id_livro, l.titulo, l.ano, c.nome AS categoria,
       GROUP_CONCAT(a.nome ORDER BY a.nome SEPARATOR ', ') AS autores
FROM livros l
JOIN categorias c ON c.id_categoria = l.id_categoria
JOIN livro_autor la ON la.id_livro = l.id_livro
JOIN autores a ON a.id_autor = la.id_autor
GROUP BY l.id_livro, l.titulo, l.ano, c.nome
ORDER BY l.titulo;

-- 2) Pesquisar por título (ou parte dele)  (tela: Catálogo > Pesquisar)
SELECT id_livro, titulo FROM livros WHERE titulo LIKE '%Node%';

-- 3) Filtrar por autor  (tela: Catálogo > Pesquisar)
SELECT l.titulo
FROM livros l
JOIN livro_autor la ON la.id_livro = l.id_livro
JOIN autores a ON a.id_autor = la.id_autor
WHERE a.nome LIKE '%Beatriz%';

-- 4) Filtrar por categoria  (tela: Catálogo > Categoria)
SELECT l.titulo FROM livros l
JOIN categorias c ON c.id_categoria = l.id_categoria
WHERE c.nome = 'Tecnologia';

-- 5) Disponibilidade de exemplares por livro  (telas: Catálogo e Detalhe do livro)
SELECT l.titulo,
       COUNT(e.id_exemplar) AS total,
       SUM(e.status = 'disponivel') AS disponiveis
FROM livros l
LEFT JOIN exemplares e ON e.id_livro = l.id_livro
GROUP BY l.id_livro, l.titulo
ORDER BY l.titulo;

-- 6) Empréstimos de um usuário (troque o 2 pelo id desejado)  (tela: Meu perfil)
SELECT l.titulo, em.data_emprestimo, em.data_prevista, em.data_devolucao
FROM emprestimos em
JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
JOIN livros l ON l.id_livro = ex.id_livro
WHERE em.id_usuario = 2
ORDER BY em.data_emprestimo DESC;

-- 7) Reservas ativas com posição na fila  (tela: Meu perfil / Painel > Reservas)
SELECT u.nome, l.titulo, r.data_reserva,
       (SELECT COUNT(*) FROM reservas r2
         WHERE r2.id_livro = r.id_livro AND r2.status = 'ativa' AND r2.id_reserva <= r.id_reserva) AS posicao_fila
FROM reservas r
JOIN usuarios u ON u.id_usuario = r.id_usuario
JOIN livros l ON l.id_livro = r.id_livro
WHERE r.status = 'ativa';

-- 8) Empréstimos atrasados  (tela: Painel > Empréstimos > Atrasados)
SELECT u.nome, l.titulo, em.data_prevista, DATEDIFF(CURDATE(), em.data_prevista) AS dias_atraso
FROM emprestimos em
JOIN usuarios u ON u.id_usuario = em.id_usuario
JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
JOIN livros l ON l.id_livro = ex.id_livro
WHERE em.data_devolucao IS NULL AND em.data_prevista < CURDATE();

-- 9) Histórico completo de movimentações  (tela: Painel > Empréstimos > Todos)
SELECT em.id_emprestimo, u.nome, l.titulo, em.data_emprestimo, em.data_devolucao
FROM emprestimos em
JOIN usuarios u ON u.id_usuario = em.id_usuario
JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
JOIN livros l ON l.id_livro = ex.id_livro
ORDER BY em.data_emprestimo DESC;

-- 10) Livros mais emprestados  (tela: Painel > Visão geral)
SELECT l.titulo, COUNT(*) AS total
FROM emprestimos em
JOIN exemplares ex ON ex.id_exemplar = em.id_exemplar
JOIN livros l ON l.id_livro = ex.id_livro
GROUP BY l.id_livro, l.titulo
ORDER BY total DESC;

-- 11) Média de notas por livro  (tela: Detalhe do livro)
SELECT l.titulo, ROUND(AVG(av.nota), 1) AS media, COUNT(*) AS avaliacoes
FROM avaliacoes av JOIN livros l ON l.id_livro = av.id_livro
GROUP BY l.id_livro, l.titulo;

-- 12) Como o sistema evita DOIS usuários pegarem o MESMO exemplar:
--     dentro de uma transação, "FOR UPDATE" trava a linha até o COMMIT.
-- START TRANSACTION;
-- SELECT id_exemplar FROM exemplares WHERE id_livro = 1 AND status = 'disponivel' LIMIT 1 FOR UPDATE;
-- INSERT INTO emprestimos (id_usuario, id_exemplar, data_emprestimo, data_prevista)
--   VALUES (2, <id_exemplar>, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY));
-- UPDATE exemplares SET status = 'emprestado' WHERE id_exemplar = <id_exemplar>;
-- COMMIT;
