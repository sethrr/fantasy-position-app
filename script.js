// Excel file processing functions (keep at top for compatibility)
var gk_isXlsx = false;
var gk_xlsxFileLookup = {};
var gk_fileData = {};

function filledCell(cell) {
    return cell !== '' && cell != null;
}

function loadFileData(filename) {
    if (gk_isXlsx && gk_xlsxFileLookup[filename]) {
        try {
            var workbook = XLSX.read(gk_fileData[filename], { type: 'base64' });
            var firstSheetName = workbook.SheetNames[0];
            var worksheet = workbook.Sheets[firstSheetName];

            // Convert sheet to JSON to filter blank rows
            var jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, defval: '' });
            // Filter out blank rows (rows where all cells are empty, null, or undefined)
            var filteredData = jsonData.filter(row => row.some(filledCell));

            // Heuristic to find the header row by ignoring rows with fewer filled cells than the next row
            var headerRowIndex = filteredData.findIndex((row, index) =>
                row.filter(filledCell).length >= filteredData[index + 1]?.filter(filledCell).length
            );
            // Fallback
            if (headerRowIndex === -1 || headerRowIndex > 25) {
                headerRowIndex = 0;
            }

            // Convert filtered JSON back to CSV
            var csv = XLSX.utils.aoa_to_sheet(filteredData.slice(headerRowIndex)); // Create a new sheet from filtered array of arrays
            csv = XLSX.utils.sheet_to_csv(csv, { header: 1 });
            return csv;
        } catch (e) {
            console.error(e);
            return "";
        }
    }
    return gk_fileData[filename] || "";
}

// Draft Order Tool Application
// Update players array to include name and image
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

let scores = {};
let currentRace = [];
let raceNumber = 1;
let maxRaces = 5;
let sortedPlayers = [];
let currentChooserIndex = 0;
let availablePicks = Array.from({ length: 12 }, (_, i) => i + 1);
let draftPicks = {};
let gamePhase = 'setup';

// Push current game state to Firestore so watch.html can mirror it live.
// No-ops silently if firebase-config.js hasn't been filled in yet.
function syncGameState() {
    if (typeof gameDocRef === 'undefined' || !gameDocRef) return;
    try {
        gameDocRef.set({
            phase: gamePhase,
            scores,
            currentRace,
            raceNumber,
            maxRaces,
            sortedPlayerNames: sortedPlayers.map(p => p.name),
            currentChooserIndex,
            availablePicks,
            draftPicks,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(err => console.error('Live sync failed:', err));
    } catch (e) {
        console.error('Live sync failed:', e);
    }
}

// Sound effects using Web Audio API
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine') {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playWhistle() {
    playSound(800, 0.2, 'square');
    setTimeout(() => playSound(600, 0.15, 'square'), 100);
}

function playCrowd() {
    // Simulate crowd cheer with filtered noise
    const bufferSize = audioContext.sampleRate * 0.5;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;

    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);

    noise.start();
    noise.stop(audioContext.currentTime + 0.8);
}

function playTouchdown() {
    playSound(523, 0.3); // C
    setTimeout(() => playSound(659, 0.3), 200); // E
    setTimeout(() => playSound(784, 0.5), 400); // G
    setTimeout(() => playCrowd(), 600);
}

function playDraftPick() {
    playSound(440, 0.2); // A
    setTimeout(() => playSound(554, 0.2), 150); // C#
    setTimeout(() => playSound(659, 0.3), 300); // E
}

function playStartGame() {
    playWhistle();
    setTimeout(() => playTouchdown(), 500);
}

// Create floating footballs dynamically
function createFloatingFootballs() {
    // Increase number of footballs for denser background
    for (let i = 0; i < 20; i++) {
        const football = document.createElement('div');
        football.className = 'football';
        football.textContent = '🏈';
        football.style.top = Math.random() * 100 + '%';
        football.style.left = Math.random() * 100 + '%';
        football.style.animationDelay = Math.random() * 8 + 's';
        football.style.fontSize = (15 + Math.random() * 10) + 'px';
        document.body.appendChild(football);
    }
}

