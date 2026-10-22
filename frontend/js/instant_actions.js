/**
 * Orbit • Habit & Task Mastery
 * Instant Non-Reload Actions (Progressive Enhancement)
 */

(function () {
    // -------------------------------------------------------------------------
    // 1. Retro 8-Bit Web Audio Engine
    // -------------------------------------------------------------------------
    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    function playCoinSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            gain.gain.setValueAtTime(0.08, now);
            osc.frequency.setValueAtTime(987.77, now); // B5
            osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.35);
        } catch (_) {}
    }

    function playBlipSound(pitch = 440) {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(pitch, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.06);
        } catch (_) {}
    }

    function playDeleteSound() {
        try {
            const ctx = getAudioContext();
            if (!ctx) return;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(280, now);
            osc.frequency.setValueAtTime(140, now + 0.08);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        } catch (_) {}
    }

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
})();
