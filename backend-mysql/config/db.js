// backend-mysql/config/db.js

const mysql = require('mysql2/promise');

// Configuração do banco de dados MySQL
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'dashboard_app'
};

const pool = mysql.createPool(dbConfig);

// Função para criar a tabela se ela não existir
const createTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS pgdas_reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cnpj VARCHAR(255),
                nomeEmpresarial VARCHAR(255),
                periodoApuracao VARCHAR(255),
                receitaBrutaAcumulada DECIMAL(15, 2),
                receitaBrutaAno DECIMAL(15, 2),
                receitasMercadoInterno JSON,
                receitasMercadoExterno JSON,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_cnpj_periodo (cnpj, periodoApuracao)
            )
        `);
        console.log('Tabela pgdas_reports verificada/criada com sucesso.');
    } catch (error) {
        console.error('Erro ao criar ou verificar a tabela:', error);
        throw error; // Propaga o erro para ser tratado no server.js
    }
};

module.exports = {
    pool,
    createTables
};