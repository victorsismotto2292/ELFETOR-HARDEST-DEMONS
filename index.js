import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// SETUP
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MIDDLEWARES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// STATIC FILES (Vercel-friendly)
app.use(express.static(path.join(__dirname, "public")));

// CREATING DATA FUNCTION
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

// TIME MACHINE DATA FUNCTION
function loadLevelsTM(){
    const cardsTMPath = path.join(__dirname, "time_machine_data.json");
    const snapshotsPath = path.join(__dirname, "time_machine_snapshots.json");
    const data = JSON.parse(fs.readFileSync(cardsTMPath, "utf-8"));
    const dataSnapshots = Array.isArray(data.snapshots) ? data.snapshots : [];
    const snapshots = fs.existsSync(snapshotsPath)
        ? (JSON.parse(fs.readFileSync(snapshotsPath, "utf-8")).snapshots || dataSnapshots)
        : dataSnapshots;
    const firstLevels = snapshots[0]?.list_data?.[0]?.levels || data[0]?.list_data?.[0]?.levels || [];
    return {
        CardsTM: firstLevels,
        snapshots
    };
}

function getTimeMachineSnapshot(selectedAt){
    const { snapshots } = loadLevelsTM();
    const isMinuteSelection = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(selectedAt || '');
    const requested = selectedAt
        ? new Date(isMinuteSelection ? `${selectedAt}:59.999-03:00` : selectedAt)
        : new Date("2026-01-15T00:00:00-03:00");
    if (Number.isNaN(requested.getTime())) return snapshots[0];
    return snapshots.reduce((chosen, snapshot) => {
        const snapshotDate = new Date(snapshot.date);
        return snapshotDate <= requested && snapshotDate >= new Date(chosen.date) ? snapshot : chosen;
    }, snapshots[0]);
}

// FUNCTIONS

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

