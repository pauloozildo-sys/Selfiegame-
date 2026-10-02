
// ===== CONFIGURAÇÃO =====
const ROWS = 4;
const COLS = 4;
const TOTAL_TILES = ROWS * COLS; // 16
const TEMPO_MEMORIZACAO = 10;
const TEMPO_JOGO = 180;

// ===== ESTADO =====
let imageSrc = '';
let placedTiles = new Set();      // índices já acertados
let currentTileIdx = null;         // peça atual (índice 0-15)
let gamePhase = 'INIT';            // 'MEMORIZE' | 'PLAYING' | 'ENDED'
let playTime = TEMPO_JOGO;
let memoTime = TEMPO_MEMORIZACAO;
let timerInterval = null;
let currentScore = 0;
let correctCount = 0;
let tutorialShown = false;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let pieceQueue = [];

// ===== ELEMENTOS =====
const screenStart = document.getElementById('screen-start');
const screenPreview = document.getElementById('screen-preview');
const screenGame = document.getElementById('screen-game');
const previewImg = document.getElementById('preview-img');
const boardWrapper = document.getElementById('board-wrapper');
const boardBg = document.getElementById('board-bg');
const boardGrid = document.getElementById('board-grid');
const floatingPiece = document.getElementById('floating-piece');
const timerDisplay = document.getElementById('timer-display');
const timerLabel = document.getElementById('timer-label');
const scoreDisplay = document.getElementById('score-display');
const piecesDisplay = document.getElementById('pieces-display');
const tutorialModal = document.getElementById('tutorial-modal');
const finalModal = document.getElementById('final-modal');

const inputCamera = document.getElementById('input-camera');
const inputGallery = document.getElementById('input-gallery');

// ===== ÁUDIO =====
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new AudioContextClass(); }
function playSound(type) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  if (type === 'correct') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now); osc.stop(now + 0.3);
  } else if (type === 'error') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.2);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now); osc.stop(now + 0.2);
  } else if (type === 'victory') {
    osc.type = 'sine';
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => osc.frequency.setValueAtTime(f, now + i * 0.12));
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
    osc.start(now); osc.stop(now + 0.7);
  }
}

// ===== NAVEGAÇÃO =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== FOTO =====
document.getElementById('btn-camera').addEventListener('click', () => inputCamera.click());
document.getElementById('btn-gallery').addEventListener('click', () => inputGallery.click());

inputCamera.addEventListener('change', e => handleFile(e));
inputGallery.addEventListener('change', e => handleFile(e));

function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const size = 800;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;

      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

      imageSrc = canvas.toDataURL('image/jpeg', 0.9);
      previewImg.src = imageSrc;
      showScreen('screen-preview');
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

// ===== USAR FOTO =====
document.getElementById('btn-use').addEventListener('click', () => {
  initAudio();
  showScreen('screen-game');
  startMemorization();
});

document.getElementById('btn-retake').addEventListener('click', () => {
  showScreen('screen-start');
});

// ===== MEMORIZAÇÃO (10s) =====
function startMemorization() {
  gamePhase = 'MEMORIZE';
  memoTime = TEMPO_MEMORIZACAO;
  timerLabel.textContent = 'MEMORIZE';
  timerDisplay.textContent = `${memoTime}s`;
  timerDisplay.classList.remove('urgent');

  // Tabuleiro mostra imagem completa
  boardBg.style.backgroundImage = `url(${imageSrc})`;
  boardBg.style.opacity = '1';

  // Grid vazio (sem slots visíveis)
  boardGrid.innerHTML = '';
  for (let i = 0; i < TOTAL_TILES; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.dataset.index = i;
    boardGrid.appendChild(slot);
  }

  floatingPiece.style.display = 'none';

  timerInterval = setInterval(() => {
    memoTime--;
    timerDisplay.textContent = `${memoTime}s`;
    if (memoTime <= 0) {
      clearInterval(timerInterval);
      startGameplay();
    }
  }, 1000);
}

