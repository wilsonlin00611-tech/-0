let globalZhDict = {};
let currentCards = [];
let isDragging = false;
let startX = 0;
let currentRotation = 0;
let tempRotation = 0;

const stage = document.getElementById('stage');
const mainBtn = document.getElementById('main-btn');
const msg = document.getElementById('msg');
const log = document.getElementById('log');

// 初始化：GraphQL 抓取中文名
async function initGame() {
    try {
        const GQL_QUERY = `query {
            pokemon_v2_pokemonspeciesname(where: {language_id: {_in: [4, 12]}}) {
                pokemon_species_id
                name
            }
        }`;
        const res = await fetch('https://beta.pokeapi.co/graphql/v1beta', {
            method: 'POST',
            body: JSON.stringify({ query: GQL_QUERY })
        });
        const json = await res.json();
        json.data.pokemon_v2_pokemonspeciesname.forEach(item => {
            globalZhDict[item.pokemon_species_id] = item.name;
        });
        msg.innerText = "圖鑑下載完畢！";
        mainBtn.disabled = false;
    } catch (e) {
        msg.innerText = "下載失敗，請重新載入";
    }
}

// 抽卡邏輯：屬性不重複
async function drawCards() {
    mainBtn.disabled = true;
    msg.innerText = "正在尋找不重複屬性的隊伍...";
    currentCards = [];
    const usedTypes = new Set();
    stage.innerHTML = "";

    while (currentCards.length < 5) {
        const id = Math.floor(Math.random() * 1025) + 1;
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const data = await res.json();
        
        const types = data.types.map(t => t.type.name);
        if (!types.some(t => usedTypes.has(t))) {
            types.forEach(t => usedTypes.add(t));
            currentCards.push({
                id: data.id,
                enName: data.name,
                zhName: globalZhDict[data.id] || data.name,
                img: data.sprites.other['official-artwork'].front_default,
                hp: data.stats[0].base_stat * 3,
                maxHp: data.stats[0].base_stat * 3,
                atk: data.stats[1].base_stat,
                types: types
            });
        }
    }
    renderCarousel();
    msg.innerText = "左右滑動選取你的寶可夢";
}

// 渲染 3D 旋轉木馬
function renderCarousel() {
    stage.innerHTML = "";
    currentCards.forEach((pokemon, i) => {
        const card = document.createElement('div');
        card.className = 'card';
        const angle = i * (360 / 5);
        card.style.transform = `rotateY(${angle}deg) translateZ(300px)`;
        card.innerHTML = `
            <img src="${pokemon.img}">
            <h3>${pokemon.zhName}</h3>
            <div style="font-size:12px; color:#aaa;">${pokemon.enName}</div>
            <div style="margin:10px 0;">
                ${pokemon.types.map(t => `<span class="type-tag">${t}</span>`).join('')}
            </div>
            <div style="font-weight:bold;">HP: ${pokemon.hp} | ATK: ${pokemon.atk}</div>
            <button style="margin-top:15px; font-size:14px;" onclick="selectForBattle(${i})">選擇出戰</button>
        `;
        stage.appendChild(card);
    });
}

// 跨裝置拖拽監聽
const startDrag = (e) => {
    isDragging = true;
    startX = e.pageX || e.touches[0].pageX;
    tempRotation = currentRotation;
};

const moveDrag = (e) => {
    if (!isDragging) return;
    const x = e.pageX || e.touches[0].pageX;
    const diff = (x - startX) * 0.5;
    currentRotation = tempRotation + diff;
    stage.style.transform = `rotateY(${currentRotation}deg)`;
};

const endDrag = () => { isDragging = false; };

window.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', moveDrag);
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchstart', startDrag);
window.addEventListener('touchmove', moveDrag);
window.addEventListener('touchend', endDrag);

// 戰鬥邏輯
async function selectForBattle(idx) {
    const player = currentCards[idx];
    document.getElementById('phase-select').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'none';
    document.getElementById('phase-battle').style.display = 'flex';

    // 隨機對手
    const eid = Math.floor(Math.random() * 1025) + 1;
    const eres = await fetch(`https://pokeapi.co/api/v2/pokemon/${eid}`);
    const edata = await eres.json();
    const enemy = {
        zhName: globalZhDict[eid] || edata.name,
        img: edata.sprites.other['official-artwork'].front_default,
        hp: edata.stats[0].base_stat * 3,
        maxHp: edata.stats[0].base_stat * 3,
        atk: edata.stats[1].base_stat
    };

    renderBattleSlot('player-slot', player);
    renderBattleSlot('enemy-slot', enemy);
    
    await runBattle(player, enemy);
}

function renderBattleSlot(id, p) {
    document.getElementById(id).innerHTML = `
        <img src="${p.img}" width="150">
        <h3>${p.zhName}</h3>
        <div class="hp-bar-outer"><div class="hp-bar-inner" id="hp-${id}"></div></div>
        <div id="text-${id}">HP: ${p.hp} / ${p.maxHp}</div>
    `;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runBattle(p, e) {
    log.innerHTML = "戰鬥開始！<br>";
    while (p.hp > 0 && e.hp > 0) {
        // 玩家攻擊
        await sleep(800);
        let dmg = Math.floor(p.atk * (0.9 + Math.random() * 0.2));
        e.hp -= dmg;
        log.innerHTML += `【${p.zhName}】發擊！造成 ${dmg} 傷害<br>`;
        updateHP('enemy-slot', e);
        if (e.hp <= 0) break;

        // 對手攻擊
        await sleep(800);
        dmg = Math.floor(e.atk * (0.9 + Math.random() * 0.2));
        p.hp -= dmg;
        log.innerHTML += `敵方【${e.zhName}】反擊！造成 ${dmg} 傷害<br>`;
        updateHP('player-slot', p);
        log.scrollTop = log.scrollHeight;
    }
    log.innerHTML += `<br><b>${p.hp > 0 ? '🏆 你贏了！' : '💀 你輸了...'}</b>`;
    await sleep(2000);
    location.reload(); // 戰鬥結束重新開始
}

function updateHP(slotId, p) {
    const percent = Math.max(0, (p.hp / p.maxHp) * 100);
    document.getElementById(`hp-${slotId}`).style.width = percent + "%";
    document.getElementById(`text-${slotId}`).innerText = `HP: ${Math.max(0, p.hp)} / ${p.maxHp}`;
}

window.onload = initGame;
