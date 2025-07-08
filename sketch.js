// ===================================
// トイレダッシュ！迷路でうんち回収ゲーム
//         - 完成版 (スマホ対応・十字キー操作) -
// ===================================

// ■ ゲーム設定 (定数: constを使用)
const MAZE_WIDTH = 21;
const MAZE_HEIGHT = 21;
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
let gameState = 'start';

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

// ★スマホ対応: UI関連の変数を追加
// ◆変更: pad, padKnobPos を dPad に変更
let dPad, attackBtn;
let touchDevice;

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
    createCanvas(windowWidth, windowHeight);
    touchDevice = isTouchDevice();
    calculateSizes();
    initGame();
}

// ★スマホ対応: 画面リサイズ時にUIやセルサイズを再計算
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    calculateSizes();
}

// ★スマホ対応: サイズ計算をまとめた関数
function calculateSizes() {
    let shorterSide = min(width, height);
    cellSize = shorterSide / (MAZE_WIDTH + 2);

    if (touchDevice) {
        // ◆変更: 十字キーの各ボタンの座標とサイズを計算
        const btnSize = min(width, height) * 0.11; // ボタン1つのサイズ
        const margin = btnSize * 0.1; // ボタン間の隙間
        const baseX = width * 0.2; // 十字キーの中心X座標
        const baseY = height * 0.75; // 十字キーの中心Y座標
        
        dPad = {
            up:    { x: baseX - btnSize / 2, y: baseY - btnSize * 1.5 - margin, w: btnSize, h: btnSize },
            down:  { x: baseX - btnSize / 2, y: baseY + btnSize * 0.5 + margin, w: btnSize, h: btnSize },
            left:  { x: baseX - btnSize * 1.5 - margin, y: baseY - btnSize / 2, w: btnSize, h: btnSize },
            right: { x: baseX + btnSize * 0.5 + margin, y: baseY - btnSize / 2, w: btnSize, h: btnSize },
            pressed: null // 現在押されている方向を記録 ('up', 'down', 'left', 'right')
        };
        
        attackBtn = { x: width * 0.82, y: height * 0.8, size: min(width, height) * 0.18 };
    }
}


// ■ メインループ (毎フレーム実行)
function draw() {
    if (gameState === 'start') {
        drawStartScreen();
    } else if (gameState === 'playing') {
        handleInput();
        update();
        drawGame();
    } else if (gameState === 'clear') {
        drawClearScreen();
    }
}

// ============== ゲームの初期化・リセット (変更なし) ==============
function initGame() { maze = generateMaze(MAZE_WIDTH, MAZE_HEIGHT); player = { x: cellSize * 1.5, y: cellSize * 1.5, size: cellSize * 0.8, invincible: false, invincibleTimer: 0, attackCooldown: 0, lastDirection: 'right' }; poops = []; for (let i = 0; i < POOP_COUNT; i++) { placeObject(poops, { size: cellSize * 0.6, moveCooldown: 150, currentCooldown: floor(random(150)) }); } enemies = []; for (let i = 0; i < ENEMY_COUNT; i++) { placeObject(enemies, { size: cellSize * 0.7, moveCooldown: 60, currentCooldown: floor(random(60)) }); } bullets = []; clearTime = 0; if (titlePoops.length === 0) { for (let i = 0; i < 15; i++) { titlePoops.push({ x: random(width), y: random(height), size: random(20, 50), speedY: random(0.2, 1.0), angle: random(TWO_PI), rotSpeed: random(-0.01, 0.01) }); } } }
function placeObject(arr, additionalProps) { let placed = false; while (!placed) { const gridX = floor(random(1, MAZE_WIDTH - 1)); const gridY = floor(random(1, MAZE_HEIGHT - 1)); if (maze[gridY][gridX] === 0 && (gridX > 3 || gridY > 3)) { const isOverlappingPoops = poops.some(p => p.x === gridX && p.y === gridY); const isOverlappingEnemies = enemies.some(e => e.x === gridX && e.y === gridY); if (!isOverlappingPoops && !isOverlappingEnemies) { const newObj = { ...additionalProps, x: gridX, y: gridY }; arr.push(newObj); placed = true; } } } }

