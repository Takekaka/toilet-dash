// ===================================
// トイレダッシュ！迷路でうんち回収ゲーム
//         - 完成版 (Dreamloで簡単ランキング) -
// ===================================

// ★変更: Dreamloのキーを設定 (Step 1で取得したあなたのキーに書き換える)
const DREAMLO_PRIVATE_CODE = 'nTzomuLRnkmyEm2iPph04AgTk9-npf5EOvAEiUAQF7OA'; // スコア登録用 (例: 'AbCDefGh1234ijK...')
const DREAMLO_PUBLIC_CODE = '686ce7628f40bc109c19a00a';  // スコア取得用 (例: '60a1b2c3d4e5f67890...')
const DREAMLO_URL_ADD = `https://www.dreamlo.com/lb/${DREAMLO_PRIVATE_CODE}/add/`;
const DREAMLO_URL_GET = `https://www.dreamlo.com/lb/${DREAMLO_PUBLIC_CODE}/json/10`; // 上位10件を取得

// ■ ゲーム設定 (定数: constを使用)
const MAZE_WIDTH = 21;//奇数
const MAZE_HEIGHT = 21;//奇数
const POOP_COUNT = 10;
const PLAYER_SPEED = 3;
const WALL_COLOR = '#4a2e00';
const PATH_COLOR = '#fffacd';
const ENEMY_COUNT = 20;
const PENALTY_TIME = 10;
const INVINCIBLE_DURATION = 120;
const ATTACK_COOLDOWN_TIME = 30;
const BULLET_SPEED = 6;

// ■ グローバル変数 (letを使用)
let cellSize;
let maze = [];

// ゲームの状態管理
let gameState = 'start'; // 'start', 'playing', 'clear', 'ranking', 'submitting'

// オブジェクト管理
let player;
let poops = [];
let enemies = [];
let bullets = [];
let titlePoops = [];

// アセット管理
let toiletImg, poopImg, enemyImg;
let bgm, collectSound, clearSound, penaltySound;

// タイマー関連
let startTime;
let clearTime;

// ランキング関連の変数
let rankingData = [];
let isRankingLoading = false;
let rankingError = null;
let rankingForm, playerNameInput, submitButton;


// ■ アセットの読み込み
function preload() {
    toiletImg = loadImage('toilet.png');
    poopImg = loadImage('poop.png');
    enemyImg = loadImage('toilet_paper.png');

    soundFormats('mp3', 'wav');
    bgm = loadSound('bgm.mp3');
    collectSound = loadSound('collect.wav');
    clearSound = loadSound('clear.wav');
    penaltySound = loadSound('penalty.wav');
}

// ■ 初期化 (一度だけ実行)
function setup() {
    createCanvas(600, 600);
    cellSize = width / MAZE_WIDTH;

    // HTMLのフォーム要素を取得
    rankingForm = select('#ranking-form');
    playerNameInput = select('#player-name');
    submitButton = select('#submit-score');
    submitButton.mousePressed(submitScore);

    initGame();
}

// ■ メインループ (毎フレーム実行)
function draw() {
    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'playing') {
        handleInput();
        update();
        drawGame();
    } else if (gameState === 'clear' || gameState === 'submitting') {
        drawClearScreen();
    } else if (gameState === 'ranking') {
        drawRankingScreen();
    }
}

// ============== ゲームの初期化・リセット ==============
function initGame() {
    maze = generateMaze(MAZE_WIDTH, MAZE_HEIGHT);

    // フォームを隠す
    rankingForm.hide();
    submitButton.removeAttribute('disabled');


    player = {
        x: cellSize * 1.5,
        y: cellSize * 1.5,
        size: cellSize * 0.8,
        invincible: false,
        invincibleTimer: 0,
        attackCooldown: 0,
        lastDirection: 'right'
    };

    poops = [];
    for (let i = 0; i < POOP_COUNT; i++) {
        placeObject(poops, {
            size: cellSize * 0.6,
            moveCooldown: 150,
            currentCooldown: floor(random(150))
        });
    }

    enemies = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
        placeObject(enemies, {
            size: cellSize * 0.7,
            moveCooldown: 60,
            currentCooldown: floor(random(60))
        });
    }

    bullets = [];
    clearTime = 0;

    if (titlePoops.length === 0) {
        for (let i = 0; i < 15; i++) {
            titlePoops.push({
                x: random(width), y: random(height),
                size: random(20, 50), speedY: random(0.2, 1.0),
                angle: random(TWO_PI), rotSpeed: random(-0.01, 0.01)
            });
        }
    }
}

