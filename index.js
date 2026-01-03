import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ==========================
// SETUP BÁSICO
// ==========================
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// MIDDLEWARES
// ==========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SERVIR ARQUIVOS ESTÁTICOS (Vercel-friendly)
app.use(express.static(path.join(__dirname, "public")));

// ==========================
// FUNÇÃO PARA CARREGAR DADOS (sempre atualizado)
// ==========================
function loadLevels() {
  const mainPath = path.join(__dirname, "levels_main.json");
  const extPath = path.join(__dirname, "levels_extended.json");
  
  return {
    main: JSON.parse(fs.readFileSync(mainPath, "utf-8")),
    extended: JSON.parse(fs.readFileSync(extPath, "utf-8"))
  };
}

// ==========================
// FUNÇÕES (SUA LÓGICA)
// ==========================

// Função para extrair ID do vídeo do YouTube de forma mais robusta
function extractYouTubeVideoId(url) {
    if (!url) return null;
    
    // Padrões comuns de URLs do YouTube
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
        /youtube\.com\/v\/([^&\?\/]+)/,
        /youtube\.com\/watch\?.*v=([^&\?\/]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    
    return null;
}

function CreateCardLevels_Main(level_main, index) {
    const position = index + 1;
    
    // Extração melhorada do ID do vídeo
    const videoId = extractYouTubeVideoId(level_main.video_url);
    
    // Usar imagem de placeholder se não houver vídeo ou ID inválido
    const imageSrc = videoId 
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` 
        : '/img/placeholder.png';
    
    const difficulty = `${level_main.diff_scale || ''}`;
    const historyHtml = level_main.pos_history 
        ? level_main.pos_history.map(log => log.log1).join('<br>') 
        : '';

    let rankDisplay = "";
    if (level_main.pos_aredl === "" || level_main.pos_aredl === 0 || level_main.pos_aredl === undefined) {
        rankDisplay = `(${level_main.diff_rank || ''})`;
    } else {
        rankDisplay = `(Top ${level_main.pos_aredl} ${level_main.diff_rank || ''})`;
    }

    const safeName = (level_main.lvl_name || '').replace(/"/g, '&quot;');
    const safeCreator = (level_main.lvl_creator || '').replace(/"/g, '&quot;');
    
    // URL segura para o link do vídeo
    const safeVideoUrl = level_main.video_url || '#';

    let levelCardHtml = `
        <div class="level-card main-level d-flex justify-content-center" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card mb-3" style="max-width: 1000px; margin: 20px;">
                <div class="row g-0">
                    <div class="col-md-4">
                        <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                            <img 
                                src="${imageSrc}" 
                                class="img-fluid rounded-start" 
                                alt="${safeName}"
                                onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                loading="lazy"
                                style="width: 100%; height: 100%; object-fit: cover;"
                            >
                        </a>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title" style="font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif; font-size: 3rem; color: #980000;">
                                ${position}- ${safeName} by ${safeCreator}
                            </h5>
                            
                            <p class="card-text" style="font-weight: 500; font-size: 14px; color: #980000;">
                                ${rankDisplay}
                            </p>
                            
                            <p class="card-text" style="font-weight: bold; font-size: small; color: black; margin-bottom: 60px;">
                                Tier (AREDL): ${difficulty}
                            </p>
                        </div>
                    </div>
                </div>
                
                <div class="dropdown" style="width: 100%;">
                    <a class="btn dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="background-color: rgb(231, 231, 231); width: 100%;">
                        View Position History
                    </a>

                    <ul class="dropdown-menu" style="width: 100%; text-align: left; padding-left: 10px;">
                        <p>${historyHtml || 'No history available'}</p>
                    </ul>
                </div>
            </div>
        </div>
    `;

    return levelCardHtml;
}

function CreateCardLevels_Extended(level_extended, index) {
    const position = index + 76;
    
    // Extração melhorada do ID do vídeo
    const videoId = extractYouTubeVideoId(level_extended.video_url);
    
    const imageSrc = videoId 
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` 
        : "/img/placeholder.png";
    
    const safeName = (level_extended.lvl_name || '').replace(/"/g, '&quot;');
    const safeCreator = (level_extended.lvl_creator || '').replace(/"/g, '&quot;');
    const safeVideoUrl = level_extended.video_url || '#';

    return `
        <div class="level-card extended-level d-flex justify-content-center" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card mb-3" style="max-width:1000px;margin:20px;">
                <div class="row g-0">
                    <div class="col-md-4">
                        <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                            <img 
                                src="${imageSrc}" 
                                class="img-fluid rounded-start"
                                alt="${safeName}"
                                onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                loading="lazy"
                                style="width: 100%; height: 100%; object-fit: cover;"
                            >
                        </a>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 style="font-size:3rem;color:#980000;">
                                ${position} - ${safeName} by ${safeCreator}
                            </h5>
                            <p style="color:#980000;">
                                ${level_extended.pos_aredl
                                    ? `(Top ${level_extended.pos_aredl} ${level_extended.diff_rank})`
                                    : `(${level_extended.diff_rank})`}
                            </p>
                            <p>Tier (AREDL): ${level_extended.diff_scale}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==========================
// GERAR PÁGINA
// ==========================
function generatePage() {
    // CARREGAR DADOS ATUALIZADOS A CADA REQUISIÇÃO
    const { main: Mainlevels, extended: Extendedlevels } = loadLevels();
    
    const htmlPagePath = path.join(__dirname, '/public/home.html');
    let htmlPage = fs.readFileSync(htmlPagePath, 'utf-8');
    
    // MAIN LEVELS DATA:
    const cardsMainHtml = Mainlevels.map((level_main, index) => CreateCardLevels_Main(level_main, index)).join('');

    // EXTENDED LEVELS DATA:
    const cardsExtendedHtml = Extendedlevels.map((level_extended, index) => CreateCardLevels_Extended(level_extended, index)).join('');

    const footerHtml = `<footer>
            <p>&copy; ELFETOR HARDEST DEMONS | Todos os direitos reservados</p>
        </footer>`;

    // replace placeholders
    htmlPage = htmlPage.replaceAll('{{cardsMainHtml}}', cardsMainHtml);
    htmlPage = htmlPage.replaceAll('{{cardsExtendedHtml}}', cardsExtendedHtml);
    htmlPage = htmlPage.replaceAll('{{footer}}', footerHtml);

    // fallbacks if placeholders weren't present
    if (!htmlPage.includes(cardsExtendedHtml)) {
        htmlPage = htmlPage.replace('</body>', cardsExtendedHtml + '\n</body>');
    }
    if (!htmlPage.includes(footerHtml)) {
        htmlPage = htmlPage.replace('</body>', footerHtml + '\n</body>');
    }

    return htmlPage;
}

// ==========================
// ROTAS
// ==========================
app.get("/", (req, res) => {
  res.redirect("/home");
});

app.get("/home", (req, res) => {
  console.log("📊 Carregando dados atualizados do JSON...");
  res.send(generatePage());
});

// ==========================
// RODAR LOCALMENTE (APENAS DEV)
// ==========================
if (process.env.NODE_ENV !== "production") {
  const PORT = 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

// ==========================
// EXPORT PARA VERCEL
// ==========================
export default app;