// ============== ゲームロジックの更新 (変更なし) ==============
function update() { if (player.invincible) { player.invincibleTimer--; if (player.invincibleTimer <= 0) { player.invincible = false; } } if (player.attackCooldown > 0) { player.attackCooldown--; } updatePoops(); updateEnemies(); updateBullets(); for (let i = poops.length - 1; i >= 0; i--) { const p = poops[i]; const playerGridX = floor(player.x / cellSize); const playerGridY = floor(player.y / cellSize); if (playerGridX === p.x && playerGridY === p.y) { poops.splice(i, 1); collectSound.play(); } } for (let i = enemies.length - 1; i >= 0; i--) { const e = enemies[i]; const playerGridX = floor(player.x / cellSize); const playerGridY = floor(player.y / cellSize); if (!player.invincible && playerGridX === e.x && playerGridY === e.y) { startTime -= PENALTY_TIME * 1000; penaltySound.play(); player.invincible = true; player.invincibleTimer = INVINCIBLE_DURATION; enemies.splice(i, 1); const enemyProps = { ...e }; delete enemyProps.x; delete enemyProps.y; placeObject(enemies, enemyProps); } } if (poops.length === 0) { gameState = 'clear'; bgm.stop(); clearSound.play(); clearTime = (millis() - startTime) / 1000; } }
function updatePoops(){for(const t of poops){t.currentCooldown--,t.currentCooldown<=0&&(t.currentCooldown=t.moveCooldown,(()=>{const o=[],{x:s,y:e}=t;e>1&&0===maze[e-1][s]&&o.push({dx:0,dy:-1}),e<MAZE_HEIGHT-2&&0===maze[e+1][s]&&o.push({dx:0,dy:1}),s>1&&0===maze[e][s-1]&&o.push({dx:-1,dy:0}),s<MAZE_WIDTH-2&&0===maze[e][s+1]&&o.push({dx:1,dy:0}),o.length>0&&(()=>{const{dx:e,dy:a}=random(o);t.x+=e,t.y+=a})()})())}}
function updateEnemies(){for(const t of enemies){t.currentCooldown--,t.currentCooldown<=0&&(t.currentCooldown=t.moveCooldown,(()=>{const o=[],{x:s,y:e}=t;e>1&&0===maze[e-1][s]&&o.push({dx:0,dy:-1}),e<MAZE_HEIGHT-2&&0===maze[e+1][s]&&o.push({dx:0,dy:1}),s>1&&0===maze[e][s-1]&&o.push({dx:-1,dy:0}),s<MAZE_WIDTH-2&&0===maze[e][s+1]&&o.push({dx:1,dy:0}),o.length>0&&(()=>{const{dx:e,dy:a}=random(o);t.x+=e,t.y+=a})()})())}}
function updateBullets(){for(let t=bullets.length-1;t>=0;t--){const o=bullets[t];o.x+=o.dx,o.y+=o.dy;const s=floor(o.x/cellSize),e=floor(o.y/cellSize);if(s<0||s>=MAZE_WIDTH||e<0||e>=MAZE_HEIGHT||1===maze[e][s]){bullets.splice(t,1);continue}let a=!1;for(let l=enemies.length-1;l>=0;l--){const i=enemies[l];if(s===i.x&&e===i.y){enemies.splice(l,1);const o={...i};delete o.x,delete o.y,placeObject(enemies,o),bullets.splice(t,1),a=!0;break}}if(a)continue;for(let l=poops.length-1;l>=0;l--){const i=poops[l];if(s===i.x&&e===i.y){startTime-=1e3*PENALTY_TIME,penaltySound.play();const o={...i};poops.splice(l,1),delete o.x,delete o.y,placeObject(poops,o),bullets.splice(t,1),a=!0;break}}if(a)continue}}

// ============== 描画関連の関数 ==============
function drawGame() { background(PATH_COLOR); push(); const mazeTotalWidth = MAZE_WIDTH * cellSize; const mazeTotalHeight = MAZE_HEIGHT * cellSize; const camX = constrain(player.x - width / 2, 0, mazeTotalWidth - width); const camY = constrain(player.y - height / 2, 0, mazeTotalHeight - height); translate(-camX, -camY); drawMaze(); drawBullets(); drawEnemies(); drawPoops(); drawPlayer(); pop(); drawUI(); if (touchDevice) { drawOnScreenControls(); } }
function drawMaze() { fill(WALL_COLOR); noStroke(); for (let y = 0; y < MAZE_HEIGHT; y++) for (let x = 0; x < MAZE_WIDTH; x++) if (maze[y][x] === 1) rect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1); }
function drawBullets() { fill(0, 150, 255, 200); noStroke(); for (const b of bullets) ellipse(b.x, b.y, b.size, b.size); }
function drawEnemies() { for (const e of enemies) image(enemyImg, e.x * cellSize + (cellSize - e.size) / 2, e.y * cellSize + (cellSize - e.size) / 2, e.size, e.size); }
function drawPoops() { for (const p of poops) image(poopImg, p.x * cellSize + (cellSize - p.size) / 2, p.y * cellSize + (cellSize - p.size) / 2, p.size, p.size); }
function drawPlayer() { if (player.invincible && frameCount % 10 < 5) return; image(toiletImg, player.x - player.size / 2, player.y - player.size / 2, player.size, player.size); }
function drawUI() { const elapsedTime = (millis() - startTime) / 1000; fill(0, 150); noStroke(); rect(5, 5, width * 0.4, height * 0.1, 10); fill(255); textSize(min(height * 0.03, 20)); textAlign(LEFT, TOP); text(`タイム: ${elapsedTime.toFixed(2)}`, 15, 15); text(`のこりのうんち: ${poops.length}`, 15, 15 + min(height * 0.035, 25)); }

