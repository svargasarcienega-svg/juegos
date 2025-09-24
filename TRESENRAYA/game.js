// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDjSsmrOT7huC-HBZIiM3FkrjBBkw-TVGQ",
    authDomain: "proyecto-3-en-raya.firebaseapp.com",
    projectId: "proyecto-3-en-raya",
    storageBucket: "proyecto-3-en-raya.appspot.com",
    messagingSenderId: "252069733137",
    appId: "1:252069733137:web:b8b96d435700e1c49962b0"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Variables globales
window.auth = firebase.auth();
window.db = firebase.firestore();
window.firebase = firebase;
window.currentUser = null;

// Variables del juego
let gameBoard = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let gameActive = true;
let gameMode = 'cpu';
let difficulty = 'medium';
let playerSymbol = 'X';
let cpuSymbol = 'O';

// Clase principal del juego
class GameManager {
    constructor() {
        this.initialized = false;
        this.eventListeners = new Map(); // Para rastrear event listeners
        this.init();
    }

    init() {
        if (this.initialized) return;
        
        console.log('🎮 Inicializando GameManager...');
        
        // Detectar estado de autenticación
        window.auth.onAuthStateChanged((user) => {
            if (user) {
                console.log("✅ Usuario autenticado:", user.uid);
                window.currentUser = user;
                this.loadPlayerData(user, true);
                this.subscribeToPlayerData(user);
            } else {
                console.log("❌ Ningún usuario autenticado");
                window.currentUser = null;
                this.showScreen('registration-screen');
            }
        });

        this.setupEventListeners();
        this.checkForRoomParameter();
        this.initialized = true;
        console.log('✅ GameManager inicializado correctamente');
    }

    // Función para limpiar event listeners anteriores
    removeEventListener(element, event, key) {
        if (this.eventListeners.has(key)) {
            const oldHandler = this.eventListeners.get(key);
            element.removeEventListener(event, oldHandler);
        }
    }

    // Función para agregar event listeners con seguimiento
    addEventListener(element, event, handler, key) {
        if (!element) return;
        
        this.removeEventListener(element, event, key);
        element.addEventListener(event, handler);
        this.eventListeners.set(key, handler);
    }

    setupEventListeners() {
        // Navegación entre pantallas
        this.addEventListener(
            document.getElementById('show-login'),
            'click',
            (e) => {
                e.preventDefault();
                this.showScreen('login-screen');
            },
            'show-login'
        );

        this.addEventListener(
            document.getElementById('show-registration'),
            'click',
            (e) => {
                e.preventDefault();
                this.showScreen('registration-screen');
            },
            'show-registration'
        );

        // Botones "Volver al Panel"
        const panelButtons = ['go-to-panel', 'go-to-panel-login', 'go-to-panel-catalog', 'back-to-panel', 'close-leaderboard'];
        panelButtons.forEach(id => {
            this.addEventListener(
                document.getElementById(id),
                'click',
                () => {
                    if (window.currentUser) {
                        this.showScreen('catalog');
                    } else {
                        this.showScreen('registration-screen');
                    }
                },
                id
            );
        });

        // Botón de juego
        this.addEventListener(
            document.getElementById('launch-game'),
            'click',
            () => {
                this.showScreen('game-area');
                document.getElementById('setup-screen').hidden = false;
                document.getElementById('game-tres-en-raya').hidden = true;
            },
            'launch-game'
        );

        // Configuración del juego
        this.addEventListener(
            document.getElementById('setup-form'),
            'submit',
            (e) => {
                e.preventDefault();
                this.startGame(e);
            },
            'setup-form'
        );

        // Mostrar/ocultar opciones según el modo
        document.querySelectorAll('input[name="mode"]').forEach((radio, index) => {
            this.addEventListener(
                radio,
                'change',
                (e) => {
                    const difficultyGroup = document.getElementById('difficulty-group');
                    const onlineGroup = document.getElementById('online-group');
                    
                    if (e.target.value === 'cpu') {
                        difficultyGroup.style.display = 'block';
                        onlineGroup.style.display = 'none';
                    } else if (e.target.value === 'online') {
                        difficultyGroup.style.display = 'none';
                        onlineGroup.style.display = 'block';
                    } else {
                        difficultyGroup.style.display = 'none';
                        onlineGroup.style.display = 'none';
                    }
                },
                `mode-radio-${index}`
            );
        });

        // Funcionalidad para juego en línea
        this.setupOnlineGameListeners();
        
        // Configurar chat
        this.setupChatListeners();

        // Botón de tabla de líderes
        this.addEventListener(
            document.getElementById('leaderboard-btn'),
            'click',
            () => {
                this.showScreen('leaderboard-screen');
                this.loadLeaderboard();
            },
            'leaderboard-btn'
        );

        // Cerrar sesión
        this.addEventListener(
            document.getElementById('logout-btn'),
            'click',
            async () => {
                try {
                    await window.auth.signOut();
                    alert("Sesión cerrada.");
                    this.showScreen('registration-screen');
                } catch (error) {
                    console.error("Error al cerrar sesión:", error);
                    alert("Error al cerrar sesión.");
                }
            },
            'logout-btn'
        );

        // Botón volver del juego
        this.addEventListener(
            document.getElementById('back'),
            'click',
            () => {
                window.location.href = 'catalog.html';
            },
            'back'
        );

        // Registro
        this.addEventListener(
            document.getElementById('player-registration-form'),
            'submit',
            async (e) => {
                e.preventDefault();
                await this.handleRegistration(e);
            },
            'registration-form'
        );

        // Login
        this.addEventListener(
            document.getElementById('player-login-form'),
            'submit',
            async (e) => {
                e.preventDefault();
                await this.handleLogin(e);
            },
            'login-form'
        );

        // Controles del juego
        this.addEventListener(
            document.getElementById('reset'),
            'click',
            () => this.resetGame(),
            'reset'
        );

        this.addEventListener(
            document.getElementById('home'),
            'click',
            () => {
                // Refrescar estadísticas antes de ir al catálogo
                if (window.currentUser) {
                    this.loadPlayerData(window.currentUser, false);
                }
                window.location.href = 'catalog.html';
            },
            'home'
        );
    }