// Initialize scores
function initializeScores() {
    players.forEach(player => {
        scores[player.name] = { races: Array(maxRaces).fill(0), total: 0 };
    });
}

// Start the app after rounds are entered
function startApp() {
    // Resume audio context on user interaction
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    maxRaces = parseInt(document.getElementById('num-rounds').value) || 5;
    if (maxRaces < 1 || maxRaces > 10) {
        document.getElementById('rounds-error').style.display = 'block';
        playSound(300, 0.3, 'sawtooth'); // Error sound
        return;
    }

    playStartGame();
    document.getElementById('rounds-error').style.display = 'none';
    document.getElementById('rounds-input').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    createFloatingFootballs();
    initializeScores();
    buildButtons();
    buildTable();
    updateStandings();

    gamePhase = 'racing';
    syncGameState();
}

// Build player selection buttons
function buildButtons() {
    const btnDiv = document.getElementById('buttons');
    btnDiv.innerHTML = '';
    players.forEach((player, index) => {
        let btn = document.createElement('button');
        btn.classList.add('player-button');

        // Create image element
        let img = document.createElement('img');
        img.src = player.image;
        img.alt = player.name;
        img.classList.add('player-image');

        // Create text element
        let span = document.createElement('span');
        span.textContent = player.name;
        span.classList.add('player-name');

        // Add image and text to button
        btn.appendChild(img);
        btn.appendChild(span);

        btn.onclick = () => selectPlayer(player.name);
        btn.id = `btn-${player.name.replace(/\s/g, '-')}`;
        btn.style.setProperty('--i', index);
        btn.style.animationDelay = (index * 0.1) + 's';
        btnDiv.appendChild(btn);
    });
}

// Handle player selection in race
function selectPlayer(name) {
    if (currentRace.includes(name)) return;

    currentRace.push(name);
    let place = currentRace.length;
    let points = 130 - place * 10;

    if (!scores[name]) scores[name] = { races: Array(maxRaces).fill(0), total: 0 };

    scores[name].races[raceNumber - 1] = points;
    scores[name].total += points;

    const btn = document.getElementById(`btn-${name.replace(/\s/g, '-')}`);
    btn.disabled = true;

    // Update button content to show place with image still visible
    const img = btn.querySelector('.player-image');
    const span = btn.querySelector('.player-name');
    span.textContent = `${name} - ${getPlaceText(place)}`;
    btn.classList.add('selected');

    // Play appropriate sound
    if (place === 1) {
        playTouchdown();
    } else if (place <= 3) {
        playCrowd();
    } else {
        playSound(400, 0.15);
    }

    updateTable(name);
    updateStandings(name);

    if (currentRace.length === 12) {
        playWhistle(); // Round complete
        currentRace = [];
        raceNumber++;
        document.getElementById('race-num').textContent = raceNumber;
        // Update standings after each race
        sortedPlayers = [...players].sort((a, b) => (scores[b.name]?.total || 0) - (scores[a.name]?.total || 0));
        // Ensure standings section is visible
        const standingsDiv = document.getElementById('standings');
        if (standingsDiv) {
            standingsDiv.style.display = 'block';
        }
        updateStandings();
        if (raceNumber > maxRaces) {
            document.getElementById('race-section').style.display = 'none';
            startDraft();
        } else {
            setTimeout(() => resetButtons(), 1500);
        }
    }

    syncGameState();
}

// Get place icon and text
function getPlaceIcon(place) {
    const icons = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣'];
    return icons[place - 1] || place;
}

function getPlaceText(place) {
    const suffixes = ['st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th'];
    return `${place}${suffixes[place - 1]} Place`;
}

// Reset buttons for next race
function resetButtons() {
    players.forEach((player, index) => {
        const btn = document.getElementById(`btn-${player.name.replace(/\s/g, '-')}`);
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('selected');

            // Reset button content
            const span = btn.querySelector('.player-name');
            if (span) {
                span.textContent = player.name;
            }

            btn.style.animation = `buttonBob 3s ease-in-out infinite`;
            btn.style.animationDelay = (index * 0.1) + 's';
        }
    });
}

