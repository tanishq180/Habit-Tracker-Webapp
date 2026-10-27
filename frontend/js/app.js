/**
 * Orbit • Habit & Task Mastery
 * Interactive Frontend Client
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // Clean Audio No-Ops (SFX Disabled)
    // ==========================================
    const playTone = () => {};
    const playCoinSound = () => {};
    const playBlipSound = () => {};
    const playFanfareSound = () => {};
    const playDeleteSound = () => {};

    // Floating Pixel EXP Animation (+100 EXP!)
    function showFloatingExp(x, y, text = '+100 EXP! ⚡') {
        const el = document.createElement('div');
        el.className = 'floating-pixel-exp';
        el.textContent = text;
        const posX = x || (window.innerWidth / 2);
        const posY = y || (window.innerHeight / 2);
        el.style.left = `${posX}px`;
        el.style.top = `${posY}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 950);
    }

    // Application State
    let categories = [];
    let tasks = [];
    let stats = {};
    let selectedCategoryId = 'all';
    let currentStatus = 'all';
    let searchQuery = '';
    let selectedPriority = 'low';
    let selectedDeadline = '';
    let selectedCategoryColor = '#39ff14';

    // DOM Elements
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const headerDateText = document.getElementById('headerDateText');
    const statRadialBar = document.getElementById('statRadialBar');
    const statPercent = document.getElementById('statPercent');
    const statSubtext = document.getElementById('statSubtext');
    const statCompleted = document.getElementById('statCompleted');
    const statBestStreak = document.getElementById('statBestStreak');
    const statPending = document.getElementById('statPending');

    const taskInput = document.getElementById('taskInput');
    const taskCategorySelect = document.getElementById('taskCategorySelect');
    const categoryDropdownWrap = document.getElementById('categoryDropdownWrap');
    const categoryTriggerBtn = document.getElementById('categoryTriggerBtn');
    const categoryDropdownMenu = document.getElementById('categoryDropdownMenu');
    const categoryOptionsList = document.getElementById('categoryOptionsList');
    const categoryMenuAddBtn = document.getElementById('categoryMenuAddBtn');
    const categoryDot = document.getElementById('categoryDot');
    const selectedCategoryLabel = document.getElementById('selectedCategoryLabel');
    const priorityPills = document.querySelectorAll('.priority-pill');
    const addTaskBtn = document.getElementById('addTaskBtn');

    const categoryPillsList = document.getElementById('categoryPillsList');
    const searchInput = document.getElementById('searchInput');
    const statusTabs = document.getElementById('statusTabs');
    const tasksContainer = document.getElementById('tasksContainer');
    const emptyState = document.getElementById('emptyState');

    // Modals
    const openCategoryModalBtn = document.getElementById('openCategoryModalBtn');
    const categoryModal = document.getElementById('categoryModal');
    const closeCategoryModalBtn = document.getElementById('closeCategoryModalBtn');
    const cancelCategoryModalBtn = document.getElementById('cancelCategoryModalBtn');
    const saveCategoryModalBtn = document.getElementById('saveCategoryModalBtn');
    const newCategoryName = document.getElementById('newCategoryName');
    const colorSwatches = document.querySelectorAll('.color-swatch');

    const editTaskModal = document.getElementById('editTaskModal');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const cancelEditModalBtn = document.getElementById('cancelEditModalBtn');
    const saveEditModalBtn = document.getElementById('saveEditModalBtn');
    const editTaskId = document.getElementById('editTaskId');
    const editTaskText = document.getElementById('editTaskText');
    const editTaskCategory = document.getElementById('editTaskCategory');
    const editTaskPriority = document.getElementById('editTaskPriority');
    const editTaskDeadline = document.getElementById('editTaskDeadline');

    const toastContainer = document.getElementById('toastContainer');

    // Initialize Current Date
    const now = new Date();
    headerDateText.textContent = now.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    // Theme Handling
    const savedTheme = localStorage.getItem('orbit_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('orbit_theme', nextTheme);
    });

    // Color Swatches Selection for Category Creation
    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', () => {
            colorSwatches.forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            selectedCategoryColor = swatch.dataset.color;
        });
    });

    // Priority Pills Selection
    priorityPills.forEach(pill => {
        pill.addEventListener('click', () => {
            priorityPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedPriority = pill.dataset.priority;
        });
    });

    // Deadline Elements
    const deadlineWrap = document.getElementById('deadlineWrap');
    const deadlinePillGroup = document.getElementById('deadlinePillGroup');
    const deadlineTriggerBtn = document.getElementById('deadlineTriggerBtn');
    const deadlinePopover = document.getElementById('deadlinePopover');
    const deadlineText = document.getElementById('deadlineText');
    const clearDeadlineBtn = document.getElementById('clearDeadlineBtn');
    const taskDeadlineInput = document.getElementById('taskDeadlineInput');
    const cancelDeadlinePopover = document.getElementById('cancelDeadlinePopover');
    const applyDeadlinePopover = document.getElementById('applyDeadlinePopover');
    const popoverQuickClear = document.getElementById('popoverQuickClear');
    const deadlineRelativeHint = document.getElementById('deadlineRelativeHint');
    const presetChips = document.querySelectorAll('.preset-chip');

    // Deadline Formatting Helper
    function getLocalDatetimeString(date) {
        const pad = (n) => String(n).padStart(2, '0');
        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const h = pad(date.getHours());
        const min = pad(date.getMinutes());
        return `${y}-${m}-${d}T${h}:${min}`;
    }

    function updateRelativeHint(isoStr) {
        if (!deadlineRelativeHint) return;
        if (!isoStr) {
            deadlineRelativeHint.classList.add('hidden');
            deadlineRelativeHint.textContent = '';
            return;
        }
        const target = new Date(isoStr);
        if (isNaN(target.getTime())) return;
        const now = new Date();
        const diffMs = target - now;

        if (diffMs < 0) {
            deadlineRelativeHint.textContent = '⚠️ Selected time is in the past';
            deadlineRelativeHint.style.color = 'var(--rose)';
            deadlineRelativeHint.classList.remove('hidden');
            return;
        }

        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        let relText = '';
        if (diffHours < 1) {
            const diffMin = Math.max(1, Math.round(diffMs / (1000 * 60)));
            relText = `Due in ${diffMin} minute${diffMin === 1 ? '' : 's'}`;
        } else if (diffHours < 24) {
            relText = `Due in ~${diffHours} hour${diffHours === 1 ? '' : 's'}`;
        } else {
            const diffDays = Math.round(diffHours / 24);
            relText = `Due in ~${diffDays} day${diffDays === 1 ? '' : 's'}`;
        }
        deadlineRelativeHint.textContent = `⏱️ ${relText} (${formatFriendlyDeadline(isoStr)})`;
        deadlineRelativeHint.style.color = 'var(--primary)';
        deadlineRelativeHint.classList.remove('hidden');
    }

    function applyDeadline(isoStr, presetKey = '') {
        selectedDeadline = isoStr;
        taskDeadlineInput.value = isoStr;
        presetChips.forEach(chip => {
            chip.classList.toggle('active', !!presetKey && chip.dataset.preset === presetKey);
        });
        if (selectedDeadline) {
            deadlineText.textContent = formatFriendlyDeadline(selectedDeadline);
            if (deadlinePillGroup) deadlinePillGroup.classList.add('has-deadline');
            clearDeadlineBtn.classList.remove('hidden');
            if (popoverQuickClear) popoverQuickClear.classList.remove('hidden');
        } else {
            deadlineText.textContent = 'Set Deadline';
            if (deadlinePillGroup) deadlinePillGroup.classList.remove('has-deadline');
            clearDeadlineBtn.classList.add('hidden');
            if (popoverQuickClear) popoverQuickClear.classList.add('hidden');
        }
        updateRelativeHint(selectedDeadline);
        deadlinePopover.classList.add('hidden');
    }

    function clearDeadline() {
        selectedDeadline = '';
        taskDeadlineInput.value = '';
        deadlineText.textContent = 'Set Deadline';
        if (deadlinePillGroup) deadlinePillGroup.classList.remove('has-deadline');
        clearDeadlineBtn.classList.add('hidden');
        if (popoverQuickClear) popoverQuickClear.classList.add('hidden');
        if (deadlineRelativeHint) {
            deadlineRelativeHint.classList.add('hidden');
            deadlineRelativeHint.textContent = '';
        }
        presetChips.forEach(c => c.classList.remove('active'));
    }

    // Toggle Popover
    deadlineTriggerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpening = deadlinePopover.classList.contains('hidden');
        if (isOpening) {
            // Set min to current time
            taskDeadlineInput.min = getLocalDatetimeString(new Date());
            if (selectedDeadline) {
                taskDeadlineInput.value = selectedDeadline;
                updateRelativeHint(selectedDeadline);
                if (popoverQuickClear) popoverQuickClear.classList.remove('hidden');
            } else {
                taskDeadlineInput.value = '';
                if (deadlineRelativeHint) deadlineRelativeHint.classList.add('hidden');
                if (popoverQuickClear) popoverQuickClear.classList.add('hidden');
            }
        }
        if (categoryDropdownMenu) {
            categoryDropdownMenu.classList.add('hidden');
            if (categoryTriggerBtn) {
                categoryTriggerBtn.classList.remove('is-open');
                categoryTriggerBtn.setAttribute('aria-expanded', 'false');
            }
        }
        deadlinePopover.classList.toggle('hidden');
    });

    taskDeadlineInput.addEventListener('input', () => {
        updateRelativeHint(taskDeadlineInput.value);
    });

    cancelDeadlinePopover.addEventListener('click', () => {
        deadlinePopover.classList.add('hidden');
    });

    applyDeadlinePopover.addEventListener('click', () => {
        if (taskDeadlineInput.value) {
            applyDeadline(taskDeadlineInput.value);
        } else {
            clearDeadline();
            deadlinePopover.classList.add('hidden');
        }
    });

    if (popoverQuickClear) {
        popoverQuickClear.addEventListener('click', () => {
            clearDeadline();
            deadlinePopover.classList.add('hidden');
        });
    }

    // Preset Chips
    presetChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            const preset = chip.dataset.preset;
            const targetDate = new Date();

            if (preset === 'today-evening') {
                if (targetDate.getHours() >= 18) {
                    targetDate.setDate(targetDate.getDate() + 1);
                }
                targetDate.setHours(18, 0, 0, 0);
            } else if (preset === 'today-night') {
                if (targetDate.getHours() >= 22) {
                    targetDate.setDate(targetDate.getDate() + 1);
                }
                targetDate.setHours(22, 0, 0, 0);
            } else if (preset === 'tomorrow-morning') {
                targetDate.setDate(targetDate.getDate() + 1);
                targetDate.setHours(9, 0, 0, 0);
            } else if (preset === 'in-2-days') {
                targetDate.setDate(targetDate.getDate() + 2);
                targetDate.setHours(9, 0, 0, 0);
            } else if (preset === 'friday-evening') {
                const day = targetDate.getDay();
                const diff = (day <= 5 ? 5 - day : 5 - day + 7);
                targetDate.setDate(targetDate.getDate() + diff);
                targetDate.setHours(17, 0, 0, 0);
            } else if (preset === 'next-monday') {
                const day = targetDate.getDay();
                const diff = (day === 0 ? 1 : 8 - day);
                targetDate.setDate(targetDate.getDate() + diff);
                targetDate.setHours(9, 0, 0, 0);
            }

            const iso = getLocalDatetimeString(targetDate);
            applyDeadline(iso, preset);
        });
    });

    // Clear Button
    clearDeadlineBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearDeadline();
    });

    // Category Dropdown Toggle
    if (categoryTriggerBtn) {
        categoryTriggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (deadlinePopover) deadlinePopover.classList.add('hidden');
            const isOpen = !categoryDropdownMenu.classList.contains('hidden');
            if (isOpen) {
                categoryDropdownMenu.classList.add('hidden');
                categoryTriggerBtn.classList.remove('is-open');
                categoryTriggerBtn.setAttribute('aria-expanded', 'false');
            } else {
                categoryDropdownMenu.classList.remove('hidden');
                categoryTriggerBtn.classList.add('is-open');
                categoryTriggerBtn.setAttribute('aria-expanded', 'true');
            }
        });
    }

    if (categoryMenuAddBtn) {
        categoryMenuAddBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            categoryDropdownMenu.classList.add('hidden');
            categoryTriggerBtn.classList.remove('is-open');
            categoryTriggerBtn.setAttribute('aria-expanded', 'false');
            categoryModal.classList.remove('hidden');
            newCategoryName.focus();
        });
    }

    // Close popovers on click outside
    document.addEventListener('click', (e) => {
        if (deadlineWrap && !deadlineWrap.contains(e.target)) {
            deadlinePopover.classList.add('hidden');
        }
        if (categoryDropdownWrap && !categoryDropdownWrap.contains(e.target)) {
            if (categoryDropdownMenu) categoryDropdownMenu.classList.add('hidden');
            if (categoryTriggerBtn) {
                categoryTriggerBtn.classList.remove('is-open');
                categoryTriggerBtn.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // Search and Status Tabs
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderTasks();
    });

    statusTabs.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playBlipSound(480);
            statusTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatus = btn.dataset.status;
            renderTasks();
        });
    });

    // Add Task Action
    const handleAddTask = async () => {
        const text = taskInput.value.trim();
        if (!text) {
            taskInput.focus();
            showToast('Please type a quest or habit name');
            return;
        }

        const categoryId = taskCategorySelect.value ? parseInt(taskCategorySelect.value) : null;

        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    category_id: categoryId,
                    priority: selectedPriority,
                    deadline: selectedDeadline
                })
            });

            if (res.ok) {
                playTone(660, 0.08, 'square');
                const newTask = await res.json();
                tasks.unshift(newTask);
                taskInput.value = '';
                clearDeadline();
                showToast('Quest added to log!');
                await refreshData();
            } else {
                const errData = await res.json().catch(() => ({}));
                showToast(errData.error || errData.message || 'Failed to add quest');
            }
        } catch (err) {
            console.error(err);
            showToast('Error connecting to server');
        }
    };


    addTaskBtn.addEventListener('click', handleAddTask);
    taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddTask();
    });

    // Category Modal Actions
    openCategoryModalBtn.addEventListener('click', () => {
        newCategoryName.value = '';
        categoryModal.classList.remove('hidden');
        newCategoryName.focus();
    });

    const closeCategoryModal = () => categoryModal.classList.add('hidden');
    closeCategoryModalBtn.addEventListener('click', closeCategoryModal);
    cancelCategoryModalBtn.addEventListener('click', closeCategoryModal);

    saveCategoryModalBtn.addEventListener('click', async () => {
        const name = newCategoryName.value.trim();
        if (!name) return;

        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    color: selectedCategoryColor
                })
            });

            if (res.ok) {
                closeCategoryModal();
                showToast(`Folder "${name}" created!`);
                await refreshData();
            } else {
                const err = await res.json();
                showToast(err.error || 'Failed to create category');
            }
        } catch (err) {
            console.error(err);
            showToast('Error creating category');
        }
    });

    // Edit Task Modal Actions
    const closeEditModal = () => editTaskModal.classList.add('hidden');
    closeEditModalBtn.addEventListener('click', closeEditModal);
    cancelEditModalBtn.addEventListener('click', closeEditModal);

    saveEditModalBtn.addEventListener('click', async () => {
        const id = editTaskId.value;
        const text = editTaskText.value.trim();
        const categoryId = editTaskCategory.value ? parseInt(editTaskCategory.value) : null;
        const priority = editTaskPriority.value;
        const deadline = editTaskDeadline.value;

        if (!text) return;

        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    category_id: categoryId,
                    priority,
                    deadline
                })
            });

            if (res.ok) {
                closeEditModal();
                showToast('Task updated');
                await refreshData();
            }
        } catch (err) {
            console.error(err);
            showToast('Failed to update task');
        }
    });

    // Square pixel confetti for retro arcade celebration
    function triggerCelebration() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 55,
                spread: 75,
                origin: { y: 0.8 },
                shapes: ['square'],
                scalar: 1.25,
                colors: ['#39ff14', '#ff007f', '#00f0ff', '#ffe600', '#ff3344']
            });
        }
    }

    // Toggle Task completion
    async function toggleTaskStatus(task, event) {
        // Optimistic UI update
        const wasCompleted = task.completed;
        task.completed = wasCompleted ? 0 : 1;
        task.streak = wasCompleted ? Math.max(0, task.streak - 1) : task.streak + 1;
        renderTasks();

        if (!wasCompleted) {
            playCoinSound();
            let clickX = window.innerWidth / 2;
            let clickY = window.innerHeight / 2;
            if (event && event.clientX) {
                clickX = event.clientX;
                clickY = event.clientY;
            }
            const expMsg = task.streak > 1 ? `+100 EXP • ${task.streak}x COMBO! 🔥` : '+100 EXP! ⚡';
            showFloatingExp(clickX, clickY, expMsg);
            triggerCelebration();
        } else {
            playBlipSound(360);
        }

        try {
            const res = await fetch(`/api/tasks/${task.id}/toggle`, { method: 'POST' });
            if (res.ok) {
                const updated = await res.json();
                Object.assign(task, updated);
                await refreshStats();
            }
        } catch (err) {
            console.error(err);
            // Revert on error
            task.completed = wasCompleted;
            renderTasks();
            showToast('Error syncing task status');
        }
    }

    // Delete Task
    async function deleteTask(id) {
        try {
            playDeleteSound();
            const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
            if (res.ok) {
                tasks = tasks.filter(t => t.id !== id);
                renderTasks();
                await refreshStats();
                await refreshCategories();
                showToast('Quest removed');
            }
        } catch (err) {
            console.error(err);
            showToast('Error deleting quest');
        }
    }

    // Delete Category / Pack
    async function deleteCategory(id, name) {
        if (!id) return;
        const confirmMsg = `Remove pack "${name}"?\nTasks inside this pack will remain as Uncategorized.`;
        if (!confirm(confirmMsg)) {
            return;
        }

        try {
            playDeleteSound();
            const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
            if (res.ok) {
                categories = categories.filter(c => c.id !== id);
                if (selectedCategoryId == id) {
                    selectedCategoryId = 'all';
                }
                if (taskCategorySelect.value == id) {
                    if (categories.length > 0) {
                        selectCategory(categories[0]);
                    } else {
                        taskCategorySelect.value = '';
                        selectedCategoryLabel.textContent = 'Category';
                        categoryDot.style.background = '#3b82f6';
                    }
                }
                await refreshData();
                showToast(`Pack "${name}" removed`);
            } else {
                showToast('Failed to remove category');
            }
        } catch (err) {
            console.error(err);
            showToast('Error removing category');
        }
    }

    // Open Edit Modal
    function openEditModal(task) {
        editTaskId.value = task.id;
        editTaskText.value = task.text;
        editTaskCategory.value = task.category_id || '';
        editTaskPriority.value = task.priority || 'medium';
        editTaskDeadline.value = task.deadline || '';
        editTaskModal.classList.remove('hidden');
        editTaskText.focus();
    }

    // Format Deadlines friendly
    function formatFriendlyDeadline(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;

        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const isToday = d.toDateString() === today.toDateString();
        const isTomorrow = d.toDateString() === tomorrow.toDateString();

        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isToday) return `Today, ${timeStr}`;
        if (isTomorrow) return `Tomorrow, ${timeStr}`;
        return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // Check if task deadline is overdue
    function isOverdue(deadlineStr, completed) {
        if (!deadlineStr || completed) return false;
        return new Date(deadlineStr) < new Date();
    }

    // Render Stats
    function updateStatsUI() {
        const total = stats.total || 0;
        const completed = stats.completed || 0;
        const pending = stats.pending || 0;
        const rate = stats.completion_rate || 0;
        const streak = stats.best_streak || 0;

        statCompleted.textContent = completed;
        statPending.textContent = pending;
        statBestStreak.textContent = streak;
        statPercent.textContent = `${Math.round(rate)}%`;

        // SVG Radial Circumference = 2 * PI * 34 ≈ 213.6
        const circumference = 213.6;
        const offset = circumference - (rate / 100) * circumference;
        statRadialBar.style.strokeDashoffset = offset;

        if (total === 0) {
            statSubtext.textContent = 'Add your first goal!';
        } else if (rate === 100) {
            statSubtext.textContent = 'Spectacular! All done today 🎉';
            playFanfareSound();
        } else if (rate >= 50) {
            statSubtext.textContent = 'Over halfway there, finish strong!';
        } else {
            statSubtext.textContent = `${pending} task${pending === 1 ? '' : 's'} remaining today`;
        }
    }

    function selectCategory(cat) {
        if (!cat) return;
        taskCategorySelect.value = cat.id;
        selectedCategoryLabel.textContent = cat.name;
        categoryDot.style.background = cat.color || '#3b82f6';
        if (categoryOptionsList) {
            categoryOptionsList.querySelectorAll('.category-option-item').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.id == cat.id);
            });
        }
    }

    // Render Category Pills & Dropdown Options
    function renderCategoryPills() {
        // Reset category pill list
        categoryPillsList.innerHTML = `
            <button class="cat-pill ${selectedCategoryId === 'all' ? 'active' : ''}" data-id="all">
                <span>All Folders</span>
                <span class="count-badge">${tasks.length}</span>
            </button>
        `;

        // Reset custom category options list and edit modal dropdown
        if (categoryOptionsList) categoryOptionsList.innerHTML = '';
        editTaskCategory.innerHTML = '<option value="">No Category</option>';

        categories.forEach(cat => {
            const count = tasks.filter(t => t.category_id === cat.id).length;
            
            // Filter Pill
            const pill = document.createElement('div');
            pill.className = `cat-pill ${selectedCategoryId == cat.id ? 'active' : ''}`;
            pill.dataset.id = cat.id;
            pill.innerHTML = `
                <span class="dot-indicator" style="background: ${cat.color}; width: 8px; height: 8px; border-radius: 50%;"></span>
                <span class="cat-pill-name">${escapeHtml(cat.name)}</span>
                <span class="count-badge">${count}</span>
                <button type="button" class="cat-pill-remove" title="Remove pack" aria-label="Remove category">&times;</button>
            `;
            pill.addEventListener('click', (e) => {
                if (e.target.closest('.cat-pill-remove')) return;
                playBlipSound(520);
                selectedCategoryId = cat.id;
                document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                renderTasks();
            });
            const removeBtn = pill.querySelector('.cat-pill-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteCategory(cat.id, cat.name);
                });
            }
            categoryPillsList.appendChild(pill);

            // Custom Dropdown Option Item
            if (categoryOptionsList) {
                const isSelected = String(taskCategorySelect.value) === String(cat.id);
                const itemBtn = document.createElement('button');
                itemBtn.type = 'button';
                itemBtn.className = `category-option-item ${isSelected ? 'active' : ''}`;
                itemBtn.dataset.id = cat.id;
                itemBtn.innerHTML = `
                    <div class="category-option-left">
                        <span class="category-option-dot" style="background: ${cat.color};"></span>
                        <span class="category-option-name">${escapeHtml(cat.name)}</span>
                    </div>
                    <div class="category-option-right">
                        <span class="category-option-count">${count}</span>
                        <button type="button" class="category-option-delete" title="Remove pack" aria-label="Remove category">&times;</button>
                        <svg class="category-option-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                `;
                itemBtn.addEventListener('click', (e) => {
                    if (e.target.closest('.category-option-delete')) return;
                    e.stopPropagation();
                    selectCategory(cat);
                    categoryDropdownMenu.classList.add('hidden');
                    categoryTriggerBtn.classList.remove('is-open');
                    categoryTriggerBtn.setAttribute('aria-expanded', 'false');
                });
                const optDelBtn = itemBtn.querySelector('.category-option-delete');
                if (optDelBtn) {
                    optDelBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteCategory(cat.id, cat.name);
                    });
                }
                categoryOptionsList.appendChild(itemBtn);
            }

            // Edit Task Select Option
            const editOpt = document.createElement('option');
            editOpt.value = cat.id;
            editOpt.textContent = cat.name;
            editTaskCategory.appendChild(editOpt);
        });

        // Pill click handler for 'All'
        categoryPillsList.querySelector('[data-id="all"]').addEventListener('click', () => {
            selectedCategoryId = 'all';
            document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
            categoryPillsList.querySelector('[data-id="all"]').classList.add('active');
            renderTasks();
        });

        // Update selected category chip indicator
        if (categories.length > 0 && !taskCategorySelect.value) {
            selectCategory(categories[0]);
        } else if (taskCategorySelect.value) {
            const selected = categories.find(c => c.id == taskCategorySelect.value);
            if (selected) {
                selectCategory(selected);
            }
        }
    }

    // Render Tasks Grouped by Category
    function renderTasks() {
        tasksContainer.innerHTML = '';

        // Filter tasks
        let filtered = tasks.filter(t => {
            // Category filter
            if (selectedCategoryId !== 'all' && t.category_id != selectedCategoryId) {
                return false;
            }
            // Status filter
            if (currentStatus === 'active' && t.completed) return false;
            if (currentStatus === 'completed' && !t.completed) return false;
            // Search filter
            if (searchQuery && !t.text.toLowerCase().includes(searchQuery)) return false;
            return true;
        });

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        } else {
            emptyState.classList.add('hidden');
        }

        // Group filtered tasks by Category
        const groups = {};
        filtered.forEach(task => {
            const catId = task.category_id || 'uncategorized';
            if (!groups[catId]) {
                const catObj = categories.find(c => c.id === task.category_id) || {
                    name: 'General',
                    color: '#94a3b8'
                };
                groups[catId] = {
                    info: catObj,
                    tasks: []
                };
            }
            groups[catId].tasks.push(task);
        });

        Object.values(groups).forEach(group => {
            const groupEl = document.createElement('div');
            groupEl.className = 'category-group';

            const canDeleteCategory = group.info && group.info.id;
            groupEl.innerHTML = `
                <div class="group-header">
                    <div class="group-title-wrap">
                        <span class="group-color-dot" style="background: ${group.info.color};"></span>
                        <h2 class="group-title">${escapeHtml(group.info.name)}</h2>
                    </div>
                    <div class="group-header-actions">
                        <span class="group-count">[${group.tasks.length}]</span>
                        ${canDeleteCategory ? `
                            <button type="button" class="group-delete-cat-btn pixel-btn" title="Remove category pack" aria-label="Remove category pack">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="task-list"></div>
            `;

            if (canDeleteCategory) {
                const groupDel = groupEl.querySelector('.group-delete-cat-btn');
                if (groupDel) {
                    groupDel.addEventListener('click', (e) => {
                        e.stopPropagation();
                        deleteCategory(group.info.id, group.info.name);
                    });
                }
            }

            const listEl = groupEl.querySelector('.task-list');

            group.tasks.forEach(task => {
                const taskCard = document.createElement('div');
                taskCard.className = `task-card ${task.completed ? 'completed' : ''}`;

                const overdue = isOverdue(task.deadline, task.completed);
                const friendlyDate = formatFriendlyDeadline(task.deadline);

                taskCard.innerHTML = `
                    <button class="task-checkbox-btn" title="${task.completed ? 'Mark incomplete' : 'Mark completed'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </button>

                    <div class="task-content">
                        <span class="task-text">${escapeHtml(task.text)}</span>
                        <div class="task-meta">
                            <!-- Priority Badge -->
                            <span class="badge priority-${task.priority || 'medium'}">
                                ${capitalize(task.priority || 'medium')}
                            </span>

                            <!-- Streak Badge -->
                            ${task.streak > 0 ? `
                                <span class="badge streak-badge" title="Consecutive completions">
                                    <span>🔥</span>
                                    <span>${task.streak} streak</span>
                                </span>
                            ` : ''}

                            <!-- Deadline Badge -->
                            ${task.deadline ? `
                                <span class="badge deadline-badge ${overdue ? 'overdue' : ''}">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="10"/>
                                        <polyline points="12 6 12 12 16 14"/>
                                    </svg>
                                    <span>${overdue ? 'Overdue: ' : ''}${friendlyDate}</span>
                                </span>
                            ` : ''}
                        </div>
                    </div>

                    <div class="task-actions">
                        <button class="action-icon-btn edit-btn" title="Edit task">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                        </button>
                        <button class="action-icon-btn delete-btn" title="Delete task">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                `;

                // Events
                taskCard.querySelector('.task-checkbox-btn').addEventListener('click', (e) => toggleTaskStatus(task, e));
                taskCard.querySelector('.edit-btn').addEventListener('click', () => {
                    playBlipSound(520);
                    openEditModal(task);
                });
                taskCard.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

                listEl.appendChild(taskCard);
            });

            tasksContainer.appendChild(groupEl);
        });
    }

    // Helper: Toast notification
    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" x2="12" y1="8" y2="12"/>
                <line x1="12" x2="12.01" y1="16" y2="16"/>
            </svg>
            <span>${escapeHtml(message)}</span>
        `;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 260);
        }, 3200);
    }

    // Utility Helpers
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    // Fetch APIs
    async function refreshCategories() {
        const res = await fetch('/api/categories');
        if (res.ok) {
            categories = await res.json();
            renderCategoryPills();
        }
    }

    async function refreshTasks() {
        const res = await fetch('/api/tasks');
        if (res.ok) {
            tasks = await res.json();
            renderTasks();
            renderCategoryPills();
        }
    }

    async function refreshStats() {
        const res = await fetch('/api/stats');
        if (res.ok) {
            stats = await res.json();
            updateStatsUI();
        }
    }

    async function refreshData() {
        await Promise.all([refreshCategories(), refreshTasks(), refreshStats()]);
    }

    // Service Worker Registration for PWA & Offline Support
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    console.log('Orbit PWA Service Worker registered:', reg.scope);
                })
                .catch(err => {
                    console.warn('Orbit PWA Service Worker failed:', err);
                });
        });
    }

    // PWA Install Prompt Handling
    let deferredPrompt = null;
    const installAppBtn = document.getElementById('installAppBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default mini-infobar
        e.preventDefault();
        deferredPrompt = e;
        if (installAppBtn) {
            installAppBtn.classList.remove('hidden');
        }
    });

    if (installAppBtn) {
        installAppBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    showToast('Installing Orbit to your device...');
                }
                deferredPrompt = null;
                installAppBtn.classList.add('hidden');
            } else {
                // If iOS Safari or unsupported, give friendly advice
                const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
                if (isIos) {
                    showToast('To install: tap Share ⎋ and choose "Add to Home Screen"');
                } else {
                    showToast('App is ready! Use your browser menu to "Install" or "Add to Home screen"');
                }
            }
        });
    }

    window.addEventListener('appinstalled', () => {
        if (installAppBtn) installAppBtn.classList.add('hidden');
        showToast('🎉 Orbit successfully installed!');
        triggerCelebration();
    });

    // Boot app
    refreshData();
});