function placeObject(arr, additionalProps) {
    let placed = false;
    while (!placed) {
        const gridX = floor(random(1, MAZE_WIDTH - 1));
        const gridY = floor(random(1, MAZE_HEIGHT - 1));

        if (maze[gridY][gridX] === 0 && (gridX > 3 || gridY > 3)) {
            const isOverlappingPoops = poops.some(p => p.x === gridX && p.y === gridY);
            const isOverlappingEnemies = enemies.some(e => e.x === gridX && e.y === gridY);

            if (!isOverlappingPoops && !isOverlappingEnemies) {
                const newObj = { ...additionalProps, x: gridX, y: gridY };
                arr.push(newObj);
                placed = true;
            }
        }
    }
}


// ============== ゲームロジックの更新 ==============
function update() {
    if (player.invincible) {
        player.invincibleTimer--;
        if (player.invincibleTimer <= 0) {
            player.invincible = false;
        }
    }
    if (player.attackCooldown > 0) {
        player.attackCooldown--;
    }

    updatePoops();
    updateEnemies();
    updateBullets();

    // うんちとの当たり判定 (回収)
    for (let i = poops.length - 1; i >= 0; i--) {
        const p = poops[i];
        const playerGridX = floor(player.x / cellSize);
        const playerGridY = floor(player.y / cellSize);
        if (playerGridX === p.x && playerGridY === p.y) {
            poops.splice(i, 1);
            collectSound.play();
        }
    }

    // 敵との当たり判定 (ダメージ)
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const playerGridX = floor(player.x / cellSize);
        const playerGridY = floor(player.y / cellSize);
        if (!player.invincible && playerGridX === e.x && playerGridY === e.y) {
            startTime -= PENALTY_TIME * 1000;
            penaltySound.play();
            player.invincible = true;
            player.invincibleTimer = INVINCIBLE_DURATION;
            enemies.splice(i, 1);
            placeObject(enemies, { ...e });
        }
    }

    // ゲームクリア判定
    if (poops.length === 0) {
        gameState = 'clear';
        bgm.stop();
        clearSound.play();
        clearTime = (millis() - startTime) / 1000;
    }
}

function updatePoops() {
    for (const poop of poops) {
        poop.currentCooldown--;
        if (poop.currentCooldown <= 0) {
            poop.currentCooldown = poop.moveCooldown;
            const possibleMoves = [];
            const { x, y } = poop;
            if (y > 1 && maze[y - 1][x] === 0) possibleMoves.push({ dx: 0, dy: -1 });
            if (y < MAZE_HEIGHT - 2 && maze[y + 1][x] === 0) possibleMoves.push({ dx: 0, dy: 1 });
            if (x > 1 && maze[y][x - 1] === 0) possibleMoves.push({ dx: -1, dy: 0 });
            if (x < MAZE_WIDTH - 2 && maze[y][x + 1] === 0) possibleMoves.push({ dx: 1, dy: 0 });
            if (possibleMoves.length > 0) {
                const move = random(possibleMoves);
                poop.x += move.dx;
                poop.y += move.dy;
            }
        }
    }
}

