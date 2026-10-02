// ===== CONFIGURAÇÃO =====
const ROWS = 4;
const COLS = 4;
const TOTAL_TILES = ROWS * COLS; // 16
const TEMPO_MEMORIZACAO = 10;
const TEMPO_JOGO = 180;

// ===== ESTADO =====
let imageSrc = '';
let boardState = []; // IDs das peças (0 a 15)
let gamePhase = 'INIT'; // 'MEMORIZE' | 'PLAYING' | 'ENDED'
let playTime = TEMPO_JOGO;
let memoTime = TEMPO_MEMORIZACAO;
let timerInterval = null;
let currentScore = 0;
let correctPositions = 0;
let firstSelected = null; // índice da primeira peça clicada
let lockBoard = false;
let tutorialShown = false;

// ===== ELEMENTOS =====
const screenStart = document.getElementById('screen-start');
const screenPreview = document.getElementById('screen-preview');
const screenGame = document.getElementById('screen-game');
const previewImg = document.getElementById('preview-img');
const boardEl = document.getElementById('board');
const timerDisplay = document.getElementById('timer-display');
const timerLabel = document.getElementById('timer-label');
const scoreDisplay = document.getElementById('score-display');
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
  if (type === 'select') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
  } else if (type === 'swap') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now); osc.stop(now + 0.2);
  } else if (type === 'correct') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now); osc.stop(now + 0.3);
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

// ===== TIRAR/ESCOLHER FOTO =====
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

  // Monta tabuleiro mostrando imagem completa
  boardEl.innerHTML = '';
  for (let i = 0; i < TOTAL_TILES; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile correct';
    tile.style.backgroundImage = `url(${imageSrc})`;
    tile.style.backgroundSize = `${COLS * 100}% ${ROWS * 100}%`;

    const col = i % COLS;
    const row = Math.floor(i / COLS);
    tile.style.backgroundPosition = `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;

    boardEl.appendChild(tile);
  }

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

  // Embaralha as 16 peças (garantindo que não fique tudo certo)
  let shuffled;
  do {
    shuffled = Array.from({ length: TOTAL_TILES }, (_, i) => i);
    shuffled.sort(() => Math.random() - 0.5);
  } while (shuffled.every((id, idx) => id === idx));

  boardState = shuffled;

  renderBoard();
  calculateScore();

  timerInterval = setInterval(() => {
    playTime--;
    timerDisplay.textContent = formatTime(playTime);
    if (playTime <= 10) timerDisplay.classList.add('urgent');
    if (playTime <= 0) {
      clearInterval(timerInterval);
      endGame(false);
    }
  }, 1000);

  // Tutorial na primeira vez
  if (!tutorialShown) {
    tutorialModal.classList.add('active');
  }
}

function formatTime(sec) {
  const m = Math.floor(Math.max(sec, 0) / 60);
  const s = Math.max(sec, 0) % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ===== RENDERIZA =====
function renderBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < TOTAL_TILES; i++) {
    const tileId = boardState[i];
    const tile = createTileElement(tileId, i);
    boardEl.appendChild(tile);
  }
}

function createTileElement(tileId, slotIdx) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.style.backgroundImage = `url(${imageSrc})`;
  tile.style.backgroundSize = `${COLS * 100}% ${ROWS * 100}%`;

  const col = tileId % COLS;
  const row = Math.floor(tileId / COLS);
  tile.style.backgroundPosition = `${(col / (COLS - 1)) * 100}% ${(row / (ROWS - 1)) * 100}%`;

  tile.dataset.slotIdx = slotIdx;

  // Verde se tá no lugar certo
  if (tileId === slotIdx) {
    tile.classList.add('correct');
  }

  tile.addEventListener('click', () => handleTileClick(slotIdx, tile));

  return tile;
}

// ===== CLIQUE NA PEÇA =====
function handleTileClick(slotIdx, tileEl) {
  if (gamePhase !== 'PLAYING' || lockBoard) return;
  initAudio();

  // Se clicou na mesma peça 2x → desmarca
  if (firstSelected !== null && firstSelected === slotIdx) {
    document.querySelector(`[data-slot-idx="${slotIdx}"]`)?.classList.remove('selected');
    firstSelected = null;
    playSound('select');
    return;
  }

  // Primeira seleção
  if (firstSelected === null) {
    firstSelected = slotIdx;
    tileEl.classList.add('selected');
    playSound('select');
    return;
  }

  // Segunda seleção → troca
  const secondIdx = slotIdx;
  const firstIdx = firstSelected;

  const firstTileEl = document.querySelector(`[data-slot-idx="${firstIdx}"]`);
  const secondTileEl = document.querySelector(`[data-slot-idx="${secondIdx}"]`);

  firstTileEl.classList.remove('selected');
  secondTileEl.classList.add('selected');
  lockBoard = true;

  // Troca no estado
  [boardState[firstIdx], boardState[secondIdx]] = [boardState[secondIdx], boardState[firstIdx]];

  // Efeito visual
  firstTileEl.classList.add('swapping');
  secondTileEl.classList.add('swapping');

  setTimeout(() => {
    firstTileEl.classList.remove('swapping');
    secondTileEl.classList.remove('swapping');

    renderBoard();
    calculateScore();

    // Som
    if (boardState[firstIdx] === firstIdx || boardState[secondIdx] === secondIdx) {
      playSound('correct');
    } else {
      playSound('swap');
    }

    firstSelected = null;
    lockBoard = false;

    checkVictory();
  }, 1000);
}

// ===== PONTUAÇÃO =====
function calculateScore() {
  let score = 0;
  correctPositions = 0;

  boardState.forEach((tileId, slotIdx) => {
    if (tileId === slotIdx) {
      score += 10;
      correctPositions++;
    }
  });

  if (correctPositions === TOTAL_TILES) {
    score += 100;
  }

  currentScore = score;
  scoreDisplay.textContent = `${score}`;
}

// ===== VITÓRIA =====
function checkVictory() {
  const allCorrect = boardState.every((tileId, slotIdx) => tileId === slotIdx);
  if (allCorrect) {
    clearInterval(timerInterval);
    playSound('victory');
    endGame(true);
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
    `Pontos: <strong>${currentScore}</strong><br>Total: <strong>${novoTotal}</strong>`;

  finalModal.classList.add('active');
}

// ===== TUTORIAL =====
document.getElementById('btn-tutorial-ok').addEventListener('click', () => {
  tutorialModal.classList.remove('active');
  tutorialShown = true;
});

document.getElementById('btn-help').addEventListener('click', () => {
  tutorialModal.classList.add('active');
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
  boardState = [];
  firstSelected = null;
  lockBoard = false;
  boardEl.innerHTML = '';
  currentScore = 0;
  correctPositions = 0;
  scoreDisplay.textContent = '0';
  showScreen('screen-start');
    }
