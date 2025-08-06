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
        return rows[0];
    }

    async create(reportData) {
        // SQL ATUALIZADO: Adicionados os novos campos no INSERT.
        const sql = `
            INSERT INTO pgdas_reports (
                cnpj, nomeEmpresarial, periodoApuracao, receitaBrutaAcumulada, 
                receitaBrutaAno, receitasMercadoInterno, receitasMercadoExterno,
                valor_total_debito, irpj, csll, cofins, pis_pasep, inss_cpp, icms, ipi, iss
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Garante que valores numéricos nulos ou indefinidos sejam salvos como 0.
        const values = [
            reportData.cnpj,
            reportData.nomeEmpresarial,
            reportData.periodoApuracao,
            reportData.receitaBrutaAcumulada ?? 0,
            reportData.receitaBrutaAno ?? 0,
            JSON.stringify(reportData.receitasMercadoInterno || {}),
            JSON.stringify(reportData.receitasMercadoExterno || {}),
            reportData.valor_total_debito ?? 0,
            reportData.irpj ?? 0,
            reportData.csll ?? 0,
            reportData.cofins ?? 0,
            reportData.pis_pasep ?? 0,
            reportData.inss_cpp ?? 0,
            reportData.icms ?? 0,
            reportData.ipi ?? 0,
            reportData.iss ?? 0
        ];
        const [result] = await this.pool.query(sql, values);
        return result.insertId;
    }

    async findById(id) {
        const [rows] = await this.pool.query('SELECT * FROM pgdas_reports WHERE id = ?', [id]);
        if (rows.length > 0) {
            return rows[0];
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