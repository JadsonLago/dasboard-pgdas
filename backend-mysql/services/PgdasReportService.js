// backend-mysql/services/PgdasReportService.js

const pdfParse = require('pdf-parse'); // Para ler o buffer do PDF

class PgdasReportService {
    constructor(pgdasReportDAO, pdfParserUtil) {
        this.pgdasReportDAO = pgdasReportDAO;
        this.pdfParserUtil = pdfParserUtil;
    }

    async processAndSaveReport(filePath) {
        try {
            const dataBuffer = require('fs').readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            const extractedData = this.pdfParserUtil.extractDataFromPdfText(pdfData.text);

            if (!extractedData.cnpj || !extractedData.periodoApuracao) {
                throw new Error('CNPJ ou Período de Apuração não puderam ser extraídos do PDF.');
            }

            // Verifica se o documento já existe
            const existingReport = await this.pgdasReportDAO.findByCnpjAndPeriod(extractedData.cnpj, extractedData.periodoApuracao);
            if (existingReport) {
                return { success: false, message: 'Este documento já foi processado e salvo anteriormente.', recordId: existingReport.id };
            }

            const recordId = await this.pgdasReportDAO.create(extractedData);
            return { success: true, recordId };

        } finally {
            require('fs').unlinkSync(filePath); // Garante que o arquivo temporário seja removido
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