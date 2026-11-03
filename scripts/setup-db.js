// Cria o banco, as tabelas e os dados de teste lendo database/schema.sql e database/seed.sql
// Uso: npm run setup-db
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true, // permite rodar o arquivo .sql inteiro de uma vez
  });
  for (const arquivo of ['schema.sql', 'seed.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', arquivo), 'utf8');
    console.log('Executando', arquivo, '...');
    await conn.query(sql);
  }
  await conn.end();
  console.log('\nBanco "devlibrary" criado com sucesso!');
  console.log('Usuários de teste (senha 123456):');
  console.log('  bibliotecaria@devlibrary.com  (administradora)');
  console.log('  leitor@devlibrary.com         (leitor)');
  console.log('  camila@devlibrary.com         (leitora)');
}

main().catch((e) => {
  console.error('\nERRO ao criar o banco:', e.code || '', e.message);
  if (e.code === 'ECONNREFUSED') console.error('-> O MySQL não está ligado. Inicie o serviço MySQL80.');
  if (e.code === 'ER_ACCESS_DENIED_ERROR') console.error('-> Usuário ou senha do MySQL incorretos. Confira DB_USER e DB_PASSWORD no arquivo .env');
  process.exit(1);
});
