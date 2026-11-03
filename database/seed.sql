-- =====================================================================
-- DevLibrary - Dados FICTÍCIOS para teste
-- Execute DEPOIS do schema.sql (ou use: npm run setup-db)
-- Senha de todos os usuários de teste: 123456
-- =====================================================================
USE devlibrary;

INSERT INTO usuarios (nome, email, telefone, senha_hash, perfil) VALUES
  ('Marina Duarte','bibliotecaria@devlibrary.com','(11) 90000-0001','$2a$10$9y7hJsgPS21Y7mb18yxpiOIu9pqftBqV4mU3vUNrktKNBRje1e3Ji','bibliotecario'),
  ('Lucas Almeida','leitor@devlibrary.com','(11) 90000-0002','$2a$10$9y7hJsgPS21Y7mb18yxpiOIu9pqftBqV4mU3vUNrktKNBRje1e3Ji','leitor'),
  ('Camila Souza','camila@devlibrary.com','(11) 90000-0003','$2a$10$9y7hJsgPS21Y7mb18yxpiOIu9pqftBqV4mU3vUNrktKNBRje1e3Ji','leitor');

INSERT INTO categorias (nome) VALUES
  ('Tecnologia'),
  ('Ficção'),
  ('Romance'),
  ('História'),
  ('Culinária'),
  ('Autoajuda'),
  ('Infantil'),
  ('Ciências');

INSERT INTO autores (nome) VALUES
  ('Helena Marques'),
  ('Rafael Tavares'),
  ('Iara Campos'),
  ('Beatriz Lemos'),
  ('Otávio Brandão'),
  ('Clarice Nogueira'),
  ('Daniel Furtado'),
  ('Mônica Prado');

INSERT INTO livros (titulo, ano, isbn, sinopse, id_categoria) VALUES
  ('Algoritmos para Curiosos',2021,'978-65-0000-001-1','Uma introdução leve à lógica de programação e aos algoritmos, com exemplos do dia a dia.',1),
  ('Banco de Dados sem Mistério',2020,'978-65-0000-002-8','Modelagem, SQL e boas práticas explicadas passo a passo, do DER ao SELECT.',1),
  ('Construindo APIs com Node',2022,'978-65-0000-003-5','Como criar APIs REST seguras e organizadas com Node.js, Express e MySQL.',1),
  ('O Farol de Vidro',2018,'978-65-0000-004-2','Um farol que guarda memórias de quem passou por ele. Uma aventura entre o real e o imaginário.',2),
  ('A Cidade dos Relógios Parados',2019,'978-65-0000-005-9','Numa cidade onde o tempo parou, uma jovem relojoeira procura o último ponteiro em movimento.',2),
  ('Cartas ao Vento Sul',2016,'978-65-0000-006-6','Duas pessoas, uma troca de cartas e uma distância que parece não acabar.',3),
  ('Um Verão em Pedra Azul',2020,'978-65-0000-007-3','Um reencontro inesperado em uma pequena cidade de serra muda os planos de uma família.',3),
  ('Breve História das Máquinas',2017,'978-65-0000-008-0','Das alavancas aos computadores: como as máquinas moldaram a sociedade.',4),
  ('Rotas do Açúcar e do Sal',2015,'978-65-0000-009-7','As rotas comerciais que ligaram povos e mudaram a mesa de cada continente.',4),
  ('Cozinha de Panela Única',2022,'978-65-0000-010-3','Receitas práticas para o dia a dia, feitas com uma panela só e pouca louça.',5),
  ('Mente Calma, Rotina Leve',2021,'978-65-0000-011-0','Pequenos hábitos para organizar o tempo e diminuir a ansiedade do cotidiano.',6),
  ('Pequenos Exploradores do Espaço',2023,'978-65-0000-012-7','Uma viagem ilustrada pelo sistema solar para leitores curiosos.',7),
  ('O Dragão que Tinha Medo de Fogo',2019,'978-65-0000-013-4','Um dragão diferente descobre que coragem não é a ausência de medo.',7),
  ('Introdução à Estatística Aplicada',2019,'978-65-0000-014-1','Conceitos de estatística com exemplos reais, gráficos e exercícios resolvidos.',8);

