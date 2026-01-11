import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ==========================
// BASIC SETUP
// ==========================
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================
// MIDDLEWARES
// ==========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// STATIC FILES (Vercel-friendly)
app.use(express.static(path.join(__dirname, "public")));

// ==========================
// CREATE DATA FUNCTION
// ==========================
function loadLevels() {
  const mainPath = path.join(__dirname, "levels_main.json");
  const extPath = path.join(__dirname, "levels_extended.json");
  const legacyPath = path.join(__dirname, "levels_legacy.json");
  
  return {
    main: JSON.parse(fs.readFileSync(mainPath, "utf-8")),
    extended: JSON.parse(fs.readFileSync(extPath, "utf-8")),
    legacy: JSON.parse(fs.readFileSync(legacyPath, "utf-8")),
  };
}

// ==========================
// FUNCTIONS
// ==========================

// Extracting youtube video ID from various URL formats
function extractYouTubeVideoId(url) {
    if (!url) return null;
    
    // Common patterns to match YouTube video IDs
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

// Função para escapar HTML e formatar histórico
function formatPositionHistory(posHistory) {
    if (!posHistory || !Array.isArray(posHistory) || posHistory.length === 0) {
        return '<span class="text-muted">No history available</span>';
    }
    
    // Função para escapar caracteres especiais
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#x2F;'
        };
        return String(text).replace(/[&<>"'\/]/g, s => map[s]);
    }
    
    // Mapear e formatar cada entrada
    const entries = posHistory.map((entry, idx) => {
        const log = entry.log1 || entry || 'Unknown entry';
        const escapedLog = escapeHtml(log);
        return `<div class="history-entry">
            <span class="history-number">${idx + 1}.</span> 
            <span class="history-text">${escapedLog}</span>
        </div>`;
    });
    
    return entries.join('');
}

// Esta versão usa um sistema de expansão próprio, sem depender do Bootstrap dropdown

function CreateCardLevels_Main(level_main, index) {
    const position = index + 1;
    
    const videoId = extractYouTubeVideoId(level_main.video_url);
    const imageSrc = videoId 
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` 
        : '/img/placeholder.png';
    
    const difficulty = `${level_main.diff_scale || ''}`;
    
    // Formatar histórico de forma segura
    let historyHtml = '';
    if (level_main.pos_history && Array.isArray(level_main.pos_history) && level_main.pos_history.length > 0) {
        historyHtml = level_main.pos_history.map((entry, idx) => {
            const log = (entry.log1 || entry || 'Unknown entry')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            
            return `<div class="history-entry">
                <span class="history-number">${idx + 1}.</span>
                <span class="history-text">${log}</span>
            </div>`;
        }).join('');
    } else {
        historyHtml = '<div class="text-center text-muted py-3">No history available</div>';
    }

    let rankDisplay = level_main.diff_rank || '';
    const safeName = (level_main.lvl_name || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const safeCreator = (level_main.lvl_creator || '').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const safeVideoUrl = level_main.video_url || '#';

    // ID único para o accordion
    const accordionId = `history-${position}`;

    const cardHtml = `
        <div class="level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                                <img 
                                    src="${imageSrc}" 
                                    alt="${safeName}"
                                    onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                    loading="lazy"
                                >
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${position}. ${safeName}
                            </h5>
                            
                            <p class="creator-text">
                                by ${safeCreator}
                            </p>
                            
                            <div class="badge-container">
                                <span class="badge-demon">${rankDisplay}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            
                            ${level_main.pos_aredl ? `<p class="aredl-text">${level_main.diff_rank === "Extreme Demon" ? "AREDL" : "IDL"} Position: #${level_main.pos_aredl}</p>` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Sistema de accordion customizado -->
                <div class="history-accordion">
                    <button class="history-toggle" onclick="toggleHistory('${accordionId}', this)" type="button">
                        <span class="toggle-text">View Position History</span>
                        <span class="toggle-arrow">▼</span>
                    </button>
                    
                    <div class="history-content" id="${accordionId}" style="display: none;">
                        <div class="history-list">
                            ${historyHtml}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return cardHtml;
}

function CreateCardLevels_Extended(level_extended, index) {
        const position = index + 76;
    
    const videoId = extractYouTubeVideoId(level_extended.video_url);
    
    // Placeholder image if main image not found
    const imageSrc = videoId 
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` 
        : '/img/placeholder.png';
    
    const difficulty = `${level_extended.diff_scale || ''}`;

    let rankDisplay = "";
    if (level_extended.pos_aredl === "" || level_extended.pos_aredl === 0 || level_extended.pos_aredl === undefined) {
        rankDisplay = `${level_extended.diff_rank || ''}`;
    } else {
        rankDisplay = `${level_extended.diff_rank || ''}`;
    }

    const safeName = (level_extended.lvl_name || '').replace(/"/g, '&quot;');
    const safeCreator = (level_extended.lvl_creator || '').replace(/"/g, '&quot;');
    
    // Safe video URL
    const safeVideoUrl = level_extended.video_url || '#';

    // DIFF RANK CASES:

        if(level_extended.diff_rank === "Extreme Demon"){
            let levelCardHtml = `
        <div class="level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                                <img 
                                    src="${imageSrc}" 
                                    alt="${safeName}"
                                    onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                    loading="lazy"
                                >
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${position}. ${safeName}
                            </h5>
                            
                            <p class="creator-text">
                                by ${safeCreator}
                            </p>
                            
                            <div class="badge-container">
                                <span class="badge-demon">${rankDisplay}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            
                            ${level_extended.pos_aredl ? `<p class="aredl-text">AREDL Position: #${level_extended.pos_aredl}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return levelCardHtml;
    }

    if(level_extended.diff_rank === "Insane Demon"){
            let levelCardHtml = `
        <div class="level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                                <img 
                                    src="${imageSrc}" 
                                    alt="${safeName}"
                                    onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                    loading="lazy"
                                >
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${position}. ${safeName}
                            </h5>
                            
                            <p class="creator-text">
                                by ${safeCreator}
                            </p>
                            
                            <div class="badge-container">
                                <span class="badge-demon">${rankDisplay}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            
                            ${level_extended.pos_aredl ? `<p class="aredl-text">IDL Position: #${level_extended.pos_aredl}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return levelCardHtml;
    }
    
    if(level_extended.diff_rank === "Hard Demon"){
                    let levelCardHtml = `
        <div class="level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                                <img 
                                    src="${imageSrc}" 
                                    alt="${safeName}"
                                    onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                    loading="lazy"
                                >
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${position}. ${safeName}
                            </h5>
                            
                            <p class="creator-text">
                                by ${safeCreator}
                            </p>
                            
                            <div class="badge-container">
                                <span class="badge-demon">${rankDisplay}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            
                            ${level_extended.pos_aredl ? `<p class="aredl-text">HDL Position: #${level_extended.pos_aredl}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return levelCardHtml;
    }
    if(level_extended.diff_rank === "Medium Demon" || level_extended.diff_rank === "Easy Demon"){
                    let levelCardHtml = `
        <div class="level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                                <img 
                                    src="${imageSrc}" 
                                    alt="${safeName}"
                                    onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                    loading="lazy"
                                >
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${position}. ${safeName}
                            </h5>
                            
                            <p class="creator-text">
                                by ${safeCreator}
                            </p>
                            
                            <div class="badge-container">
                                <span class="badge-demon">${rankDisplay}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            
                            ${level_extended.pos_aredl ? `<p class="aredl-text">List Position: #${level_extended.pos_aredl}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return levelCardHtml;
    }
}

function CreateCardLevels_Legacy(level_legacy, index) {
        const position = index + 151;
    
    const videoId = extractYouTubeVideoId(level_legacy.video_url);
    
    const imageSrc = videoId 
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` 
        : '/img/placeholder.png';
    
    const difficulty = `${level_legacy.diff_scale || ''}`;

    let rankDisplay = "";
    if (level_legacy.pos_aredl === "" || level_legacy.pos_aredl === 0 || level_legacy.pos_aredl === undefined) {
        rankDisplay = `${level_legacy.diff_rank || ''}`;
    } else {
        rankDisplay = `${level_legacy.diff_rank || ''}`;
    }

    const safeName = (level_legacy.lvl_name || '').replace(/"/g, '&quot;');
    const safeCreator = (level_legacy.lvl_creator || '').replace(/"/g, '&quot;');
    
    const safeVideoUrl = level_legacy.video_url || '#';
    // DIFF RANK CASES:

        if(level_legacy.diff_rank === "Extreme Demon"){
            let levelCardHtml = `
        <div class="level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                                <img 
                                    src="${imageSrc}" 
                                    alt="${safeName}"
                                    onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                    loading="lazy"
                                >
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${position}. ${safeName}
                            </h5>
                            
                            <p class="creator-text">
                                by ${safeCreator}
                            </p>
                            
                            <div class="badge-container">
                                <span class="badge-demon">${rankDisplay}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            
                            ${level_legacy.pos_aredl ? `<p class="aredl-text">AREDL Position: #${level_legacy.pos_aredl}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return levelCardHtml;
    }

    if(level_legacy.diff_rank === "Insane Demon"){
            let levelCardHtml = `
        <div class="level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                                <img 
                                    src="${imageSrc}" 
                                    alt="${safeName}"
                                    onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                    loading="lazy"
                                >
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${position}. ${safeName}
                            </h5>
                            
                            <p class="creator-text">
                                by ${safeCreator}
                            </p>
                            
                            <div class="badge-container">
                                <span class="badge-demon">${rankDisplay}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            
                            ${level_legacy.pos_aredl ? `<p class="aredl-text">IDL Position: #${level_legacy.pos_aredl}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return levelCardHtml;
    }
    
    if(level_legacy.diff_rank === "Hard Demon"){
                    let levelCardHtml = `
        <div class="level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                                <img 
                                    src="${imageSrc}" 
                                    alt="${safeName}"
                                    onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                    loading="lazy"
                                >
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${position}. ${safeName}
                            </h5>
                            
                            <p class="creator-text">
                                by ${safeCreator}
                            </p>
                            
                            <div class="badge-container">
                                <span class="badge-demon">${rankDisplay}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            
                            ${level_legacy.pos_aredl ? `<p class="aredl-text">HDL Position: #${level_legacy.pos_aredl}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return levelCardHtml;
    }
    if(level_legacy.diff_rank === "Medium Demon" || level_legacy.diff_rank === "Easy Demon"){
                    let levelCardHtml = `
        <div class="level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
                                <img 
                                    src="${imageSrc}" 
                                    alt="${safeName}"
                                    onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                                    loading="lazy"
                                >
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h5 class="card-title">
                                ${position}. ${safeName}
                            </h5>
                            
                            <p class="creator-text">
                                by ${safeCreator}
                            </p>
                            
                            <div class="badge-container">
                                <span class="badge-demon">${rankDisplay}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            
                            ${level_legacy.pos_aredl ? `<p class="aredl-text">List Position: #${level_legacy.pos_aredl}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return levelCardHtml;
    }
}

// ==========================
// GENERATE PAGE
// ==========================
function generatePage() {
    // LOAD UPDATED DATA ON EVERY REQUEST
    const { main: Mainlevels, extended: Extendedlevels, legacy: Legacylevels } = loadLevels();
    
    const htmlPagePath = path.join(__dirname, '/public/home.html');
    let htmlPage = fs.readFileSync(htmlPagePath, 'utf-8');
    
    // MAIN LEVELS DATA:
    const cardsMainHtml = Mainlevels.map((level_main, index) => CreateCardLevels_Main(level_main, index)).join('');

    // EXTENDED LEVELS DATA:
    const cardsExtendedHtml = Extendedlevels.map((level_extended, index) => CreateCardLevels_Extended(level_extended, index)).join('');

    // LEGACY LEVELS DATA:
    const cardsLegacyHtml = Legacylevels.map((level_legacy, index) => CreateCardLevels_Legacy(level_legacy, index)).join('');

    const footerHtml = `
        <p class="footer-title">ELFETOR HARDEST DEMONS</p>
        <p>© ${new Date().getFullYear()} All rights reserved</p>
    `;

    // replace placeholders
    htmlPage = htmlPage.replaceAll('{{cardsMainHtml}}', cardsMainHtml);
    htmlPage = htmlPage.replaceAll('{{cardsExtendedHtml}}', cardsExtendedHtml);
    htmlPage = htmlPage.replaceAll('{{cardsLegacyHtml}}', cardsLegacyHtml);
    htmlPage = htmlPage.replaceAll('{{footer}}', footerHtml);

    // fallbacks if placeholders weren't present
    if (!htmlPage.includes(cardsExtendedHtml)) {
        htmlPage = htmlPage.replace('</body>', cardsExtendedHtml + '\n</body>');
    }
    if (!htmlPage.includes(footerHtml)) {
        htmlPage = htmlPage.replace('</body>', footerHtml + '\n</body>');
    }
    if(!htmlPage.includes(cardsLegacyHtml)){
        htmlPage = htmlPage.replace('</body>', cardsLegacyHtml + '\n</body>');
    }

    return htmlPage;
}

// ==========================
// ROUTES
// ==========================
app.get("/", (req, res) => {
  res.redirect("/home");
});

app.get("/home", (req, res) => {
  console.log("Carregando dados atualizados do JSON...");
  res.send(generatePage());
});

// ==========================
// LOADING LOCALHOST PORT
// ==========================
if (process.env.NODE_ENV !== "production") {
  const PORT = 3010;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

// ==========================
// VERCEL EXPORT
// ==========================
export default app;