// backend-mysql/services/PgdasReportService.js

class PgdasReportService {
    constructor(pgdasReportDAO, pdfParserUtil) {
        this.pgdasReportDAO = pgdasReportDAO;
        this.pdfParserUtil = pdfParserUtil;
    }

    async processAndSaveReport(filePath) {
        try {
            // Chama a função 'extractDataFromPdfFile' que lê o arquivo e extrai todos os dados.
            const extractedData = await this.pdfParserUtil.extractDataFromPdfFile(filePath);

            if (!extractedData || !extractedData.cnpj || !extractedData.periodoApuracao) {
                throw new Error('CNPJ ou Período de Apuração não puderam ser extraídos do PDF. O arquivo pode ser inválido ou de um tipo não suportado.');
            }

            // Verifica se o documento já existe
            const existingReport = await this.pgdasReportDAO.findByCnpjAndPeriod(extractedData.cnpj, extractedData.periodoApuracao);
            if (existingReport) {
                return { success: false, message: 'Este documento já foi processado e salvo anteriormente.', recordId: existingReport.id };
            }

            const recordId = await this.pgdasReportDAO.create(extractedData);
            return { success: true, recordId };

        } finally {
            // Garante que o arquivo temporário seja removido, mesmo se ocorrer um erro.
            require('fs').unlinkSync(filePath); 
        }
    }

    async getReportById(id) {
        const report = await this.pgdasReportDAO.findById(id);
        if (!report) {
            throw new Error('Relatório não encontrado.');
        }
        return report;
    }

    async getAllReports() {
        return await this.pgdasReportDAO.findAll();
    }

    async getReportsByCnpj(cnpj) {
        return await this.pgdasReportDAO.findAllByCnpj(cnpj);
    }
}

module.exports = PgdasReportService;