class AmongUsMap {
    constructor() {
        this.player = document.getElementById('player');
        this.map = document.querySelector('.map');
        
        // Player position
        this.playerX = 100;
        this.playerY = 100;
        
        // Movement speed
        this.moveSpeed = 8; // Increased from 5 to 8 for faster player movement
        this.botSpeed = 3; // Increased from 2 to 3 for more active bots
        
        // Room boundaries for collision detection
        this.rooms = {
            cafeteria: { x: 50, y: 50, width: 200, height: 150 },
            medbay: { x: 300, y: 50, width: 180, height: 140 },
            security: { x: 530, y: 50, width: 160, height: 120 },
            electrical: { x: 740, y: 50, width: 170, height: 130 },
            storage: { x: 50, y: 250, width: 190, height: 160 },
            admin: { x: 300, y: 250, width: 200, height: 150 },
            weapons: { x: 550, y: 250, width: 180, height: 140 },
            navigation: { x: 780, y: 250, width: 160, height: 120 }
        };
        
        // Initialize bots for each room
        this.bots = {};
        this.botPositions = {};
        this.botDirections = {};
        this.botStates = {}; // Track if bots are alive or dead
        
        const roomNames = ['cafeteria', 'medbay', 'security', 'electrical', 'storage', 'admin', 'weapons', 'navigation'];
        
        roomNames.forEach(roomName => {
            this.bots[roomName] = document.getElementById(`bot-${roomName}`);
            // Position each bot in the center of their respective room
            const room = this.rooms[roomName];
            this.botPositions[roomName] = {
                x: room.x + room.width / 2,
                y: room.y + room.height / 2
            };
            this.botDirections[roomName] = { x: 1, y: 0 };
            this.botStates[roomName] = 'alive'; // Track bot state
        });
        
        // Kill system
        this.killCooldown = 0;
        this.killRange = 30; // Distance to kill a bot
        this.killCooldownTime = 8000; // 8 seconds in milliseconds
        
        // Vent system for player impostor
        this.ventCooldown = 0;
        this.ventCooldownTime = 2000; // 2 seconds
        
        // Game role system
        this.playerRole = Math.random() < 0.6 ? 'crewmate' : 'impostor'; // 60% crewmate, 40% impostor
        this.gameState = 'playing'; // playing, meeting, gameOver
        this.meetingCooldown = 0;
        this.meetingCooldownTime = 15000; // 15 seconds
        
        // Mobile detection and touch controls
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                        (window.innerWidth <= 768 && 'ontouchstart' in window);
        this.touchControls = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };
        this.movementKeys = {};
        
        // AI Impostor system (when player is crewmate)
        this.aiImpostorBot = null; // Which bot is the AI impostor
        this.aiImpostorKills = 0; // Track AI impostor kills
        this.aiImpostorState = 'waiting'; // waiting, teleporting, hunting, killing, cooldown
        this.aiImpostorStartDelay = 2000; // 2 seconds before starting
        this.aiImpostorStartTime = Date.now();
        this.aiImpostorTarget = null; // Current target bot
        this.aiImpostorSpeed = 5; // Faster than regular bots
        this.aiImpostorKillDelay = 8000; // 8 seconds between kills
        this.aiImpostorLastKillTime = 0;
        this.aiImpostorDisabled = false; // Disabled when voted out
        
        this.deadBodies = []; // Track dead bodies for reporting
        this.reportedBodies = []; // Track reported bodies
        