INSERT INTO livro_autor (id_livro, id_autor) VALUES
  (1,1),
  (2,2),
  (3,2),
  (3,3),
  (4,4),
  (5,5),
  (6,4),
  (7,6),
  (8,3),
  (9,5),
  (10,6),
  (11,7),
  (12,1),
  (13,7),
  (14,8);

INSERT INTO exemplares (id_livro, codigo, status) VALUES
  (1,'LIV1-01','disponivel'),
  (1,'LIV1-02','disponivel'),
  (1,'LIV1-03','disponivel'),
  (2,'LIV2-01','disponivel'),
  (2,'LIV2-02','disponivel'),
  (3,'LIV3-01','disponivel'),
  (3,'LIV3-02','disponivel'),
  (4,'LIV4-01','disponivel'),
  (4,'LIV4-02','disponivel'),
  (5,'LIV5-01','disponivel'),
  (6,'LIV6-01','disponivel'),
  (6,'LIV6-02','disponivel'),
  (7,'LIV7-01','disponivel'),
  (7,'LIV7-02','disponivel'),
  (8,'LIV8-01','disponivel'),
  (8,'LIV8-02','disponivel'),
  (9,'LIV9-01','disponivel'),
  (10,'LIV10-01','disponivel'),
  (10,'LIV10-02','disponivel'),
  (10,'LIV10-03','disponivel'),
  (11,'LIV11-01','disponivel'),
  (11,'LIV11-02','disponivel'),
  (12,'LIV12-01','disponivel'),
  (12,'LIV12-02','disponivel'),
  (12,'LIV12-03','disponivel'),
  (13,'LIV13-01','disponivel'),
  (13,'LIV13-02','disponivel'),
  (14,'LIV14-01','disponivel'),
  (14,'LIV14-02','disponivel');

-- Movimentações de exemplo (datas relativas a hoje, para o atraso sempre aparecer)
INSERT INTO emprestimos (id_usuario, id_exemplar, data_emprestimo, data_prevista, data_devolucao)
SELECT 2, id_exemplar, DATE_SUB(CURDATE(), INTERVAL 5 DAY), DATE_ADD(CURDATE(), INTERVAL 9 DAY), NULL FROM exemplares WHERE codigo='LIV5-01';
INSERT INTO emprestimos (id_usuario, id_exemplar, data_emprestimo, data_prevista, data_devolucao)
SELECT 2, id_exemplar, DATE_SUB(CURDATE(), INTERVAL 2 DAY), DATE_ADD(CURDATE(), INTERVAL 12 DAY), NULL FROM exemplares WHERE codigo='LIV1-01';
INSERT INTO emprestimos (id_usuario, id_exemplar, data_emprestimo, data_prevista, data_devolucao)
SELECT 2, id_exemplar, DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_SUB(CURDATE(), INTERVAL 46 DAY), DATE_SUB(CURDATE(), INTERVAL 48 DAY) FROM exemplares WHERE codigo='LIV4-01';
INSERT INTO emprestimos (id_usuario, id_exemplar, data_emprestimo, data_prevista, data_devolucao)
SELECT 3, id_exemplar, DATE_SUB(CURDATE(), INTERVAL 25 DAY), DATE_SUB(CURDATE(), INTERVAL 11 DAY), NULL FROM exemplares WHERE codigo='LIV9-01';
INSERT INTO emprestimos (id_usuario, id_exemplar, data_emprestimo, data_prevista, data_devolucao)
SELECT 3, id_exemplar, DATE_SUB(CURDATE(), INTERVAL 40 DAY), DATE_SUB(CURDATE(), INTERVAL 26 DAY), DATE_SUB(CURDATE(), INTERVAL 30 DAY) FROM exemplares WHERE codigo='LIV2-01';

-- Exemplares que estão emprestados agora
UPDATE exemplares SET status='emprestado'
WHERE id_exemplar IN (SELECT id_exemplar FROM emprestimos WHERE data_devolucao IS NULL);

INSERT INTO reservas (id_usuario, id_livro, status) VALUES (3, 5, 'ativa'), (2, 9, 'ativa');

INSERT INTO avaliacoes (id_usuario, id_livro, nota, comentario) VALUES
  (2, 4, 5, 'Uma leitura envolvente do início ao fim.'),
  (2, 2, 5, 'Explica SQL de um jeito que finalmente fez sentido.'),
  (3, 2, 4, 'Ótimos exemplos práticos.');