    // Función para mostrar pantallas
    showScreen(screenId) {
        const screens = ['registration-screen', 'login-screen', 'catalog', 'game-area', 'leaderboard-screen'];
        screens.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        
        const targetEl = document.getElementById(screenId);
        if (targetEl) {
            targetEl.hidden = false;
        }
    }

    // Cargar datos del jugador
    async loadPlayerData(user, shouldSwitchScreen = false) {
        try {
            const doc = await window.db.collection("players").doc(user.uid).get();
            if (doc.exists) {
                const data = doc.data();
                const welcomeEl = document.getElementById('welcome-player');
                const gamesPlayedEl = document.getElementById('games-played');
                const gamesWonEl = document.getElementById('games-won');
                const winPercentageEl = document.getElementById('win-percentage');

                if (welcomeEl) welcomeEl.textContent = data.name || "Jugador";
                if (gamesPlayedEl) gamesPlayedEl.textContent = data.gamesPlayed || 0;
                if (gamesWonEl) gamesWonEl.textContent = data.gamesWon || 0;
                
                const winPercentage = data.gamesPlayed > 0 ? Math.round((data.gamesWon / data.gamesPlayed) * 100) : 0;
                if (winPercentageEl) winPercentageEl.textContent = winPercentage + '%';
                
                if (shouldSwitchScreen) {
                    this.showScreen('catalog');
                }
            } else {
                console.log("Documento del jugador no encontrado");
                if (shouldSwitchScreen) this.showScreen('registration-screen');
            }
        } catch (error) {
            console.error("Error al cargar datos:", error);
            this.showScreen('registration-screen');
        }
    }
    
    // Suscribirse a cambios del jugador
    subscribeToPlayerData(user) {
        window.db.collection("players").doc(user.uid).onSnapshot((doc) => {
            if (doc.exists) {
                this.loadPlayerData(user, false);
            }
        });
    }

    // Inicializar el juego
    startGame(e) {
        const formData = new FormData(e.target);
        playerSymbol = formData.get('symbol') || 'X';
        cpuSymbol = playerSymbol === 'X' ? 'O' : 'X';
        gameMode = formData.get('mode') || 'cpu';
        difficulty = document.getElementById('difficulty').value || 'medium';
        
        // Manejar modo en línea
        if (gameMode === 'online') {
            const onlineAction = formData.get('online-action');
            if (onlineAction === 'create') {
                this.createOnlineRoom();
            } else if (onlineAction === 'join') {
                const roomId = document.getElementById('room-id').value.trim();
                if (roomId.length === 6) {
                    this.joinOnlineRoom(roomId);
                } else {
                    alert('Por favor ingresa un ID de sala válido de 6 caracteres.');
                    return;
                }
            }
        } else {
            this.startLocalGame();
        }
    }

