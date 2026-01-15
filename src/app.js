/**
 * Day 2 Main Application - MVC Implementation
 * * Orchestrates semua komponen:
 * - Storage Manager
 * - Repositories
 * - Controllers
 * - Views
 * - User Authentication
 */

// Global application state
let app = {
    storage: null,
    userRepository: null,
    taskRepository: null,
    userController: null,
    taskController: null,
    taskView: null,
    currentUser: null
};

/**
 * Initialize aplikasi
 */
function initializeApp() {
    console.log('🚀 Initializing Day 2 Task Management System...');
    
    try {
        // 1. Initialize storage manager
        // Pastikan class EnhancedStorageManager sudah ada di utils
        app.storage = new EnhancedStorageManager('taskAppDay2', '2.0');
        console.log('✅ Storage manager initialized');
        
        // 2. Initialize repositories
        app.userRepository = new UserRepository(app.storage);
        app.taskRepository = new TaskRepository(app.storage);
        console.log('✅ Repositories initialized');
        
        // 3. Initialize controllers
        app.userController = new UserController(app.userRepository);
        app.taskController = new TaskController(app.taskRepository, app.userRepository);
        console.log('✅ Controllers initialized');
        
        // 4. Initialize view
        // View akan menangani rendering DOM, bukan app.js secara langsung
        app.taskView = new TaskView(app.taskController, app.userController);
        console.log('✅ Views initialized');
        
        // 5. Setup event listeners (Auth, UI, Filters)
        setupEventListeners();
        
        // 6. Create demo user jika belum ada (Helper untuk testing)
        createDemoUserIfNeeded();
        
        // 7. Check session / Show login
        const savedUser = app.storage.load('currentUser', null);
        if (savedUser) {
            // Auto login jika ada session tersimpan (opsional feature)
            app.currentUser = savedUser;
            app.taskController.setCurrentUser(savedUser.id);
            showMainContent();
            app.taskView.refresh(); // Render tasks & stats via View
        } else {
            showLoginSection();
        }
        
        console.log('✅ Day 2 Application initialized successfully!');
        
    } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        alert('Gagal menginisialisasi aplikasi: ' + error.message);
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // --- Auth Listeners ---
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) registerBtn.addEventListener('click', showRegisterModal);
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    
    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    
    const registerForm = document.getElementById('registerForm');
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    
    const closeRegisterModal = document.getElementById('closeRegisterModal');
    const cancelRegister = document.getElementById('cancelRegister');
    if (closeRegisterModal) closeRegisterModal.addEventListener('click', hideRegisterModal);
    if (cancelRegister) cancelRegister.addEventListener('click', hideRegisterModal);
    
    // --- Quick Action Listeners ---
    const showOverdueBtn = document.getElementById('showOverdueBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const refreshTasks = document.getElementById('refreshTasks');
    const clearAllTasks = document.getElementById('clearAllTasks');
    
    if (showOverdueBtn) showOverdueBtn.addEventListener('click', () => {
        // Gunakan View untuk mengatur filter, bukan manual DOM di sini
        document.querySelector('.filter-btn[data-filter="all"]').classList.remove('active');
        app.taskView.filterTasks({ overdue: true });
        showMessage('Menampilkan task yang overdue', 'warning');
    });

    if (exportDataBtn) exportDataBtn.addEventListener('click', exportAppData);
    if (refreshTasks) refreshTasks.addEventListener('click', () => app.taskView.refresh());
    
    if (clearAllTasks) {
        clearAllTasks.addEventListener('click', () => {
            if(confirm('Apakah Anda yakin ingin menghapus SEMUA task?')) {
                // Di real app, controller harus punya method deleteAll, 
                // tapi di sini kita bisa loop delete atau clear storage key
                // Untuk keamanan, kita skip implementasi delete all massal via controller saat ini
                app.taskView.refresh();
            }
        });
    }

    // --- Search & Sort Listeners ---
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        // Debounce search
        let timeout = null;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                app.taskView.handleSearch(e.target.value);
            }, 300);
        });
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            const [sortBy, order] = e.target.value.split('-');
            app.taskView.handleSort(sortBy, order);
        });
    }

    // --- Filter Listeners (Status & Priority) ---
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update UI Active State
            filterButtons.forEach(b => b.classList.remove('active'));
            // Reset category buttons juga biar tidak bingung
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            
            e.target.classList.add('active');
            
            const filterValue = e.target.dataset.filter;
            
            // Logic mapping filter
            if (filterValue === 'all') {
                app.taskView.clearFilters();
            } else if (['urgent', 'high', 'medium', 'low'].includes(filterValue)) {
                app.taskView.filterTasks({ priority: filterValue });
            } else {
                app.taskView.filterTasks({ status: filterValue });
            }
        });
    });

    // --- NEW: Category Listeners ---
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Update UI Active State
            categoryButtons.forEach(b => b.classList.remove('active'));
            // Reset filter buttons standard
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            
            e.target.classList.add('active');
            
            const category = e.target.dataset.category;
            // Delegate ke View untuk filter by category
            app.taskView.filterTasks({ category: category });
        });
    });
}