        this.init();
    }
    
    init() {
        this.setupPlayerControls();
        this.startBotMovement();
        this.updatePositions();
        this.showRoleAssignment();
        this.setupEmergencyButton();
        this.designateAIImpostor();
        this.updateControlInstructions();
    }
    
    updateControlInstructions() {
        const controlInstructions = document.getElementById('control-instructions');
        if (controlInstructions) {
            if (this.isMobile) {
                controlInstructions.textContent = 'Use on-screen joystick and buttons to play';
            } else {
                controlInstructions.textContent = 'Use WASD or Arrow Keys to move';
            }
        }
    }
    
    setupPlayerControls() {
        const keys = {};
        
        // Keyboard controls (for desktop)
        document.addEventListener('keydown', (e) => {
            keys[e.key.toLowerCase()] = true;
            this.movementKeys[e.key.toLowerCase()] = true;
            this.handlePlayerMovement(keys);
            
            // Handle kill action (only for impostor)
            if (e.key.toLowerCase() === 'e' && this.playerRole === 'impostor') {
                this.attemptKill();
            }
            
            // Handle emergency meeting (only for crewmate)
            if (e.key.toLowerCase() === 'r' && this.playerRole === 'crewmate') {
                this.attemptEmergencyMeeting();
            }
            
            // Handle vent (only for impostor)
            if (e.key === ' ' && this.playerRole === 'impostor') {
                e.preventDefault(); // Prevent page scroll
                this.attemptVent();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
            this.movementKeys[e.key.toLowerCase()] = false;
        });
        
        // Mobile touch controls
        if (this.isMobile) {
            this.setupMobileControls();
        }
    }
    
    setupMobileControls() {
        // Create mobile control UI
        const mobileControls = document.createElement('div');
        mobileControls.id = 'mobile-controls';
        mobileControls.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            padding: 10px;
            z-index: 100;
            pointer-events: none;
        `;
        
        // Joystick area (left side)
        const joystickArea = document.createElement('div');
        joystickArea.id = 'joystick-area';
        joystickArea.style.cssText = `
            width: 150px;
            height: 150px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            border: 3px solid rgba(255, 255, 255, 0.5);
            position: relative;
            pointer-events: all;
            touch-action: none;
        `;
        
        const joystickKnob = document.createElement('div');
        joystickKnob.id = 'joystick-knob';
        joystickKnob.style.cssText = `
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.8);
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border: 2px solid rgba(255, 255, 255, 0.9);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        
        joystickArea.appendChild(joystickKnob);
        mobileControls.appendChild(joystickArea);
        
        // Action buttons (right side)
        const actionButtons = document.createElement('div');
        actionButtons.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: all;
        `;
        
        // Kill/Report button
        const actionBtn = document.createElement('button');
        actionBtn.id = 'mobile-action-btn';
        actionBtn.style.cssText = `
            width: 80px;
            height: 80px;
            border-radius: 50%;
            background: ${this.playerRole === 'impostor' ? 'rgba(231, 76, 60, 0.8)' : 'rgba(52, 152, 219, 0.8)'};
            border: 3px solid rgba(255, 255, 255, 0.9);
            color: white;
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            touch-action: manipulation;
        `;
        actionBtn.textContent = this.playerRole === 'impostor' ? '🔪' : '📢';
        actionButtons.appendChild(actionBtn);
        
        // Vent button (only for impostor)
        if (this.playerRole === 'impostor') {
            const ventBtn = document.createElement('button');
            ventBtn.id = 'mobile-vent-btn';
            ventBtn.style.cssText = `
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: rgba(155, 89, 182, 0.8);
                border: 3px solid rgba(255, 255, 255, 0.9);
                color: white;
                font-size: 24px;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                touch-action: manipulation;
            `;
            ventBtn.textContent = '🚪';
            actionButtons.appendChild(ventBtn);
        }
        
        mobileControls.appendChild(actionButtons);
        document.body.appendChild(mobileControls);
        
        // Joystick touch handling
        let joystickRect = joystickArea.getBoundingClientRect();
        let joystickCenter = {
            x: joystickRect.left + joystickRect.width / 2,
            y: joystickRect.top + joystickRect.height / 2
        };
        const joystickRadius = joystickRect.width / 2 - 30;
        
        const updateJoystickCenter = () => {
            joystickRect = joystickArea.getBoundingClientRect();
            joystickCenter = {
                x: joystickRect.left + joystickRect.width / 2,
                y: joystickRect.top + joystickRect.height / 2
            };
        };
        
        const handleTouchStart = (e) => {
            e.preventDefault();
            updateJoystickCenter();
            this.touchControls.active = true;
            const touch = e.touches[0] || e.changedTouches[0];
            this.touchControls.startX = touch.clientX;
            this.touchControls.startY = touch.clientY;
        };
        
        const handleTouchMove = (e) => {
            if (!this.touchControls.active) return;
            e.preventDefault();
            const touch = e.touches[0] || e.changedTouches[0];
            const deltaX = touch.clientX - joystickCenter.x;
            const deltaY = touch.clientY - joystickCenter.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (distance <= joystickRadius) {
                this.touchControls.currentX = deltaX;
                this.touchControls.currentY = deltaY;
            } else {
                const angle = Math.atan2(deltaY, deltaX);
                this.touchControls.currentX = Math.cos(angle) * joystickRadius;
                this.touchControls.currentY = Math.sin(angle) * joystickRadius;
            }
            
            // Update joystick knob position
            joystickKnob.style.transform = `translate(calc(-50% + ${this.touchControls.currentX}px), calc(-50% + ${this.touchControls.currentY}px))`;
            
            // Convert joystick movement to movement keys
            const threshold = 10;
            this.movementKeys = {};
            if (Math.abs(this.touchControls.currentX) > threshold) {
                this.movementKeys[this.touchControls.currentX > 0 ? 'd' : 'a'] = true;
            }
            if (Math.abs(this.touchControls.currentY) > threshold) {
                this.movementKeys[this.touchControls.currentY > 0 ? 's' : 'w'] = true;
            }
        };
        
        const handleTouchEnd = (e) => {
            e.preventDefault();
            this.touchControls.active = false;
            this.touchControls.currentX = 0;
            this.touchControls.currentY = 0;
            this.movementKeys = {};
            joystickKnob.style.transform = 'translate(-50%, -50%)';
        };
        
        joystickArea.addEventListener('touchstart', handleTouchStart, { passive: false });
        joystickArea.addEventListener('touchmove', handleTouchMove, { passive: false });
        joystickArea.addEventListener('touchend', handleTouchEnd, { passive: false });
        joystickArea.addEventListener('touchcancel', handleTouchEnd, { passive: false });
        
        // Action button handlers
        actionBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.playerRole === 'impostor') {
                this.attemptKill();
            } else {
                this.attemptEmergencyMeeting();
            }
        }, { passive: false });
        
        if (this.playerRole === 'impostor') {
            const ventBtn = document.getElementById('mobile-vent-btn');
            ventBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.attemptVent();
            }, { passive: false });
        }
        
        // Update movement handler to use touch controls
        setInterval(() => {
            if (this.isMobile && Object.keys(this.movementKeys).length > 0) {
                this.handlePlayerMovement(this.movementKeys);
            }
        }, 16); // ~60fps
    }
    
    handlePlayerMovement(keys) {
        let newX = this.playerX;
        let newY = this.playerY;
        
        if (keys['w'] || keys['arrowup']) {
            newY -= this.moveSpeed;
        }
        if (keys['s'] || keys['arrowdown']) {
            newY += this.moveSpeed;
        }
        if (keys['a'] || keys['arrowleft']) {
            newX -= this.moveSpeed;
        }
        if (keys['d'] || keys['arrowright']) {
            newX += this.moveSpeed;
        }
        
        // Check if new position is valid (within rooms and not hitting walls)
        if (this.isValidPosition(newX, newY, 'player')) {
            this.playerX = newX;
            this.playerY = newY;
            this.updatePlayerPosition();
        }
    }
    
    isValidPosition(x, y, entity) {
        const size = 20; // Player/bot size
        
        // Check map boundaries
        if (x < 0 || y < 0 || x + size > this.map.offsetWidth || y + size > this.map.offsetHeight) {
            return false;
        }
        
        // Check collision ONLY with the actual black outline elements
        // Get all outline elements and check if position overlaps with them
        const outlines = document.querySelectorAll('.outline');
        
        for (const outline of outlines) {
            const rect = outline.getBoundingClientRect();
            const mapRect = this.map.getBoundingClientRect();
            
            // Convert to map-relative coordinates
            const outlineX = rect.left - mapRect.left;
            const outlineY = rect.top - mapRect.top;
            const outlineWidth = rect.width;
            const outlineHeight = rect.height;
            
            // Check if player/bot overlaps with this outline
            if (x < outlineX + outlineWidth &&
                x + size > outlineX &&
                y < outlineY + outlineHeight &&
                y + size > outlineY) {
                return false;
            }
        }
        
        return true;
    }
    
    updatePlayerPosition() {
        this.player.style.left = this.playerX + 'px';
        this.player.style.top = this.playerY + 'px';
        this.player.classList.add('moving');
        setTimeout(() => this.player.classList.remove('moving'), 200);
    }
    
    startBotMovement() {
        setInterval(() => {
            this.moveAllBots();
            this.updateCooldown();
            this.aiImpostorBehavior();
            this.checkBodyReporting();
        }, 100);
    }
    
    moveAllBots() {
        const roomNames = ['cafeteria', 'medbay', 'security', 'electrical', 'storage', 'admin', 'weapons', 'navigation'];
        
        roomNames.forEach(roomName => {
            this.moveBot(roomName);
        });
    }
    
    moveBot(roomName) {
        // Only move alive bots
        if (this.botStates[roomName] !== 'alive') {
            return;
        }
        
        const bot = this.bots[roomName];
        const pos = this.botPositions[roomName];
        const dir = this.botDirections[roomName];
        
        // Enhanced bot AI - more active movement within room
        const room = this.rooms[roomName];
        
        // More frequent direction changes for active movement
        if (Math.random() < 0.05) { // Increased from 0.02 to 0.05
            // More varied movement patterns
            const patterns = [
                { x: 1, y: 0 },      // Right
                { x: -1, y: 0 },     // Left  
                { x: 0, y: 1 },      // Down
                { x: 0, y: -1 },     // Up
                { x: 0.7, y: 0.7 },  // Diagonal down-right
                { x: -0.7, y: 0.7 }, // Diagonal down-left
                { x: 0.7, y: -0.7 }, // Diagonal up-right
                { x: -0.7, y: -0.7 } // Diagonal up-left
            ];
            
            const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
            dir.x = randomPattern.x;
            dir.y = randomPattern.y;
        }
        
        // Apply movement
        const newX = pos.x + dir.x * this.botSpeed;
        const newY = pos.y + dir.y * this.botSpeed;
        
        if (this.isValidPosition(newX, newY, 'bot')) {
            pos.x = newX;
            pos.y = newY;
            this.updateBotPosition(roomName);
        } else {
            // Change direction if hitting wall - try different directions
            const bouncePatterns = [
                { x: -dir.x, y: dir.y },  // Reverse X
                { x: dir.x, y: -dir.y },  // Reverse Y
                { x: -dir.x, y: -dir.y }, // Reverse both
                { x: dir.y, y: dir.x },   // Rotate 90 degrees
                { x: -dir.y, y: -dir.x }  // Rotate -90 degrees
            ];
            
            const randomBounce = bouncePatterns[Math.floor(Math.random() * bouncePatterns.length)];
            dir.x = randomBounce.x;
            dir.y = randomBounce.y;
        }
    }
    
    updateBotPosition(roomName) {
        const bot = this.bots[roomName];
        const pos = this.botPositions[roomName];
        
        bot.style.left = pos.x + 'px';
        bot.style.top = pos.y + 'px';
        bot.classList.add('moving');
        setTimeout(() => bot.classList.remove('moving'), 200);
    }
    
    updatePositions() {
        this.updatePlayerPosition();
        
        // Update all bot positions
        const roomNames = ['cafeteria', 'medbay', 'security', 'electrical', 'storage', 'admin', 'weapons', 'navigation'];
        roomNames.forEach(roomName => {
            this.updateBotPosition(roomName);
        });
    }
    
    attemptKill() {
        // Check if kill cooldown is active
        if (this.killCooldown > 0) {
            console.log('Kill on cooldown!');
            return;
        }
        
        // Find closest alive bot
        let closestBot = null;
        let closestDistance = Infinity;
        
        const roomNames = ['cafeteria', 'medbay', 'security', 'electrical', 'storage', 'admin', 'weapons', 'navigation'];
        
        roomNames.forEach(roomName => {
            if (this.botStates[roomName] === 'alive') {
                const botPos = this.botPositions[roomName];
                const distance = Math.sqrt(
                    Math.pow(this.playerX - botPos.x, 2) + 
                    Math.pow(this.playerY - botPos.y, 2)
                );
                
                if (distance < this.killRange && distance < closestDistance) {
                    closestBot = roomName;
                    closestDistance = distance;
                }
            }
        });
        
        // Kill the closest bot if in range
        if (closestBot) {
            this.killBot(closestBot);
            this.killCooldown = this.killCooldownTime;
            console.log(`Killed ${closestBot}! Cooldown: 10 seconds`);
        }
    }
    
    killBot(roomName) {
        // Mark bot as dead
        this.botStates[roomName] = 'dead';
        
        // Change bot color to grey
        const bot = this.bots[roomName];
        bot.style.background = 'linear-gradient(45deg, #7f8c8d, #6c7b7d)';
        
        // Stop bot movement
        this.botDirections[roomName] = { x: 0, y: 0 };
        
        // Add dead body for player impostor kills
        if (this.playerRole === 'impostor') {
            const botPos = this.botPositions[roomName];
            this.deadBodies.push({
                room: roomName,
                x: botPos.x,
                y: botPos.y,
                time: Date.now()
            });
            
            // Check win condition for impostor (7 kills instead of 8)
            const deadCount = Object.values(this.botStates).filter(state => state === 'dead').length;
            if (deadCount >= 7) {
                this.showVictoryMessage('Impostor Wins!', 'You eliminated 7 crewmates!');
            }
        }
    }
    
    checkWinCondition() {
        const roomNames = ['cafeteria', 'medbay', 'security', 'electrical', 'storage', 'admin', 'weapons', 'navigation'];
        const aliveBots = roomNames.filter(roomName => this.botStates[roomName] === 'alive');
        
        if (aliveBots.length === 0) {
            this.showWinMessage();
        }
    }
    
    showWinMessage() {
        // Create win message
        const winDiv = document.createElement('div');
        winDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            color: white;
            padding: 30px;
            border-radius: 15px;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            z-index: 1000;
            border: 3px solid #ecf0f1;
        `;
        winDiv.innerHTML = `
            <h2>🎉 VICTORY! 🎉</h2>
            <p>You eliminated all bots!</p>
            <p>Press F5 to play again</p>
        `;
        
        document.body.appendChild(winDiv);
        
        // Stop all movement
        this.gameWon = true;
    }
    
    updateCooldown() {
        if (this.killCooldown > 0) {
            this.killCooldown -= 100; // Decrease by 100ms each update
            if (this.killCooldown < 0) {
                this.killCooldown = 0;
            }
            
            // Update cooldown display
            const cooldownDisplay = document.getElementById('cooldown-display');
            if (cooldownDisplay) {
                const secondsLeft = Math.ceil(this.killCooldown / 1000);
                cooldownDisplay.textContent = `Kill Cooldown: ${secondsLeft}s`;
            }
        } else {
            // Clear cooldown display
            const cooldownDisplay = document.getElementById('cooldown-display');
            if (cooldownDisplay) {
                cooldownDisplay.textContent = '';
            }
        }
        
        // Update vent cooldown
        if (this.ventCooldown > 0) {
            this.ventCooldown -= 100;
            if (this.ventCooldown < 0) {
                this.ventCooldown = 0;
            }
        }
    }
    
    showRoleAssignment() {
        const roleDiv = document.createElement('div');
        roleDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, ${this.playerRole === 'impostor' ? '#e74c3c, #c0392b' : '#3498db, #2980b9'});
            color: white;
            padding: 30px;
            border-radius: 15px;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            z-index: 1000;
            border: 3px solid #ecf0f1;
        `;
        roleDiv.innerHTML = `
            <h2>${this.playerRole === 'impostor' ? '🔴 IMPOSTOR' : '🔵 CREWMATE'}</h2>
            <p>${this.playerRole === 'impostor' ? 'Kill all crewmates to win!' : 'Find and vote out the impostor!'}</p>
            <p>Click to continue...</p>
        `;
        
        document.body.appendChild(roleDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            document.body.removeChild(roleDiv);
            this.updateRoleDisplay();
        }, 3000);
    }
    
    updateRoleDisplay() {
        const roleDisplay = document.getElementById('role-display');
        const impostorControls = document.getElementById('impostor-controls');
        const crewmateControls = document.getElementById('crewmate-controls');
        
        if (roleDisplay) {
            roleDisplay.textContent = `Role: ${this.playerRole === 'impostor' ? '🔴 IMPOSTOR' : '🔵 CREWMATE'}`;
            roleDisplay.style.color = this.playerRole === 'impostor' ? '#e74c3c' : '#3498db';
        }
        
        if (impostorControls) {
            impostorControls.style.display = this.playerRole === 'impostor' ? 'block' : 'none';
        }
        
        if (crewmateControls) {
            crewmateControls.style.display = this.playerRole === 'crewmate' ? 'block' : 'none';
        }
    }
    
    setupEmergencyButton() {
        if (this.playerRole === 'crewmate') {
            const cafeteria = document.getElementById('cafeteria');
            const emergencyBtn = document.createElement('div');
            emergencyBtn.id = 'emergency-button';
            emergencyBtn.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 40px;
                height: 40px;
                background: linear-gradient(45deg, #e74c3c, #c0392b);
                border-radius: 50%;
                border: 3px solid #ecf0f1;
                cursor: pointer;
                z-index: 10;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            `;
            emergencyBtn.innerHTML = '🚨';
            cafeteria.appendChild(emergencyBtn);
        }
    }
    
    attemptEmergencyMeeting() {
        if (this.gameState !== 'playing' || this.playerRole !== 'crewmate') return;
        
        // Check if in cafeteria
        const cafeteria = this.rooms.cafeteria;
        if (this.playerX < cafeteria.x || this.playerX > cafeteria.x + cafeteria.width ||
            this.playerY < cafeteria.y || this.playerY > cafeteria.y + cafeteria.height) {
            console.log('Must be in cafeteria to call emergency meeting!');
            return;
        }
        
        // Check cooldown
        if (this.meetingCooldown > 0) {
            console.log('Emergency meeting on cooldown!');
            return;
        }
        
        this.startMeeting();
    }
    
    startMeeting() {
        this.gameState = 'meeting';
        this.meetingCooldown = this.meetingCooldownTime;
        
        // Create voting screen
        const meetingDiv = document.createElement('div');
        meetingDiv.id = 'meeting-screen';
        meetingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.9);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
        `;
        
        const colors = [
            { name: 'Blue', color: '#3498db', bot: 'cafeteria' },
            { name: 'Green', color: '#2ecc71', bot: 'medbay' },
            { name: 'Orange', color: '#f39c12', bot: 'security' },
            { name: 'Purple', color: '#9b59b6', bot: 'electrical' },
            { name: 'Turquoise', color: '#1abc9c', bot: 'storage' },
            { name: 'Pink', color: '#e91e63', bot: 'admin' },
            { name: 'Blue Grey', color: '#607d8b', bot: 'weapons' },
            { name: 'Brown', color: '#795548', bot: 'navigation' }
        ];
        
        let votingHTML = '<h2>🚨 EMERGENCY MEETING 🚨</h2><p>Who is the impostor?</p><div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px;">';
        
        colors.forEach((colorInfo, index) => {
            const botState = this.botStates[colorInfo.bot];
            const isAlive = botState === 'alive';
            votingHTML += `
                <div class="vote-option" data-bot="${colorInfo.bot}" style="
                    background: ${isAlive ? colorInfo.color : '#7f8c8d'};
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    cursor: ${isAlive ? 'pointer' : 'not-allowed'};
                    opacity: ${isAlive ? '1' : '0.5'};
                    border: 3px solid #ecf0f1;
                ">
                    <div style="font-size: 24px;">${isAlive ? '👤' : '💀'}</div>
                    <div style="font-weight: bold;">${colorInfo.name}</div>
                    <div style="font-size: 12px;">${isAlive ? 'Alive' : 'Dead'}</div>
                </div>
            `;
        });
        
        votingHTML += '</div><div style="margin-top: 20px;"><button id="skip-vote" style="padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 5px; cursor: pointer;">Skip Vote</button></div>';
        
        meetingDiv.innerHTML = votingHTML;
        document.body.appendChild(meetingDiv);
        
        // Add click handlers
        document.querySelectorAll('.vote-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const botName = e.currentTarget.dataset.bot;
                if (this.botStates[botName] === 'alive') {
                    this.voteOutBot(botName);
                }
            });
        });
        
        document.getElementById('skip-vote').addEventListener('click', () => {
            this.endMeeting();
        });
    }
    
    voteOutBot(botName) {
        // Kill the voted bot
        this.killBot(botName);
        
        // Check if impostor was voted out
        if (botName === this.aiImpostorBot) {
            // Disable AI impostor
            this.aiImpostorDisabled = true;
            this.showVictoryMessage('Crewmates Win!', 'You voted out the impostor!');
        } else {
            // Wrong vote - continue the game
            console.log('Wrong vote! The game continues...');
        }
        
        this.endMeeting();
    }
    
    endMeeting() {
        const meetingScreen = document.getElementById('meeting-screen');
        if (meetingScreen) {
            document.body.removeChild(meetingScreen);
        }
        this.gameState = 'playing';
    }
    
    // AI Impostor behavior
    aiImpostorBehavior() {
        if (this.playerRole !== 'crewmate' || this.gameState !== 'playing') return;
        if (!this.aiImpostorBot) return;
        if (this.aiImpostorDisabled) return; // Disabled when voted out
        
        // Check if enough time has passed to start
        if (this.aiImpostorState === 'waiting') {
            if (Date.now() - this.aiImpostorStartTime >= this.aiImpostorStartDelay) {
                this.aiImpostorState = 'teleporting';
            } else {
                return;
            }
        }
        
        // Wait for cooldown after kill
        if (this.aiImpostorState === 'cooldown') {
            if (Date.now() - this.aiImpostorLastKillTime >= this.aiImpostorKillDelay) {
                this.aiImpostorState = 'teleporting';
            } else {
                return;
            }
        }
        
        // Teleport to random room and find nearest crewmate
        if (this.aiImpostorState === 'teleporting') {
            const aliveRooms = Object.keys(this.botStates).filter(room => 
                this.botStates[room] === 'alive' && room !== this.aiImpostorBot
            );
            
            if (aliveRooms.length > 0) {
                // Teleport to a random room
                const randomRoom = aliveRooms[Math.floor(Math.random() * aliveRooms.length)];
                const room = this.rooms[randomRoom];
                
                // Teleport AI impostor to the room
                this.botPositions[this.aiImpostorBot] = {
                    x: room.x + room.width / 2,
                    y: room.y + room.height / 2
                };
                this.updateBotPosition(this.aiImpostorBot);
                
                // Find nearest crewmate in any room
                let nearestDistance = Infinity;
                let nearestTarget = null;
                
                aliveRooms.forEach(roomName => {
                    const distance = Math.sqrt(
                        Math.pow(this.botPositions[this.aiImpostorBot].x - this.botPositions[roomName].x, 2) +
                        Math.pow(this.botPositions[this.aiImpostorBot].y - this.botPositions[roomName].y, 2)
                    );
                    
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestTarget = roomName;
                    }
                });
                
                this.aiImpostorTarget = nearestTarget;
                this.aiImpostorState = 'hunting';
            }
        }
        
        // Hunt the target crewmate
        if (this.aiImpostorState === 'hunting' && this.aiImpostorTarget) {
            const impostorPos = this.botPositions[this.aiImpostorBot];
            const targetPos = this.botPositions[this.aiImpostorTarget];
            
            const dx = targetPos.x - impostorPos.x;
            const dy = targetPos.y - impostorPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 20) {
                // Close enough to kill
                this.killBot(this.aiImpostorTarget);
                this.aiImpostorKills++;
                this.aiImpostorLastKillTime = Date.now();
                
                // Add dead body
                this.deadBodies.push({
                    room: this.aiImpostorTarget,
                    x: targetPos.x,
                    y: targetPos.y,
                    time: Date.now()
                });
                
                this.aiImpostorState = 'cooldown'; // 15-second cooldown
                this.aiImpostorTarget = null;
                
                // Check if AI impostor wins (only player left)
                const remainingAlive = Object.values(this.botStates).filter(state => state === 'alive').length;
                if (remainingAlive <= 1) { // Only player left
                    this.showVictoryMessage('AI Impostor Wins!', 'All crewmates have been eliminated!');
                }
            } else {
                // Move towards target with increased speed
                const moveX = (dx / distance) * this.aiImpostorSpeed;
                const moveY = (dy / distance) * this.aiImpostorSpeed;
                
                const newX = impostorPos.x + moveX;
                const newY = impostorPos.y + moveY;
                
                if (this.isValidPosition(newX, newY, 'bot')) {
                    impostorPos.x = newX;
                    impostorPos.y = newY;
                    this.updateBotPosition(this.aiImpostorBot);
                }
            }
        }
    }
    
    checkBodyReporting() {
        // Check if player is near any dead body
        this.deadBodies.forEach((body, index) => {
            if (!this.reportedBodies.includes(index)) {
                // Check player
                const playerDistance = Math.sqrt(
                    Math.pow(this.playerX - body.x, 2) + 
                    Math.pow(this.playerY - body.y, 2)
                );
                
                if (playerDistance < 5) { // 4-5 pixels as requested
                    if (this.playerRole === 'crewmate') {
                        // Body reported - impostor loses
                        this.showVictoryMessage('Crewmates Win!', 'Dead body was reported!');
                        this.reportedBodies.push(index);
                        return;
                    } else if (this.playerRole === 'impostor') {
                        // Player impostor loses if crewmate reports body
                        this.showVictoryMessage('Crewmates Win!', 'Your victim was found!');
                        this.reportedBodies.push(index);
                        return;
                    }
                }
                
                // Check if any alive crewmate bot touches the dead body
                const roomNames = ['cafeteria', 'medbay', 'security', 'electrical', 'storage', 'admin', 'weapons', 'navigation'];
                roomNames.forEach(roomName => {
                    // Only check alive bots (not the impostor bot)
                    if (this.botStates[roomName] === 'alive' && roomName !== this.aiImpostorBot) {
                        const botPos = this.botPositions[roomName];
                        const botDistance = Math.sqrt(
                            Math.pow(botPos.x - body.x, 2) + 
                            Math.pow(botPos.y - body.y, 2)
                        );
                        
                        // Bot touches body (within 10 pixels - considering bot size)
                        if (botDistance < 10) {
                            // AI crewmate reports body - impostor loses
                            this.showVictoryMessage('Crewmates Win!', 'AI crewmate reported a dead body!');
                            this.reportedBodies.push(index);
                        }
                    }
                });
            }
        });
    }
    
    showVictoryMessage(title, message) {
        const winDiv = document.createElement('div');
        winDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            color: white;
            padding: 30px;
            border-radius: 15px;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            z-index: 1000;
            border: 3px solid #ecf0f1;
        `;
        winDiv.innerHTML = `
            <h2>${title}</h2>
            <p>${message}</p>
            <p>Press F5 to play again</p>
        `;
        
        document.body.appendChild(winDiv);
        this.gameState = 'gameOver';
    }
    
    attemptVent() {
        if (this.gameState !== 'playing' || this.playerRole !== 'impostor') return;
        
        // Check cooldown
        if (this.ventCooldown > 0) {
            console.log('Vent on cooldown!');
            return;
        }
        
        this.startVentScreen();
    }
    
    startVentScreen() {
        this.gameState = 'venting';
        
        // Create vent screen
        const ventDiv = document.createElement('div');
        ventDiv.id = 'vent-screen';
        ventDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.9);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
        `;
        
        const rooms = [
            { name: 'Cafeteria', room: 'cafeteria' },
            { name: 'MedBay', room: 'medbay' },
            { name: 'Security', room: 'security' },
            { name: 'Electrical', room: 'electrical' },
            { name: 'Storage', room: 'storage' },
            { name: 'Admin', room: 'admin' },
            { name: 'Weapons', room: 'weapons' },
            { name: 'Navigation', room: 'navigation' }
        ];
        
        let ventHTML = '<h2>🚪 VENT SYSTEM 🚪</h2><p>Choose a room to teleport to:</p><div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px;">';
        
        rooms.forEach((roomInfo, index) => {
            ventHTML += `
                <div class="vent-option" data-room="${roomInfo.room}" style="
                    background: linear-gradient(135deg, #e74c3c, #c0392b);
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                    cursor: pointer;
                    border: 3px solid #ecf0f1;
                    transition: transform 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    <div style="font-size: 24px;">🚪</div>
                    <div style="font-weight: bold;">${roomInfo.name}</div>
                </div>
            `;
        });
        
        ventHTML += '</div><div style="margin-top: 20px;"><button id="cancel-vent" style="padding: 10px 20px; background: #95a5a6; color: white; border: none; border-radius: 5px; cursor: pointer;">Cancel</button></div>';
        
        ventDiv.innerHTML = ventHTML;
        document.body.appendChild(ventDiv);
        
        // Add click handlers
        document.querySelectorAll('.vent-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const roomName = e.currentTarget.dataset.room;
                this.teleportToRoom(roomName);
            });
        });
        
        document.getElementById('cancel-vent').addEventListener('click', () => {
            this.endVent();
        });
    }
    
    teleportToRoom(roomName) {
        const room = this.rooms[roomName];
        if (room) {
            // Teleport player to the room
            this.playerX = room.x + room.width / 2;
            this.playerY = room.y + room.height / 2;
            this.updatePlayerPosition();
            
            // Set vent cooldown
            this.ventCooldown = this.ventCooldownTime;
            
            console.log(`Teleported to ${roomName}!`);
        }
        
        this.endVent();
    }
    
    endVent() {
        const ventScreen = document.getElementById('vent-screen');
        if (ventScreen) {
            document.body.removeChild(ventScreen);
        }
        this.gameState = 'playing';
    }
    
    designateAIImpostor() {
        if (this.playerRole === 'crewmate') {
            // Choose a random bot to be the AI impostor
            const roomNames = ['cafeteria', 'medbay', 'security', 'electrical', 'storage', 'admin', 'weapons', 'navigation'];
            this.aiImpostorBot = roomNames[Math.floor(Math.random() * roomNames.length)];
            
            // Keep the AI impostor bot's original color - don't change it
            console.log(`AI Impostor is: ${this.aiImpostorBot}`);
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AmongUsMap();
});
