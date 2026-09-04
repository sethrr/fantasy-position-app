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

function renderDraft(data) {
    const section = document.getElementById('draft-section');
    const chooserText = document.getElementById('current-chooser');
    const title = document.getElementById('assigned-picks-title');
    const ul = document.getElementById('assigned-picks');

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

        ul.innerHTML = '';
        Object.keys(draftPicks).forEach(name => {
            const player = playerByName(name);
            let li = document.createElement('li');
            li.classList.add('draft-pick-item');
            let img = document.createElement('img');
            img.src = player ? player.image : '';
            img.alt = name;
            img.classList.add('draft-pick-image');
            let textSpan = document.createElement('span');
            textSpan.textContent = `🏈 ${name}: Draft Pick #${draftPicks[name]}`;
            li.appendChild(img);
            li.appendChild(textSpan);
            ul.appendChild(li);
        });
    } else {
        chooserText.style.display = 'none';
        title.textContent = '🏆 FINAL DRAFT ORDER 🏆';
        title.style.display = 'block';

        let order = Object.keys(draftPicks).map(name => ({
            name,
            pick: draftPicks[name],
            image: playerByName(name)?.image || ''
        })).sort((a, b) => a.pick - b.pick);

        ul.innerHTML = '';
        order.forEach((o, index) => {
            let li = document.createElement('li');
            li.classList.add('final-order-item');
            let img = document.createElement('img');
            img.src = o.image;
            img.alt = o.name;
            img.classList.add('final-order-image');
            const rankIcon = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏈';
            let textSpan = document.createElement('span');
            textSpan.textContent = `${rankIcon} Pick #${o.pick}: ${o.name}`;
            li.appendChild(img);
            li.appendChild(textSpan);
            ul.appendChild(li);
        });
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