// Build initial scores table
function buildTable() {
    const thead = document.getElementById('table-head');
    let headerRow = '<tr><th><img src="player-icons.png" alt="Player" class="table-header-image"> Player</th>';
    for (let i = 1; i <= maxRaces; i++) {
        headerRow += `<th>🏃‍♂️‍➡️ Round ${i}</th>`;
    }
    headerRow += '<th>🏆 Total Points</th></tr>';
    thead.innerHTML = headerRow;

    const tbody = document.getElementById('score-body');
    tbody.innerHTML = '';
    players.forEach(player => {
        let tr = document.createElement('tr');
        tr.id = `row-${player.name.replace(/\s/g, '-')}`;
        let html = `<td><img src="${player.image}" alt="${player.name}" class="table-player-image"> ${player.name}</td>`;
        for (let i = 0; i < maxRaces; i++) {
            html += `<td id="race-${player.name.replace(/\s/g, '-')}-${i + 1}">0</td>`;
        }
        html += `<td id="total-${player.name.replace(/\s/g, '-')}">0</td>`;
        tr.innerHTML = html;
        tbody.appendChild(tr);
    });
}

// Update scores table with animations
function updateTable(updatedPlayer) {
    players.forEach(player => {
        for (let i = 0; i < maxRaces; i++) {
            const cell = document.getElementById(`race-${player.name.replace(/\s/g, '-')}-${i + 1}`);
            if (cell) cell.textContent = scores[player.name]?.races[i] || 0;
            if (player.name === updatedPlayer && i === raceNumber - 1) {
                const row = document.getElementById(`row-${player.name.replace(/\s/g, '-')}`);
                if (row) {
                    row.classList.add('updated');
                    setTimeout(() => row.classList.remove('updated'), 1000);
                }
            }
        }
        const totalCell = document.getElementById(`total-${player.name.replace(/\s/g, '-')}`);
        if (totalCell) totalCell.textContent = scores[player.name]?.total || 0;
    });
}

// Update live standings with animations
function updateStandings(updatedPlayer) {
    // Sort by total points, highest first
    let sorted = [...players].sort((a, b) => (scores[b.name]?.total || 0) - (scores[a.name]?.total || 0));
    const ol = document.getElementById('standings-list');
    ol.innerHTML = '';
    sorted.forEach((player, index) => {
        let li = document.createElement('li');
        li.classList.add('standings-item');

        // Create image element for standings
        let img = document.createElement('img');
        img.src = player.image;
        img.alt = player.name;
        img.classList.add('standings-image');

        // Numbered standings by points order
        let textSpan = document.createElement('span');
        textSpan.textContent = `${index + 1}. ${player.name} - ${scores[player.name]?.total || 0} pts`;

        li.appendChild(img);
        li.appendChild(textSpan);

        if (player.name === updatedPlayer) {
            li.classList.add('updated');
            setTimeout(() => li.classList.remove('updated'), 1000);
        }
        ol.appendChild(li);
    });
}

// Start draft pick selection
function startDraft() {
    gamePhase = 'draft';
    playTouchdown(); // Championship complete sound

    // Race table no longer needed; draft controls take over
    document.getElementById('score-table').style.display = 'none';

    // Update sortedPlayers for draft order before draft starts
    sortedPlayers = [...players].sort((a, b) => (scores[b.name]?.total || 0) - (scores[a.name]?.total || 0));
    // Center the standings
    const standingsDiv = document.getElementById('standings');
    if (standingsDiv) {
        standingsDiv.style.margin = '0 auto';
        standingsDiv.style.maxWidth = '500px';
        standingsDiv.style.textAlign = 'center';
        standingsDiv.style.display = 'block';

        // Update the standings title to highlight final order
        const standingsTitle = standingsDiv.querySelector('h2');
        if (standingsTitle) {
            standingsTitle.textContent = '🏆 FINAL STANDINGS 🏆';
        }

        // Use updateStandings to refresh the standings list
        updateStandings();
    }

    // Show draft controls and let the top scorer pick first
    document.getElementById('draft-section').style.display = 'block';
    nextChooser();
}