    // Iniciar juego local
    startLocalGame() {
        currentPlayer = playerSymbol;
        gameBoard = ['', '', '', '', '', '', '', '', ''];
        gameActive = true;
        
        document.getElementById('setup-screen').hidden = true;
        document.getElementById('game-tres-en-raya').hidden = false;
        
        // Ocultar chat en modo local
        this.hideChat();
        
        this.initializeGameBoard();
        this.updateBoard();
        this.updateStatus();
    }

    // Crear sala en línea
    createOnlineRoom() {
        const roomId = document.getElementById('display-room-id').textContent;
        if (!roomId) {
            alert('Error: No se pudo generar el ID de la sala.');
            return;
        }
        
        // Aquí implementarías la lógica para crear la sala en Firebase
        console.log('Creando sala en línea:', roomId);
        alert(`Sala creada con ID: ${roomId}\nComparte el enlace con tu amigo para que se una.`);
        
        // Iniciar juego en línea con chat
        this.startOnlineGame(roomId, 'host');
    }

    // Unirse a sala en línea
    joinOnlineRoom(roomId) {
        // Aquí implementarías la lógica para unirse a la sala en Firebase
        console.log('Uniéndose a sala:', roomId);
        alert(`Intentando unirse a la sala: ${roomId}`);
        
        // Iniciar juego en línea con chat
        this.startOnlineGame(roomId, 'guest');
    }

    // Iniciar juego en línea
    startOnlineGame(roomId, role) {
        currentPlayer = playerSymbol;
        gameBoard = ['', '', '', '', '', '', '', '', ''];
        gameActive = true;
        
        document.getElementById('setup-screen').hidden = true;
        document.getElementById('game-tres-en-raya').hidden = false;
        
        // Mostrar chat en modo en línea
        this.showChat();
        this.initializeChat();
        
        this.initializeGameBoard();
        this.updateBoard();
        this.updateStatus();
        
        // Agregar mensaje de bienvenida al chat
        this.addChatMessage('system', `Sala ${roomId} - ${role === 'host' ? 'Anfitrión' : 'Invitado'}`);
    }

    // Inicializar tablero del juego
    initializeGameBoard() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            // Limpiar event listeners anteriores
            this.removeEventListener(cell, 'click', `cell-${index}`);
            
