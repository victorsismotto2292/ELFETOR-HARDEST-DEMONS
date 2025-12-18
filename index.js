const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

const port = 3005;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static('public'));
app.use('/style', express.static('style'));
app.use('/img', express.static('img'));

const levelsPath = path.join(__dirname, 'levels.json');
const levelsData = fs.readFileSync(levelsPath);
const levels = JSON.parse(levelsData);

function CreateCardLevels(level, index){
    const video_url = `${level.video_url}`;
    const position = index + 1;
    const imageSrc = `/img/${level.lvl_name.toLowerCase().replace(/\s+/g, '')}_elfetor.png`;
    const difficulty = `${level.diff_scale}`;
    const historyHtml = level.pos_history.map(log => log.log1).join('<br>');
    let levelCardHtml = `
    <div class="d-flex justify-content-center">
    <div class="card mb-3" style="max-width: 1000px; margin: 20px;">
        <div class="row g-0">
            <div class="col-md-4">
                <a href="${video_url}"><img src="${imageSrc}" class="img-fluid rounded-start" alt="${level.lvl_name}"></a>
            </div>
            <div class="col-md-8">
                <div class="card-body">
                    <h5 class="card-title" style="font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif; font-size: 3rem; color: #980000;">${position}- ${level.lvl_name} by ${level.lvl_creator}</h5>
                    <p class="card-text" style="font-weight: 500; font-size: 14px; color: #980000;">(Top ${level.pos_aredl} ${level.diff_rank})</p>
                    <p class="card-text" style="font-weight: bold; font-size: small; color: black; margin-bottom: 60px;">Tier (AREDL): ${difficulty}</p>
                </div>
            </div>
        </div>
        <div class="dropdown" style="width: 100%;">
            <a class="btn dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false" style="background-color: rgb(231, 231, 231); width: 100%;">
            View Position History
            </a>

            <ul class="dropdown-menu" style="width: 100%; text-align: left; padding-left: 10px;">
            <p>${historyHtml}</p>
            </ul>
        </div>
    </div>
</div>
    `;

    return levelCardHtml;
}

app.get('/home', (req, res) => {
    const cardsHtml = levels.map((level, index) => CreateCardLevels(level, index)).join('');
    const htmlPagePath = path.join(__dirname, '/public/home.html');
    let htmlPage = fs.readFileSync(htmlPagePath, 'utf-8');
    htmlPage = htmlPage.replace('{{cardsHtml}}', cardsHtml);
    res.send(htmlPage);
});

app.listen(port, () => {
    console.log(`Server now loading in: http://localhost:${port}/home`);
});