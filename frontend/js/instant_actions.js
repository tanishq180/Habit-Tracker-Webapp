/**
 * Orbit • Habit & Task Mastery
 * Instant Non-Reload Actions (Progressive Enhancement)
 */

(function () {
    // -------------------------------------------------------------------------
    // 1. Instant 1-Click Theme Switcher (Zero Reload, 1-Click Instant Toggle)
    // -------------------------------------------------------------------------
    document.addEventListener('click', (e) => {
        const themeBtn = e.target.closest('.theme-toggle');
        if (!themeBtn) return;

        e.preventDefault();

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

        // 1. Instant DOM attribute toggle
        document.documentElement.setAttribute('data-theme', nextTheme);

        // 2. Persist in localStorage and Cookie
        try {
            localStorage.setItem('orbit_theme', nextTheme);
            document.cookie = `orbit_theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
        } catch (_) {}

        // 3. Update all theme toggle buttons on the screen
        document.querySelectorAll('.theme-toggle').forEach(btn => {
            const content = btn.querySelector('.theme-btn-content');
            if (content) {
                if (nextTheme === 'light') {
                    content.innerHTML = `
                        <svg class="moon-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M12 3a6 6 0 0 0 9 9 9 0 1 1-9-9Z"/>
                        </svg>
                        <span class="btn-text-badge">DARK</span>
                    `;
                } else {
                    content.innerHTML = `
                        <svg class="sun-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <circle cx="12" cy="12" r="4"/>
                            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                        </svg>
                        <span class="btn-text-badge">LIGHT</span>
                    `;
                }
            }
            btn.href = `/set-theme/${nextTheme === 'dark' ? 'light' : 'dark'}`;
        });

        // 4. Background sync with backend
        fetch(`/set-theme/${nextTheme}`, { credentials: 'same-origin' }).catch(() => {});
    });

    // 1-Click Quick Color Swatches in Modals
    document.addEventListener('click', (e) => {
        const swatch = e.target.closest('.quick-color-swatch');
        if (!swatch) return;
        const color = swatch.dataset.color;
        if (!color) return;
        const parent = swatch.closest('.color-picker-group') || swatch.parentElement;
        const input = parent ? parent.querySelector('input[type="color"]') : document.querySelector('input[type="color"]');
        if (input) {
            input.value = color;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        parent.querySelectorAll('.quick-color-swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
    });

    const playCoinSound = () => {};
    const playBlipSound = () => {};
    const playDeleteSound = () => {};

    // -------------------------------------------------------------------------
    // 2. Floating Pixel EXP Burst
    // -------------------------------------------------------------------------
    function showFloatingExp(x, y, text) {
        const el = document.createElement('div');
        el.className = 'floating-pixel-exp';
        el.textContent = text || '+100 EXP! ⚡';
        el.style.left = `${x || (window.innerWidth / 2)}px`;
        el.style.top = `${y || (window.innerHeight / 2)}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 950);
    }

    // -------------------------------------------------------------------------
    // 3. UI Stats Synchronizer
    // -------------------------------------------------------------------------
    function updateStatsUI(stats) {
        if (!stats) return;

        // Quests Cleared
        const clearedEl = document.getElementById('statQuestsCleared');
        if (clearedEl && stats.completed !== undefined) {
            clearedEl.textContent = stats.completed;
        }

        // Max Combo Streak
        const comboEl = document.getElementById('statMaxCombo');
        if (comboEl && stats.best_streak !== undefined) {
            comboEl.textContent = stats.best_streak;
        }

        // Active Quests
        const activeEl = document.getElementById('statActiveQuests');
        if (activeEl && stats.pending !== undefined) {
            activeEl.textContent = stats.pending;
        }

        // Radial Gauge
        const radialLabel = document.getElementById('statRadialLabel');
        if (radialLabel && stats.completion_rate !== undefined) {
            radialLabel.textContent = `${stats.completion_rate}%`;
        }

        const radialBar = document.getElementById('statRadialBar');
        if (radialBar && stats.radial_offset !== undefined) {
            radialBar.style.strokeDashoffset = stats.radial_offset;
        }

        const statDesc = document.getElementById('statDesc');
        if (statDesc && stats.completion_rate !== undefined) {
            statDesc.textContent = stats.completion_rate === 100
                ? 'ALL QUESTS CLEARED! ★★★'
                : 'Level up by conquering habits!';
        }
    }

    function updateCategoriesUI(categories) {
        if (!Array.isArray(categories)) return;

        categories.forEach(cat => {
            // Horizontal Pack Progress Radar Card
            const card = document.querySelector(`.pack-dashboard-card[data-category-id="${cat.id}"]`);
            if (card) {
                const fraction = card.querySelector('.pack-card-fraction');
                if (fraction) fraction.textContent = `${cat.completed_tasks}/${cat.total_tasks}`;

                const percent = card.querySelector('.pack-card-percent');
                if (percent) percent.textContent = `${cat.completion_rate}%`;

                const fill = card.querySelector('.pack-progress-bar-fill');
                if (fill) fill.style.width = `${cat.completion_rate}%`;

                const label = card.querySelector('.pack-card-status-label');
                if (label) {
                    if (cat.total_tasks === 0) {
                        label.className = 'pack-card-status-label status-empty';
                        label.textContent = '[ EMPTY ]';
                    } else if (cat.completion_rate === 100) {
                        label.className = 'pack-card-status-label status-cleared';
                        label.textContent = '[ CLEARED ★ ]';
                    } else {
                        label.className = 'pack-card-status-label status-pending';
                        label.textContent = `[${cat.pending_tasks} LEFT]`;
                    }
                }
            }

            // Category Filter Pill Badge
            const pill = document.querySelector(`.cat-pill[data-category-id="${cat.id}"]`);
            if (pill) {
                const badge = pill.querySelector('.count-badge');
                if (badge) badge.textContent = cat.total_tasks;
            }
        });

        // Update All Packs pill total
        const allPill = document.querySelector('.cat-pill[data-category-id="all"] .count-badge');
        if (allPill) {
            const sum = categories.reduce((acc, c) => acc + (c.total_tasks || 0), 0);
            allPill.textContent = sum;
        }
    }

    function checkGroupEmpty(groupEl) {
        if (!groupEl) return;
        const visibleCards = groupEl.querySelectorAll('.task-card:not([style*="display: none"])');
        if (visibleCards.length === 0) {
            groupEl.style.display = 'none';
        }
    }

    // -------------------------------------------------------------------------
    // 4. Intercept Checkbox Click (Instant Toggle without Page Reload)
    // -------------------------------------------------------------------------
    document.addEventListener('click', async (e) => {
        const toggleBtn = e.target.closest('.task-checkbox-btn');
        if (!toggleBtn) return;

        const form = toggleBtn.closest('form');
        const taskCard = toggleBtn.closest('.task-card');
        if (!taskCard) return;

        // Prevent normal full-page form submission
        e.preventDefault();

        const taskId = taskCard.dataset.taskId;
        const wasCompleted = taskCard.classList.contains('completed');
        const newCompleted = !wasCompleted;

        // 1. INSTANT OPTIMISTIC UI UPDATE
        taskCard.classList.toggle('completed', newCompleted);
        taskCard.dataset.completed = newCompleted ? '1' : '0';
        toggleBtn.textContent = newCompleted ? '✓' : '';
        toggleBtn.title = newCompleted ? 'Mark Incomplete' : 'Clear Quest';

        // Update streak counter badge
        let streak = parseInt(taskCard.dataset.streak || '0', 10);
        streak = newCompleted ? (streak + 1) : Math.max(0, streak - 1);
        taskCard.dataset.streak = streak;

        let streakBadge = taskCard.querySelector('.streak-badge');
        if (streak > 0) {
            if (!streakBadge) {
                streakBadge = document.createElement('span');
                streakBadge.className = 'badge streak-badge';
                const meta = taskCard.querySelector('.task-meta');
                if (meta) meta.appendChild(streakBadge);
            }
            if (streakBadge) {
                streakBadge.textContent = `🔥 ${streak} STREAK`;
                streakBadge.style.display = '';
            }
        } else if (streakBadge) {
            streakBadge.style.display = 'none';
        }

        // Sound effect & Floating EXP animation
        if (newCompleted) {
            playCoinSound();
            const rect = toggleBtn.getBoundingClientRect();
            const expText = streak > 1 ? `+100 EXP • ${streak}x COMBO! 🔥` : '+100 EXP! ⚡';
            showFloatingExp(rect.left + rect.width / 2, rect.top, expText);
        } else {
            playBlipSound(360);
        }

        // Optional status filter behavior
        const currentStatus = document.body.dataset.currentStatus || 'all';
        if (currentStatus === 'active' && newCompleted) {
            setTimeout(() => {
                taskCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                taskCard.style.opacity = '0';
                taskCard.style.transform = 'translateX(20px)';
                setTimeout(() => {
                    taskCard.style.display = 'none';
                    checkGroupEmpty(taskCard.closest('.category-group'));
                }, 300);
            }, 600);
        } else if (currentStatus === 'completed' && !newCompleted) {
            setTimeout(() => {
                taskCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                taskCard.style.opacity = '0';
                taskCard.style.transform = 'translateX(-20px)';
                setTimeout(() => {
                    taskCard.style.display = 'none';
                    checkGroupEmpty(taskCard.closest('.category-group'));
                }, 300);
            }, 600);
        }

        // 2. SEND BACKGROUND ASYNC REQUEST
        try {
            const url = (form && form.action) ? form.action : `/tasks/${taskId}/toggle`;
            const formData = form ? new FormData(form) : new FormData();

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                if (data.task) {
                    taskCard.dataset.streak = data.task.streak;
                    if (streakBadge && data.task.streak > 0) {
                        streakBadge.textContent = `🔥 ${data.task.streak} STREAK`;
                    }
                }
                if (data.stats) {
                    updateStatsUI(data.stats);
                }
                if (data.categories) {
                    updateCategoriesUI(data.categories);
                }
            } else {
                console.warn('Sync failed; server returned status:', res.status);
            }
        } catch (err) {
            console.error('Task toggle error:', err);
        }
    });

    // -------------------------------------------------------------------------
    // 5. Intercept Task Delete Click (Instant Removal without Page Reload)
    // -------------------------------------------------------------------------
    document.addEventListener('click', async (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (!deleteBtn) return;

        const taskCard = deleteBtn.closest('.task-card');
        if (!taskCard) return;

        const form = deleteBtn.closest('form');
        e.preventDefault();

        if (!confirm('Delete this quest?')) {
            return;
        }

        const taskId = taskCard.dataset.taskId;
        playDeleteSound();

        // Optimistic removal animation
        taskCard.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        taskCard.style.opacity = '0';
        taskCard.style.transform = 'scale(0.92)';

        setTimeout(() => {
            const group = taskCard.closest('.category-group');
            taskCard.remove();
            if (group) checkGroupEmpty(group);
        }, 300);

        try {
            const url = (form && form.action) ? form.action : `/tasks/${taskId}/delete`;
            const formData = form ? new FormData(form) : new FormData();

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                if (data.stats) updateStatsUI(data.stats);
                if (data.categories) updateCategoriesUI(data.categories);
            }
        } catch (err) {
            console.error('Task delete error:', err);
        }
    });

    // -------------------------------------------------------------------------
    // 6. Toast Notification Helper
    // -------------------------------------------------------------------------
    function showToast(message, isError = false) {
        let toast = document.getElementById('orbitToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'orbitToast';
            toast.className = 'orbit-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.style.background = isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)';
        toast.classList.add('show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    // -------------------------------------------------------------------------
    // 7. Deadline Clear & Input Sync
    // -------------------------------------------------------------------------
    const clearDeadlineBtn = document.getElementById('clearDeadlineBtn');
    const taskDeadlineInput = document.getElementById('taskDeadlineInput');
    const deadlineDetails = document.getElementById('deadlineDetails');
    const deadlineBtnLabel = document.getElementById('deadlineBtnLabel');

    if (clearDeadlineBtn && taskDeadlineInput) {
        clearDeadlineBtn.addEventListener('click', (e) => {
            e.preventDefault();
            taskDeadlineInput.value = '';
            if (deadlineBtnLabel) deadlineBtnLabel.textContent = 'Set Deadline';
            if (deadlineDetails) deadlineDetails.removeAttribute('open');
        });
    }

    if (taskDeadlineInput && deadlineBtnLabel) {
        taskDeadlineInput.addEventListener('change', () => {
            if (taskDeadlineInput.value) {
                try {
                    const dt = new Date(taskDeadlineInput.value);
                    const formatted = dt.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    deadlineBtnLabel.textContent = `⏰ ${formatted}`;
                } catch (_) {
                    deadlineBtnLabel.textContent = 'Deadline Set ⏰';
                }
            } else {
                deadlineBtnLabel.textContent = 'Set Deadline';
            }
        });
    }

    // -------------------------------------------------------------------------
    // 8. Intercept Floating Composer Submit (Instant Task Addition)
    // -------------------------------------------------------------------------
    const addHabitForm = document.getElementById('addHabitForm');
    const habitTextInput = document.getElementById('habitTextInput');
    const habitCategorySelect = document.getElementById('habitCategorySelect');
    const habitPrioritySelect = document.getElementById('habitPrioritySelect');
    const addHabitSubmitBtn = document.getElementById('addHabitSubmitBtn');

    if (addHabitForm && habitTextInput) {
        addHabitForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const text = habitTextInput.value.trim();
            if (!text) {
                habitTextInput.focus();
                showToast('Please type a habit or quest name', true);
                return;
            }

            const category_id = habitCategorySelect ? habitCategorySelect.value : '';
            const priority = habitPrioritySelect ? habitPrioritySelect.value : 'medium';
            const deadline = taskDeadlineInput ? taskDeadlineInput.value : '';

            if (addHabitSubmitBtn) {
                addHabitSubmitBtn.disabled = true;
                addHabitSubmitBtn.style.opacity = '0.6';
            }

            try {
                const res = await fetch('/tasks/add', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({
                        text,
                        category_id: category_id || null,
                        priority,
                        deadline
                    })
                });

                if (res.ok) {
                    playCoinSound();
                    habitTextInput.value = '';
                    if (taskDeadlineInput) taskDeadlineInput.value = '';
                    if (deadlineBtnLabel) deadlineBtnLabel.textContent = 'Set Deadline';
                    if (deadlineDetails) deadlineDetails.removeAttribute('open');

                    showToast('Quest added to log!');
                    const data = await res.json();
                    if (data.stats) updateStatsUI(data.stats);
                    if (data.categories) updateCategoriesUI(data.categories);

                    setTimeout(() => {
                        window.location.reload();
                    }, 400);
                } else {
                    const errData = await res.json().catch(() => ({}));
                    showToast(errData.error || errData.message || 'Failed to add quest', true);
                }
            } catch (err) {
                console.error('Error adding quest:', err);
                showToast('Network error connecting to server', true);
            } finally {
                if (addHabitSubmitBtn) {
                    addHabitSubmitBtn.disabled = false;
                    addHabitSubmitBtn.style.opacity = '1';
                }
            }
        });
    }
})();