function updateEnemies() {
    for (const enemy of enemies) {
        enemy.currentCooldown--;
        if (enemy.currentCooldown <= 0) {
            enemy.currentCooldown = enemy.moveCooldown;
            const possibleMoves = [];
            const { x, y } = enemy;
            if (y > 1 && maze[y - 1][x] === 0) possibleMoves.push({ dx: 0, dy: -1 });
            if (y < MAZE_HEIGHT - 2 && maze[y + 1][x] === 0) possibleMoves.push({ dx: 0, dy: 1 });
            if (x > 1 && maze[y][x - 1] === 0) possibleMoves.push({ dx: -1, dy: 0 });
            if (x < MAZE_WIDTH - 2 && maze[y][x + 1] === 0) possibleMoves.push({ dx: 1, dy: 0 });
            if (possibleMoves.length > 0) {
                const move = random(possibleMoves);
                enemy.x += move.dx;
                enemy.y += move.dy;
            }
        }
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.dx;
        b.y += b.dy;

        const gridX = floor(b.x / cellSize);
        const gridY = floor(b.y / cellSize);

        if (gridX < 0 || gridX >= MAZE_WIDTH || gridY < 0 || gridY >= MAZE_HEIGHT || maze[gridY][gridX] === 1) {
            bullets.splice(i, 1);
            continue;
        }

        let hit = false;

        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (gridX === e.x && gridY === e.y) {
                enemies.splice(j, 1);
                bullets.splice(i, 1);
                hit = true;
                break;
            }
        }

        if (hit) {
            continue;
        }

        for (let j = poops.length - 1; j >= 0; j--) {
            const p = poops[j];
            if (gridX === p.x && gridY === p.y) {
                startTime -= PENALTY_TIME * 1000;
                penaltySound.play();
                const poopProps = { ...p };
                poops.splice(j, 1);
                placeObject(poops, poopProps);
                bullets.splice(i, 1);
                hit = true;
                break;
            }
        }

        if (hit) {
            continue;
        }
    }
}


// ============== 描画関連の関数 ==============
function drawGame() {
    background(PATH_COLOR);
    drawMaze();
    drawBullets();
    drawEnemies();
    drawPoops();
    drawPlayer();
    drawUI();
}