function CreateCardLevels_Main(level_main, index) {
    const position = index + 1;
    
    const videoId = extractYouTubeVideoId(level_main.video_url);
    const imageSrc = videoId 
        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` 
        : '/img/placeholder.png';
    
    const difficulty = `${level_main.diff_scale || ''}`;
    
    // Historical format
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

    // Unique ID
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
        const normalizedRank = String(level_extended.diff_rank || '').trim().toLowerCase();
    
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

        if(normalizedRank === "extreme demon"){
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

    if(normalizedRank === "insane demon"){
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
    
    if(normalizedRank === "hard demon"){
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
    if(normalizedRank === "medium demon" || normalizedRank === "easy demon"){
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
    const rankDisplay = `${level_legacy.diff_rank || ''}`;
    const normalizedRank = String(level_legacy.diff_rank || '').trim().toLowerCase();
 
    const safeName    = (level_legacy.lvl_name    || '').replace(/"/g, '&quot;');
    const safeCreator = (level_legacy.lvl_creator || '').replace(/"/g, '&quot;');
    const safeVideoUrl = level_legacy.video_url || '#';
 
    // Badge class choice
    let badgeClass = 'badge-demon';
    if (normalizedRank === 'extreme demon'){badgeClass = 'badge-extreme'}
    else if (normalizedRank === 'insane demon'){badgeClass = 'badge-insane'}
    else if (normalizedRank === 'hard demon'){badgeClass = 'badge-hard'}
    else if (normalizedRank === 'medium demon'){badgeClass = 'badge-medium'}
    else if (normalizedRank === 'easy demon'){badgeClass = 'badge-easy'}
 
    // Link's position text
    let aredlLabel = 'List Position';
    if (level_legacy.diff_rank === 'Extreme Demon') aredlLabel = 'List Position';
    else if (level_legacy.diff_rank === 'Insane Demon') aredlLabel = 'IDL Position';
    else if (level_legacy.diff_rank === 'Hard Demon')   aredlLabel = 'AREDL Position';
 
    const levelCardHtml = `
<div class="col level-card" data-name="${safeName.toLowerCase()}" data-creator="${safeCreator.toLowerCase()}" data-position="${position}">
    <div class="card h-100 legacy-card">
        <!-- Imagem ocupa toda a largura do card -->
        <a href="${safeVideoUrl}" target="_blank" rel="noopener noreferrer">
            <img
                class="legacy-card-img"
                src="${imageSrc}"
                alt="${safeName}"
                onerror="this.src='/img/placeholder.png'; this.onerror=null;"
                loading="lazy"
            >
        </a>
 
        <!-- Dados do nível ficam abaixo da imagem -->
        <div class="card-body legacy-card-body">
            <h6 class="card-title legacy-card-title">
                ${position}. ${safeName}
            </h6>
 
            <p class="creator-text legacy-creator">
                by ${safeCreator}
            </p>
 
            <div class="badge-container">
                <span>${rankDisplay}</span>
                ${difficulty ? `<span class="badge-tier">Tier: ${difficulty}</span>` : ''}
            </div>
 
            ${level_legacy.pos_aredl
                ? `<p class="aredl-text">${aredlLabel}: #${level_legacy.pos_aredl}</p>`
                : ''}
        </div>
    </div>
</div>
`;
 
    return levelCardHtml;
}

function CreateCardLevels_TM(level, index, currentPosition){
    const position = index + 1;
    const videoId = extractYouTubeVideoId(level.video_url);
    const imageSrc = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '/img/placeholder.png';
    const escapeHtml = value => String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const name = escapeHtml(level.lvl_name || 'Unknown level');
    const creator = escapeHtml(level.lvl_creator || 'Unknown creator');
    const rank = escapeHtml(level.diff_rank || '');
    const difficulty = escapeHtml(level.diff_scale || '');
    const videoUrl = escapeHtml(level.video_url || '#');
    const positionInfo = level.pos_aredl ? `<p class="aredl-text">List Position: #${escapeHtml(level.pos_aredl)}</p>` : '';
    const currentPositionInfo = currentPosition > 150
        ? '<p class="current-position">Currently at Legacy</p>'
        : currentPosition
        ? `<p class="current-position">Currently at #${currentPosition}</p>`
        : '<p class="current-position current-position-muted">Currently not on the list</p>';

    return `
        <article class="level-card" data-name="${name.toLowerCase()}" data-creator="${creator.toLowerCase()}" data-position="${position}">
            <div class="card">
                <div class="row g-0">
                    <div class="col-md-4">
                        <div class="image-container">
                            <a href="${videoUrl}" target="_blank" rel="noopener noreferrer">
                                <img src="${imageSrc}" alt="${name}" onerror="this.src='/img/placeholder.png'; this.onerror=null;" loading="lazy">
                            </a>
                        </div>
                    </div>
                    <div class="col-md-8">
                        <div class="card-body">
                            <h2 class="card-title">${position}. ${name}</h2>
                            <p class="creator-text">by ${creator}</p>
                            <div class="badge-container">
                                <span class="badge-demon">${rank}</span>
                                <span class="badge-tier">Tier: ${difficulty}</span>
                            </div>
                            ${currentPositionInfo}
                            ${positionInfo}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;
}
// GENERATE PAGE
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

// TIME MACHINE GENERATION PAGE:

function generateTimeMachinePage(selectedAt){
    const { main, extended, legacy } = loadLevels();
    const currentLevels = [...main, ...extended, ...legacy];
    const currentPositions = new Map(currentLevels.map((level, index) => [String(level.lvl_name || '').trim().toLowerCase(), index + 1]));
    const selectedSnapshot = getTimeMachineSnapshot(selectedAt);
    const CardsTM = selectedSnapshot.list_data?.[0]?.levels || selectedSnapshot.levels || [];

    const TMPagePath = path.join(__dirname, '/public/timemachine.html');
    let TMPage = fs.readFileSync(TMPagePath, 'utf-8');

    const CardsTMHtml = CardsTM.map((levels_TM, index) => CreateCardLevels_TM(
        levels_TM,
        index,
        currentPositions.get(String(levels_TM.lvl_name || '').trim().toLowerCase())
    )).join('');

    const footerTM =
    `<p class="footer-title">ELFETOR HARDEST DEMONS</p>
    <p>© ${new Date().getFullYear()} All rights reserved</p>`

    // placeholders replacement:

    TMPage = TMPage.replaceAll('{{CardsTMHtml}}', CardsTMHtml);
    TMPage = TMPage.replaceAll('{{footerTM}}', footerTM);

    if(!TMPage.includes(CardsTMHtml)){
        TMPage = TMPage.replace('</body>', CardsTMHtml + '\n</body>');
    }
    if(!TMPage.includes(footerTM)){
        TMPage = TMPage.replace('</body>', footerTM + '\n</body>');
    }

    return TMPage;
}

// ROUTES
app.get("/", (req, res) => {
  res.redirect("/home");
});

app.get("/home", (req, res) => {
  console.log("Carregando dados atualizados do JSON...");
  res.send(generatePage());
});

app.get("/timemachine", (req, res) => {
    console.log("Carregando página Time Machine...");
    // res.sendFile(path.join(__dirname, "timemachine.html")); PRA TESTE
    res.send(generateTimeMachinePage(req.query.at));
});

// PORT
if (process.env.NODE_ENV !== "production") {
  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

// VERCEL EXPORT
export default app;