            // Agregar nuevo event listener
            this.addEventListener(
                cell,
                'click',
                () => this.handleCellClick(index),
                `cell-${index}`
            );
        });
    }

    handleCellClick(index) {
        if (gameBoard[index] !== '' || !gameActive) return;

        gameBoard[index] = currentPlayer;
        this.updateBoard();

        if (this.checkWinner()) {
            const isWin = currentPlayer === playerSymbol;
            document.getElementById('status').textContent = `¡${currentPlayer} gana!`;
            gameActive = false;
            this.updateStats(isWin ? 'win' : 'lose');
            
            // Mostrar mensaje de estadísticas actualizadas
            setTimeout(() => {
                const statusEl = document.getElementById('status');
                if (statusEl) {
                    statusEl.textContent = `¡${currentPlayer} gana! Estadísticas actualizadas.`;
                }
            }, 1000);
            return;
        }

        if (gameBoard.every(cell => cell !== '')) {
            document.getElementById('status').textContent = '¡Empate!';
            gameActive = false;
            this.updateStats('draw');
            
            // Mostrar mensaje de estadísticas actualizadas
            setTimeout(() => {
                const statusEl = document.getElementById('status');
                if (statusEl) {
                    statusEl.textContent = '¡Empate! Estadísticas actualizadas.';
                }
            }, 1000);
            return;
        }

        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
        this.updateStatus();

        if (gameMode === 'cpu' && currentPlayer === cpuSymbol) {
            setTimeout(() => this.cpuMove(), 500);
        }
    }

    cpuMove() {
        if (!gameActive) return;

        let move;
        switch (difficulty) {
            case 'easy':
                move = this.getRandomMove();
                break;
            case 'medium':
                move = Math.random() < 0.7 ? this.getBestMove() : this.getRandomMove();
                break;
            case 'hard':
                move = this.getBestMove();
                break;
        }

        if (move !== -1) {
            this.handleCellClick(move);
        }
    }

    getRandomMove() {
        const availableMoves = gameBoard.map((cell, index) => cell === '' ? index : null).filter(val => val !== null);
        return availableMoves.length > 0 ? availableMoves[Math.floor(Math.random() * availableMoves.length)] : -1;
    }

    getBestMove() {
        let bestScore = -Infinity;
        let bestMove = -1;

        for (let i = 0; i < 9; i++) {
            if (gameBoard[i] === '') {
                gameBoard[i] = cpuSymbol;
                let score = this.minimax(gameBoard, 0, false);
                gameBoard[i] = '';
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = i;
                }
            }
        }
        return bestMove;
    }

    minimax(board, depth, isMaximizing) {
        let result = this.checkWinnerForMinimax();
        if (result !== null) {
            return result === cpuSymbol ? 1 : result === playerSymbol ? -1 : 0;
        }

        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = cpuSymbol;
                    let score = this.minimax(board, depth + 1, false);
                    board[i] = '';
                    bestScore = Math.max(score, bestScore);
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = playerSymbol;
                    let score = this.minimax(board, depth + 1, true);
                    board[i] = '';
                    bestScore = Math.min(score, bestScore);
                }
            }
            return bestScore;
        }
    }

    checkWinner() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Filas
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columnas
            [0, 4, 8], [2, 4, 6] // Diagonales
        ];

        return winPatterns.some(pattern => {
            const [a, b, c] = pattern;
            return gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c];
        });
    }

    checkWinnerForMinimax() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        for (let pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (gameBoard[a] && gameBoard[a] === gameBoard[b] && gameBoard[a] === gameBoard[c]) {
                return gameBoard[a];
            }
        }

        return gameBoard.every(cell => cell !== '') ? 'tie' : null;
    }

    updateBoard() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            cell.textContent = gameBoard[index];
            cell.style.color = gameBoard[index] === 'X' ? '#e74c3c' : '#3498db';
        });
    }

    updateStatus() {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = `Turno de ${currentPlayer}`;
        }
    }

    resetGame() {
        gameBoard = ['', '', '', '', '', '', '', '', ''];
        currentPlayer = playerSymbol;
        gameActive = true;
        this.updateBoard();
        this.updateStatus();
    }

    async updateStats(result) {
        if (!window.currentUser) return;

        try {
            const playerRef = window.db.collection("players").doc(window.currentUser.uid);
            const doc = await playerRef.get();
            
            if (doc.exists) {
                const data = doc.data();
                const newGamesPlayed = (data.gamesPlayed || 0) + 1;
                const newGamesWon = result === 'win' ? (data.gamesWon || 0) + 1 : (data.gamesWon || 0);
                const newWinPercentage = Math.round((newGamesWon / newGamesPlayed) * 100);

                await playerRef.update({
                    gamesPlayed: newGamesPlayed,
                    gamesWon: newGamesWon,
                    winPercentage: newWinPercentage
                });

                // Actualizar la interfaz de usuario inmediatamente
                this.updateStatsUI(newGamesPlayed, newGamesWon, newWinPercentage);
                
                // Debug: mostrar estadísticas actualizadas
                console.log(`Estadísticas actualizadas: ${newGamesPlayed} partidas, ${newGamesWon} victorias, ${newWinPercentage}%`);
            }
        } catch (error) {
            console.error("Error al actualizar estadísticas:", error);
        }
    }

    // Actualizar la interfaz de usuario con las nuevas estadísticas
    updateStatsUI(gamesPlayed, gamesWon, winPercentage) {
        const gamesPlayedEl = document.getElementById('games-played');
        const gamesWonEl = document.getElementById('games-won');
        const winPercentageEl = document.getElementById('win-percentage');

        if (gamesPlayedEl) gamesPlayedEl.textContent = gamesPlayed;
        if (gamesWonEl) gamesWonEl.textContent = gamesWon;
        if (winPercentageEl) winPercentageEl.textContent = winPercentage + '%';

        // Calcular derrotas y empates
        const gamesLost = gamesPlayed - gamesWon;
        const gamesDraw = 0; // Por ahora no contamos empates como derrotas

        // También actualizar las estadísticas en el juego
        const statsEl = document.getElementById('stats');
        if (statsEl) {
            statsEl.textContent = `Estadísticas: ${gamesWon}V | ${gamesDraw}E | ${gamesLost}D`;
        }
    }

    // Registro
    async handleRegistration(e) {
        const name = document.getElementById('player-name-reg').value.trim();
        const email = document.getElementById('player-email').value.trim();
        const password = document.getElementById('player-password').value;

        if (!name || !email || !password) {
            alert("Por favor completa todos los campos.");
            return;
        }

        try {
            const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            await window.db.collection("players").doc(user.uid).set({
                name: name,
                email: email,
                gamesPlayed: 0,
                gamesWon: 0,
                winPercentage: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("✅ Registro exitoso. ¡Bienvenido!");

        } catch (error) {
            console.error("Error en registro:", error);
            let msg = "Error: ";
            if (error.code === 'auth/email-already-in-use') {
                msg += "El correo ya está registrado.";
            } else if (error.code === 'auth/invalid-email') {
                msg += "Correo inválido.";
            } else if (error.code === 'auth/weak-password') {
                msg += "La contraseña debe tener al menos 6 caracteres.";
            } else {
                msg += error.message;
            }
            alert(msg);
        }
    }

    // Login
    async handleLogin(e) {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            alert("Por favor completa todos los campos.");
            return;
        }

        try {
            await window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            await window.auth.signInWithEmailAndPassword(email, password);
            
        } catch (error) {
            console.error("Error en login:", error);
            let msg = "Error: ";
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                msg += "Correo o contraseña incorrectos.";
            } else if (error.code === 'auth/invalid-email') {
                msg += "Correo inválido.";
            } else {
                msg += error.message;
            }
            alert(msg);
        }
    }

    // Tabla de líderes
    async loadLeaderboard() {
        const list = document.getElementById('leaderboard-list');
        if (!list) return;
        
        list.innerHTML = '<p>Cargando...</p>';

        try {
            const snapshot = await window.db.collection("players")
                .orderBy("gamesWon", "desc")
                .limit(10)
                .get();

            list.innerHTML = '';
            let rank = 1;
            snapshot.forEach(doc => {
                const data = doc.data();
                const item = document.createElement('div');
                item.innerHTML = `
                    <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #eee;">
                        <span><strong>${rank}.</strong> ${data.name}</span>
                        <span>${data.gamesWon} victorias</span>
                    </div>
                `;
                list.appendChild(item);
                rank++;
            });

            if (rank === 1) {
                list.innerHTML = '<p>No hay jugadores registrados aún.</p>';
            }
        } catch (error) {
            console.error("Error al cargar leaderboard:", error);
            list.innerHTML = '<p>Error al cargar la tabla de líderes.</p>';
        }
    }

    // Configurar listeners para juego en línea
    setupOnlineGameListeners() {
        // Cambiar entre crear y unirse a sala
        document.querySelectorAll('input[name="online-action"]').forEach((radio, index) => {
            this.addEventListener(
                radio,
                'change',
                (e) => {
                    const roomIdGroup = document.getElementById('room-id-group');
                    const roomInfoGroup = document.getElementById('room-info-group');
                    
                    if (e.target.value === 'create') {
                        roomIdGroup.style.display = 'none';
                        roomInfoGroup.style.display = 'block';
                        this.generateRoomId();
                    } else {
                        roomIdGroup.style.display = 'block';
                        roomInfoGroup.style.display = 'none';
                    }
                },
                `online-action-${index}`
            );
        });

        // Generar ID de sala
        this.addEventListener(
            document.getElementById('generate-room-id'),
            'click',
            () => this.generateRoomId(),
            'generate-room-id'
        );

        // Copiar ID de sala
        this.addEventListener(
            document.getElementById('copy-room-id'),
            'click',
            () => this.copyToClipboard(document.getElementById('display-room-id').textContent),
            'copy-room-id'
        );

        // Copiar enlace de sala
        this.addEventListener(
            document.getElementById('copy-room-link'),
            'click',
            () => this.copyToClipboard(document.getElementById('room-link').value),
            'copy-room-link'
        );
    }

    // Generar ID de sala aleatorio
    generateRoomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let roomId = '';
        for (let i = 0; i < 6; i++) {
            roomId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const displayElement = document.getElementById('display-room-id');
        const linkElement = document.getElementById('room-link');
        
        if (displayElement) {
            displayElement.textContent = roomId;
        }
        
        if (linkElement) {
            const currentUrl = window.location.origin + window.location.pathname.replace('game-setup.html', '') + 'game-setup.html';
            linkElement.value = `${currentUrl}?room=${roomId}`;
        }
    }

    // Copiar al portapapeles
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            alert('¡Copiado al portapapeles!');
        } catch (err) {
            // Fallback para navegadores que no soportan clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('¡Copiado al portapapeles!');
        }
    }

    // Verificar si hay parámetros de sala en la URL
    checkForRoomParameter() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (roomId) {
            // Si hay un ID de sala en la URL, seleccionar "Unirse a Sala"
            const joinRadio = document.querySelector('input[name="online-action"][value="join"]');
            const createRadio = document.querySelector('input[name="online-action"][value="create"]');
            const onlineMode = document.querySelector('input[name="mode"][value="online"]');
            
            if (joinRadio && createRadio && onlineMode) {
                onlineMode.checked = true;
                joinRadio.checked = true;
                createRadio.checked = false;
                
                // Mostrar/ocultar grupos apropiados
                const difficultyGroup = document.getElementById('difficulty-group');
                const onlineGroup = document.getElementById('online-group');
                const roomIdGroup = document.getElementById('room-id-group');
                const roomInfoGroup = document.getElementById('room-info-group');
                
                if (difficultyGroup) difficultyGroup.style.display = 'none';
                if (onlineGroup) onlineGroup.style.display = 'block';
                if (roomIdGroup) roomIdGroup.style.display = 'block';
                if (roomInfoGroup) roomInfoGroup.style.display = 'none';
                
                // Llenar el campo de ID de sala
                const roomIdInput = document.getElementById('room-id');
                if (roomIdInput) {
                    roomIdInput.value = roomId;
                }
            }
        }
    }

    // Configurar listeners del chat
    setupChatListeners() {
        // Botón para mostrar/ocultar chat
        this.addEventListener(
            document.getElementById('toggle-chat-btn'),
            'click',
            () => this.toggleChat(),
            'toggle-chat-btn'
        );

        // Botón para colapsar chat
        this.addEventListener(
            document.getElementById('toggle-chat'),
            'click',
            () => this.collapseChat(),
            'toggle-chat'
        );

        // Enviar mensaje
        this.addEventListener(
            document.getElementById('send-message'),
            'click',
            () => this.sendMessage(),
            'send-message'
        );

        // Enviar mensaje con Enter
        this.addEventListener(
            document.getElementById('chat-input'),
            'keypress',
            (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            },
            'chat-input-enter'
        );
    }

    // Mostrar chat
    showChat() {
        const chatContainer = document.getElementById('chat-container');
        const toggleChatBtn = document.getElementById('toggle-chat-btn');
        
        if (chatContainer) chatContainer.style.display = 'block';
        if (toggleChatBtn) toggleChatBtn.style.display = 'inline-block';
    }

    // Ocultar chat
    hideChat() {
        const chatContainer = document.getElementById('chat-container');
        const toggleChatBtn = document.getElementById('toggle-chat-btn');
        
        if (chatContainer) chatContainer.style.display = 'none';
        if (toggleChatBtn) toggleChatBtn.style.display = 'none';
    }

    // Alternar chat
    toggleChat() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.style.display = chatContainer.style.display === 'none' ? 'block' : 'none';
        }
    }

    // Colapsar chat
    collapseChat() {
        const chatContainer = document.getElementById('chat-container');
        if (chatContainer) {
            chatContainer.classList.toggle('collapsed');
        }
    }

    // Inicializar chat
    initializeChat() {
        // Limpiar mensajes anteriores
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '<div class="chat-message system"><span class="message-time">00:00</span><span class="message-text">¡Bienvenido al chat! Puedes comunicarte con tu oponente aquí.</span></div>';
        }
    }

    // Enviar mensaje
    sendMessage() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return;

        const message = chatInput.value.trim();
        if (!message) return;

        // Agregar mensaje propio
        this.addChatMessage('own', message);
        
        // Limpiar input
        chatInput.value = '';
        
        // Aquí implementarías el envío del mensaje a Firebase
        console.log('Enviando mensaje:', message);
        
        // Simular respuesta del oponente (para demo)
        setTimeout(() => {
            this.addChatMessage('other', '¡Buena jugada!');
        }, 1000);
    }

    // Agregar mensaje al chat
    addChatMessage(type, text) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        
        const time = new Date().toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        messageDiv.innerHTML = `
            <span class="message-time">${time}</span>
            <span class="message-text">${text}</span>
        `;
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll hacia abajo
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Función global para mostrar pantallas (para compatibilidad)
window.showScreen = function(screenId) {
    if (window.gameManager) {
        window.gameManager.showScreen(screenId);
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Inicializando aplicación...');
    try {
        window.gameManager = new GameManager();
        console.log('✅ Aplicación inicializada correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar la aplicación:', error);
        alert('Error al iniciar la aplicación. Revisa la consola para más detalles.');
    }
});