function drawMaze() {
    fill(WALL_COLOR);
    noStroke();
    for (let y = 0; y < MAZE_HEIGHT; y++) {
        for (let x = 0; x < MAZE_WIDTH; x++) {
            if (maze[y][x] === 1) {
                rect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
}

function drawBullets() {
    fill(0, 150, 255, 200);
    noStroke();
    for (const b of bullets) {
        ellipse(b.x, b.y, b.size, b.size);
    }
}

function drawEnemies() {
    for (const e of enemies) {
        const screenX = e.x * cellSize + (cellSize - e.size) / 2;
        const screenY = e.y * cellSize + (cellSize - e.size) / 2;
        if (enemyImg && enemyImg.width > 0) {
            image(enemyImg, screenX, screenY, e.size, e.size);
        } else {
            fill(250, 240, 230); stroke(200);
            rect(screenX, screenY, e.size, e.size);
        }
    }
}

function drawPoops() {
    for (const p of poops) {
        const screenX = p.x * cellSize + (cellSize - p.size) / 2;
        const screenY = p.y * cellSize + (cellSize - p.size) / 2;
        image(poopImg, screenX, screenY, p.size, p.size);
    }
}

function drawPlayer() {
    if (player.invincible && frameCount % 10 < 5) {
        return;
    }
    image(toiletImg, player.x - player.size / 2, player.y - player.size / 2, player.size, player.size);
}

function drawUI() {
    const elapsedTime = (millis() - startTime) / 1000;
    fill(0, 150);
    noStroke();
    rect(5, 5, 220, 70, 10);
    fill(255);
    textSize(20);
    textAlign(LEFT, TOP);
    text(`タイム: ${elapsedTime.toFixed(2)}`, 15, 15);
    text(`のこりのうんち: ${poops.length}`, 15, 45);
}

function drawStartScreen() {
    background(WALL_COLOR);
    for (const p of titlePoops) {
        p.y += p.speedY;
        p.angle += p.rotSpeed;
        if (p.y > height + p.size) {
            p.y = -p.size;
            p.x = random(width);
        }
        push();
        translate(p.x, p.y);
        rotate(p.angle);
        tint(255, 150);
        image(poopImg, -p.size / 2, -p.size / 2, p.size, p.size);
        pop();
    }
    noTint();
    textAlign(CENTER, CENTER);
    fill(0, 0, 0, 100);
    textSize(85);
    text('トイレダッシュ！', width / 2 + 4, height / 2 - 80 + 4);
    fill('#FFD700');
    stroke(WALL_COLOR);
    strokeWeight(5);
    textSize(80);
    text('トイレダッシュ！', width / 2, height / 2 - 80);
    const toiletY = height / 2 + 60 + sin(frameCount * 0.05) * 10;
    image(toiletImg, width / 2 - 75, toiletY, 150, 150);
    noStroke();
    
    textSize(22);
    fill(255, 128 + 127 * sin(frameCount * 0.1));
    text('- クリックして流す -', width / 2, height - 120);
    
    rectMode(CENTER);
    fill('#fffacd');
    rect(width/2, height - 65, 250, 40, 10);
    fill(WALL_COLOR);
    textSize(18);
    text('ランキングを見る', width/2, height - 65);
    rectMode(CORNER);

    textSize(18);
    fill(255);
    text('WASD/矢印キー: 移動  |  スペースキー: 水で攻撃', width / 2, height - 30);
}

function drawClearScreen() {
    background(PATH_COLOR);
    fill(WALL_COLOR);
    textAlign(CENTER, CENTER);
    textSize(50);
    
    if (gameState === 'submitting') {
        text('スコア登録中...', width / 2, height / 2 - 60);
    } else {
        text('ゲームクリア！', width / 2, height / 2 - 60);
        textSize(30);
        text(`タイム: ${clearTime.toFixed(2)} 秒`, width / 2, height / 2);

        rankingForm.show();
        
        textSize(20);
        text('クリックでタイトルへ (登録しない)', width / 2, height / 2 + 180);
    }
}

function drawRankingScreen() {
    background(PATH_COLOR);
    textAlign(CENTER, CENTER);
    fill(WALL_COLOR);
    textSize(40);
    text('グローバルランキング', width / 2, 60);

    if (isRankingLoading) {
        textSize(25);
        text('読み込み中...', width / 2, height / 2);
    } else if (rankingError) {
        textSize(20);
        fill(255, 0, 0);
        text(`エラー: ${rankingError}`, width / 2, height / 2);
    } else if (rankingData.length === 0) {
        textSize(25);
        text('まだ誰も流していません。', width / 2, height / 2);
    } else {
        textAlign(LEFT, CENTER);
        textSize(22);
        for (let i = 0; i < rankingData.length; i++) {
            const rank = i + 1;
            const entry = rankingData[i];
            const y = 140 + i * 40;

            // Dreamloはスコアが高いほど良い -> タイムは短いほど良い
            // 登録時に `999999 - time` でスコアを計算したので、表示時に元に戻す
            const time = 999999 - entry.score;

            // 順位
            textAlign(RIGHT);
            fill(WALL_COLOR);
            text(`${rank}.`, 150, y);

            // 名前
            textAlign(LEFT);
            text(entry.name, 170, y);

            // タイム
            textAlign(RIGHT);
            text(`${time.toFixed(2)} 秒`, width - 80, y);
        }
    }

    textAlign(CENTER, CENTER);
    textSize(20);
    fill(0, 128 + 127 * sin(frameCount * 0.05));
    text('クリックでタイトルへ', width / 2, height - 50);
}


// ============== イベントハンドラ ==============
function handleInput() {
    const prevX = player.x;
    const prevY = player.y;

    if (keyIsDown(UP_ARROW) || keyIsDown(87)) { player.y -= PLAYER_SPEED; player.lastDirection = 'up'; }
    if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) { player.y += PLAYER_SPEED; player.lastDirection = 'down'; }
    if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) { player.x -= PLAYER_SPEED; player.lastDirection = 'left'; }
    if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) { player.x += PLAYER_SPEED; player.lastDirection = 'right'; }

    const p_left = floor((player.x - player.size / 2) / cellSize);
    const p_right = floor((player.x + player.size / 2) / cellSize);
    const p_top = floor((player.y - player.size / 2) / cellSize);
    const p_bottom = floor((player.y + player.size / 2) / cellSize);
    if (maze[p_top][p_left] === 1 || maze[p_top][p_right] === 1 ||
        maze[p_bottom][p_left] === 1 || maze[p_bottom][p_right] === 1) {
        player.x = prevX;
        player.y = prevY;
    }
}