// Set up next chooser
function nextChooser() {
    if (currentChooserIndex >= 12) {
        showFinalOrder();
        return;
    }
    let chooser = sortedPlayers[currentChooserIndex];
    const chooserText = document.getElementById('current-chooser');
    if (chooserText) {
        chooserText.innerHTML = `<img src="${chooser.image}" alt="${chooser.name}" class="chooser-image"> 🎯 ${chooser.name}'s turn to select draft pick (Total: ${scores[chooser.name]?.total || 0} points) 🎯`;
    }
    const select = document.getElementById('draft-pick-select');
    if (select) {
        select.innerHTML = '<option value="">🏈 Select Draft Position 🏈</option>';
        availablePicks.forEach(pick => {
            let opt = document.createElement('option');
            opt.value = pick;
            opt.textContent = `Draft Pick #${pick}`;
            select.appendChild(opt);
        });
    }
}

// Confirm draft pick
function confirmPick() {
    let chooser = sortedPlayers[currentChooserIndex];
    let pick = document.getElementById('draft-pick-select')?.value;
    if (!pick) {
        const error = document.getElementById('draft-error');
        if (error) error.style.display = 'block';
        playSound(300, 0.3, 'sawtooth'); // Error sound
        return;
    }

    playDraftPick();
    const error = document.getElementById('draft-error');
    if (error) error.style.display = 'none';
    pick = parseInt(pick);
    draftPicks[chooser.name] = pick;
    availablePicks = availablePicks.filter(p => p !== pick);

    const ul = document.getElementById('assigned-picks');
    if (ul) {
        let li = document.createElement('li');
        li.classList.add('draft-pick-item');

        // Create image for draft picks
        let img = document.createElement('img');
        img.src = chooser.image;
        img.alt = chooser.name;
        img.classList.add('draft-pick-image');

        let textSpan = document.createElement('span');
        textSpan.textContent = `🏈 ${chooser.name}: Draft Pick #${pick}`;

        li.appendChild(img);
        li.appendChild(textSpan);
        li.style.animationDelay = (currentChooserIndex * 0.1) + 's';
        ul.appendChild(li);
    }
    currentChooserIndex++;
    nextChooser();
    syncGameState();
}

// Show final draft order sorted by pick
function showFinalOrder() {
    gamePhase = 'final';
    playTouchdown(); // Final celebration
    let order = [];
    for (let name in draftPicks) {
        // Find player object for image
        let playerObj = players.find(p => p.name === name);
        order.push({ name, pick: draftPicks[name], image: playerObj ? playerObj.image : '' });
    }
    order.sort((a, b) => a.pick - b.pick);

    const ul = document.getElementById('assigned-picks');
    if (ul) {
        ul.innerHTML = '';
        let h3 = document.createElement('h3');
        h3.textContent = '🏆 FINAL DRAFT ORDER 🏆';
        h3.style.textAlign = 'center';
        h3.style.color = 'var(--accent-gold)';
        h3.style.fontSize = '24px';
        h3.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        ul.appendChild(h3);

        order.forEach((o, index) => {
            let li = document.createElement('li');
            li.classList.add('final-order-item');

            // Create image for final order
            let img = document.createElement('img');
            img.src = o.image;
            img.alt = o.name;
            img.classList.add('final-order-image');

            const rankIcon = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏈';
            let textSpan = document.createElement('span');
            textSpan.textContent = `${rankIcon} Pick #${o.pick}: ${o.name}`;

            li.appendChild(img);
            li.appendChild(textSpan);
            li.style.animationDelay = (index * 0.1) + 's';
            li.style.fontSize = '16px';
            li.style.fontWeight = '700';
            ul.appendChild(li);
        });
    }

    // Hide draft controls
    const chooser = document.getElementById('current-chooser');
    const controls = document.getElementById('draft-controls');
    const assignedPicksTitle = document.getElementById('assigned-picks-title');
    const dps = document.getElementById('dps');
    const pcd = document.getElementById('pcd');
    if (chooser) chooser.style.display = 'none';
    if (controls) controls.style.display = 'none';
    if (assignedPicksTitle) assignedPicksTitle.style.display = 'none';
    if (dps) dps.style.display = 'none';
    if (pcd) pcd.style.display = 'none';
}

