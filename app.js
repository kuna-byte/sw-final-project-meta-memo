/* App.js - MindFlow Engine */

(function () {
    // --- Application State ---
    let state = {
        notes: [],
        connections: [],
        panX: 0,
        panY: 0,
        zoom: 1.0,
        snapGrid: true,
        selectedNoteId: null,
        selectedConnectionId: null
    };

    // History stack for Undo/Redo
    let historyStack = [];
    let historyIndex = -1;

    // Drawing connection state
    let drawingConnection = null;
    let reconnectingEdge = null;
    let connHandleStart = null;
    let connHandleEnd = null;

    // Viewport size tracking
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;

    // DOM Elements
    const canvasContainer = document.getElementById('canvas-container');
    const canvas = document.getElementById('canvas');
    const svgLayer = document.getElementById('svg-layer');
    const edgesGroup = document.getElementById('edges-group');
    const guideline = document.getElementById('guideline');
    const notesLayer = document.getElementById('notes-layer');
    const canvasHint = document.getElementById('canvas-hint');
    
    // Zoom Controls
    const zoomIndicator = document.getElementById('zoom-indicator');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const zoomResetBtn = document.getElementById('zoom-reset-btn');
    
    // Header Actions
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const helpBtn = document.getElementById('help-btn');
    
    // Search
    const searchInput = document.getElementById('search-input');
    const searchClearBtn = document.getElementById('search-clear-btn');
    const searchResultsCount = document.getElementById('search-results-count');
    
    // Sidebar Quick Actions
    const addNoteBtn = document.getElementById('add-note-btn');
    const snapGridBtn = document.getElementById('snap-grid-btn');
    
    // Modals
    const helpModal = document.getElementById('help-modal');
    const helpCloseBtn = document.getElementById('help-close-btn');
    const helpConfirmBtn = document.getElementById('help-confirm-btn');
    
    const importModal = document.getElementById('import-modal');
    const importCloseBtn = document.getElementById('import-close-btn');
    const importCancelBtn = document.getElementById('import-cancel-btn');
    const importSubmitBtn = document.getElementById('import-submit-btn');
    const importTextarea = document.getElementById('import-textarea');
    const fileUploadInput = document.getElementById('file-upload-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    const importError = document.getElementById('import-error');

    // Create edge delete button inside canvas dynamically
    const edgeDeleteWrapper = document.createElement('div');
    edgeDeleteWrapper.className = 'edge-delete-btn-wrapper';
    edgeDeleteWrapper.innerHTML = `<button class="edge-delete-btn" title="연결 삭제"><i class="ri-delete-bin-line"></i></button>`;
    canvas.appendChild(edgeDeleteWrapper);
    const edgeDeleteBtn = edgeDeleteWrapper.querySelector('.edge-delete-btn');

    // Constants
    const CANVAS_SIZE = 10000;
    const GRID_SIZE = 28;
    const MIN_ZOOM = 0.15;
    const MAX_ZOOM = 3.0;
    const DEFAULT_NOTE_WIDTH = 260;
    const DEFAULT_NOTE_HEIGHT = 120;

    // --- Initialization ---
    function init() {
        createConnectionHandles();
        setupEventListeners();
        loadState();
        
        // Update sidebar snap state UI
        updateSnapGridUI();
        
        // Initial center of canvas
        if (state.notes.length === 0) {
            loadTemplateData();
        } else {
            // Recalculate dimensions for loaded notes
            setTimeout(() => {
                state.notes.forEach(note => updateNoteDimensions(note.id));
                renderConnections();
            }, 100);
        }
        
        centerCanvasOnContent();
        updateUndoRedoButtons();
    }

    function createConnectionHandles() {
        connHandleStart = document.createElement('div');
        connHandleStart.className = 'connection-handle handle-start';
        connHandleStart.style.display = 'none';
        connHandleStart.title = '연결 출발지 변경';
        canvas.appendChild(connHandleStart);

        connHandleEnd = document.createElement('div');
        connHandleEnd.className = 'connection-handle handle-end';
        connHandleEnd.style.display = 'none';
        connHandleEnd.title = '연결 목적지 변경';
        canvas.appendChild(connHandleEnd);
        
        setupConnectionHandleEvents();
    }

    function setupConnectionHandleEvents() {
        connHandleStart.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startReconnectingConnection(state.selectedConnectionId, 'start', e);
        });

        connHandleEnd.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startReconnectingConnection(state.selectedConnectionId, 'end', e);
        });
    }

    // --- Template Data ---
    function loadTemplateData() {
        const centerX = CANVAS_SIZE / 2;
        const centerY = CANVAS_SIZE / 2;

        const defaultNotes = [
            {
                id: 'note_' + Math.random().toString(36).substr(2, 9),
                text: '💡 MindFlow 보드에 오신 것을 환영합니다!\n\n여기는 브레인스토밍과 메모를 위한 공간입니다.\n\n- 빈 공간 더블 클릭: 새 메모 생성\n- 메모 드래그: 위치 이동',
                x: centerX - 130,
                y: centerY - 150,
                width: DEFAULT_NOTE_WIDTH,
                height: 140,
                theme: 'violet'
            },
            {
                id: 'note_' + Math.random().toString(36).substr(2, 9),
                text: '🔗 메모 연결하기\n\n메모 가장자리에 마우스를 올리면 파란색 원형 포트가 나타납니다.\n\n그 포트를 드래그하여 다른 메모 카드 위로 놓으면 선이 연결됩니다!',
                x: centerX + 250,
                y: centerY - 150,
                width: DEFAULT_NOTE_WIDTH,
                height: 140,
                theme: 'ocean'
            },
            {
                id: 'note_' + Math.random().toString(36).substr(2, 9),
                text: '⚙️ 툴바 및 단축키\n\n- G: 그리드 스냅 토글\n- Ctrl+Z / Y: 되돌리기/다시실행\n- Ctrl+F: 실시간 검색\n- Del: 선택 메모/연결선 삭제',
                x: centerX - 130,
                y: centerY + 100,
                width: DEFAULT_NOTE_WIDTH,
                height: 140,
                theme: 'emerald'
            }
        ];

        const defaultConnections = [
            {
                id: 'conn_' + Math.random().toString(36).substr(2, 9),
                fromId: defaultNotes[0].id,
                fromPort: 'right',
                toId: defaultNotes[1].id,
                toPort: 'left'
            },
            {
                id: 'conn_' + Math.random().toString(36).substr(2, 9),
                fromId: defaultNotes[0].id,
                fromPort: 'bottom',
                toId: defaultNotes[2].id,
                toPort: 'top'
            }
        ];

        state.notes = defaultNotes;
        state.connections = defaultConnections;
        
        // Render initial data
        state.notes.forEach(note => createNoteDOM(note));
        
        setTimeout(() => {
            state.notes.forEach(note => updateNoteDimensions(note.id));
            renderConnections();
            pushHistory();
        }, 100);
    }

    // --- State Persistence & History ---
    function saveState() {
        const savedData = {
            notes: state.notes,
            connections: state.connections,
            panX: state.panX,
            panY: state.panY,
            zoom: state.zoom,
            snapGrid: state.snapGrid
        };
        localStorage.setItem('mindflow_board_state', JSON.stringify(savedData));
    }

    function loadState() {
        const saved = localStorage.getItem('mindflow_board_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                state.notes = parsed.notes || [];
                state.connections = parsed.connections || [];
                state.panX = parsed.panX !== undefined ? parsed.panX : (viewportWidth - CANVAS_SIZE) / 2;
                state.panY = parsed.panY !== undefined ? parsed.panY : (viewportHeight - CANVAS_SIZE) / 2;
                state.zoom = parsed.zoom || 1.0;
                state.snapGrid = parsed.snapGrid !== undefined ? parsed.snapGrid : true;
                
                // Render nodes
                notesLayer.innerHTML = '';
                state.notes.forEach(note => createNoteDOM(note));
                updateCanvasTransform();
            } catch (e) {
                console.error("Error loading saved state:", e);
            }
        } else {
            // Default center
            state.panX = (viewportWidth - CANVAS_SIZE) / 2;
            state.panY = (viewportHeight - CANVAS_SIZE) / 2;
            state.zoom = 1.0;
            updateCanvasTransform();
        }
    }

    function pushHistory() {
        const cleanState = {
            notes: JSON.parse(JSON.stringify(state.notes)),
            connections: JSON.parse(JSON.stringify(state.connections))
        };
        
        const stateStr = JSON.stringify(cleanState);
        
        // Don't push duplicate states
        if (historyIndex >= 0 && historyStack[historyIndex] === stateStr) {
            return;
        }

        // Discard forward history
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push(stateStr);
        
        // Limit size
        if (historyStack.length > 50) {
            historyStack.shift();
        } else {
            historyIndex++;
        }
        
        updateUndoRedoButtons();
        saveState();
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            restoreFromHistory();
        }
    }

    function redo() {
        if (historyIndex < historyStack.length - 1) {
            historyIndex++;
            restoreFromHistory();
        }
    }

    function restoreFromHistory() {
        const snapshot = JSON.parse(historyStack[historyIndex]);
        state.notes = JSON.parse(JSON.stringify(snapshot.notes));
        state.connections = JSON.parse(JSON.stringify(snapshot.connections));
        
        // Re-render nodes (preserve DOM elements if possible, or clear and recreate)
        notesLayer.innerHTML = '';
        state.notes.forEach(note => createNoteDOM(note));
        
        // Re-measure after rendering
        setTimeout(() => {
            state.notes.forEach(note => updateNoteDimensions(note.id));
            renderConnections();
        }, 50);

        deselectNote();
        deselectConnection();
        updateUndoRedoButtons();
        saveState();
    }

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= historyStack.length - 1;
    }

    // --- Canvas Manipulation (Pan & Zoom) ---
    function updateCanvasTransform() {
        canvas.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
        zoomIndicator.textContent = `${Math.round(state.zoom * 100)}%`;
        
        // Keep active connection delete button in correct relative position if visible
        if (state.selectedConnectionId) {
            updateConnectionDeletePosition(state.selectedConnectionId);
        }
    }

    function animateViewport(toPanX, toPanY, toZoom, duration = 400) {
        const startPanX = state.panX;
        const startPanY = state.panY;
        const startZoom = state.zoom;
        const startTime = performance.now();

        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // cubic ease-out
            const ease = 1 - Math.pow(1 - progress, 3);

            state.panX = startPanX + (toPanX - startPanX) * ease;
            state.panY = startPanY + (toPanY - startPanY) * ease;
            state.zoom = startZoom + (toZoom - startZoom) * ease;

            updateCanvasTransform();

            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                saveState();
            }
        }
        requestAnimationFrame(step);
    }

    function centerCanvasOnContent() {
        if (state.notes.length === 0) {
            // Center of canvas coordinates
            const targetPanX = viewportWidth / 2 - (CANVAS_SIZE / 2);
            const targetPanY = viewportHeight / 2 - (CANVAS_SIZE / 2);
            animateViewport(targetPanX, targetPanY, 1.0);
            return;
        }

        // Find bounding box of notes
        let minX = CANVAS_SIZE, minY = CANVAS_SIZE;
        let maxX = 0, maxY = 0;

        state.notes.forEach(note => {
            minX = Math.min(minX, note.x);
            minY = Math.min(minY, note.y);
            maxX = Math.max(maxX, note.x + note.width);
            maxY = Math.max(maxY, note.y + note.height);
        });

        // Center of bounding box
        const contentCenterX = minX + (maxX - minX) / 2;
        const contentCenterY = minY + (maxY - minY) / 2;

        const targetPanX = viewportWidth / 2 - contentCenterX;
        const targetPanY = viewportHeight / 2 - contentCenterY;
        
        animateViewport(targetPanX, targetPanY, 1.0);
    }

    // Zooming centering on cursor
    function handleZoom(factor, clientX, clientY) {
        let targetZoom = state.zoom * factor;
        targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
        
        // Calculate canvas coordinates of mouse pointer
        const canvasX = (clientX - state.panX) / state.zoom;
        const canvasY = (clientY - state.panY) / state.zoom;
        
        // Calculate new pan values to keep point under mouse
        state.panX = clientX - canvasX * targetZoom;
        state.panY = clientY - canvasY * targetZoom;
        state.zoom = targetZoom;
        
        updateCanvasTransform();
        saveState();
    }

    // --- Notes Management ---
    function createNote(x, y, text = '') {
        const id = 'note_' + Math.random().toString(36).substr(2, 9);
        const themes = ['slate', 'rose', 'emerald', 'amber', 'ocean', 'violet'];
        // Pick theme based on quantity or randomly
        const theme = themes[Math.floor(Math.random() * themes.length)];

        const note = {
            id: id,
            text: text,
            x: x,
            y: y,
            width: DEFAULT_NOTE_WIDTH,
            height: DEFAULT_NOTE_HEIGHT,
            theme: theme
        };

        state.notes.push(note);
        createNoteDOM(note);
        
        // Update size & save
        setTimeout(() => {
            updateNoteDimensions(id);
            pushHistory();
            
            // Focus textarea inside new note
            const textarea = document.querySelector(`#${id} .note-textarea`);
            if (textarea) textarea.focus();
        }, 50);

        return note;
    }

    function createNoteDOM(note) {
        const card = document.createElement('div');
        card.id = note.id;
        card.className = `note-card theme-${note.theme}`;
        card.style.left = `${note.x}px`;
        card.style.top = `${note.y}px`;
        card.style.width = `${note.width}px`;

        card.innerHTML = `
            <div class="note-header">
                <div class="note-drag-handle"></div>
                <button class="note-delete-btn" title="삭제"><i class="ri-close-line"></i></button>
            </div>
            <div class="note-body">
                <textarea class="note-textarea" placeholder="메모를 적어보세요...">${note.text}</textarea>
            </div>
            <div class="note-footer">
                <div class="note-color-picker">
                    <span class="color-dot slate" data-theme="slate" title="슬레이트"></span>
                    <span class="color-dot rose" data-theme="rose" title="로즈"></span>
                    <span class="color-dot emerald" data-theme="emerald" title="에메랄드"></span>
                    <span class="color-dot amber" data-theme="amber" title="앰버"></span>
                    <span class="color-dot ocean" data-theme="ocean" title="오션"></span>
                    <span class="color-dot violet" data-theme="violet" title="바이올렛"></span>
                </div>
            </div>
            <!-- Ports for connection -->
            <div class="connector-port port-top" data-port="top"></div>
            <div class="connector-port port-right" data-port="right"></div>
            <div class="connector-port port-bottom" data-port="bottom"></div>
            <div class="connector-port port-left" data-port="left"></div>
        `;

        notesLayer.appendChild(card);
        setupNoteEvents(card, note.id);
    }

    function setupNoteEvents(card, noteId) {
        const textarea = card.querySelector('.note-textarea');
        const deleteBtn = card.querySelector('.note-delete-btn');
        const colorDots = card.querySelectorAll('.color-dot');
        const ports = card.querySelectorAll('.connector-port');

        // Dragging variables
        let isDragging = false;
        let startX, startY;
        let initialNoteX, initialNoteY;

        // Auto-sizing textarea height
        function autoResizeTextarea() {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
            
            // Measure actual note height and update state
            const currentHeight = card.offsetHeight;
            const note = state.notes.find(n => n.id === noteId);
            if (note && note.height !== currentHeight) {
                note.height = currentHeight;
                renderConnections(); // Real-time redraw curves
            }
        }

        // Set initial textarea height
        setTimeout(autoResizeTextarea, 20);

        // Edit text
        let typingTimeout;
        textarea.addEventListener('input', (e) => {
            autoResizeTextarea();
            const note = state.notes.find(n => n.id === noteId);
            if (note) {
                note.text = e.target.value;
            }
            
            // Debounce history push during typing
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                pushHistory();
            }, 1000);
        });

        textarea.addEventListener('focus', () => {
            selectNote(noteId);
        });

        textarea.addEventListener('blur', () => {
            pushHistory(); // Capture final text change state
        });

        // Color Picker
        colorDots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                const theme = e.target.dataset.theme;
                const note = state.notes.find(n => n.id === noteId);
                if (note) {
                    note.theme = theme;
                    card.className = `note-card theme-${theme} ${state.selectedNoteId === noteId ? 'selected' : ''}`;
                    pushHistory();
                }
            });
        });

        // Delete note
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteNote(noteId);
        });

        // Click to select note
        card.addEventListener('mousedown', (e) => {
            // Check if clicking interaction elements
            if (e.target.closest('.note-textarea') || 
                e.target.closest('.note-delete-btn') || 
                e.target.closest('.color-dot') || 
                e.target.closest('.connector-port')) {
                return;
            }
            
            selectNote(noteId);
            
            // Start drag note
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const note = state.notes.find(n => n.id === noteId);
            if (note) {
                initialNoteX = note.x;
                initialNoteY = note.y;
            }

            document.addEventListener('mousemove', dragNote);
            document.addEventListener('mouseup', stopDragNote);
            
            card.style.zIndex = 10;
        });

        function dragNote(e) {
            if (!isDragging) return;
            
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            // Scale drag movement with zoom level
            let targetX = initialNoteX + dx / state.zoom;
            let targetY = initialNoteY + dy / state.zoom;
            
            // Boundary checks
            targetX = Math.max(0, Math.min(CANVAS_SIZE - DEFAULT_NOTE_WIDTH, targetX));
            
            const note = state.notes.find(n => n.id === noteId);
            targetY = Math.max(0, Math.min(CANVAS_SIZE - (note ? note.height : DEFAULT_NOTE_HEIGHT), targetY));

            if (state.snapGrid) {
                targetX = Math.round(targetX / GRID_SIZE) * GRID_SIZE;
                targetY = Math.round(targetY / GRID_SIZE) * GRID_SIZE;
            }

            if (note) {
                note.x = targetX;
                note.y = targetY;
                card.style.left = `${targetX}px`;
                card.style.top = `${targetY}px`;
                
                // Redraw connections connected to this note
                renderConnections();
            }
        }

        function stopDragNote() {
            if (isDragging) {
                isDragging = false;
                document.removeEventListener('mousemove', dragNote);
                document.removeEventListener('mouseup', stopDragNote);
                card.style.zIndex = '';
                pushHistory();
            }
        }

        // Port connections dragging
        ports.forEach(port => {
            port.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                const portName = e.target.dataset.port;
                startDrawingConnection(noteId, portName, e);
            });
        });
    }

    function updateNoteDimensions(noteId) {
        const el = document.getElementById(noteId);
        if (el) {
            const note = state.notes.find(n => n.id === noteId);
            if (note) {
                note.width = el.offsetWidth;
                note.height = el.offsetHeight;
            }
        }
    }

    function deleteNote(noteId) {
        // Remove connections associated with this note
        state.connections = state.connections.filter(c => c.fromId !== noteId && c.toId !== noteId);
        
        // Remove note
        state.notes = state.notes.filter(n => n.id !== noteId);
        
        // Remove DOM element
        const card = document.getElementById(noteId);
        if (card) {
            card.style.animation = 'popIn 0.2s reverse ease-in';
            setTimeout(() => card.remove(), 180);
        }
        
        // Clean selection state
        if (state.selectedNoteId === noteId) {
            state.selectedNoteId = null;
        }

        deselectConnection();
        renderConnections();
        pushHistory();
    }

    function selectNote(noteId) {
        deselectConnection();
        if (state.selectedNoteId === noteId) return;
        
        deselectNote();
        state.selectedNoteId = noteId;
        
        const card = document.getElementById(noteId);
        if (card) {
            card.classList.add('selected');
        }
    }

    function deselectNote() {
        if (state.selectedNoteId) {
            const card = document.getElementById(state.selectedNoteId);
            if (card) {
                card.classList.remove('selected');
            }
            state.selectedNoteId = null;
        }
    }

    // --- Connections (Edges) Management ---
    
    function getPortCoords(noteId, portName) {
        const note = state.notes.find(n => n.id === noteId);
        if (!note) return { x: 0, y: 0 };
        
        const w = note.width;
        const h = note.height;
        
        switch (portName) {
            case 'top':
                return { x: note.x + w / 2, y: note.y };
            case 'right':
                return { x: note.x + w, y: note.y + h / 2 };
            case 'bottom':
                return { x: note.x + w / 2, y: note.y + h };
            case 'left':
                return { x: note.x, y: note.y + h / 2 };
            default:
                return { x: note.x + w / 2, y: note.y + h / 2 };
        }
    }

    function getBezierPath(x1, y1, fromPort, x2, y2, toPort) {
        // Control offset dynamically adjusted based on distance
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const offset = Math.max(40, Math.min(180, dist * 0.45));
        
        let dx1 = 0, dy1 = 0;
        let dx2 = 0, dy2 = 0;

        switch (fromPort) {
            case 'right': dx1 = offset; break;
            case 'left': dx1 = -offset; break;
            case 'bottom': dy1 = offset; break;
            case 'top': dy1 = -offset; break;
        }

        switch (toPort) {
            case 'right': dx2 = offset; break;
            case 'left': dx2 = -offset; break;
            case 'bottom': dy2 = offset; break;
            case 'top': dy2 = -offset; break;
        }

        return `M ${x1} ${y1} C ${x1 + dx1} ${y1 + dy1}, ${x2 + dx2} ${y2 + dy2}, ${x2} ${y2}`;
    }

    function calculateBezierMidpoint(x1, y1, fromPort, x2, y2, toPort) {
        // Cubic bezier mid point formula at t = 0.5
        // B(t) = (1-t)^3 * P0 + 3*(1-t)^2*t * P1 + 3*(1-t)*t^2 * P2 + t^3 * P3
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const offset = Math.max(40, Math.min(180, dist * 0.45));
        
        let dx1 = 0, dy1 = 0;
        let dx2 = 0, dy2 = 0;

        switch (fromPort) {
            case 'right': dx1 = offset; break;
            case 'left': dx1 = -offset; break;
            case 'bottom': dy1 = offset; break;
            case 'top': dy1 = -offset; break;
        }

        switch (toPort) {
            case 'right': dx2 = offset; break;
            case 'left': dx2 = -offset; break;
            case 'bottom': dy2 = offset; break;
            case 'top': dy2 = -offset; break;
        }

        const p0 = { x: x1, y: y1 };
        const p1 = { x: x1 + dx1, y: y1 + dy1 };
        const p2 = { x: x2 + dx2, y: y2 + dy2 };
        const p3 = { x: x2, y: y2 };

        const t = 0.5;
        const mt = 1 - t;
        
        const mx = Math.pow(mt, 3) * p0.x + 3 * Math.pow(mt, 2) * t * p1.x + 3 * mt * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
        const my = Math.pow(mt, 3) * p0.y + 3 * Math.pow(mt, 2) * t * p1.y + 3 * mt * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;

        return { x: mx, y: my };
    }

    function renderConnections() {
        edgesGroup.innerHTML = '';
        
        state.connections.forEach(conn => {
            const p1 = getPortCoords(conn.fromId, conn.fromPort);
            const p2 = getPortCoords(conn.toId, conn.toPort);
            
            const pathData = getBezierPath(p1.x, p1.y, conn.fromPort, p2.x, p2.y, conn.toPort);
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('id', conn.id);
            path.setAttribute('d', pathData);
            path.setAttribute('class', `edge-path ${state.selectedConnectionId === conn.id ? 'selected' : ''}`);
            
            // Hover/Click interactivity
            path.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                selectConnection(conn.id);
            });
            
            edgesGroup.appendChild(path);
        });

        // Update active connection delete button if one is selected
        if (state.selectedConnectionId) {
            updateConnectionDeletePosition(state.selectedConnectionId);
            updateConnectionHandlesPosition(state.selectedConnectionId);
        }
    }

    // Interactive Drawing Line
    function startDrawingConnection(fromNoteId, fromPort, e) {
        deselectNote();
        deselectConnection();

        const p1 = getPortCoords(fromNoteId, fromPort);

        drawingConnection = {
            fromId: fromNoteId,
            fromPort: fromPort,
            startX: p1.x,
            startY: p1.y
        };

        guideline.style.display = 'block';
        guideline.setAttribute('d', `M ${p1.x} ${p1.y} L ${p1.x} ${p1.y}`);
        
        document.body.classList.add('drawing-connection');
        
        document.addEventListener('mousemove', drawConnectionGuide);
        document.addEventListener('mouseup', completeConnection);
    }

    function drawConnectionGuide(e) {
        if (!drawingConnection) return;

        // Mouse relative to canvas
        const mouseX = (e.clientX - state.panX) / state.zoom;
        const mouseY = (e.clientY - state.panY) / state.zoom;

        const pathData = getBezierPath(
            drawingConnection.startX, 
            drawingConnection.startY, 
            drawingConnection.fromPort, 
            mouseX, 
            mouseY, 
            getOppositePort(drawingConnection.fromPort)
        );

        guideline.setAttribute('d', pathData);

        // Hover effect on candidate target notes
        highlightTargetNoteCandidate(mouseX, mouseY);
    }

    function highlightTargetNoteCandidate(mouseX, mouseY) {
        state.notes.forEach(note => {
            const card = document.getElementById(note.id);
            if (!card || note.id === drawingConnection.fromId) return;

            const isInside = mouseX >= note.x && mouseX <= note.x + note.width &&
                             mouseY >= note.y && mouseY <= note.y + note.height;

            if (isInside) {
                card.classList.add('highlight-candidate');
            } else {
                card.classList.remove('highlight-candidate');
            }
        });
    }

    function completeConnection(e) {
        if (!drawingConnection) return;

        document.removeEventListener('mousemove', drawConnectionGuide);
        document.removeEventListener('mouseup', completeConnection);
        document.body.classList.remove('drawing-connection');
        guideline.style.display = 'none';

        // Find candidate note under cursor
        const mouseX = (e.clientX - state.panX) / state.zoom;
        const mouseY = (e.clientY - state.panY) / state.zoom;

        let targetNote = null;
        state.notes.forEach(note => {
            if (note.id === drawingConnection.fromId) return;
            
            // Visual feedback cleanup
            const card = document.getElementById(note.id);
            if (card) card.classList.remove('highlight-candidate');

            const isInside = mouseX >= note.x && mouseX <= note.x + note.width &&
                             mouseY >= note.y && mouseY <= note.y + note.height;
            
            if (isInside) {
                targetNote = note;
            }
        });

        // Also check if clicked directly on target port
        const targetPortEl = document.elementFromPoint(e.clientX, e.clientY);
        let finalTargetPort = null;
        let finalTargetId = null;

        if (targetPortEl && targetPortEl.classList.contains('connector-port')) {
            const card = targetPortEl.closest('.note-card');
            if (card && card.id !== drawingConnection.fromId) {
                finalTargetId = card.id;
                finalTargetPort = targetPortEl.dataset.port;
            }
        }

        // If dropped on note (but not precise port), calculate closest port
        if (targetNote && !finalTargetPort) {
            finalTargetId = targetNote.id;
            
            const ports = ['top', 'right', 'bottom', 'left'];
            let minDist = Infinity;
            
            ports.forEach(p => {
                const portCoords = getPortCoords(targetNote.id, p);
                const d = Math.hypot(mouseX - portCoords.x, mouseY - portCoords.y);
                if (d < minDist) {
                    minDist = d;
                    finalTargetPort = p;
                }
            });
        }

        if (finalTargetId && finalTargetPort) {
            // Check if connection already exists
            const duplicate = state.connections.find(c => 
                (c.fromId === drawingConnection.fromId && c.fromPort === drawingConnection.fromPort && 
                 c.toId === finalTargetId && c.toPort === finalTargetPort) ||
                (c.fromId === finalTargetId && c.fromPort === finalTargetPort && 
                 c.toId === drawingConnection.fromId && c.toPort === drawingConnection.fromPort)
            );

            if (!duplicate) {
                const connId = 'conn_' + Math.random().toString(36).substr(2, 9);
                state.connections.push({
                    id: connId,
                    fromId: drawingConnection.fromId,
                    fromPort: drawingConnection.fromPort,
                    toId: finalTargetId,
                    toPort: finalTargetPort
                });
                
                renderConnections();
                pushHistory();
            }
        }

        drawingConnection = null;
    }

    function getOppositePort(port) {
        switch (port) {
            case 'top': return 'bottom';
            case 'bottom': return 'top';
            case 'left': return 'right';
            case 'right': return 'left';
            default: return 'left';
        }
    }

    function selectConnection(connId) {
        deselectNote();
        
        const isAlreadySelected = state.selectedConnectionId === connId;

        if (!isAlreadySelected) {
            deselectConnection();
            state.selectedConnectionId = connId;

            const path = document.getElementById(connId);
            if (path) {
                path.classList.add('selected');
            }
        }

        updateConnectionDeletePosition(connId);
        updateConnectionHandlesPosition(connId);
    }

    function deselectConnection() {
        if (state.selectedConnectionId) {
            const path = document.getElementById(state.selectedConnectionId);
            if (path) {
                path.classList.remove('selected');
            }
            state.selectedConnectionId = null;
        }
        edgeDeleteWrapper.style.display = 'none';
        if (connHandleStart) connHandleStart.style.display = 'none';
        if (connHandleEnd) connHandleEnd.style.display = 'none';
    }

    function updateConnectionDeletePosition(connId) {
        const conn = state.connections.find(c => c.id === connId);
        if (!conn) return;

        const p1 = getPortCoords(conn.fromId, conn.fromPort);
        const p2 = getPortCoords(conn.toId, conn.toPort);

        // Find midpoint
        const mid = calculateBezierMidpoint(p1.x, p1.y, conn.fromPort, p2.x, p2.y, conn.toPort);

        edgeDeleteWrapper.style.left = `${mid.x}px`;
        edgeDeleteWrapper.style.top = `${mid.y}px`;
        edgeDeleteWrapper.style.display = 'block';
    }

    function updateConnectionHandlesPosition(connId) {
        const conn = state.connections.find(c => c.id === connId);
        if (!conn || !connHandleStart || !connHandleEnd) return;

        const p1 = getPortCoords(conn.fromId, conn.fromPort);
        const p2 = getPortCoords(conn.toId, conn.toPort);

        connHandleStart.style.left = `${p1.x}px`;
        connHandleStart.style.top = `${p1.y}px`;
        connHandleStart.style.display = 'block';

        connHandleEnd.style.left = `${p2.x}px`;
        connHandleEnd.style.top = `${p2.y}px`;
        connHandleEnd.style.display = 'block';
    }

    function deleteConnection(connId) {
        state.connections = state.connections.filter(c => c.id !== connId);
        deselectConnection();
        renderConnections();
        pushHistory();
    }

    function startReconnectingConnection(connId, handleType, e) {
        const conn = state.connections.find(c => c.id === connId);
        if (!conn) return;

        // Hide handles and faint original connection
        connHandleStart.style.display = 'none';
        connHandleEnd.style.display = 'none';
        edgeDeleteWrapper.style.display = 'none';
        
        const pathEl = document.getElementById(connId);
        if (pathEl) {
            pathEl.style.opacity = '0.15';
        }

        let fixedNodeId, fixedPort;
        if (handleType === 'start') {
            fixedNodeId = conn.toId;
            fixedPort = conn.toPort;
        } else {
            fixedNodeId = conn.fromId;
            fixedPort = conn.fromPort;
        }

        const fixedCoords = getPortCoords(fixedNodeId, fixedPort);

        reconnectingEdge = {
            connectionId: connId,
            handleType: handleType,
            fixedNodeId: fixedNodeId,
            fixedPort: fixedPort,
            fixedX: fixedCoords.x,
            fixedY: fixedCoords.y
        };

        guideline.style.display = 'block';
        
        const mouseX = (e.clientX - state.panX) / state.zoom;
        const mouseY = (e.clientY - state.panY) / state.zoom;
        
        updateReconnectGuide(mouseX, mouseY);

        document.body.classList.add('drawing-connection');
        
        document.addEventListener('mousemove', drawReconnectGuide);
        document.addEventListener('mouseup', completeReconnectingConnection);
    }

    function drawReconnectGuide(e) {
        if (!reconnectingEdge) return;

        const mouseX = (e.clientX - state.panX) / state.zoom;
        const mouseY = (e.clientY - state.panY) / state.zoom;

        updateReconnectGuide(mouseX, mouseY);

        // Highlight candidate notes
        state.notes.forEach(note => {
            const card = document.getElementById(note.id);
            if (!card || note.id === reconnectingEdge.fixedNodeId) return;

            const isInside = mouseX >= note.x && mouseX <= note.x + note.width &&
                             mouseY >= note.y && mouseY <= note.y + note.height;

            if (isInside) {
                card.classList.add('highlight-candidate');
            } else {
                card.classList.remove('highlight-candidate');
            }
        });
    }

    function updateReconnectGuide(mouseX, mouseY) {
        let pathData;
        const f = reconnectingEdge;
        
        if (f.handleType === 'start') {
            pathData = getBezierPath(mouseX, mouseY, getOppositePort(f.fixedPort), f.fixedX, f.fixedY, f.fixedPort);
        } else {
            pathData = getBezierPath(f.fixedX, f.fixedY, f.fixedPort, mouseX, mouseY, getOppositePort(f.fixedPort));
        }
        
        guideline.setAttribute('d', pathData);
    }

    function completeReconnectingConnection(e) {
        if (!reconnectingEdge) return;

        document.removeEventListener('mousemove', drawReconnectGuide);
        document.removeEventListener('mouseup', completeReconnectingConnection);
        document.body.classList.remove('drawing-connection');
        guideline.style.display = 'none';

        const pathEl = document.getElementById(reconnectingEdge.connectionId);
        if (pathEl) {
            pathEl.style.opacity = '';
        }

        const mouseX = (e.clientX - state.panX) / state.zoom;
        const mouseY = (e.clientY - state.panY) / state.zoom;

        let targetNote = null;
        state.notes.forEach(note => {
            if (note.id === reconnectingEdge.fixedNodeId) return;
            
            const card = document.getElementById(note.id);
            if (card) card.classList.remove('highlight-candidate');

            const isInside = mouseX >= note.x && mouseX <= note.x + note.width &&
                             mouseY >= note.y && mouseY <= note.y + note.height;
            
            if (isInside) {
                targetNote = note;
            }
        });

        // Precision port check
        const targetPortEl = document.elementFromPoint(e.clientX, e.clientY);
        let finalTargetPort = null;
        let finalTargetId = null;

        if (targetPortEl && targetPortEl.classList.contains('connector-port')) {
            const card = targetPortEl.closest('.note-card');
            if (card && card.id !== reconnectingEdge.fixedNodeId) {
                finalTargetId = card.id;
                finalTargetPort = targetPortEl.dataset.port;
            }
        }

        if (targetNote && !finalTargetPort) {
            finalTargetId = targetNote.id;
            const ports = ['top', 'right', 'bottom', 'left'];
            let minDist = Infinity;
            
            ports.forEach(p => {
                const portCoords = getPortCoords(targetNote.id, p);
                const d = Math.hypot(mouseX - portCoords.x, mouseY - portCoords.y);
                if (d < minDist) {
                    minDist = d;
                    finalTargetPort = p;
                }
            });
        }

        if (finalTargetId && finalTargetPort) {
            const conn = state.connections.find(c => c.id === reconnectingEdge.connectionId);
            if (conn) {
                if (reconnectingEdge.handleType === 'start') {
                    conn.fromId = finalTargetId;
                    conn.fromPort = finalTargetPort;
                } else {
                    conn.toId = finalTargetId;
                    conn.toPort = finalTargetPort;
                }

                const isDuplicate = state.connections.some(c => 
                    c.id !== conn.id && 
                    ((c.fromId === conn.fromId && c.fromPort === conn.fromPort && c.toId === conn.toId && c.toPort === conn.toPort) ||
                     (c.fromId === conn.toId && c.fromPort === conn.toPort && c.toId === conn.fromId && c.toPort === conn.fromPort))
                );

                if (isDuplicate) {
                    state.connections = state.connections.filter(c => c.id !== conn.id);
                    deselectConnection();
                } else {
                    renderConnections();
                    selectConnection(conn.id);
                }
                pushHistory();
            }
        } else {
            selectConnection(reconnectingEdge.connectionId);
        }

        reconnectingEdge = null;
    }


    // --- Search Features ---
    let searchMatches = [];
    let currentSearchIndex = -1;

    function performSearch(query) {
        // Remove highlights
        document.querySelectorAll('.note-card.highlighted').forEach(el => el.classList.remove('highlighted'));
        searchResultsCount.textContent = '';
        searchMatches = [];
        currentSearchIndex = -1;

        if (!query.trim()) {
            searchClearBtn.style.display = 'none';
            return;
        }

        searchClearBtn.style.display = 'block';
        const q = query.toLowerCase();

        state.notes.forEach(note => {
            if (note.text.toLowerCase().includes(q)) {
                searchMatches.push(note);
                const el = document.getElementById(note.id);
                if (el) el.classList.add('highlighted');
            }
        });

        if (searchMatches.length > 0) {
            searchResultsCount.textContent = `${searchMatches.length}개 발견`;
            currentSearchIndex = 0;
            focusOnNote(searchMatches[0].id);
        } else {
            searchResultsCount.textContent = '일치 없음';
        }
    }

    function focusOnNote(noteId) {
        const note = state.notes.find(n => n.id === noteId);
        if (!note) return;

        selectNote(noteId);

        // Smoothly pan & zoom to center the note
        const noteCenterX = note.x + note.width / 2;
        const noteCenterY = note.y + note.height / 2;

        const targetPanX = viewportWidth / 2 - noteCenterX;
        const targetPanY = viewportHeight / 2 - noteCenterY;

        animateViewport(targetPanX, targetPanY, 1.1);
    }

    // --- Sidebar actions ---
    function toggleSnapGrid() {
        state.snapGrid = !state.snapGrid;
        updateSnapGridUI();
        saveState();
    }

    function updateSnapGridUI() {
        if (state.snapGrid) {
            snapGridBtn.classList.add('active');
        } else {
            snapGridBtn.classList.remove('active');
        }
    }

    // --- Export / Import ---
    function exportJSON() {
        const cleanState = {
            notes: state.notes,
            connections: state.connections
        };

        const jsonStr = JSON.stringify(cleanState, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `mindflow-brainstorm-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    function importJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.notes || !data.connections) {
                throw new Error("올바른 MindFlow 파일 형식이 아닙니다.");
            }

            state.notes = data.notes;
            state.connections = data.connections;

            // Clear active UI and DOM elements
            notesLayer.innerHTML = '';
            deselectNote();
            deselectConnection();

            // Re-render
            state.notes.forEach(note => createNoteDOM(note));

            setTimeout(() => {
                state.notes.forEach(note => updateNoteDimensions(note.id));
                renderConnections();
                centerCanvasOnContent();
                pushHistory();
            }, 100);

            closeModal(importModal);
            return true;
        } catch (e) {
            importError.textContent = `가져오기 실패: ${e.message}`;
            return false;
        }
    }

    // --- Modal Management ---
    function openModal(modal) {
        modal.classList.add('active');
        if (modal === importModal) {
            importTextarea.value = '';
            importError.textContent = '';
            fileUploadInput.value = '';
            fileNameDisplay.textContent = '선택된 파일 없음';
        }
    }

    function closeModal(modal) {
        modal.classList.remove('active');
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // Window Resize
        window.addEventListener('resize', () => {
            viewportWidth = window.innerWidth;
            viewportHeight = window.innerHeight;
        });

        // Canvas Zoom via Scroll Wheel
        canvasContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = 1.1;
            if (e.deltaY < 0) {
                handleZoom(zoomFactor, e.clientX, e.clientY);
            } else {
                handleZoom(1 / zoomFactor, e.clientX, e.clientY);
            }
            
            // Hide canvas hints on zoom/pan interaction
            canvasHint.classList.add('fade-out');
        }, { passive: false });

        // Canvas Panning dragging variables
        let isPanning = false;
        let startPanX, startPanY;
        let startMouseX, startMouseY;

        canvasContainer.addEventListener('mousedown', (e) => {
            // Deselect selected items when clicking empty canvas
            if (e.target === canvasContainer || e.target === canvas || e.target === svgLayer) {
                deselectNote();
                deselectConnection();
            }

            // Pan trigger keys: Right click, Wheel click, or Spacebar + Left click
            const isRightClick = e.button === 2;
            const isMiddleClick = e.button === 1;
            const isSpaceLeftClick = e.button === 0 && e.shiftKey; // Also allow shift key or space key

            if (isRightClick || isMiddleClick || isSpaceLeftClick || (e.button === 0 && spaceBarPressed)) {
                e.preventDefault();
                isPanning = true;
                startPanX = state.panX;
                startPanY = state.panY;
                startMouseX = e.clientX;
                startMouseY = e.clientY;

                document.addEventListener('mousemove', panCanvas);
                document.addEventListener('mouseup', stopPanCanvas);
            }
        });

        function panCanvas(e) {
            if (!isPanning) return;
            const dx = e.clientX - startMouseX;
            const dy = e.clientY - startMouseY;

            state.panX = startPanX + dx;
            state.panY = startPanY + dy;

            updateCanvasTransform();
            
            // Hide hint
            canvasHint.classList.add('fade-out');
        }

        function stopPanCanvas(e) {
            if (isPanning) {
                isPanning = false;
                document.removeEventListener('mousemove', panCanvas);
                document.removeEventListener('mouseup', stopPanCanvas);
                saveState();
            }
        }

        // Prevent context menu to allow Right Click Pan
        canvasContainer.addEventListener('contextmenu', e => e.preventDefault());

        // Double click empty canvas to add note
        canvasContainer.addEventListener('dblclick', (e) => {
            if (e.target === canvasContainer || e.target === canvas || e.target === svgLayer) {
                // Convert mouse position to canvas virtual coordinates
                const x = (e.clientX - state.panX) / state.zoom;
                const y = (e.clientY - state.panY) / state.zoom;
                
                // Subtract half width/height to center the new note on double click
                createNote(
                    Math.max(0, Math.min(CANVAS_SIZE, x - DEFAULT_NOTE_WIDTH / 2)),
                    Math.max(0, Math.min(CANVAS_SIZE, y - DEFAULT_NOTE_HEIGHT / 2))
                );
            }
        });

        // Edge Delete button event
        edgeDeleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (state.selectedConnectionId) {
                deleteConnection(state.selectedConnectionId);
            }
        });

        // Keyboard Shortcuts
        let spaceBarPressed = false;

        document.addEventListener('keydown', (e) => {
            const isInputFocused = document.activeElement.tagName === 'TEXTAREA' || 
                                   document.activeElement.tagName === 'INPUT';

            // Global Spacebar tracker for Pan
            if (e.code === 'Space' && !isInputFocused) {
                spaceBarPressed = true;
                canvasContainer.style.cursor = 'grab';
            }

            if (isInputFocused) return;

            // N: Add new note in center of screen
            if (e.key.toLowerCase() === 'n') {
                const screenCenterX = viewportWidth / 2;
                const screenCenterY = viewportHeight / 2;
                
                const canvasX = (screenCenterX - state.panX) / state.zoom;
                const canvasY = (screenCenterY - state.panY) / state.zoom;
                
                createNote(
                    Math.max(0, Math.min(CANVAS_SIZE, canvasX - DEFAULT_NOTE_WIDTH / 2)),
                    Math.max(0, Math.min(CANVAS_SIZE, canvasY - DEFAULT_NOTE_HEIGHT / 2))
                );
            }

            // G: Toggle Grid Snapping
            if (e.key.toLowerCase() === 'g') {
                toggleSnapGrid();
            }

            // Ctrl + Z: Undo
            if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            }

            // Ctrl + Y: Redo
            if (e.ctrlKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            }

            // Ctrl + F: Search Focus
            if (e.ctrlKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }

            // Delete / Backspace: Delete selected note or connection
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (state.selectedNoteId) {
                    deleteNote(state.selectedNoteId);
                } else if (state.selectedConnectionId) {
                    deleteConnection(state.selectedConnectionId);
                }
            }

            // Esc: Deselect or Close modal
            if (e.key === 'Escape') {
                deselectNote();
                deselectConnection();
                
                // Close active modals
                document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m));
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                spaceBarPressed = false;
                canvasContainer.style.cursor = '';
            }
        });

        // Zoom Panel clicks
        zoomInBtn.addEventListener('click', () => handleZoom(1.2, viewportWidth / 2, viewportHeight / 2));
        zoomOutBtn.addEventListener('click', () => handleZoom(1 / 1.2, viewportWidth / 2, viewportHeight / 2));
        zoomResetBtn.addEventListener('click', () => centerCanvasOnContent());

        // Header Actions
        undoBtn.addEventListener('click', undo);
        redoBtn.addEventListener('click', redo);
        exportBtn.addEventListener('click', exportJSON);
        importBtn.addEventListener('click', () => openModal(importModal));
        
        clearAllBtn.addEventListener('click', () => {
            if (confirm("정말로 모든 메모와 연결선을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                notesLayer.innerHTML = '';
                state.notes = [];
                state.connections = [];
                deselectNote();
                deselectConnection();
                renderConnections();
                pushHistory();
            }
        });

        // Help Modal Events
        helpBtn.addEventListener('click', () => openModal(helpModal));
        helpCloseBtn.addEventListener('click', () => closeModal(helpModal));
        helpConfirmBtn.addEventListener('click', () => closeModal(helpModal));
        
        // Import Modal Events
        importCloseBtn.addEventListener('click', () => closeModal(importModal));
        importCancelBtn.addEventListener('click', () => closeModal(importModal));
        
        importSubmitBtn.addEventListener('click', () => {
            const data = importTextarea.value.trim();
            if (data) {
                importJSON(data);
            } else {
                importError.textContent = "가져올 JSON 데이터를 입력하세요.";
            }
        });

        // File upload trigger
        fileUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            fileNameDisplay.textContent = file.name;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                importTextarea.value = event.target.result;
            };
            reader.readAsText(file);
        });

        // Search Input Events
        searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });

        searchClearBtn.addEventListener('click', () => {
            searchInput.value = '';
            performSearch('');
            searchInput.focus();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && searchMatches.length > 0) {
                // Cycle search results
                currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
                focusOnNote(searchMatches[currentSearchIndex].id);
            }
        });

        // Sidebar Add Note Button click
        addNoteBtn.addEventListener('click', () => {
            const screenCenterX = viewportWidth / 2;
            const screenCenterY = viewportHeight / 2;
            
            const canvasX = (screenCenterX - state.panX) / state.zoom;
            const canvasY = (screenCenterY - state.panY) / state.zoom;
            
            createNote(
                Math.max(0, Math.min(CANVAS_SIZE, canvasX - DEFAULT_NOTE_WIDTH / 2)),
                Math.max(0, Math.min(CANVAS_SIZE, canvasY - DEFAULT_NOTE_HEIGHT / 2))
            );
        });

        snapGridBtn.addEventListener('click', toggleSnapGrid);
    }

    // Run app on load
    window.addEventListener('DOMContentLoaded', init);

})();
