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
        // SQL ATUALIZADO: Adicionadas colunas para IPI e ISS.
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
                valor_total_debito DECIMAL(15, 2),
                irpj DECIMAL(10, 2),
                csll DECIMAL(10, 2),
                cofins DECIMAL(10, 2),
                pis_pasep DECIMAL(10, 2),
                inss_cpp DECIMAL(10, 2),
                icms DECIMAL(10, 2),
                ipi DECIMAL(10, 2),
                iss DECIMAL(10, 2),
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