/**
 * Handle user login
 */
function handleLogin() {
    const usernameInput = document.getElementById('usernameInput');
    const username = usernameInput.value.trim();
    
    if (!username) {
        showMessage('Username wajib diisi', 'error');
        return;
    }
    
    const response = app.userController.login(username);
    
    if (response.success) {
        app.currentUser = response.data;
        app.storage.save('currentUser', app.currentUser); // Persist session simple
        
        // Set current user di task controller
        app.taskController.setCurrentUser(app.currentUser.id);
        
        // Show main content
        showMainContent();
        
        // Load user list untuk assign dropdown di Form
        loadUserListForAssign();
        
        // Refresh views (Load tasks & Stats)
        app.taskView.refresh();
        
        showMessage(response.message, 'success');
    } else {
        showMessage(response.error, 'error');
    }
}

/**
 * Handle user logout
 */
function handleLogout() {
    const response = app.userController.logout();
    
    app.currentUser = null;
    app.storage.remove('currentUser');
    
    hideMainContent();
    showLoginSection();
    
    showMessage(response.message, 'info');
}

/**
 * Show/Hide Register Modal
 */
function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) modal.style.display = 'flex';
}

function hideRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('registerForm');
    if (form) form.reset();
}

/**
 * Handle user registration
 */
function handleRegister(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const userData = {
        username: formData.get('username')?.trim(),
        email: formData.get('email')?.trim(),
        fullName: formData.get('fullName')?.trim()
    };
    
    const response = app.userController.register(userData);
    
    if (response.success) {
        hideRegisterModal();
        showMessage(response.message, 'success');
        
        const usernameInput = document.getElementById('usernameInput');
        if (usernameInput) usernameInput.value = userData.username;
    } else {
        showMessage(response.error, 'error');
    }
}

/**
 * UI State Management
 */
function showLoginSection() {
    const loginSection = document.getElementById('loginSection');
    const userInfo = document.getElementById('userInfo');
    const mainContent = document.getElementById('mainContent');
    
    if (loginSection) loginSection.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    
    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) {
        usernameInput.value = '';
        usernameInput.focus();
    }
}

function showMainContent() {
    const loginSection = document.getElementById('loginSection');
    const userInfo = document.getElementById('userInfo');
    const mainContent = document.getElementById('mainContent');
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    if (loginSection) loginSection.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'block';
    
    if (welcomeMessage && app.currentUser) {
        welcomeMessage.textContent = `Hai, ${app.currentUser.fullName || app.currentUser.username}!`;
    }
}

function hideMainContent() {
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.style.display = 'none';
}

/**
 * Load users into assign dropdown
 */
function loadUserListForAssign() {
    const response = app.userController.getAllUsers();
    
    if (response.success) {
        const assigneeSelect = document.getElementById('taskAssignee');
        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="self">Diri Sendiri</option>';
            response.data.forEach(user => {
                if (user.id !== app.currentUser.id) {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = user.fullName || user.username;
                    assigneeSelect.appendChild(option);
                }
            });
        }
    }
}

/**
 * Export app data
 */
function exportAppData() {
    // Menggunakan storage manager langsung
    const exportData = app.storage.exportData();
    
    if (exportData) {
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `task-app-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        showMessage('Data berhasil diekspor', 'success');
    } else {
        showMessage('Gagal mengekspor data', 'error');
    }
}

/**
 * Helper: Create demo users
 */
function createDemoUserIfNeeded() {
    // Cek langsung ke storage agar tidak perlu init controller dulu
    const users = app.storage.load('users', []);
    
    if (users.length === 0) {
        try {
            app.userRepository.create({ username: 'demo', email: 'demo@example.com', fullName: 'Demo User' });
            app.userRepository.create({ username: 'budi', email: 'budi@kantor.com', fullName: 'Budi Santoso' });
            console.log('✅ Demo users created');
        } catch (error) {
            console.error('Failed to create demo users:', error);
        }
    }
}

/**
 * Show global toast message
 * (Delegates to View if initialized, else logs)
 */
function showMessage(message, type = 'info') {
    if (app.taskView) {
        app.taskView.showMessage(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
        alert(message);
    }
}

// Error Handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Export for debugging/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { app, initializeApp };
} else {
    window.app = app; // Expose to window for debugging
}// Bug fix