function mousePressed() {
    if (gameState === 'start') {
        // ランキングボタンの当たり判定
        if (mouseY > height - 85 && mouseY < height - 45 && mouseX > width/2 - 125 && mouseX < width/2 + 125) {
            goToRankingScreen();
        } else {
            gameState = 'playing';
            startTime = millis();
            if (!bgm.isPlaying()) {
                bgm.loop();
            }
        }
    } else if (gameState === 'clear') {
        // フォームの外側をクリックした場合のみ
        gameState = 'start';
        initGame();
    } else if (gameState === 'ranking') {
        gameState = 'start';
    }
}

function keyPressed() {
    if (gameState === 'playing' && keyCode === 32 && player.attackCooldown <= 0) {
        launchAttack();
        player.attackCooldown = ATTACK_COOLDOWN_TIME;
    }
}

function launchAttack() {
    let dx = 0, dy = 0;
    switch (player.lastDirection) {
        case 'up':    dy = -1; break;
        case 'down':  dy = 1;  break;
        case 'left':  dx = -1; break;
        case 'right': dx = 1;  break;
    }
    const bullet = {
        x: player.x,
        y: player.y,
        size: cellSize * 0.4,
        dx: dx * BULLET_SPEED,
        dy: dy * BULLET_SPEED,
    };
    bullets.push(bullet);
}

// ============== 迷路生成 (穴掘り法) ==============
function generateMaze(w, h) {
    let newMaze = Array(h).fill(null).map(() => Array(w).fill(1));
    const stack = [];
    let cx = 1, cy = 1;
    newMaze[cy][cx] = 0;
    stack.push([cx, cy]);

    while (stack.length > 0) {
        [cx, cy] = stack[stack.length - 1];
        const directions = [];
        if (cx > 1 && newMaze[cy][cx - 2] === 1) directions.push('W');
        if (cx < w - 2 && newMaze[cy][cx + 2] === 1) directions.push('E');
        if (cy > 1 && newMaze[cy - 2][cx] === 1) directions.push('N');
        if (cy < h - 2 && newMaze[cy + 2][cx] === 1) directions.push('S');

        if (directions.length > 0) {
            const dir = random(directions);
            let nx = cx, ny = cy;
            let wallX = cx, wallY = cy;
            switch (dir) {
                case 'N': ny -= 2; wallY -= 1; break;
                case 'S': ny += 2; wallY += 1; break;
                case 'W': nx -= 2; wallX -= 1; break;
                case 'E': nx += 2; wallX += 1; break;
            }
            newMaze[ny][nx] = 0;
            newMaze[wallY][wallX] = 0;
            stack.push([nx, ny]);
        } else {
            stack.pop();
        }
    }
    return newMaze;
}

// ============== ランキング関連の関数 ==============
function goToRankingScreen() {
    gameState = 'ranking';
    isRankingLoading = true;
    rankingError = null;

    loadJSON(DREAMLO_URL_GET, (data) => {
        if (data.dreamlo && data.dreamlo.leaderboard && data.dreamlo.leaderboard.entry) {
            rankingData = data.dreamlo.leaderboard.entry;
            // Dreamloはスコアが高い順なので、タイムが短い順(score昇順)にソート
            rankingData.sort((a, b) => a.score - b.score);
        } else {
            rankingData = [];
        }
        isRankingLoading = false;
    }, (err) => {
        console.error("Error fetching ranking: ", err);
        rankingError = "ランキングの取得に失敗しました。";
        isRankingLoading = false;
    });
}

function submitScore() {
    const name = playerNameInput.value().trim();
    if (name === '') {
        alert('名前を入力してください！');
        return;
    }

    gameState = 'submitting';
    submitButton.attribute('disabled', '');
    rankingForm.hide();

    // Dreamloはスコアが「高い」ほど上位。タイムは「短い」ほど良い。
    // そのため、非常に大きな数字からタイムを引くことで大小関係を逆転させる。
    // 小数点をなくすために100倍して整数にする。
    const score = 99999999 - floor(clearTime * 100); 

    const url = `${DREAMLO_URL_ADD}${encodeURIComponent(name)}/${score}`;

    httpGet(url, 'text', false, (response) => {
        console.log("Score submitted:", response);
        goToRankingScreen();
    }, (error) => {
        console.error("Error submitting score:", error);
        alert('スコアの登録に失敗しました。');
        gameState = 'clear';
        submitButton.removeAttribute('disabled');
        rankingForm.show();
    });
}