document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const kelasFilter = document.getElementById('kelas-filter');
    let allTasks = [];

    // Initialize
    fetchData();

    // Event Listeners
    refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('loading');
        await fetchData();
        setTimeout(() => refreshBtn.classList.remove('loading'), 500);
    });

    kelasFilter.addEventListener('change', () => {
        renderTasks(allTasks);
    });

    async function fetchData() {
        try {
            await Promise.all([fetchStats(), fetchTasks()]);
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }

    async function fetchStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            
            animateValue('stat-guilds', 0, data.guilds || 0, 1000);
            animateValue('stat-tasks', 0, data.tasks || 0, 1000);
            animateValue('stat-channels', 0, data.channels || 0, 1000);
        } catch (error) {
            console.error('Error fetching stats:', error);
            document.getElementById('stat-guilds').textContent = 'Error';
            document.getElementById('stat-tasks').textContent = 'Error';
            document.getElementById('stat-channels').textContent = 'Error';
        }
    }

    async function fetchTasks() {
        try {
            const res = await fetch('/api/tasks');
            allTasks = await res.json();
            renderTasks(allTasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            document.getElementById('tasks-body').innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; color: var(--danger);">Failed to load tasks.</td>
                </tr>
            `;
        }
    }

    function renderTasks(tasks) {
        const tbody = document.getElementById('tasks-body');
        const filterValue = kelasFilter.value;
        
        let filteredTasks = tasks;
        if (filterValue !== 'all') {
            filteredTasks = tasks.filter(t => t.kelas === filterValue);
        }

        if (filteredTasks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; color: var(--text-secondary); padding: 2rem;">No tasks found for the selected filter.</td>
                </tr>
            `;
            return;
        }

        const now = new Date();

        tbody.innerHTML = filteredTasks.map(task => {
            const deadline = new Date(task.deadline);
            const isPastDue = deadline < now && task.status !== 'completed';
            
            let statusClass = 'pending';
            let statusText = 'Pending';
            
            if (task.status === 'completed') {
                statusClass = 'completed';
                statusText = 'Completed';
            } else if (isPastDue) {
                statusClass = 'past-due';
                statusText = 'Past Due';
            }

            const badgeClass = `badge kelas-${task.kelas.toLowerCase()}`;
            
            return `
                <tr>
                    <td><strong>${escapeHTML(task.description)}</strong></td>
                    <td><span class="${badgeClass}">${escapeHTML(task.kelas)}</span></td>
                    <td>${formatDate(deadline)}</td>
                    <td>
                        <div class="status-indicator">
                            <div class="status-dot ${statusClass}"></div>
                            <span>${statusText}</span>
                        </div>
                    </td>
                    <td>
                        ${task.link ? `<a href="${escapeHTML(task.link)}" target="_blank" class="link-icon" title="View Link">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        </a>` : '-'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Utilities
    function animateValue(id, start, end, duration) {
        if (start === end) return;
        const obj = document.getElementById(id);
        if (!obj) return;
        
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    function formatDate(date) {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' };
        return date.toLocaleDateString('id-ID', options);
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    }
});
