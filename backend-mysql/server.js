// backend-mysql/server.js

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

// Importar módulos das novas camadas
const { pool, createTables } = require('./config/db');
const { extractDataFromPdfText } = require('./utils/pdfParser');
const PgdasReportDAO = require('./dao/PgdasReportDAO');
const PgdasReportService = require('./services/PgdasReportService');

const app = express();
const port = 3001;

// Inicializar DAO e Service
const pgdasReportDAO = new PgdasReportDAO(pool);
const pgdasReportService = new PgdasReportService(pgdasReportDAO, { extractDataFromPdfText }); // Passa a função extractDataFromPdfText

// Inicializar banco de dados e criar tabelas
createTables().catch(err => {
    console.error('Falha ao iniciar o banco de dados:', err);
    process.exit(1); // Encerra a aplicação se o banco de dados não puder ser inicializado
});

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
    res.send('Backend MySQL está funcionando!');
});

// Endpoint para upload e processamento
app.post('/upload', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Nenhum arquivo enviado.');
    }

    try {
        const result = await pgdasReportService.processAndSaveReport(req.file.path);
        if (result.success) {
            res.json(result);
        } else {
            res.status(409).json(result); // 409 Conflict para documentos duplicados
        }
    } catch (error) {
        console.error('Erro no upload e processamento:', error);
        res.status(500).json({ success: false, message: error.message || 'Erro interno do servidor.' });
    }
});

// Endpoint para buscar dados por ID
app.get('/data/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const data = await pgdasReportService.getReportById(id);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Erro ao buscar dados por ID:', error);
        res.status(404).json({ success: false, message: error.message || 'Dados não encontrados.' });
    }
});

// Endpoint para buscar todas as declarações (para a listagem agrupada)
app.get('/documents', async (req, res) => {
    try {
        const documents = await pgdasReportService.getAllReports();
        res.json({ success: true, documents });
    } catch (error) {
        console.error('Erro ao buscar lista de documentos:', error);
        res.status(500).json({ success: false, message: error.message || 'Erro ao buscar lista de documentos.' });
    }
});

// Endpoint para buscar declarações por CNPJ
app.get('/documents/by-cnpj/:cnpj', async (req, res) => {
    const { cnpj } = req.params;
    try {
        const documents = await pgdasReportService.getReportsByCnpj(cnpj);
        res.json({ success: true, documents });
    } catch (error) {
        console.error(`Erro ao buscar declarações para CNPJ ${cnpj}:`, error);
        res.status(500).json({ success: false, message: error.message || 'Erro ao buscar declarações por CNPJ.' });
    }
});


app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
});