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
// DADOS
// ==========================
const Mainlevels = JSON.parse(
  fs.readFileSync(path.join(__dirname, "levels_main.json"), "utf-8")
);

const Extendedlevels = JSON.parse(
  fs.readFileSync(path.join(__dirname, "levels_extended.json"), "utf-8")
);

// ==========================
// FUNÇÕES (SUA LÓGICA)
// ==========================
function CreateCardLevels_Main(level_main, index) {
  const position = index + 1;
  const videoId = level_main.video_url.split("v=")[1]?.split("&")[0];
  const imageSrc = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : "/img/placeholder.png";

  const historyHtml = level_main.pos_history
    ?.map(log => log.log1)
    .join("<br>") ?? "";

  return `
    <div class="d-flex justify-content-center">
      <div class="card mb-3" style="max-width:1000px;margin:20px;">
        <div class="row g-0">
          <div class="col-md-4">
            <a href="${level_main.video_url}" target="_blank">
              <img src="${imageSrc}" class="img-fluid rounded-start">
            </a>
          </div>
          <div class="col-md-8">
            <div class="card-body">
              <h5 style="font-size:3rem;color:#980000;">
                ${position} - ${level_main.lvl_name} by ${level_main.lvl_creator}
              </h5>
              <p style="color:#980000;">
                ${level_main.pos_aredl
                  ? `(Top ${level_main.pos_aredl} ${level_main.diff_rank})`
                  : `(${level_main.diff_rank})`}
              </p>
              <p>Tier (AREDL): ${level_main.diff_scale}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function CreateCardLevels_Extended(level_extended, index) {
  const position = index + 76;
  const videoId = level_extended.video_url.split("v=")[1]?.split("&")[0];
  const imageSrc = videoId
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : "/img/placeholder.png";

  return `
    <div class="d-flex justify-content-center">
      <div class="card mb-3" style="max-width:1000px;margin:20px;">
        <div class="row g-0">
          <div class="col-md-4">
            <a href="${level_extended.video_url}" target="_blank">
              <img src="${imageSrc}" class="img-fluid rounded-start">
            </a>
          </div>
          <div class="col-md-8">
            <div class="card-body">
              <h5 style="font-size:3rem;color:#980000;">
                ${position} - ${level_extended.lvl_name} by ${level_extended.lvl_creator}
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
