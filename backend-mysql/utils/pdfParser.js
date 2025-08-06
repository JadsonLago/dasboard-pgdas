// backend-mysql/utils/pdfParser.js

const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Converte uma string de moeda (ex: "1.234,56") para um número.
 * Retorna 0 se a entrada for inválida ou vazia.
 */
const parseCurrency = (str) => {
    if (typeof str !== 'string' || str.trim() === '') return 0;
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
};

/**
 * Extrai os valores da tabela de impostos do texto do PDF.
 * Foca na tabela final "Total do Débito Exigível".
 */
const extractTaxValues = (text) => {
    const taxes = {};
    const anchor = 'Total do Débito Exigível (R$)';
    const startIndex = text.lastIndexOf(anchor);

    if (startIndex === -1) return {};

    // Pega um bloco de texto de 400 caracteres após a âncora para a busca.
    const searchBlock = text.substring(startIndex + anchor.length, startIndex + anchor.length + 400);
    
    // Regex para encontrar todos os números no formato de moeda brasileira (ex: 1.234,56).
    const numbers = searchBlock.match(/(\d{1,3}(\.\d{3})*,\d{2})/g);

    if (numbers && numbers.length >= 9) {
        // A ordem da tabela no PDF é fixa: IRPJ, CSLL, COFINS, PIS/Pasep, INSS/CPP, ICMS, IPI, ISS, Total
        taxes.irpj = parseCurrency(numbers[0]);
        taxes.csll = parseCurrency(numbers[1]);
        taxes.cofins = parseCurrency(numbers[2]);
        taxes.pis_pasep = parseCurrency(numbers[3]);
        taxes.inss_cpp = parseCurrency(numbers[4]);
        taxes.icms = parseCurrency(numbers[5]);
        taxes.ipi = parseCurrency(numbers[6]);
        taxes.iss = parseCurrency(numbers[7]);
        taxes.valor_total_debito = parseCurrency(numbers[8]);
    }
    
    return taxes;
};

/**
 * Extrai as receitas mensais dos mercados interno e externo.
 */
const extractAllMonthlyRevenues = (text) => {
    const revenues = {
        receitasMercadoInterno: {},
        receitasMercadoExterno: {}
    };

    const startAnchor = '2.2) Receitas Brutas Anteriores';
    const endAnchor = '2.3) Folha de Salários Anteriores';
    
    const startIndex = text.indexOf(startAnchor);
    const endIndex = text.indexOf(endAnchor, startIndex);

    if (startIndex === -1 || endIndex === -1) return revenues;

    const revenueBlock = text.substring(startIndex, endIndex);

    const internalAnchor = 'Mercado Interno';
    const externalAnchor = 'Mercado Externo';
    const internalIndex = revenueBlock.indexOf(internalAnchor);
    const externalIndex = revenueBlock.indexOf(externalAnchor);

    const internalBlock = externalIndex !== -1 
        ? revenueBlock.substring(internalIndex, externalIndex)
        : revenueBlock.substring(internalIndex);
        
    const externalBlock = externalIndex !== -1
        ? revenueBlock.substring(externalIndex)
        : "";

    // Regex para encontrar pares de data (MM/YYYY) e um valor numérico subsequente.
    const revenueRegex = /(\d{2}\/\d{4})\s*([\d.,]+)/g;
    
    let match;
    while ((match = revenueRegex.exec(internalBlock)) !== null) {
        revenues.receitasMercadoInterno[match[1]] = parseCurrency(match[2]);
    }

    // Reseta o índice da regex para buscar no próximo bloco
    revenueRegex.lastIndex = 0; 
    
    while ((match = revenueRegex.exec(externalBlock)) !== null) {
        revenues.receitasMercadoExterno[match[1]] = parseCurrency(match[2]);
    }

    return revenues;
};

/**
 * Função principal que orquestra a extração de todos os dados de um arquivo PDF.
 */
const extractDataFromPdfFile = async (filePath) => {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;
    
    const data = {};

    const extract = (regex) => {
        const match = text.match(regex);
        return match ? match[1].trim() : null;
    };

    // Extrai dados do cabeçalho
    data.cnpj = extract(/CNPJ Matriz:\s*([\d.\-/\s]+)/);
    data.nomeEmpresarial = extract(/Nome empresarial:\s*([^\n]+)/);
    data.periodoApuracao = extract(/Período de Apuração:\s*([^\n]+)/);
    data.receitaBrutaAcumulada = parseCurrency(extract(/Receita bruta acumulada nos doze meses anteriores\s+ao PA \(RBT12\)\s+([0-9.,]+)/));
    data.receitaBrutaAno = parseCurrency(extract(/Receita bruta acumulada no ano-calendário corrente\s+\(RBA\)\s+([0-9.,]+)/));

    // Extrai dados estruturados das tabelas
    const taxData = extractTaxValues(text);
    const revenueData = extractAllMonthlyRevenues(text);

    // Combina todos os dados extraídos em um único objeto
    return {
        ...data,
        ...taxData,
        ...revenueData
    };
};

module.exports = {
    extractDataFromPdfFile
};