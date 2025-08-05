// backend-mysql/utils/pdfParser.js

// Função para extrair receitas mensais de um bloco de texto
const extractMonthlyRevenues = (content) => {
    const revenues = {};
    const datePattern = /\d{2}\/\d{4}/g;
    let dates = [];
    let dateMatch;
    while ((dateMatch = datePattern.exec(content)) !== null) {
        dates.push({ date: dateMatch[0], index: dateMatch.index });
    }

    dates.sort((a, b) => a.index - b.index);

    for (let i = 0; i < dates.length; i++) {
        const currentMonthYear = dates[i].date;
        const startIndex = dates[i].index + currentMonthYear.length;
        const endIndex = (i + 1 < dates.length) ? dates[i + 1].index : content.length;

        let segment = content.substring(startIndex, endIndex).trim();

        // Regex refinada para o formato numérico brasileiro
        const valuePattern = /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)/;
        const valueMatch = segment.match(valuePattern);

        let value = 0;
        if (valueMatch && valueMatch[1]) {
            const valorStr = valueMatch[1];
            value = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'));
        }
        
        if (!isNaN(value)) {
            revenues[currentMonthYear] = value;
        }
    }
    return revenues;
};

// Função para extrair dados do texto do PDF
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

    // Captura o texto entre "2.2) Receitas Brutas Anteriores (R$)" e "2.3) Folha de Salários Anteriores (R$)"
    const fullRevenuesBlockRegex = /2\.2\)\s*Receitas Brutas Anteriores \(R\$\)([\s\S]*?)2\.3\)\s*Folha de Salários Anteriores/;
    const fullRevenuesBlockMatch = text.match(fullRevenuesBlockRegex);
    let fullRevenuesBlockText = fullRevenuesBlockMatch ? fullRevenuesBlockMatch[1] : '';

    // Normaliza o texto removendo quebras de linha e múltiplos espaços para facilitar a regex
    fullRevenuesBlockText = fullRevenuesBlockText.replace(/["']/g, '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();

    const internalMarketStartMarker = '2.2.1) Mercado Interno';
    const externalMarketStartMarker = '2.2.2) Mercado Externo';
    const nextSectionMarker = '2.3) Folha de Salarios Anteriores'; 

    const internalStartIndex = fullRevenuesBlockText.indexOf(internalMarketStartMarker);
    const externalStartIndex = fullRevenuesBlockText.indexOf(externalMarketStartMarker);
    const nextSectionIndex = fullRevenuesBlockText.indexOf(nextSectionMarker);

    let internalMarketContent = '';
    let externalMarketContent = '';

    if (internalStartIndex !== -1) {
        let internalEndIndex = externalStartIndex !== -1 ? externalStartIndex : nextSectionIndex;
        if (internalEndIndex === -1) {
            internalEndIndex = fullRevenuesBlockText.length;
        }
        internalMarketContent = fullRevenuesBlockText.substring(internalStartIndex + internalMarketStartMarker.length, internalEndIndex).trim();
    }

    if (externalStartIndex !== -1) {
        let externalEndIndex = nextSectionIndex !== -1 ? nextSectionIndex : fullRevenuesBlockText.length;
        externalMarketContent = fullRevenuesBlockText.substring(externalStartIndex + externalMarketStartMarker.length, externalEndIndex).trim();
    }

    data.receitasMercadoInterno = extractMonthlyRevenues(internalMarketContent);
    data.receitasMercadoExterno = extractMonthlyRevenues(externalMarketContent);

    return data;
};

module.exports = {
    extractDataFromPdfText
};