// ===== JOGO =====
function startGameplay() {
  gamePhase = 'PLAYING';
  playTime = TEMPO_JOGO;
  timerLabel.textContent = 'TEMPO';
  timerDisplay.textContent = formatTime(playTime);

  // Opaca a imagem de fundo
  boardBg.style.opacity = '0.4';

  // Zera estado
  placedTiles = new Set();
  correctCount = 0;
  currentScore = 0;
  scoreDisplay.textContent = '0';
  piecesDisplay.textContent = `0/${TOTAL_TILES}`;

  // Cria fila embaralhada de peças
  pieceQueue = Array.from({ length: TOTAL_TILES }, (_, i) => i);
  pieceQueue.sort(() => Math.random() - 0.5);

  // Timer
  timerInterval = setInterval(() => {
    playTime--;
    timerDisplay.textContent = formatTime(playTime);
    if (playTime <= 10) timerDisplay.classList.add('urgent');
    if (playTime <= 0) {
      clearInterval(timerInterval);
      endGame(false);
    }
  }, 1000);

  // Tutorial primeira vez
  if (!tutorialShown) {
    setTimeout(() => tutorialModal.classList.add('active'), 500);
  }

  // Primeira peça
  spawnNextPiece();
}

function formatTime(sec) {
  const m = Math.floor(Math.max(sec, 0) / 60);
  const s = Math.max(sec, 0) % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ===== SPAWN DA PEÇA =====
function spawnNextPiece() {
  if (pieceQueue.length === 0) {
    // Acabaram as peças
    if (correctCount === TOTAL_TILES) {
      endGame(true);
    }
    return;
  }

  currentTileIdx = pieceQueue.shift();

  // Aplica background
  floatingPiece.style.backgroundImage = `url(${imageSrc})`;
  floatingPiece.style.backgroundSize = `${COLS * 100}% ${ROWS * 100}%`;

  const col = currentTileIdx % COLS;
  const row = Math.floor(currentTileIdx / COLS);
  floatingPiece.style.backgroundPosition = `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;

  // Posição aleatória no tabuleiro (mas não em cima do slot correto)
  const wrapperRect = boardWrapper.getBoundingClientRect();
  const pieceSize = wrapperRect.width * 0.25;

  let randomX, randomY;
  const correctX = (currentTileIdx % COLS) * (wrapperRect.width / COLS);
  const correctY = Math.floor(currentTileIdx / COLS) * (wrapperRect.height / ROWS);

  let tentativas = 0;
  do {
    randomX = Math.random() * (wrapperRect.width - pieceSize);
    randomY = Math.random() * (wrapperRect.height - pieceSize);
    tentativas++;
  } while (
    tentativas < 20 &&
    Math.abs(randomX - correctX) < pieceSize * 1.5 &&
    Math.abs(randomY - correctY) < pieceSize * 1.5
  );

  floatingPiece.style.left = randomX + 'px';
  floatingPiece.style.top = randomY + 'px';
  floatingPiece.style.width = pieceSize + 'px';
  floatingPiece.style.height = pieceSize + 'px';
  floatingPiece.style.display = 'block';
  floatingPiece.classList.remove('success', 'error');
}

// ===== DRAG DA PEÇA (TOUCH) =====
floatingPiece.addEventListener('touchstart', handleDragStart, { passive: false });
document.addEventListener('touchmove', handleDragMove, { passive: false });
document.addEventListener('touchend', handleDragEnd);

function handleDragStart(e) {
  if (gamePhase !== 'PLAYING' || currentTileIdx === null) return;
  e.preventDefault();
  initAudio();

  isDragging = true;
  const touch = e.touches[0];
  const rect = floatingPiece.getBoundingClientRect();

  dragOffsetX = touch.clientX - rect.left;
  dragOffsetY = touch.clientY - rect.top;

  floatingPiece.style.transition = 'none';
}

function handleDragMove(e) {
  if (!isDragging) return;
  e.preventDefault();

  const touch = e.touches[0];
  const wrapperRect = boardWrapper.getBoundingClientRect();

  let newX = touch.clientX - dragOffsetX - wrapperRect.left;
  let newY = touch.clientY - dragOffsetY - wrapperRect.top;

  // Limita ao tabuleiro
  const pieceW = floatingPiece.offsetWidth;
  const pieceH = floatingPiece.offsetHeight;

  newX = Math.max(0, Math.min(newX, wrapperRect.width - pieceW));
  newY = Math.max(0, Math.min(newY, wrapperRect.height - pieceH));

  floatingPiece.style.left = newX + 'px';
  floatingPiece.style.top = newY + 'px';

  // Destaca o slot sob o dedo
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('highlight'));
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  const slot = el?.closest('.slot');
  if (slot && !placedTiles.has(parseInt(slot.dataset.index))) {
    slot.classList.add('highlight');
  }
}

function handleDragEnd(e) {
  if (!isDragging) return;
  isDragging = false;

  document.querySelectorAll('.slot').forEach(s => s.classList.remove('highlight'));

  const touch = e.changedTouches[0];
  const wrapperRect = boardWrapper.getBoundingClientRect();

  // Posição do centro da peça
  const pieceRect = floatingPiece.getBoundingClientRect();
  const centerX = pieceRect.left + pieceRect.width / 2;
  const centerY = pieceRect.top + pieceRect.height / 2;

  // Descobre qual slot tá embaixo
  const el = document.elementFromPoint(centerX, centerY);
  const slot = el?.closest('.slot');

  floatingPiece.style.transition = 'transform 0.1s';

  if (!slot) {
    // Soltou fora → volta pra posição original
    floatingPiece.style.borderColor = '#00f0ff';
    floatingPiece.style.boxShadow = '0 0 20px #00f0ff';
    return;
  }

  const slotIdx = parseInt(slot.dataset.index);

  if (slotIdx === currentTileIdx) {
    // ✅ ACERTOU
    floatingPiece.classList.add('success');
    playSound('correct');

    // Marca slot como preenchido
    slot.classList.add('filled');
    slot.style.backgroundImage = `url(${imageSrc})`;
    slot.style.backgroundSize = `${COLS * 100}% ${ROWS * 100}%`;

    const col = currentTileIdx % COLS;
    const row = Math.floor(currentTileIdx / COLS);
    slot.style.backgroundPosition = `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;

    placedTiles.add(slotIdx);
    correctCount++;
    currentScore += 10;
    scoreDisplay.textContent = `${currentScore}`;
    piecesDisplay.textContent = `${correctCount}/${TOTAL_TILES}`;

    // Esconde a peça e spawna a próxima
    setTimeout(() => {
      floatingPiece.style.display = 'none';
      floatingPiece.classList.remove('success');

      // Vitória?
      if (correctCount === TOTAL_TILES) {
        currentScore += 100; // bônus
        scoreDisplay.textContent = `${currentScore}`;
        clearInterval(timerInterval);
        playSound('victory');
        endGame(true);
      } else {
        spawnNextPiece();
      }
    }, 500);
  } else {
    // ❌ ERROU
    floatingPiece.classList.add('error');
    playSound('error');

    setTimeout(() => {
      floatingPiece.classList.remove('error');
    }, 500);
  }
}