// ★スマホ対応: 画面上のコントローラーを描画する関数
// ◆変更: 円形パッドから十字キーの描画に変更
function drawOnScreenControls() {
    // 十字キーの描画
    noStroke();
    for (const dir in dPad) {
        if (dir === 'pressed') continue;
        const btn = dPad[dir];
        // 押されているボタンは明るく表示
        if (dPad.pressed === dir) {
            fill(200, 200, 200, 150);
        } else {
            fill(128, 128, 128, 100);
        }
        rect(btn.x, btn.y, btn.w, btn.h, 8); // 角丸の四角形

        // 矢印の三角形を描画
        fill(255, 200);
        push();
        translate(btn.x + btn.w / 2, btn.y + btn.h / 2);
        const arrowSize = btn.w * 0.25;
        if (dir === 'up') {
            triangle(0, -arrowSize, -arrowSize, arrowSize, arrowSize, arrowSize);
        } else if (dir === 'down') {
            triangle(0, arrowSize, -arrowSize, -arrowSize, arrowSize, -arrowSize);
        } else if (dir === 'left') {
            triangle(-arrowSize, 0, arrowSize, -arrowSize, arrowSize, arrowSize);
        } else if (dir === 'right') {
            triangle(arrowSize, 0, -arrowSize, -arrowSize, -arrowSize, arrowSize);
        }
        pop();
    }

    // 攻撃ボタンの描画 (変更なし)
    if (player.attackCooldown > 0) {
        fill(255, 0, 0, 80);
    } else {
        fill(0, 100, 255, 100);
    }
    ellipse(attackBtn.x, attackBtn.y, attackBtn.size, attackBtn.size);
    fill(255, 200);
    textAlign(CENTER, CENTER);
    textSize(attackBtn.size * 0.3);
    text('攻撃', attackBtn.x, attackBtn.y);
}


function drawStartScreen() { background(WALL_COLOR); for (const p of titlePoops) { p.y += p.speedY; p.angle += p.rotSpeed; if (p.y > height + p.size) { p.y = -p.size; p.x = random(width); } push(); translate(p.x, p.y); rotate(p.angle); tint(255, 150); image(poopImg, -p.size / 2, -p.size / 2, p.size, p.size); pop(); } noTint(); textAlign(CENTER, CENTER); fill(0, 0, 0, 100); textSize(width * 0.14); text('トイレダッシュ！', width / 2 + 4, height / 2 - 80 + 4); fill('#FFD700'); stroke(WALL_COLOR); strokeWeight(5); textSize(width * 0.13); text('トイレダッシュ！', width / 2, height / 2 - 80); const toiletY = height / 2 + 60 + sin(frameCount * 0.05) * 10; image(toiletImg, width / 2 - 75, toiletY, 150, 150); noStroke(); textSize(width * 0.035); fill(255, 128 + 127 * sin(frameCount * 0.1)); text(touchDevice ? '- タップして流す -' : '- クリックして流す -', width / 2, height - 80); textSize(width * 0.03); fill(255); text(touchDevice ? '矢印キー: 移動  |  右のボタン: 攻撃' : 'WASD/矢印キー: 移動  |  スペースキー: 水で攻撃', width / 2, height - 40); }
function drawClearScreen() { background(PATH_COLOR); fill(WALL_COLOR); textAlign(CENTER, CENTER); textSize(50); text('ゲームクリア！', width / 2, height / 2 - 60); textSize(30); text(`タイム: ${clearTime.toFixed(2)} 秒`, width / 2, height / 2); textSize(20); text(touchDevice ? 'タップしてタイトルへ' : 'クリックでタイトルへ', width / 2, height / 2 + 60); }

