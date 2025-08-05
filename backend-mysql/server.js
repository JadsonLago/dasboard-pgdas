// backend-mysql/server.js

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

const app = express();
const port = 3001;

// Configuração do banco de dados MySQL
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'dashboard_app'
};

let pool;

// Função para estabelecer a conexão com o banco de dados
const initializeDatabase = async () => {
    try {
        pool = mysql.createPool(dbConfig);
        console.log('Conectado ao banco de dados MySQL!');

        // Cria a tabela se ela não existir
        // Adicionadas colunas para receitas de Mercado Interno e Mercado Externo
        const [rows] = await pool.query(`
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
        console.error('Erro ao conectar ou inicializar o banco de dados:', error);
        process.exit(1);
    }
};

initializeDatabase();

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
    res.send('Backend MySQL está funcionando!');
});

// Nova função para extrair receitas mensais de um bloco de texto
const extractMonthlyRevenues = (content) => {
    const revenues = {};
    // Regex para encontrar todas as datas (DD/AAAA)
    const datePattern = /\d{2}\/\d{4}/g;
    let dates = [];
    let dateMatch;
    // Coleta todas as datas e suas posições no texto
    while ((dateMatch = datePattern.exec(content)) !== null) {
        dates.push({ date: dateMatch[0], index: dateMatch.index });
    }

    // Garante que as datas estejam em ordem cronológica (pelo índice no texto)
    dates.sort((a, b) => a.index - b.index);

    // Itera sobre as datas para extrair o valor correspondente
    for (let i = 0; i < dates.length; i++) {
        const currentMonthYear = dates[i].date;
        const startIndex = dates[i].index + currentMonthYear.length;
        // O endIndex é o início da próxima data ou o final do conteúdo
        const endIndex = (i + 1 < dates.length) ? dates[i + 1].index : content.length;

        // Extrai o segmento de texto entre a data atual e a próxima data
        let segment = content.substring(startIndex, endIndex).trim();

        // Regex refinada para o formato numérico brasileiro:
        // Captura números inteiros (ex: "900")
        // Ou números com pontos de milhar opcionais e vírgula decimal com 1 ou 2 dígitos (ex: "32.326,75", "0,00", "1,2")
        const valuePattern = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/;
        const valueMatch = segment.match(valuePattern);

        let value = 0; // Valor padrão se não for encontrado
        if (valueMatch && valueMatch[1]) {
            const valorStr = valueMatch[1];
            // Limpa o valor removendo pontos de milhar e substituindo vírgula por ponto decimal
            value = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'));
        }
        
        if (!isNaN(value)) { // Garante que o valor é um número válido
            revenues[currentMonthYear] = value;
        }
    }
    return revenues;
};


// Função para extrair dados do texto do PDF (revisada para receitas mensais)
const extractDataFromPdfText = (text) => {
    const data = {};

    const cnpjRegex = /CNPJ Matriz:\s*([\d.\-/\s]+)/;
    const nomeEmpresarialRegex = /Nome empresarial:\s*([^\n]+)/;
    const periodoApuracaoRegex = /Período de Apuração:\s*([^\n]+)/;
    const receitaBrutaAcumuladaRegex = /Receita bruta acumulada nos doze meses anteriores\s+ao PA \(RBT12\)\s+([0-9.,]+)/;
    const receitaBrutaAnoRegex = /Receita bruta acumulada no ano-calendário corrente\s+\(RBA\)\s+([0-9.,]+)/;

    const cnpjMatch = text.match(cnpjRegex);
    if (cnpjMatch) data.cnpj = cnpjMatch[1].trim();

    const nomeEmpresarialMatch = text.match(nomeEmpresarialRegex);
    if (nomeEmpresarialMatch) data.nomeEmpresarial = nomeEmpresarialMatch[1].trim();

    const periodoApuracaoMatch = text.match(periodoApuracaoRegex);
    if (periodoApuracaoMatch) data.periodoApuracao = periodoApuracaoMatch[1].trim();

    const receitaBrutaAcumuladaMatch = text.match(receitaBrutaAcumuladaRegex);
    if (receitaBrutaAcumuladaMatch) data.receitaBrutaAcumulada = parseFloat(receitaBrutaAcumuladaMatch[1].replace(/\./g, '').replace(',', '.'));
    
    const receitaBrutaAnoMatch = text.match(receitaBrutaAnoRegex);
    if (receitaBrutaAnoMatch) data.receitaBrutaAno = parseFloat(receitaBrutaAnoMatch[1].replace(/\./g, '').replace(',', '.'));

    const receitasMercadoInterno = {};
    const receitasMercadoExterno = {};

    // Captura o texto entre "2.2) Receitas Brutas Anteriores (R$)" e "2.3) Folha de Salários Anteriores (R$)"
    const fullRevenuesBlockRegex = /2\.2\)\s*Receitas Brutas Anteriores \(R\$\)([\s\S]*?)2\.3\)\s*Folha de Salários Anteriores/;
    const fullRevenuesBlockMatch = text.match(fullRevenuesBlockRegex);
    let fullRevenuesBlockText = fullRevenuesBlockMatch ? fullRevenuesBlockMatch[1] : '';

    // Normaliza o texto removendo quebras de linha e múltiplos espaços para facilitar a regex
    // Também remove aspas e vírgulas soltas que podem vir da extração do PDF
    fullRevenuesBlockText = fullRevenuesBlockText.replace(/["']/g, '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

    // Encontra os índices de início e fim das seções de mercado interno e externo
    const internalMarketStartMarker = '2.2.1) Mercado Interno';
    const externalMarketStartMarker = '2.2.2) Mercado Externo';
    // Ajustado para o texto normalizado (sem acento)
    const nextSectionMarker = '2.3) Folha de Salarios Anteriores'; 

    const internalStartIndex = fullRevenuesBlockText.indexOf(internalMarketStartMarker);
    const externalStartIndex = fullRevenuesBlockText.indexOf(externalMarketStartMarker);
    const nextSectionIndex = fullRevenuesBlockText.indexOf(nextSectionMarker);

    let internalMarketContent = '';
    let externalMarketContent = '';

    if (internalStartIndex !== -1) {
        let internalEndIndex = externalStartIndex !== -1 ? externalStartIndex : nextSectionIndex;
        if (internalEndIndex === -1) { // Se não houver marcador de mercado externo ou próxima seção, vai até o fim do bloco
            internalEndIndex = fullRevenuesBlockText.length;
        }
        internalMarketContent = fullRevenuesBlockText.substring(internalStartIndex + internalMarketStartMarker.length, internalEndIndex).trim();
    }

    if (externalStartIndex !== -1) {
        let externalEndIndex = nextSectionIndex !== -1 ? nextSectionIndex : fullRevenuesBlockText.length;
        externalMarketContent = fullRevenuesBlockText.substring(externalStartIndex + externalMarketStartMarker.length, externalEndIndex).trim();
    }

    // Usa a nova função para extrair as receitas de cada mercado
    data.receitasMercadoInterno = extractMonthlyRevenues(internalMarketContent);
    data.receitasMercadoExterno = extractMonthlyRevenues(externalMarketContent);

    return data;
};

// Endpoint para upload e processamento
app.post('/upload', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('Nenhum arquivo enviado.');
    }

    const filePath = req.file.path;

    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        const extractedData = extractDataFromPdfText(data.text);
        
        // Verifica se já existe um registro com o mesmo CNPJ e Período de Apuração
        const [existingRows] = await pool.query(
            'SELECT id FROM pgdas_reports WHERE cnpj = ? AND periodoApuracao = ?',
            [extractedData.cnpj, extractedData.periodoApuracao]
        );

        if (existingRows.length > 0) {
            fs.unlinkSync(filePath);
            return res.status(409).json({ success: false, message: 'Este documento já foi processado e salvo anteriormente.', recordId: existingRows[0].id });
        }

        // Insere os dados no MySQL
        // Atualizado para inserir nas novas colunas de receitas
        const sql = `INSERT INTO pgdas_reports (cnpj, nomeEmpresarial, periodoApuracao, receitaBrutaAcumulada, receitaBrutaAno, receitasMercadoInterno, receitasMercadoExterno) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const values = [
            extractedData.cnpj,
            extractedData.nomeEmpresarial,
            extractedData.periodoApuracao,
            extractedData.receitaBrutaAcumulada,
            extractedData.receitaBrutaAno,
            JSON.stringify(extractedData.receitasMercadoInterno), // Salva o objeto como JSON
            JSON.stringify(extractedData.receitasMercadoExterno)  // Salva o objeto como JSON
        ];
        const [result] = await pool.query(sql, values);

        fs.unlinkSync(filePath);

        res.json({ success: true, recordId: result.insertId });
    } catch (error) {
        console.error('Erro ao processar o PDF e salvar no banco:', error);
        fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: 'Erro ao processar o arquivo.' });
    }
});