// Reset the app to initial state
function resetApp() {
    playWhistle();
    scores = {};
    currentRace = [];
    raceNumber = 1;
    sortedPlayers = [];
    currentChooserIndex = 0;
    availablePicks = Array.from({ length: 12 }, (_, i) => i + 1);
    draftPicks = {};
    maxRaces = parseInt(document.getElementById('num-rounds').value) || 5;
    gamePhase = 'racing';

    document.getElementById('race-section').style.display = 'block';
    document.getElementById('draft-section').style.display = 'none';
    document.getElementById('score-table').style.display = 'block';
    document.getElementById('race-num').textContent = '1';

    // Undo the final-standings styling applied by startDraft()
    const standingsDiv = document.getElementById('standings');
    if (standingsDiv) {
        standingsDiv.style.margin = '';
        standingsDiv.style.maxWidth = '';
        standingsDiv.style.textAlign = '';
        const standingsTitle = standingsDiv.querySelector('h2');
        if (standingsTitle) standingsTitle.textContent = '🏅 DRAFT POSITION';
    }

    // Reset all elements
    const elements = ['draft-error', 'current-chooser', 'draft-controls', 'assigned-picks', 'assigned-picks-title', 'dps', 'pcd'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === 'draft-error') el.style.display = 'none';
            else if (['current-chooser', 'draft-controls', 'assigned-picks-title', 'dps', 'pcd'].includes(id)) el.style.display = 'block';
            else if (id === 'draft-controls') el.style.display = 'flex';
            else if (id === 'assigned-picks') el.innerHTML = '';
        }
    });

    initializeScores();
    buildButtons();
    buildTable();
    updateStandings();
    syncGameState();
}

// Wipe everything and go all the way back to the rounds entry screen
function startOverApp() {
    if (!confirm('Start over? This wipes all scores and draft picks for everyone watching.')) return;

    playWhistle();
    scores = {};
    currentRace = [];
    raceNumber = 1;
    sortedPlayers = [];
    currentChooserIndex = 0;
    availablePicks = Array.from({ length: 12 }, (_, i) => i + 1);
    draftPicks = {};
    gamePhase = 'setup';

    document.getElementById('app').style.display = 'none';
    document.getElementById('rounds-input').style.display = 'block';
    document.getElementById('rounds-error').style.display = 'none';
    document.getElementById('race-section').style.display = 'block';
    document.getElementById('score-table').style.display = 'block';
    document.getElementById('draft-section').style.display = 'none';
    document.getElementById('race-num').textContent = '1';

    const assignedPicks = document.getElementById('assigned-picks');
    if (assignedPicks) assignedPicks.innerHTML = '';
    document.getElementById('draft-error').style.display = 'none';
    ['current-chooser', 'draft-controls', 'assigned-picks-title', 'dps', 'pcd'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });

    // Undo the final-standings styling applied by startDraft()
    const standingsDiv = document.getElementById('standings');
    if (standingsDiv) {
        standingsDiv.style.margin = '';
        standingsDiv.style.maxWidth = '';
        standingsDiv.style.textAlign = '';
        const standingsTitle = standingsDiv.querySelector('h2');
        if (standingsTitle) standingsTitle.textContent = '🏅 DRAFT POSITION';
    }

    // Remove the extra floating footballs spawned during the game
    document.querySelectorAll('.football').forEach((el, i) => {
        if (i >= 5) el.remove();
    });

    syncGameState();
}

// Background music controls
document.addEventListener('DOMContentLoaded', function () {
    const music = document.getElementById('bg-music');
    const btn = document.getElementById('music-toggle-btn');
    let isPlaying = false;

    music.volume = 0.1;

    // Music only plays once the user clicks the button

    // Set initial button text
    btn.textContent = 'Play Hype Music!';

    btn.addEventListener('click', function () {
        if (isPlaying) {
            music.pause();
            btn.textContent = 'Play Hype Music!';
        } else {
            music.play();
            btn.textContent = 'Stop The Hype!';
        }
        isPlaying = !isPlaying;
    });
});

// Initialize scores on page load
initializeScores();

// Initialize audio context on first user interaction
document.addEventListener('click', function initAudio() {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    document.removeEventListener('click', initAudio);
}, { once: true });