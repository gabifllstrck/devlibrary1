-- =====================================================================
-- DevLibrary - Script de criação do banco de dados (MySQL 8+)
-- Execute este arquivo inteiro no MySQL Workbench (ou use: npm run setup-db)
-- Ordem: primeiro as tabelas "pai", depois as que têm chave estrangeira.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS devlibrary
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE devlibrary;

-- Apaga na ordem inversa das dependências (permite rodar o script de novo)
DROP TABLE IF EXISTS avaliacoes;
DROP TABLE IF EXISTS reservas;
DROP TABLE IF EXISTS emprestimos;
DROP TABLE IF EXISTS exemplares;
DROP TABLE IF EXISTS livro_autor;
DROP TABLE IF EXISTS livros;
DROP TABLE IF EXISTS autores;
DROP TABLE IF EXISTS categorias;
DROP TABLE IF EXISTS usuarios;

-- 1) Usuários (leitores e bibliotecários)
CREATE TABLE usuarios (
  id_usuario  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome        VARCHAR(100) NOT NULL,
  email       VARCHAR(100) NOT NULL,
  telefone    VARCHAR(20)  NULL,
  senha_hash  VARCHAR(255) NOT NULL,
  perfil      ENUM('leitor','bibliotecario') NOT NULL DEFAULT 'leitor',
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;

-- 2) Categorias
CREATE TABLE categorias (
  id_categoria INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome         VARCHAR(50) NOT NULL,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uq_categorias_nome (nome)
) ENGINE=InnoDB;

-- 3) Autores
CREATE TABLE autores (
  id_autor INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome     VARCHAR(100) NOT NULL,
  PRIMARY KEY (id_autor),
  UNIQUE KEY uq_autores_nome (nome)
) ENGINE=InnoDB;

-- 4) Livros (o "título" em si; as cópias físicas ficam em "exemplares")
CREATE TABLE livros (
  id_livro     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titulo       VARCHAR(150) NOT NULL,
  ano          SMALLINT NULL,
  isbn         VARCHAR(20)  NULL,
  sinopse      TEXT NULL,
  id_categoria INT UNSIGNED NOT NULL,
  criado_em    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_livro),
  UNIQUE KEY uq_livros_isbn (isbn),
  KEY idx_livros_titulo (titulo),
  KEY idx_livros_categoria (id_categoria),
  CONSTRAINT chk_livros_ano CHECK (ano IS NULL OR (ano >= 1000 AND ano <= 2100)),
  CONSTRAINT fk_livros_categoria FOREIGN KEY (id_categoria)
    REFERENCES categorias (id_categoria) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 5) Livro x Autor (relação N:N)
CREATE TABLE livro_autor (
  id_livro INT UNSIGNED NOT NULL,
  id_autor INT UNSIGNED NOT NULL,
  PRIMARY KEY (id_livro, id_autor),
  CONSTRAINT fk_la_livro FOREIGN KEY (id_livro) REFERENCES livros (id_livro) ON DELETE CASCADE,
  CONSTRAINT fk_la_autor FOREIGN KEY (id_autor) REFERENCES autores (id_autor) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6) Exemplares (cópias físicas de cada livro)
CREATE TABLE exemplares (
  id_exemplar INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_livro    INT UNSIGNED NOT NULL,
  codigo      VARCHAR(30) NOT NULL,
  status      ENUM('disponivel','emprestado','indisponivel') NOT NULL DEFAULT 'disponivel',
  PRIMARY KEY (id_exemplar),
  UNIQUE KEY uq_exemplares_codigo (codigo),
  KEY idx_exemplares_livro_status (id_livro, status),
  CONSTRAINT fk_exemplares_livro FOREIGN KEY (id_livro) REFERENCES livros (id_livro) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7) Empréstimos (data_devolucao NULL = ainda não devolvido)
CREATE TABLE emprestimos (
  id_emprestimo   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario      INT UNSIGNED NOT NULL,
  id_exemplar     INT UNSIGNED NOT NULL,
  data_emprestimo DATE NOT NULL,
  data_prevista   DATE NOT NULL,
  data_devolucao  DATE NULL,
  PRIMARY KEY (id_emprestimo),
  KEY idx_emp_usuario (id_usuario),
  KEY idx_emp_exemplar (id_exemplar),
  KEY idx_emp_aberto (data_devolucao, data_prevista),
  CONSTRAINT chk_emp_datas CHECK (data_prevista >= data_emprestimo),
  CONSTRAINT fk_emp_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE RESTRICT,
  CONSTRAINT fk_emp_exemplar FOREIGN KEY (id_exemplar) REFERENCES exemplares (id_exemplar) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 8) Reservas
CREATE TABLE reservas (
  id_reserva   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario   INT UNSIGNED NOT NULL,
  id_livro     INT UNSIGNED NOT NULL,
  data_reserva DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status       ENUM('ativa','atendida','cancelada') NOT NULL DEFAULT 'ativa',
  PRIMARY KEY (id_reserva),
  KEY idx_res_livro_status (id_livro, status),
  KEY idx_res_usuario (id_usuario),
  CONSTRAINT fk_res_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_res_livro FOREIGN KEY (id_livro) REFERENCES livros (id_livro) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9) Avaliações (uma por usuário por livro)
CREATE TABLE avaliacoes (
  id_avaliacao INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_usuario   INT UNSIGNED NOT NULL,
  id_livro     INT UNSIGNED NOT NULL,
  nota         TINYINT UNSIGNED NOT NULL,
  comentario   VARCHAR(500) NULL,
  data_avaliacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_avaliacao),
  UNIQUE KEY uq_avaliacao_usuario_livro (id_usuario, id_livro),
  CONSTRAINT chk_avaliacao_nota CHECK (nota BETWEEN 1 AND 5),
  CONSTRAINT fk_av_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_av_livro FOREIGN KEY (id_livro) REFERENCES livros (id_livro) ON DELETE CASCADE
) ENGINE=InnoDB;