// ===== FIM DE JOGO =====
function endGame(win) {
  gamePhase = 'ENDED';

  const totalAtual = parseInt(localStorage.getItem('memoryClub_totalScore') || '0', 10);
  const novoTotal = totalAtual + currentScore;
  localStorage.setItem('memoryClub_totalScore', novoTotal.toString());

  document.getElementById('final-title').textContent = win ? '🎉 PARABÉNS!' : '⏰ FIM DE TEMPO!';
  document.getElementById('final-stats').innerHTML =
    `Peças encaixadas: <strong>${correctCount}/${TOTAL_TILES}</strong><br>` +
    `Pontos: <strong>${currentScore}</strong><br>` +
    `Total: <strong>${novoTotal}</strong>`;

  finalModal.classList.add('active');
}

// ===== TUTORIAL =====
document.getElementById('btn-tutorial-ok').addEventListener('click', () => {
  tutorialModal.classList.remove('active');
  tutorialShown = true;
});

// ===== BOTÕES FINAIS =====
document.getElementById('btn-new-selfie').addEventListener('click', () => {
  finalModal.classList.remove('active');
  resetToStart();
  setTimeout(() => inputCamera.click(), 300);
});

document.getElementById('btn-new-gallery').addEventListener('click', () => {
  finalModal.classList.remove('active');
  resetToStart();
  setTimeout(() => inputGallery.click(), 300);
});

function resetToStart() {
  clearInterval(timerInterval);
  gamePhase = 'INIT';
  placedTiles = new Set();
  currentTileIdx = null;
  pieceQueue = [];
  correctCount = 0;
  currentScore = 0;
  scoreDisplay.textContent = '0';
  piecesDisplay.textContent = '0/16';
  floatingPiece.style.display = 'none';
  showScreen('screen-start');
}
