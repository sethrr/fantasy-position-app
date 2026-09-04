// Read-only live view of the draft — mirrors whatever the host's browser pushes to Firestore.
const players = [
    { name: "Adam", image: "images/adam.jpg" },
    { name: "Alex", image: "images/alex.jpeg" },
    { name: "Daniels", image: "images/daniels.jpg" },
    { name: "Defargges", image: "images/defargges.jpeg" },
    { name: "Eric", image: "images/eric.jpg" },
    { name: "GR", image: "images/GR.jpg" },
    { name: "Gio", image: "images/gio.png" },
    { name: "Justin", image: "images/justin.jpg" },
    { name: "Seth", image: "images/seth.jpeg" },
    { name: "Shane", image: "images/shane.jpg" },
    { name: "Yared", image: "images/yared.jpeg" },
    { name: "Destin", image: "images/destin.jpg" }
];

function playerByName(name) {
    return players.find(p => p.name === name);
}

function getPlaceText(place) {
    const suffixes = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th'];
    return `${place}${suffixes[place - 1]} Place`;
}

function buildTable(maxRaces) {
    const thead = document.getElementById('table-head');
    let headerRow = '<tr><th>Player</th>';
    for (let i = 1; i <= maxRaces; i++) {
        headerRow += `<th>🏃‍♂️‍➡️ Round ${i}</th>`;
    }
    headerRow += '<th>🏆 Total Points</th></tr>';
    thead.innerHTML = headerRow;
}

function renderTable(scores, maxRaces) {
    const tbody = document.getElementById('score-body');
    tbody.innerHTML = '';
    players.forEach(player => {
        const playerScore = scores?.[player.name] || { races: Array(maxRaces).fill(0), total: 0 };
        let tr = document.createElement('tr');
        let html = `<td><img src="${player.image}" alt="${player.name}" class="table-player-image"> ${player.name}</td>`;
        for (let i = 0; i < maxRaces; i++) {
            html += `<td>${playerScore.races[i] || 0}</td>`;
        }
        html += `<td>${playerScore.total || 0}</td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

function renderStandings(scores) {
    const sorted = [...players].sort((a, b) => (scores?.[b.name]?.total || 0) - (scores?.[a.name]?.total || 0));
    const ol = document.getElementById('standings-list');
    ol.innerHTML = '';
    sorted.forEach((player, index) => {
        let li = document.createElement('li');
        li.classList.add('standings-item');

        let img = document.createElement('img');
        img.src = player.image;
        img.alt = player.name;
        img.classList.add('standings-image');

        let textSpan = document.createElement('span');
        textSpan.textContent = `${index + 1}. ${player.name} - ${scores?.[player.name]?.total || 0} pts`;

        li.appendChild(img);
        li.appendChild(textSpan);
        ol.appendChild(li);
    });
}

function renderRaceStatus(data) {
    const el = document.getElementById('race-status');
    if (data.phase === 'racing') {
        const picksSoFar = (data.currentRace || [])
            .map((name, i) => `${getPlaceText(i + 1)}: ${name}`)
            .join(' · ');
        el.innerHTML = `<h2>🏈 RACE ${data.raceNumber} RESULTS 🏈</h2>` + (picksSoFar ? `<p>${picksSoFar}</p>` : '<p>Waiting for the next result...</p>');
    } else if (data.phase === 'draft') {
        el.innerHTML = `<h2>🏆 DRAFT PICK SELECTION 🏆</h2>`;
    } else if (data.phase === 'final') {
        el.innerHTML = `<h2>🏆 FINAL DRAFT ORDER SET 🏆</h2>`;
    } else {
        el.innerHTML = '';
    }
}

// Render all 12 draft slots in pick order (1-12), filling in names as they're chosen.
function renderPicksList(draftPicks, isFinal) {
    const ul = document.getElementById('assigned-picks');
    ul.innerHTML = '';

    const nameByPick = {};
    Object.keys(draftPicks).forEach(name => { nameByPick[draftPicks[name]] = name; });

    for (let pick = 1; pick <= 12; pick++) {
        const name = nameByPick[pick];
        const player = name ? playerByName(name) : null;

        let li = document.createElement('li');
        li.classList.add(isFinal ? 'final-order-item' : 'draft-pick-item');
        if (!name) li.style.opacity = '0.4';

        let img = document.createElement('img');
        img.src = player ? player.image : '';
        img.alt = name || '';
        img.classList.add(isFinal ? 'final-order-image' : 'draft-pick-image');
        if (!name) img.style.visibility = 'hidden';

        const rankIcon = isFinal ? (pick === 1 ? '👑' : pick === 2 ? '🥈' : pick === 3 ? '🥉' : '🏈') : '🏈';
        let textSpan = document.createElement('span');
        textSpan.textContent = name ? `${rankIcon} Pick #${pick}: ${name}` : `Pick #${pick}: — waiting —`;
        if (isFinal) {
            li.style.fontSize = '16px';
            li.style.fontWeight = '700';
        }

        li.appendChild(img);
        li.appendChild(textSpan);
        ul.appendChild(li);
    }
}

function renderDraft(data) {
    const section = document.getElementById('draft-section');
    const chooserText = document.getElementById('current-chooser');
    const title = document.getElementById('assigned-picks-title');

    if (data.phase !== 'draft' && data.phase !== 'final') {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const sortedNames = data.sortedPlayerNames || [];
    const draftPicks = data.draftPicks || {};

    if (data.phase === 'draft') {
        const chooserName = sortedNames[data.currentChooserIndex];
        const chooser = chooserName ? playerByName(chooserName) : null;
        chooserText.style.display = 'flex';
        chooserText.innerHTML = chooser
            ? `<img src="${chooser.image}" alt="${chooser.name}" class="chooser-image"> 🎯 ${chooser.name}'s turn to select draft pick 🎯`
            : '';
        title.textContent = '📋 DRAFT SELECTIONS';
        title.style.display = 'block';
        renderPicksList(draftPicks, false);
    } else {
        chooserText.style.display = 'none';
        title.textContent = '🏆 FINAL DRAFT ORDER 🏆';
        title.style.display = 'block';
        renderPicksList(draftPicks, true);
    }
}

let tableBuiltForRaces = null;

function render(data) {
    const waiting = document.getElementById('waiting');
    const app = document.getElementById('watch-app');

    if (!data || !data.phase || data.phase === 'setup') {
        waiting.style.display = 'block';
        app.style.display = 'none';
        return;
    }
    waiting.style.display = 'none';
    app.style.display = 'block';

    if (tableBuiltForRaces !== data.maxRaces) {
        buildTable(data.maxRaces);
        tableBuiltForRaces = data.maxRaces;
    }

    renderRaceStatus(data);
    renderTable(data.scores, data.maxRaces);
    renderStandings(data.scores);
    renderDraft(data);
}

if (typeof gameDocRef === 'undefined' || !gameDocRef) {
    document.getElementById('waiting').textContent = '⚠️ Live sync is not configured yet (firebase-config.js needs a real Firebase project).';
} else {
    gameDocRef.onSnapshot(doc => {
        render(doc.exists ? doc.data() : null);
    }, err => {
        console.error('Live sync error:', err);
        document.getElementById('waiting').textContent = '⚠️ Lost connection to the live game.';
    });
}