// ============== イベントハンドラ ==============
// ◆変更: タッチ入力の判定を十字キー用に変更
function handleInput() {
    const prevX = player.x;
    const prevY = player.y;
    let moveX = 0;
    let moveY = 0;
    
    // --- キーボード入力 ---
    if (keyIsDown(UP_ARROW) || keyIsDown(87)) { moveY -= 1; player.lastDirection = 'up'; }
    if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) { moveY += 1; player.lastDirection = 'down'; }
    if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) { moveX -= 1; player.lastDirection = 'left'; }
    if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) { moveX += 1; player.lastDirection = 'right'; }

    // --- スマホ対応: タッチ入力 ---
    if (touchDevice) {
        dPad.pressed = null; // 押されているボタンをリセット
        let movedByTouch = false;

        for (let touch of touches) {
            // 攻撃ボタンの判定
            if (dist(touch.x, touch.y, attackBtn.x, attackBtn.y) < attackBtn.size / 2) {
                if (player.attackCooldown <= 0) {
                    launchAttack();
                    player.attackCooldown = ATTACK_COOLDOWN_TIME;
                }
                continue; // 攻撃ボタンを押した指は移動判定しない
            }

            // 既に他の指で移動操作中の場合は、この指の移動判定はスキップ
            if (movedByTouch) continue;

            // 十字キーの各ボタンを判定
            for (const dir in dPad) {
                if (dir === 'pressed') continue;
                const btn = dPad[dir];
                
                // タッチ座標がボタンの矩形内にあるかチェック
                if (touch.x > btn.x && touch.x < btn.x + btn.w &&
                    touch.y > btn.y && touch.y < btn.y + btn.h) {
                    
                    dPad.pressed = dir; // どのボタンが押されているか記録 (描画用)
                    movedByTouch = true;
                    
                    // 移動方向を決定
                    switch (dir) {
                        case 'up':    moveY = -1; player.lastDirection = 'up';    break;
                        case 'down':  moveY = 1;  player.lastDirection = 'down';  break;
                        case 'left':  moveX = -1; player.lastDirection = 'left';  break;
                        case 'right': moveX = 1;  player.lastDirection = 'right'; break;
                    }
                    break; // この指の判定は終了
                }
            }
        }
    }

    // --- プレイヤーの移動処理 ---
    if (moveX !== 0 || moveY !== 0) {
        const moveVec = createVector(moveX, moveY);
        moveVec.normalize();
        player.x += moveVec.x * PLAYER_SPEED;
        player.y += moveVec.y * PLAYER_SPEED;
    }
    
    // --- 当たり判定 ---
    const p_left = floor((player.x - player.size / 2) / cellSize);
    const p_right = floor((player.x + player.size / 2) / cellSize);
    const p_top = floor((player.y - player.size / 2) / cellSize);
    const p_bottom = floor((player.y + player.size / 2) / cellSize);
    if (p_left < 0 || p_right >= MAZE_WIDTH || p_top < 0 || p_bottom >= MAZE_HEIGHT || maze[p_top][p_left] === 1 || maze[p_top][p_right] === 1 || maze[p_bottom][p_left] === 1 || maze[p_bottom][p_right] === 1) { player.x = prevX; player.y = prevY; }
}


function handleGameStart() { if (gameState === 'start') { gameState = 'playing'; startTime = millis(); if (getAudioContext().state !== 'running') { userStartAudio(); } if (!bgm.isPlaying()) { bgm.loop(); } } else if (gameState === 'clear') { gameState = 'start'; initGame(); } }
function touchStarted() { if (gameState === 'start' || gameState === 'clear') { handleGameStart(); } return false; }
function mousePressed() { if (!touchDevice) { handleGameStart(); } }
function keyPressed() { if (gameState === 'playing' && keyCode === 32 && player.attackCooldown <= 0) { launchAttack(); player.attackCooldown = ATTACK_COOLDOWN_TIME; } }
function launchAttack() { let dx = 0, dy = 0; switch (player.lastDirection) { case 'up': dy = -1; break; case 'down': dy = 1; break; case 'left': dx = -1; break; case 'right': dx = 1; break; } const bullet = { x: player.x, y: player.y, size: cellSize * 0.4, dx: dx * BULLET_SPEED, dy: dy * BULLET_SPEED, }; bullets.push(bullet); }
function generateMaze(w, h) { let newMaze = Array(h).fill(null).map(() => Array(w).fill(1)); const stack = []; let cx = 1, cy = 1; newMaze[cy][cx] = 0; stack.push([cx, cy]); while (stack.length > 0) { [cx, cy] = stack[stack.length - 1]; const directions = []; if (cx > 1 && newMaze[cy][cx - 2] === 1) directions.push('W'); if (cx < w - 2 && newMaze[cy][cx + 2] === 1) directions.push('E'); if (cy > 1 && newMaze[cy - 2][cx] === 1) directions.push('N'); if (cy < h - 2 && newMaze[cy + 2][cx] === 1) directions.push('S'); if (directions.length > 0) { const dir = random(directions); let nx = cx, ny = cy; let wallX = cx, wallY = cy; switch (dir) { case 'N': ny -= 2; wallY -= 1; break; case 'S': ny += 2; wallY += 1; break; case 'W': nx -= 2; wallX -= 1; break; case 'E': nx += 2; wallX += 1; break; } newMaze[ny][nx] = 0; newMaze[wallY][wallX] = 0; stack.push([nx, ny]); } else { stack.pop(); } } return newMaze; }
function isTouchDevice() { return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0); }