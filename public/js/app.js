document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const kelasFilter = document.getElementById('kelas-filter');
    let allTasks = [];

    fetchData();

    refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        await fetchData();
        setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
    });

    kelasFilter.addEventListener('change', () => renderTable(allTasks));

    async function fetchData() {
        await Promise.all([fetchStats(), fetchTasks()]).catch(console.error);
    }

    async function fetchStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            animateValue('stat-guilds',   0, data.guilds   || 0, 900);
            animateValue('stat-tasks',    0, data.tasks    || 0, 900);
            animateValue('stat-channels', 0, data.channels || 0, 900);
        } catch {
            ['stat-guilds', 'stat-tasks', 'stat-channels'].forEach(
                id => document.getElementById(id).textContent = 'Err'
            );
        }
    }

    async function fetchTasks() {
        try {
            const res  = await fetch('/api/tasks');
            allTasks   = await res.json();
            renderTable(allTasks);
            renderRecentList(allTasks);
            renderChart(allTasks);
            renderPendingStat(allTasks);
        } catch {
            document.getElementById('tasks-body').innerHTML =
                `<tr><td colspan="5" style="text-align:center;color:var(--red);padding:2rem">Failed to load tasks.</td></tr>`;
        }
    }

    /* ── Table ─────────────────────────────── */
    function renderTable(tasks) {
        const tbody  = document.getElementById('tasks-body');
        const filter = kelasFilter.value;
        const list   = filter === 'all' ? tasks : tasks.filter(t => t.kelas === filter);
        const now    = new Date();

        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-3);padding:2rem">No tasks found.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(task => {
            const deadline  = new Date(task.deadline);
            const isPastDue = deadline < now && task.status !== 'completed';
            const sc        = task.status === 'completed' ? 'completed' : isPastDue ? 'past-due' : 'pending';
            const st        = sc === 'completed' ? 'Completed' : sc === 'past-due' ? 'Past Due' : 'Pending';
            const bc        = `badge kelas-${task.kelas.toLowerCase()}`;

            return `<tr>
                <td><strong>${esc(task.description)}</strong></td>
                <td><span class="${bc}">${esc(task.kelas)}</span></td>
                <td style="color:var(--text-2)">${fmtDate(deadline)}</td>
                <td>
                    <span class="status-pill ${sc}">
                        <span class="status-pill-dot"></span>${st}
                    </span>
                </td>
                <td>${task.link
                    ? `<a href="${esc(task.link)}" target="_blank" class="link-icon" title="Open link">
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg></a>`
                    : '<span style="color:var(--text-3)">—</span>'}
                </td>
            </tr>`;
        }).join('');
    }

    /* ── Recent List (top 6) ────────────────── */
    function renderRecentList(tasks) {
        const el  = document.getElementById('recent-tasks-list');
        const now = new Date();
        const top = [...tasks].slice(0, 6);

        if (!top.length) {
            el.innerHTML = `<p style="color:var(--text-3);font-size:13px;text-align:center;padding:16px">No tasks yet.</p>`;
            return;
        }

        const icons = { A: '📘', B: '📗', Semua: '📋' };

        el.innerHTML = top.map(task => {
            const deadline  = new Date(task.deadline);
            const isPastDue = deadline < now && task.status !== 'completed';
            const sc        = task.status === 'completed' ? 'completed' : isPastDue ? 'past-due' : 'pending';
            const st        = sc === 'completed' ? 'Completed' : sc === 'past-due' ? 'Past Due' : 'Pending';
            const iconClass = `task-item-icon ${task.kelas.toLowerCase()}`;
            const icon      = icons[task.kelas] || '📌';

            return `<div class="task-list-item">
                <div class="${iconClass}">${icon}</div>
                <div class="task-item-body">
                    <div class="task-item-desc">${esc(task.description)}</div>
                    <div class="task-item-meta">Kelas ${esc(task.kelas)} · ${fmtDate(deadline)}</div>
                </div>
                <span class="task-item-badge ${sc}">${st}</span>
            </div>`;
        }).join('');
    }

    /* ── Donut Chart ────────────────────────── */
    function renderChart(tasks) {
        const now       = new Date();
        const completed = tasks.filter(t => t.status === 'completed').length;
        const pastDue   = tasks.filter(t => t.status !== 'completed' && new Date(t.deadline) < now).length;
        const pending   = tasks.length - completed - pastDue;
        const total     = tasks.length;

        document.getElementById('donut-total').textContent    = total || '0';
        document.getElementById('legend-pending').textContent   = pending;
        document.getElementById('legend-completed').textContent = completed;
        document.getElementById('legend-pastdue').textContent   = pastDue;

        const circ = 2 * Math.PI * 60; // ≈ 376.99

        // Calculate proportional lengths
        const pLen  = total ? (pending   / total) * circ : 0;
        const cLen  = total ? (completed / total) * circ : 0;
        const dLen  = total ? (pastDue   / total) * circ : 0;

        // Offsets (cumulative)
        const pOff = 0;
        const cOff = circ - pLen;
        const dOff = circ - pLen - cLen;

        setArc('donut-pending',   pLen, circ - pLen, pOff);
        setArc('donut-completed', cLen, circ - cLen, cOff);
        setArc('donut-pastdue',   dLen, circ - dLen, dOff);
    }

    function setArc(id, dash, gap, offset) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.strokeDasharray  = `${dash} ${gap}`;
        el.style.strokeDashoffset = -offset;
        el.style.transition       = 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease';
    }

    /* ── Pending stat card ──────────────────── */
    function renderPendingStat(tasks) {
        const now     = new Date();
        const pending = tasks.filter(t => t.status !== 'completed' && new Date(t.deadline) >= now).length;
        animateValue('stat-pending', 0, pending, 900);
    }

    /* ── Helpers ────────────────────────────── */
    function animateValue(id, from, to, ms) {
        const el = document.getElementById(id);
        if (!el || from === to) { if (el) el.textContent = to; return; }
        let start = null;
        const step = ts => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / ms, 1);
            el.textContent = Math.floor(p * (to - from) + from);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    function fmtDate(d) {
        return d.toLocaleDateString('id-ID', {
            weekday: 'short', day: 'numeric', month: 'short',
            year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function esc(s) {
        if (!s) return '';
        return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
    }
});
