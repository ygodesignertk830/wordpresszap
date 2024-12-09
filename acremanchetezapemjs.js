const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Função para armazenar links enviados
const armazenarLinksEnviados = (link) => {
    if (!fs.existsSync('links_enviados.txt')) {
        fs.writeFileSync('links_enviados.txt', link + '\n');
    } else {
        fs.appendFileSync('links_enviados.txt', link + '\n');
    }
};

// Função para verificar se o link já foi enviado
const verificarLinkEnviado = (link) => {
    if (fs.existsSync('links_enviados.txt')) {
        const links = fs.readFileSync('links_enviados.txt', 'utf-8').split('\n');
        return links.includes(link);
    }
    return false;
};

// Inicialize o cliente com autenticação local
const client = new Client({
    authStrategy: new LocalAuth()
});

// Quando o cliente estiver pronto
client.on('ready', async () => {
    console.log('Cliente WhatsApp Web está pronto!');

    // Função para pegar as matérias do RSS do site WordPress
    const pegarMaterias = async () => {
        const url = 'https://acremanchete.com/feed/';
        const response = await axios.get(url);
        const $ = cheerio.load(response.data, { xmlMode: true });

        $('item').each(async (i, post) => {
            const title = $(post).find('title').text();
            const link = $(post).find('link').text();
            const description = $(post).find('description').text();

            // Verifica se o link já foi enviado
            if (verificarLinkEnviado(link)) {
                return; // Se o link já foi enviado, pula para o próximo
            }

            // Extrai a imagem da postagem
            const postUrl = link;
            const postResponse = await axios.get(postUrl);
            const $$ = cheerio.load(postResponse.data);
            const imageUrl = $$('meta[property="og:image"]').attr('content') || 'Imagem não encontrada';

            // Envia a mensagem para o WhatsApp
            await enviarMensagem(title, link, imageUrl);

            // Armazena o link da matéria para evitar envio repetido
            armazenarLinksEnviados(link);
        });
    };

    // Função para enviar a mensagem para o WhatsApp
    const enviarMensagem = async (titulo, link, imagemUrl) => {
        const mensagem = `📰 ${titulo}\nLeia mais: ${link}\nImagem:`;

        // Enviar para o grupo
        const grupoId = '120363374965333761@g.us'; // Substitua pelo ID do seu grupo
        const chat = await client.getChatById(grupoId);
        
        // Envia a imagem junto com o texto
        chat.sendMessage(mensagem, { media: { url: imagemUrl } });
        console.log(`Mensagem enviada para o WhatsApp: ${titulo}`);
    };

    // Função para enviar as matérias periodicamente
    const enviarMateriasPeriodicamente = async () => {
        while (true) {
            // Chama a função para pegar e enviar as últimas matérias do site
            await pegarMaterias();

            // Aguardar 30 segundos (30.000 milissegundos) antes de enviar a próxima matéria
            console.log('Aguardando 30 segundos antes de enviar novamente...');
            await new Promise(resolve => setTimeout(resolve, 30000)); // Espera 30 segundos
        }
    };

    // Inicia o envio das matérias
    enviarMateriasPeriodicamente();
});

// Gerar o QR Code para autenticação no WhatsApp Web (apenas na primeira execução)
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

// Inicializar o cliente
client.initialize();
