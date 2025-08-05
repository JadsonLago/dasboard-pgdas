// backend-mysql/dao/PgdasReportDAO.js

class PgdasReportDAO {
    constructor(pool) {
        this.pool = pool;
    }

    async findByCnpjAndPeriod(cnpj, periodoApuracao) {
        const [rows] = await this.pool.query(
            'SELECT id FROM pgdas_reports WHERE cnpj = ? AND periodoApuracao = ?',
            [cnpj, periodoApuracao]
        );
        return rows[0]; // Retorna o primeiro registro encontrado ou undefined
    }

    async create(reportData) {
        const sql = `INSERT INTO pgdas_reports (cnpj, nomeEmpresarial, periodoApuracao, receitaBrutaAcumulada, receitaBrutaAno, receitasMercadoInterno, receitasMercadoExterno) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const values = [
            reportData.cnpj,
            reportData.nomeEmpresarial,
            reportData.periodoApuracao,
            reportData.receitaBrutaAcumulada,
            reportData.receitaBrutaAno,
            JSON.stringify(reportData.receitasMercadoInterno),
            JSON.stringify(reportData.receitasMercadoExterno)
        ];
        const [result] = await this.pool.query(sql, values);
        return result.insertId;
    }

    async findById(id) {
        const [rows] = await this.pool.query('SELECT * FROM pgdas_reports WHERE id = ?', [id]);
        if (rows.length > 0) {
            return rows[0]; // O driver já converte JSON para objeto
        }
        return null;
    }

    async findAll() {
        const [rows] = await this.pool.query('SELECT id, cnpj, nomeEmpresarial, periodoApuracao, createdAt FROM pgdas_reports ORDER BY createdAt DESC');
        return rows;
    }

    async findAllByCnpj(cnpj) {
        const [rows] = await this.pool.query(
            'SELECT id, cnpj, nomeEmpresarial, periodoApuracao, createdAt FROM pgdas_reports WHERE cnpj = ? ORDER BY periodoApuracao DESC',
            [cnpj]
        );
        return rows;
    }
}

module.exports = PgdasReportDAO;