// Endpoint para buscar dados por ID
app.get('/data/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM pgdas_reports WHERE id = ?', [id]);
        if (rows.length > 0) {
            const data = rows[0];
            // O driver mysql2 já converte JSON para objeto, então não precisamos de JSON.parse
            res.json({ success: true, data });
        } else {
            res.status(404).json({ success: false, message: 'Dados não encontrados.' });
        }
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar dados.' });
    }
});

// Endpoint para buscar declarações por CNPJ
app.get('/documents/by-cnpj/:cnpj', async (req, res) => {
    const { cnpj } = req.params;
    try {
        // Busca todas as declarações para o CNPJ fornecido, ordenadas por período de apuração
        const [rows] = await pool.query(
            'SELECT id, cnpj, nomeEmpresarial, periodoApuracao, createdAt FROM pgdas_reports WHERE cnpj = ? ORDER BY periodoApuracao DESC',
            [cnpj]
        );
        res.json({ success: true, documents: rows });
    } catch (error) {
        console.error(`Erro ao buscar declarações para CNPJ ${cnpj}:`, error);
        res.status(500).json({ success: false, message: 'Erro ao buscar declarações por CNPJ.' });
    }
});

// Endpoint para buscar todos os documentos (para a listagem agrupada)
// Este endpoint foi adicionado na conversa anterior, mas não estava no código completo da última vez.
app.get('/documents', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, cnpj, nomeEmpresarial, periodoApuracao, createdAt FROM pgdas_reports ORDER BY createdAt DESC');
        res.json({ success: true, documents: rows });
    } catch (error) {
        console.error('Erro ao buscar lista de documentos:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar lista de documentos.' });
    }
});


app.listen(port, () => {
    console.log(`Servidor backend rodando em http://localhost:${port}`);
});