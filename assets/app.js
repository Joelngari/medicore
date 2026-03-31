// ============================================================
//  app.js — EduCore Frontend Logic
//  This file handles ALL JavaScript for the app.
//  It talks to PHP via fetch() — never touches the DB directly.
// ============================================================

// ── HELPERS ─────────────────────────────────────────────────
const el  = id => document.getElementById(id);
const val = id => el(id) ? el(id).value : '';
const uid = (p='ID') => p + '-' + Math.floor(10000 + Math.random() * 90000);
const ts  = () => new Date().toLocaleString();
const today = () => new Date().toLocaleDateString();
const closeModal = id => el(id).classList.remove('open');
const LS = (k, v) => {
    if (v === undefined) { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } }
    localStorage.setItem(k, JSON.stringify(v));
};

// ── API CALLER ───────────────────────────────────────────────
// Every fetch to PHP goes through this one function.
// It sends JSON, receives JSON, handles errors gracefully.
async function api(endpoint, payload = {}) {
    try {
        const res = await fetch(`api/${endpoint}.php`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success && data.error) {
            console.warn(`[API ${endpoint}]`, data.error);
        }
        return data;
    } catch (e) {
        console.error(`[API ${endpoint}] Network error:`, e);
        return { success: false, error: 'Network error. Is the server running?' };
    }
}

// ── SHOW LOADER ──────────────────────────────────────────────
function showLoader(msg = 'Loading…') {
    let ld = el('globalLoader');
    if (!ld) {
        ld = document.createElement('div');
        ld.id = 'globalLoader';
        ld.style.cssText = 'position:fixed;bottom:24px;right:24px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;padding:10px 20px;border-radius:10px;font-size:.82rem;font-weight:700;z-index:9999;box-shadow:0 4px 16px rgba(14,165,233,.4);font-family:"DM Sans",sans-serif;';
        document.body.appendChild(ld);
    }
    ld.innerText = msg;
    ld.style.display = 'block';
}
function hideLoader() { const ld = el('globalLoader'); if (ld) ld.style.display = 'none'; }

// ════════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════════
const Auth = {
    currentUser: null,
    selectedRole: null,
    _users: null,

    // Boot — called on page load
    async init() {
        const sess = LS('educore_session');
        if (sess) {
            // Verify session still valid
            const res = await api('auth', { action: 'get_users' });
            if (res.success) {
                const u = (res.users || []).find(x => x.id === sess.id && x.status === 'approved');
                if (u) { this.currentUser = u; this.launchApp(); return; }
            }
        }
        el('authWrap').style.display = 'flex';
    },

    async login() {
        const username = val('loginUsername').trim().toLowerCase();
        const password = val('loginPass').trim();
        const errEl    = el('loginErr');
        errEl.style.display = 'none';

        if (!username || !password) {
            errEl.innerText = 'Please enter username and password.';
            errEl.style.display = 'block'; return;
        }

        const res = await api('auth', { action: 'login', username, password });
        if (!res.success) {
            errEl.innerText = res.error || 'Login failed.';
            errEl.style.display = 'block'; return;
        }

        this.currentUser = res.user;
        LS('educore_session', { id: res.user.id });
        this.launchApp();
    },

    async register() {
        const errEl = el('regErr');
        errEl.style.display = 'none';

        const payload = {
            action:   'register',
            name:     val('regName').trim(),
            username: val('regUsername').trim().toLowerCase(),
            password: val('regPass').trim(),
            role:     this.selectedRole,
            secQ:     val('regSecQ'),
            secA:     val('regSecA').trim().toLowerCase(),
        };

        if (!payload.role) { errEl.innerText = 'Please select your role.'; errEl.style.display = 'block'; return; }

        const res = await api('auth', payload);
        if (!res.success) {
            errEl.innerText = res.error || 'Registration failed.';
            errEl.style.display = 'block'; return;
        }

        // Show success screen
        el('registerForm').style.display = 'none';
        el('regSuccessName').innerHTML = `Signed up as <b>${payload.name}</b> · @${payload.username}`;
        el('regSuccessScreen').style.display = 'block';
        if (el('loginUsername')) el('loginUsername').value = payload.username;
    },

    async forgotLookup() {
        const errEl   = el('forgotErr');
        errEl.style.display = 'none';
        const username = val('forgotUsername').trim().toLowerCase();
        if (!username) { errEl.innerText = 'Please enter your username.'; errEl.style.display = 'block'; return; }

        const res = await api('auth', { action: 'forgot_lookup', username });
        if (!res.success) { errEl.innerText = res.error; errEl.style.display = 'block'; return; }

        el('forgotQuestion').innerText = res.question;
        el('forgotStep1').style.display = 'none';
        el('forgotStep2').style.display = 'block';
    },

    async forgotReset() {
        const errEl = el('forgotErr'), sucEl = el('forgotSuccess');
        errEl.style.display = 'none'; sucEl.style.display = 'none';

        const res = await api('auth', {
            action:   'forgot_reset',
            username: val('forgotUsername').trim().toLowerCase(),
            answer:   val('forgotAnswer').trim().toLowerCase(),
            newPass:  val('forgotNewPass').trim(),
        });

        if (!res.success) { errEl.innerText = res.error; errEl.style.display = 'block'; return; }
        sucEl.innerHTML = '<b>✅ Password reset!</b> You can now sign in.';
        sucEl.style.display = 'block';
        setTimeout(() => this.showLogin(), 2500);
    },

    selectRole(role) {
        this.selectedRole = role;
        ['roleTeacher','roleCounsellor','rolePharm','roleLab','roleAdmin'].forEach(id => {
            const e = el(id); if (e) e.className = 'role-btn';
        });
        const map = { teacher:'roleTeacher', counsellor:'roleCounsellor', librarian:'rolePharm', exam:'roleLab', admin:'roleAdmin' };
        const e = el(map[role]); if (e) e.classList.add('role-selected');
    },

    checkStrength() {
        const p = val('regPass'); let s = 0;
        if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/[0-9]/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
        const colors = ['','#ef4444','#f59e0b','#0ea5e9','#0284c7'];
        const labels = ['','Weak','Fair','Good','Strong'];
        el('strengthFill').style.width  = (s * 25) + '%';
        el('strengthFill').style.background = colors[s] || '#ef4444';
        el('strengthText').innerText = labels[s] || 'Enter a password';
    },

    showLogin() {
        el('loginForm').style.display = 'block';
        el('registerForm').style.display = 'none';
        if (el('forgotForm')) el('forgotForm').style.display = 'none';
        if (el('regSuccessScreen')) el('regSuccessScreen').style.display = 'none';
        const si = el('toggleSignIn'), sr = el('toggleRegister');
        if (si) si.classList.add('active'); if (sr) sr.classList.remove('active');
    },
    showRegister() {
        el('loginForm').style.display = 'none';
        el('registerForm').style.display = 'block';
        if (el('forgotForm')) el('forgotForm').style.display = 'none';
        if (el('regSuccessScreen')) el('regSuccessScreen').style.display = 'none';
        const si = el('toggleSignIn'), sr = el('toggleRegister');
        if (si) si.classList.remove('active'); if (sr) sr.classList.add('active');
    },
    showForgot() {
        el('loginForm').style.display  = 'none';
        el('registerForm').style.display = 'none';
        el('forgotForm').style.display  = 'block';
        el('forgotStep1').style.display = 'block';
        el('forgotStep2').style.display = 'none';
        el('forgotErr').style.display   = 'none';
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('educore_session');
        el('appWrap').classList.remove('visible');
        el('authWrap').style.display = 'flex';
        this.showLogin();
    },

    launchApp() {
        el('authWrap').style.display = 'none';
        el('appWrap').classList.add('visible');
        const u = this.currentUser;

        const roleColors = { admin:'var(--purple)', teacher:'var(--accent)', counsellor:'var(--green)', librarian:'var(--cyan)', exam:'var(--yellow)' };
        el('userAvatar').style.background = roleColors[u.role] || 'var(--muted)';
        el('userAvatar').innerText  = u.name.charAt(0).toUpperCase();
        el('userName').innerText    = u.name;
        el('userRoleLabel').innerText = u.role.charAt(0).toUpperCase() + u.role.slice(1) + ' — ' + u.dept;

        const roleAccess = {
            admin:      ['dash','intake','reg','appt','db','chart','metrics','exam','rooms','library','billing','staff','admin','ledger'],
            teacher:    ['dash','intake','reg','appt','db','chart','metrics','exam','rooms','library'],
            counsellor: ['dash','intake','reg','appt','db','metrics','rooms'],
            librarian:  ['dash','library','metrics'],
            exam:       ['dash','metrics','exam'],
        };
        const allowed = roleAccess[u.role] || ['dash'];
        const allNav  = ['dash','intake','reg','appt','db','chart','metrics','exam','rooms','library','billing','staff','admin','ledger'];

        el('ns-admin').style.display = u.role === 'admin' ? 'block' : 'none';
        allNav.forEach(id => {
            const n = el('nav-' + id); if (!n) return;
            n.style.display = allowed.includes(id) ? 'flex' : 'none';
        });

        App.init();
        if (u.role === 'admin') this.renderAdminPanel().catch(() => {});
        goTo('dash');
    },

    async renderAdminPanel() {
        const res = await api('auth', { action: 'get_users' });
        if (!res.success) return;
        const users = res.users || [];

        if (el('adminStatUsers'))    el('adminStatUsers').innerText    = users.length;
        if (el('adminStatActive'))   el('adminStatActive').innerText   = users.filter(u => u.status !== 'rejected').length;
        if (el('adminStatDisabled')) el('adminStatDisabled').innerText = users.filter(u => u.status === 'rejected').length;
        if (el('adminStatAdmins'))   el('adminStatAdmins').innerText   = users.filter(u => u.role === 'admin').length;
        if (el('allUsersCount'))     el('allUsersCount').innerText     = users.length + ' TOTAL';
        if (el('nb-pending'))        el('nb-pending').style.display    = 'none';

        const roleColors = { admin:'var(--purple)', teacher:'var(--accent)', counsellor:'var(--green)', librarian:'var(--cyan)', exam:'var(--yellow)' };
        const roleHex    = { admin:'#7c3aed', teacher:'#0ea5e9', counsellor:'#16a34a', librarian:'#0891b2', exam:'#d97706' };
        const roleLabels = { teacher:'Teacher', counsellor:'Counsellor', librarian:'Librarian', exam:'Exam Coord', admin:'Admin' };

        if (el('adminRoleBreakdown')) {
            el('adminRoleBreakdown').innerHTML = ['teacher','counsellor','librarian','exam','admin'].map(r => {
                const count = users.filter(u => u.role === r).length;
                const pct   = users.length ? Math.round(count / users.length * 100) : 0;
                return `<div class="role-breakdown-row">
                    <div style="width:80px;font-size:.75rem;font-weight:600;color:${roleHex[r]||'var(--muted)'};">${roleLabels[r]||r}</div>
                    <div class="role-bar-wrap"><div class="role-bar-fill" style="width:${pct}%;background:${roleHex[r]||'var(--muted)'};"></div></div>
                    <div style="width:30px;text-align:right;font-size:.75rem;color:var(--muted);">${count}</div>
                </div>`;
            }).join('');
        }

        if (el('allUsersList')) {
            el('allUsersList').innerHTML = users.map(u => `
                <div class="admin-user-row" data-name="${u.name.toLowerCase()}" data-role="${u.role}">
                    <div class="admin-user-av" style="background:${roleColors[u.role]||'var(--muted)'};">${u.name.charAt(0)}</div>
                    <div style="flex-grow:1;min-width:0;">
                        <div style="font-weight:700;font-size:.85rem;">${u.name} ${u.id===this.currentUser.id?'<span style="font-size:.62rem;color:var(--accent);">(You)</span>':''}</div>
                        <div style="font-size:.72rem;color:var(--muted);margin-top:2px;">@${u.username} &nbsp;·&nbsp; ${u.role} &nbsp;·&nbsp; Joined ${u.created||''}</div>
                    </div>
                    <span class="${u.status==='rejected'?'rejected-badge':'approved-badge'}">${u.status==='rejected'?'Disabled':'Active'}</span>
                    ${u.id !== this.currentUser.id ? `
                    <div style="display:flex;gap:6px;">
                        ${u.status==='rejected'
                            ? `<button class="btn btn-s" style="padding:5px 12px;font-size:.75rem;" onclick="(async()=>{ await Auth.enableUser('${u.id}'); })()">Enable</button>`
                            : `<button class="btn btn-y" style="padding:5px 12px;font-size:.75rem;color:#111;" onclick="(async()=>{ await Auth.disableUser('${u.id}'); })()">Disable</button>`}
                        <button class="tbl-btn tbl-btn-r" onclick="(async()=>{ await Auth.deleteUser('${u.id}'); })()">Delete</button>
                    </div>` : ''}
                </div>`).join('');
        }
    },

    async enableUser(id) {
        await api('auth', { action: 'update_user_status', id, status: 'approved' });
        App.log('USER ENABLED', id, 'User re-enabled by admin', 'bg');
        this.renderAdminPanel().catch(() => {});
    },
    async disableUser(id) {
        await api('auth', { action: 'update_user_status', id, status: 'rejected' });
        App.log('USER DISABLED', id, 'User disabled by admin', 'by');
        this.renderAdminPanel().catch(() => {});
    },
    async deleteUser(id) {
        if (!confirm('Delete this user account?')) return;
        await api('auth', { action: 'delete_user', id });
        App.log('USER DELETED', id, 'Account removed', 'br');
        this.renderAdminPanel().catch(() => {});
    },
    async createAdmin() {
        const errEl = el('createAccErr'), sucEl = el('createAccSuccess');
        if (errEl) errEl.style.display = 'none';
        const res = await api('auth', {
            action:   'create_account',
            name:     val('newAdminName').trim(),
            username: val('newAdminEmail').trim().toLowerCase(),
            password: val('newAdminPass').trim(),
            role:     val('newAccRoleSelect'),
        });
        if (!res.success) { if (errEl) { errEl.innerText = res.error; errEl.style.display = 'block'; } return; }
        el('newAdminName').value = ''; el('newAdminEmail').value = ''; el('newAdminPass').value = '';
        if (sucEl) { sucEl.innerHTML = `<b>Account created!</b> ${res.message}`; sucEl.style.display = 'block'; setTimeout(() => { if (sucEl) sucEl.style.display = 'none'; }, 3000); }
        this.renderAdminPanel().catch(() => {});
    },
};

// ════════════════════════════════════════════════════════════
//  ROOM MANAGER
// ════════════════════════════════════════════════════════════
const RoomMgr = {
    rooms: [], activeIdx: 0,

    save()    { this.rooms.forEach(r => api('data', { action: 'save_room', record: r }).catch(() => {})); },
    async openAddRoom()  { el('addRoomModal').classList.add('open'); },
    async openAddSeats() {
        const s = el('addSeatWardSel'); if (!s) return;
        s.innerHTML = this.rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        el('addSeatModal').classList.add('open');
    },
    addRoom() {
        const name = val('newRoomName').trim(); if (!name) return alert('Room name required.');
        const id   = 'room-' + Date.now();
        this.rooms.push({ id, name, beds: [] });
        api('data', { action: 'save_room', record: { id, name, beds: [] } });
        closeModal('addRoomModal'); el('newRoomName').value = '';
        this.render();
    },
    addSeats() {
        const wid   = val('addSeatWardSel');
        const count = parseInt(val('addSeatCount')) || 5;
        const w     = this.rooms.find(r => r.id === wid); if (!w) return;
        const pre   = w.name.substring(0, 3).toUpperCase();
        const start = w.beds.length + 1;
        for (let i = start; i < start + count; i++) {
            w.beds.push({ num: pre + '-' + String(i).padStart(2, '0'), status: 'free', patient: '', patientPID: '', notes: '' });
        }
        api('data', { action: 'save_room', record: w });
        closeModal('addSeatModal'); this.render();
    },
    switchRoom(i) { this.activeIdx = i; this.renderGrid(i); this.renderSummary(); },
    render() { this.renderTabs(); this.renderGrid(this.activeIdx); this.renderSummary(); },
    renderTabs() {
        const tabs = el('roomTabs'); if (!tabs) return;
        tabs.innerHTML = this.rooms.map((w, i) => {
            const f = w.beds.filter(b => b.status === 'free').length;
            return `<div class="room-tab ${i === this.activeIdx ? 'active' : ''}" onclick="RoomMgr.switchRoom(${i})">${w.name} <span style="font-size:.6rem;opacity:.75;">${f} free</span></div>`;
        }).join('');
    },
    renderGrid(idx) {
        const w = this.rooms[idx]; if (!w) { if (el('seatGrid')) el('seatGrid').innerHTML = ''; return; }
        if (el('roomGridTitle')) el('roomGridTitle').innerText = w.name;
        const cls   = { free: 'bf', occupied: 'bo', reserved: 'br2', maintenance: 'bm' };
        const icons = { free: '🟢', occupied: '🔴', reserved: '🟡', maintenance: '🔧' };
        const grid  = el('seatGrid');
        if (grid) grid.innerHTML = w.beds.map((b, bi) =>
            `<div class="seat-tile ${cls[b.status]||'bf'}" onclick="RoomMgr.openSeatModal(${idx},${bi})">
                <span class="seat-icon">${icons[b.status]||'🟢'}</span>
                <div class="seat-num">Seat ${b.num}</div>
                <div class="seat-slbl">${b.status}</div>
                ${b.patient ? `<div class="seat-pname">${b.patient}</div>` : ''}
            </div>`).join('');
        if (el('seatGridEmpty')) el('seatGridEmpty').style.display = w.beds.length ? 'none' : 'block';
    },
    renderSummary() {
        const tot = this.rooms.reduce((s, w) => s + w.beds.length, 0);
        const fr  = this.totalFree();
        const occ = this.rooms.reduce((s, w) => s + w.beds.filter(b => b.status === 'occupied').length, 0);
        const sum = el('roomSummary');
        if (sum) sum.innerHTML = [
            `<div class="stat"><div class="stat-val cg">${fr}</div><div class="stat-lbl">Free</div></div>`,
            `<div class="stat"><div class="stat-val cr">${occ}</div><div class="stat-lbl">In Use</div></div>`,
            `<div class="stat"><div class="stat-val ca">${tot}</div><div class="stat-lbl">Total Seats</div></div>`,
            `<div class="stat"><div class="stat-val cp">${this.rooms.length}</div><div class="stat-lbl">Rooms</div></div>`,
        ].join('');
    },
    totalFree() { return this.rooms.reduce((s, w) => s + w.beds.filter(b => b.status === 'free').length, 0); },
    allBeds(wid) { const w = this.rooms.find(r => r.id === wid); return w ? w.beds : []; },
    openSeatModal(wi, bi) {
        const b = this.rooms[wi]?.beds[bi]; if (!b) return;
        el('seatModalTitle').innerText = `Seat ${b.num}`;
        el('seatModalBody').innerHTML = `
            <label class="lbl">Status</label>
            <select id="seatStatusSel"><option ${b.status==='free'?'selected':''}>free</option><option ${b.status==='occupied'?'selected':''}>occupied</option><option ${b.status==='reserved'?'selected':''}>reserved</option><option ${b.status==='maintenance'?'selected':''}>maintenance</option></select>
            <label class="lbl">Student</label><input type="text" id="seatPatient" value="${b.patient||''}">
            <label class="lbl">Notes</label><input type="text" id="seatNotes" value="${b.notes||''}">`;
        el('seatModalActions').innerHTML = `
            <button class="btn btn-d" onclick="RoomMgr.deleteSeat(${wi},${bi})">🗑 Remove</button>
            <button class="btn btn-g" onclick="closeModal('seatModal')">Cancel</button>
            <button class="btn btn-p" onclick="RoomMgr.saveSeat(${wi},${bi})">Save</button>`;
        el('seatModal').classList.add('open');
    },
    saveSeat(wi, bi) {
        const b = this.rooms[wi]?.beds[bi]; if (!b) return;
        b.status  = val('seatStatusSel');
        b.patient = val('seatPatient');
        b.notes   = val('seatNotes');
        api('data', { action: 'save_room', record: this.rooms[wi] });
        closeModal('seatModal'); this.render();
    },
    deleteSeat(wi, bi) {
        this.rooms[wi].beds.splice(bi, 1);
        api('data', { action: 'save_room', record: this.rooms[wi] });
        closeModal('seatModal'); this.render();
    },
    populateSelects() {
        const s = el('cSeatRoom'); if (!s) return;
        s.innerHTML = '<option value="">— None —</option>' + this.rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    },
};

// ════════════════════════════════════════════════════════════
//  LIBRARY MANAGER
// ════════════════════════════════════════════════════════════
const LibMgr = {
    resources: [],

    async saveResource() {
        const name = val('itemName').trim(); if (!name) return alert('Item name required.');
        const rec  = {
            id:       uid('ITM'),
            name,
            category: val('itemCat'),
            qty:      parseInt(val('itemQty')) || 0,
            unit:     val('itemUnit'),
            reorder:  parseInt(val('itemReorder')) || 10,
            price:    parseFloat(val('itemPrice')) || 0,
            expiry:   val('itemExpiry'),
            supplier: val('itemSupplier'),
        };
        this.resources.unshift(rec);
        await api('data', { action: 'save_inventory', record: rec });
        ['itemName','itemQty','itemReorder','itemPrice','itemExpiry','itemSupplier'].forEach(id => { const e = el(id); if (e) e.value = ''; });
        App.log('INVENTORY ADD', rec.id, rec.name, 'bg');
        this.render(); this.populateResourceSelect();
    },
    async deleteResource(i) {
        const id = this.resources[i].id;
        this.resources.splice(i, 1);
        await api('data', { action: 'delete_inventory', id });
        this.render();
    },
    async dispense() {
        const sid    = val('issueStudent');
        const resId  = val('issueItem');
        const qty    = parseInt(val('issueQty')) || 1;
        const instr  = val('issueInstr');
        if (!sid || !resId) return alert('Select student and item.');
        const d = this.resources.find(x => x.id === resId);
        if (!d) return;
        if (d.qty < qty) return alert(`Only ${d.qty} ${d.unit} in stock.`);
        d.qty -= qty;
        await api('data', { action: 'save_inventory', record: d });
        App.log('ISSUE', sid, `${qty}x ${d.name} — ${instr}`, 'bc');
        this.render(); this.populateResourceSelect();
        alert(`Issued ${qty}x ${d.name}`);
    },
    render() {
        const q = (val('libSearch') || '').toLowerCase();
        const lc = el('libCount'); if (lc) lc.innerText = this.resources.length;
        const list = el('libList'); if (!list) return;
        const filtered = this.resources.filter(d => !q || d.name.toLowerCase().includes(q));
        const pct = d => d.reorder ? Math.min(100, Math.round(d.qty / (d.reorder * 2) * 100)) : 50;
        list.innerHTML = filtered.slice(0, 30).map((d, i) => `
            <tr>
                <td><b>${d.name}</b></td>
                <td><span class="bdg bb">${d.category||'—'}</span></td>
                <td>
                    <div style="font-weight:700;color:${d.qty<=d.reorder?'var(--red)':'var(--green)'};">${d.qty} ${d.unit||''}</div>
                    <div class="stock-bar"><div class="stock-fill" style="width:${pct(d)}%;background:${d.qty<=d.reorder?'var(--red)':'var(--green)'}"></div></div>
                </td>
                <td>KES ${(d.price||0).toFixed(2)}</td>
                <td>${d.expiry||'—'}</td>
                <td><button class="tbl-btn tbl-btn-r" onclick="LibMgr.deleteResource(${i})">🗑</button></td>
            </tr>`).join('');

        // Low stock alerts
        const alerts = el('dash-lib-alerts');
        if (alerts) {
            const low = this.resources.filter(d => d.qty <= d.reorder);
            alerts.innerHTML = low.length
                ? low.slice(0, 5).map(d => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:.8rem;"><span>${d.name}</span><span style="color:var(--red);font-weight:700;">${d.qty} left</span></div>`).join('')
                : '<div style="color:var(--muted);font-size:.8rem;">All stock levels OK ✓</div>';
        }
    },
    populateResourceSelect() {
        const s = el('issueItem'); if (!s) return;
        s.innerHTML = '<option value="">— Select —</option>' + this.resources.map(d => `<option value="${d.id}">${d.name} (${d.qty} ${d.unit||''})</option>`).join('');
    },
};

// ════════════════════════════════════════════════════════════
//  BILLING
// ════════════════════════════════════════════════════════════
const Billing = {
    items: [],
    _invoices: [],

    addItem() {
        const desc = val('billDesc').trim(), qty = parseInt(val('billQtyI')) || 1, unit = parseFloat(val('billUnit')) || 0;
        if (!desc) return;
        this.items.push({ desc, qty, unit, total: qty * unit });
        el('billDesc').value = ''; el('billQtyI').value = 1; el('billUnit').value = '';
        this.renderItems();
    },
    removeItem(i) { this.items.splice(i, 1); this.renderItems(); },
    renderItems() {
        el('billItems').innerHTML = this.items.map((it, i) =>
            `<div style="display:grid;grid-template-columns:2fr .5fr 1fr 1fr auto;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:.82rem;">
                <span>${it.desc}</span><span>${it.qty}</span>
                <span>KES ${it.unit.toFixed(2)}</span>
                <span style="font-weight:700;color:var(--accent);">KES ${it.total.toFixed(2)}</span>
                <button class="tbl-btn tbl-btn-r" onclick="Billing.removeItem(${i})">✕</button>
            </div>`).join('');
        const total = this.items.reduce((s, i) => s + i.total, 0);
        el('billTotal').innerText = total.toFixed(2);
        this.calcBalance();
    },
    calcBalance() {
        const total = this.items.reduce((s, i) => s + i.total, 0);
        const paid  = parseFloat(val('billPaid')) || 0;
        el('billBalance').innerText = Math.max(0, total - paid).toFixed(2);
    },
    async saveInvoice() {
        const pid = val('billPatient').trim();
        if (!pid || !this.items.length) return alert('Add student and items.');
        const total = this.items.reduce((s, i) => s + i.total, 0);
        const paid  = parseFloat(val('billPaid')) || 0;
        const bal   = Math.max(0, total - paid);
        const inv   = { id: 'INV-' + Date.now(), pid, items: [...this.items], total, paid, balance: bal, method: val('billMethod'), date: today() };
        this._invoices.unshift(inv);
        await api('data', { action: 'save_invoice', record: inv });
        const p = App.db.find(x => x.id === pid);
        if (p) { p.balance = (p.balance || 0) + bal; await api('students', { action: 'save', student: p }); }
        App.log('INVOICE', inv.id, `${pid} — KES ${total.toFixed(2)}`, 'by');
        this.items = []; this.renderItems(); el('billPaid').value = ''; el('billBalance').innerText = '0.00';
        this.renderInvoices(); App.renderDB(); alert('🧾 Invoice saved.');
    },
    renderInvoices() {
        const invs = this._invoices;
        const ic = el('invoiceCount'); if (ic) ic.innerText = invs.length + ' INVOICES';
        const il = el('invoiceList'); if (!il) return;
        il.innerHTML = invs.map(inv =>
            `<tr>
                <td class="mono">${inv.id}</td><td>${inv.student_id||inv.pid}</td>
                <td style="color:var(--accent);font-weight:700;">KES ${parseFloat(inv.total).toFixed(2)}</td>
                <td style="color:var(--green);">KES ${parseFloat(inv.paid).toFixed(2)}</td>
                <td style="color:${inv.balance>0?'var(--red)':'var(--green)'};font-weight:700;">KES ${parseFloat(inv.balance).toFixed(2)}</td>
                <td><span class="bdg by">${inv.method}</span></td>
                <td>${inv.date}</td>
            </tr>`).join('');
    },
};

// ════════════════════════════════════════════════════════════
//  MAIN APP
// ════════════════════════════════════════════════════════════
const App = {
    db: [], logs: [], intake: [], appts: [], metricsLog: [], exams: [], staff: [],
    activePID: null, activeDisp: null, activeIntakeLevel: null, activeVPID: null, activeExamPID: null,
    rxList: [], mode: 'new', _invoices: [],

    // ── Load all data from PHP APIs ──────────────────────────
    async loadAll() {
        try {
            showLoader('Loading data…');
            const [sr, ir, ar, mr, er, str, rr, invr, logr] = await Promise.all([
                api('students', { action: 'get_all' }),
                api('data',     { action: 'get_intake' }),
                api('data',     { action: 'get_sessions' }),
                api('data',     { action: 'get_metrics' }),
                api('data',     { action: 'get_exams' }),
                api('data',     { action: 'get_staff' }),
                api('data',     { action: 'get_rooms' }),
                api('data',     { action: 'get_invoices' }),
                api('data',     { action: 'get_logs' }),
            ]);
            this.db        = sr.students  || [];
            this.intake    = ir.intake    || [];
            this.appts     = ar.sessions  || [];
            this.metricsLog= mr.metrics   || [];
            this.exams     = er.exams     || [];
            this.staff     = str.staff    || [];
            RoomMgr.rooms  = (rr.rooms    || []).map(r => ({ ...r, beds: Array.isArray(r.beds) ? r.beds : JSON.parse(r.beds || '[]') }));
            if (!RoomMgr.rooms.length) RoomMgr.seedDefaults();
            Billing._invoices = invr.invoices || [];
            this.logs      = logr.logs    || [];
            const invRes   = await api('data', { action: 'get_inventory' });
            LibMgr.resources = invRes.inventory || [];
        } catch (e) {
            console.error('loadAll error:', e);
        } finally {
            hideLoader();
        }
    },

    async init() {
        setInterval(() => { const t = el('clock-top'); if (t) t.innerText = new Date().toLocaleString(); }, 1000);
        await this.loadAll();
        RoomMgr.populateSelects();
        LibMgr.render(); LibMgr.populateResourceSelect(); Billing.renderInvoices();
        this.renderDB(); this.renderDash(); this.renderIntake();
        this.renderAppts(); this.renderMetrics(); this.renderExam(); this.renderStaff();
        this.updateBadges(); setInterval(() => this.updateBadges(), 30000);
        this.renderLedger();
    },

    log(action, target, details, cls) {
        try {
            const user  = Auth.currentUser;
            const entry = { time: ts(), user: user ? user.name : 'System', action, target, details, cls };
            this.logs.unshift(entry);
            api('data', { action: 'add_log', record: entry }).catch(() => {});
            try { this.renderLedger(); } catch (e) {}
        } catch (e) {}
    },

    updateBadges() {
        const ib = el('nb-intake'); if (ib) ib.innerText = this.intake.filter(t => t.status === 'Waiting').length;
        const ab = el('nb-appt');   if (ab) ab.innerText = this.appts.filter(a => a.date === new Date().toISOString().split('T')[0]).length;
        const urgent = this.intake.filter(t => t.level <= 2 && t.status === 'Waiting').length;
        const ha = el('hdrAlert'); if (ha) ha.style.display = urgent > 0 ? 'block' : 'none';
    },

    // ── DASHBOARD ────────────────────────────────────────────
    renderDash() {
        try {
            const ds = el('dashStats');
            if (ds) ds.innerHTML = [
                `<div class="stat"><div class="stat-val ca">${this.db.length}</div><div class="stat-lbl">Students</div></div>`,
                `<div class="stat"><div class="stat-val cg">${this.intake.filter(t=>t.status==='Waiting').length}</div><div class="stat-lbl">In Intake</div></div>`,
                `<div class="stat"><div class="stat-val cy">${this.appts.filter(a=>a.date===new Date().toISOString().split('T')[0]).length}</div><div class="stat-lbl">Sessions Today</div></div>`,
                `<div class="stat"><div class="stat-val cp">${RoomMgr.totalFree()}</div><div class="stat-lbl">Seats Free</div></div>`,
            ].join('');

            const dtl = el('dash-intake-list'); if (dtl) {
                const waiting = this.intake.filter(t => t.status === 'Waiting').slice(0, 5);
                dtl.innerHTML = waiting.length
                    ? waiting.map(t => `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:.82rem;"><span><b>${t.name}</b> — ${t.complaint||'—'}</span><span class="bdg ${t.level<=2?'br':t.level===3?'by':'bg'}">P${t.level}</span></div>`).join('')
                    : '<div style="color:var(--muted);font-size:.8rem;padding:8px 0;">No students waiting ✓</div>';
                const dtc = el('dash-intake-count'); if (dtc) dtc.innerText = waiting.length;
            }

            const dal = el('dash-appt-list'); if (dal) {
                const today_str = new Date().toISOString().split('T')[0];
                const todayAppts = this.appts.filter(a => a.date === today_str).slice(0, 5);
                dal.innerHTML = todayAppts.length
                    ? todayAppts.map(a => `<div class="appt-slot"><div class="appt-time">${a.time||'—'}</div><div><div style="font-size:.82rem;font-weight:600;">${a.student}</div><div style="font-size:.65rem;color:var(--muted);">${a.dept}</div></div></div>`).join('')
                    : '<div style="color:var(--muted);font-size:.8rem;padding:8px 0;">No sessions today</div>';
                const dac = el('dash-appt-count'); if (dac) dac.innerText = todayAppts.length;
            }

            const dbs = el('dash-bed-summary'); if (dbs) {
                dbs.innerHTML = RoomMgr.rooms.map(w => {
                    const wf  = w.beds.filter(b => b.status === 'free').length;
                    const pct = w.beds.length ? Math.round(wf / w.beds.length * 100) : 0;
                    return `<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:.78rem;margin-bottom:3px;"><span>${w.name}</span><span style="color:${wf?'var(--green)':'var(--red)'};font-weight:600;">${wf}/${w.beds.length} free</span></div><div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${wf?'var(--green)':'var(--red)'}"></div></div></div>`;
                }).join('') || '<div style="color:var(--muted);font-size:.8rem;">No rooms configured yet.</div>';
            }
        } catch (e) {}
    },

    // ── INTAKE ───────────────────────────────────────────────
    setIntake(lvl) {
        this.activeIntakeLevel = lvl;
        for (let i = 1; i <= 5; i++) { const b = el('tl' + i); if (b) b.classList.toggle('sel', i === lvl); }
    },
    async saveIntake() {
        const name = val('trName').trim();
        if (!name) return alert('Name required.');
        if (!this.activeIntakeLevel) return alert('Select priority level.');
        const rec = { id: uid('TRG'), name, complaint: val('trComplaint'), level: this.activeIntakeLevel, bp: val('trBP'), pr: val('trPR'), temp: val('trTemp'), spo2: val('trSPO2'), counsellor: val('trCounsellor'), status: 'Waiting' };
        this.intake.unshift(rec);
        await api('data', { action: 'save_intake', record: rec });
        this.log('INTAKE', rec.id, `${name} — P${rec.level}: ${rec.complaint}`, 'br');
        ['trName','trComplaint','trBP','trPR','trTemp','trSPO2','trCounsellor'].forEach(id => { const e = el(id); if (e) e.value = ''; });
        this.activeIntakeLevel = null; for (let i = 1; i <= 5; i++) { const b = el('tl' + i); if (b) b.classList.remove('sel'); }
        this.renderIntake(); this.renderDash(); this.updateBadges();
    },
    renderIntake() {
        try {
            const lvlNames = ['','Critical','Urgent','High','Medium','Routine'];
            const tqc = el('intakeQueueCount'); if (tqc) tqc.innerText = this.intake.filter(t => t.status === 'Waiting').length + ' WAITING';
            const tq  = el('intakeQueue'); if (!tq) return;
            tq.innerHTML = this.intake.slice(0, 20).map((t, i) =>
                `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:10px 12px;margin-bottom:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="font-weight:700;font-size:.85rem;">${t.name}</span>
                        <div style="display:flex;gap:6px;">
                            <span class="bdg ${t.level<=2?'br':t.level===3?'by':'bg'}">P${t.level} ${lvlNames[t.level]||''}</span>
                            <span class="bdg ${t.status==='Waiting'?'by':'bg'}">${t.status}</span>
                        </div>
                    </div>
                    <div style="font-size:.75rem;color:var(--muted);">${t.complaint||'—'} | BP:${t.bp||'—'} PR:${t.pr||'—'}</div>
                    <div style="margin-top:7px;display:flex;gap:6px;">
                        ${t.status==='Waiting'?`<button class="tbl-btn tbl-btn-g" onclick="(async()=>App.attendIntake(${i}))()">✅ Seen</button>`:''}
                        <button class="tbl-btn" onclick="App.intakeToReg('${t.id}')">📝 Register</button>
                        <button class="tbl-btn tbl-btn-r" onclick="(async()=>App.removeIntake(${i}))()">🗑</button>
                    </div>
                </div>`).join('');
        } catch (e) {}
    },
    async attendIntake(i) {
        this.intake[i].status = 'Seen';
        await api('data', { action: 'save_intake', record: this.intake[i] });
        this.renderIntake(); this.renderDash(); this.updateBadges();
    },
    async removeIntake(i) {
        const id = this.intake[i].id; this.intake.splice(i, 1);
        await api('data', { action: 'delete_intake', id });
        this.renderIntake(); this.updateBadges();
    },
    intakeToReg(id) { const t = this.intake.find(x => x.id === id); if (!t) return; el('pName').value = t.name; goTo('reg'); },

    // ── REGISTRATION ─────────────────────────────────────────
    setMode(m) {
        this.mode = m;
        el('btnNew').classList.toggle('active', m === 'new');
        el('btnOld').classList.toggle('active', m === 'old');
        el('recallBox').style.display = m === 'old' ? 'block' : 'none';
        el('mainBtn').className = m === 'new' ? 'btn btn-p btn-full' : 'btn btn-s btn-full';
        el('mainBtn').innerHTML = m === 'new' ? 'Save Student' : '📂 Re-Open File';
        if (m === 'new') this.clearReg();
    },
    dbSearch() {
        const q = val('dbQuery').toLowerCase();
        const list = el('resultsList'); if (!q) { list.innerHTML = ''; return; }
        list.innerHTML = this.db.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).map(p =>
            `<div class="recall-res" onclick="App.autoFill('${p.id}')">${p.name} (${p.id})</div>`).join('');
    },
    autoFill(pid) {
        const p = this.db.find(x => x.id === pid); if (!p) return;
        this.activePID = pid;
        [['pName','name'],['pID','natID'],['pDOB','dob'],['pAddr','addr'],['pPhone','phone'],['pKin','kin'],['pIns','ins'],['pPol','pol']].forEach(([id,key]) => { const e = el(id); if (e) e.value = p[key] || ''; });
        el('resultsList').innerHTML = '';
        this.log('RECALL', p.id, `Loaded: ${p.name}`, 'by');
    },
    async savePatient() {
        if (this.mode === 'old') { this.openChart(this.activePID); return; }
        const name = val('pName').trim(); if (!name) return alert('Name required.');
        const newID = uid('SID');
        const rec = { id: newID, name, natID: val('pID'), dob: val('pDOB'), gender: val('pGender'), blood: val('pBlood'), addr: val('pAddr'), phone: val('pPhone'), kin: val('pKin'), kinPhone: val('pKinPhone'), kinRel: val('pKinRel'), ins: val('pIns'), pol: val('pPol'), occ: val('pOcc'), complaint:'', hpi:'', pastHistory:'', resourceHistory:'', familyHistory:'', socialHistory:'', review:'', exam:'', diagnosis:'', icd:'', currentNote:'', nextVisitDate:'', nextVisitPurpose:'', disposition:'', bedWardId:'', roomAssigned:'', wardAssigned:'', rxList:[], balance:0, lastVisit: today() };
        this.db.push(rec);
        await api('students', { action: 'save', student: rec });
        this.log('REGISTRATION', newID, `New student: ${name}`, 'bg');
        this.renderDB(); this.renderDash(); this.openChart(newID);
    },

    // ── APPOINTMENTS ─────────────────────────────────────────
    apptSearch() {
        const q = val('apptPatient').toLowerCase();
        const res = el('apptSearchRes'); if (!q) { res.innerHTML = ''; return; }
        res.innerHTML = this.db.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).slice(0, 4).map(p =>
            `<div class="recall-res" onclick="App.setApptP('${p.id}','${p.name}')">${p.name} (${p.id})</div>`).join('');
    },
    setApptP(pid, name) { el('apptPatient').value = name + ' (' + pid + ')'; this._apptPID = pid; el('apptSearchRes').innerHTML = ''; },
    async saveAppt() {
        const student = val('apptPatient').trim(); if (!student) return alert('Student required.');
        const rec = { id: uid('APT'), student, student_id: this._apptPID || '', teacher: val('apptDoctor'), dept: val('apptDept'), date: val('apptDate'), time: val('apptTime'), type: val('apptType'), notes: val('apptNotes'), status: 'Scheduled' };
        this.appts.unshift(rec);
        await api('data', { action: 'save_session', record: rec });
        this.log('SESSION', rec.id, `${student} — ${rec.dept} on ${rec.date}`, 'bb');
        ['apptPatient','apptDoctor','apptDate','apptTime','apptNotes'].forEach(id => { const e = el(id); if (e) e.value = ''; });
        this._apptPID = null; this.renderAppts(); this.renderDash(); this.updateBadges();
    },
    renderAppts() {
        try {
            const ac = el('apptCount'); if (ac) ac.innerText = this.appts.length;
            const al = el('apptList'); if (!al) return;
            al.innerHTML = this.appts.slice(0, 20).map((a, i) =>
                `<div class="appt-slot"><div class="appt-time">${a.time||'—'}</div><div style="flex-grow:1;"><div style="font-size:.82rem;font-weight:600;">${a.student}</div><div style="font-size:.65rem;color:var(--muted);">${a.dept} — ${a.date}</div></div><span class="bdg bb">${a.status}</span><button class="tbl-btn tbl-btn-r" style="margin-left:6px;" onclick="(async()=>App.cancelAppt(${i}))()">Cancel</button></div>`).join('');
        } catch (e) {}
    },
    async cancelAppt(i) { this.appts[i].status = 'Cancelled'; await api('data', { action: 'save_session', record: this.appts[i] }); this.renderAppts(); },

    // ── CLINICAL CHART ───────────────────────────────────────
    openChart(pid) {
        const p = this.db.find(x => x.id === pid); if (!p) return;
        this.activePID = pid; this.rxList = p.rxList || [];
        el('activePatientName').innerText = p.name;
        el('activePIDBadge').innerText = 'SID: ' + p.id;
        const bb = el('activeBloodBadge'); if (bb) { bb.innerText = p.blood || ''; bb.style.display = p.blood ? 'inline-block' : 'none'; }
        const map = { cComplaint:'complaint', cHPI:'hpi', cPastHistory:'pastHistory', cDrugHistory:'resourceHistory', cFamilyHistory:'familyHistory', cSocialHistory:'socialHistory', cReview:'review', cExam:'exam', cDiagnosis:'diagnosis', cICD:'icd', cNote:'currentNote', cNextDate:'nextVisitDate', cNextPurpose:'nextVisitPurpose' };
        for (const [id, key] of Object.entries(map)) { const e = el(id); if (e) e.value = p[key] || ''; }
        RoomMgr.populateSelects();
        el('cSeatRoom').value = p.bedWardId || ''; this.populateBedSelect(); el('cSeatNum').value = p.roomAssigned || '';
        this.activeDisp = p.disposition || null; this._applyDispUI(p); this._applyDischargeMode(p.disposition);
        this.renderRx(); this.log('FILE ACCESS', p.id, `Chart opened: ${p.name}`, 'bb'); goTo('chart');
    },
    populateBedSelect() {
        const wardId = val('cSeatRoom'), s = el('cSeatNum'); if (!wardId) { s.innerHTML = '<option value="">— Select Room —</option>'; return; }
        s.innerHTML = '<option value="">— None —</option>' + RoomMgr.allBeds(wardId).map(b => {
            const ok = b.status === 'free' || b.patientPID === this.activePID;
            return `<option value="${b.num}">${ok?'🟢':'🔴'} Seat ${b.num} — ${b.status}${b.patient?' ('+b.patient+')':''}</option>`;
        }).join('');
    },
    addRx() {
        const resource = val('rxResource').trim(), dose = val('rxDose').trim(), dur = val('rxDur').trim();
        if (!resource) return; this.rxList.push({ resource, dose, dur });
        ['rxResource','rxDose','rxDur'].forEach(id => { const e = el(id); if (e) e.value = ''; }); this.renderRx();
    },
    removeRx(i) { this.rxList.splice(i, 1); this.renderRx(); },
    renderRx() { el('rxList').innerHTML = this.rxList.map((r, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:.8rem;"><span>📚 <b>${r.resource}</b> — ${r.dose} × ${r.dur}</span><button class="tbl-btn tbl-btn-r" onclick="App.removeRx(${i})">✕</button></div>`).join(''); },
    setDisp(type) { this.activeDisp = this.activeDisp === type ? null : type; this._applyDispUI(null); this._applyDischargeMode(this.activeDisp); },
    _applyDispUI(p) {
        ['return','referral','transfer'].forEach(t => { el('disp-' + t).className = 'disp-card'; el('dd-' + t).classList.remove('open'); });
        const s = this.activeDisp; if (!s) return;
        const cm = { return:'sel-return', referral:'sel-referral', transfer:'sel-transfer' };
        el('disp-' + s).classList.add(cm[s]); el('dd-' + s).classList.add('open');
        if (p) {
            if (s === 'return')   { el('cDispRD').value = p.dispRD||''; el('cDispRR').value = p.dispRR||''; }
            if (s === 'referral') { el('cDispRH').value = p.dispRH||''; el('cDispRDept').value = p.dispRDept||''; el('cDispRDate').value = p.dispRDate||''; el('cDispReason').value = p.dispReason||''; }
            if (s === 'transfer') { el('cTransferNote').value = p.dispDN||''; el('cTransferDate').value = p.dispDD||''; el('cTransferCondition').value = p.dispDC||''; }
        }
    },
    _applyDischargeMode(disp) {
        const d = disp === 'transfer';
        ['chart-room-panel','chart-next-panel'].forEach(id => { const e = el(id); if (e) e.style.display = d ? 'none' : 'block'; });
        ['disp-return','disp-referral'].forEach(id => { const e = el(id); if (e) e.style.display = d ? 'none' : ''; });
        ['dd-return','dd-referral'].forEach(id => { const e = el(id); if (d && e) e.classList.remove('open'); });
        const banner = el('discharged-banner'); if (banner) banner.style.display = d ? 'flex' : 'none';
        const saveBtn = el('chart-save-btn'); if (saveBtn) { saveBtn.style.opacity = d ? '.5' : '1'; }
    },
    async saveAcademic() {
        const p = this.db.find(x => x.id === this.activePID); if (!p) return alert('No student loaded.');
        const map = { complaint:'cComplaint', hpi:'cHPI', pastHistory:'cPastHistory', resourceHistory:'cDrugHistory', familyHistory:'cFamilyHistory', socialHistory:'cSocialHistory', review:'cReview', exam:'cExam', diagnosis:'cDiagnosis', icd:'cICD', currentNote:'cNote', nextVisitDate:'cNextDate', nextVisitPurpose:'cNextPurpose' };
        for (const [key, id] of Object.entries(map)) { p[key] = val(id); }
        p.rxList = [...this.rxList];
        const prevWard = p.bedWardId, prevBed = p.roomAssigned;
        p.bedWardId = val('cSeatRoom'); p.roomAssigned = val('cSeatNum');
        const wObj = RoomMgr.rooms.find(w => w.id === p.bedWardId);
        p.wardAssigned = wObj ? wObj.name : '';
        if (prevWard && prevBed && (prevWard !== p.bedWardId || prevBed !== p.roomAssigned)) {
            const ow = RoomMgr.rooms.find(w => w.id === prevWard);
            if (ow) { const ob = ow.beds.find(b => b.num === prevBed); if (ob && ob.patientPID === p.id) { ob.status = 'free'; ob.patient = ''; ob.patientPID = ''; } }
        }
        if (p.bedWardId && p.roomAssigned && wObj) {
            const nb = wObj.beds.find(b => b.num === p.roomAssigned);
            if (nb) { nb.status = 'occupied'; nb.patient = p.name; nb.patientPID = p.id; }
        }
        RoomMgr.save();
        p.disposition = this.activeDisp || '';
        p.dispRD = val('cDispRD'); p.dispRR = val('cDispRR'); p.dispRH = val('cDispRH');
        p.dispRDept = val('cDispRDept'); p.dispRDate = val('cDispRDate'); p.dispReason = val('cDispReason');
        p.dispDN = val('cTransferNote'); p.dispDD = val('cTransferDate'); p.dispDC = val('cTransferCondition');
        p.lastVisit = today();
        await api('students', { action: 'save', student: p });
        this.log('ACADEMIC UPDATE', p.id, `Outcome: ${p.diagnosis||'—'}`, 'bb');
        this.renderDB(); this.renderDash(); alert('Academic record saved.');
    },

    // ── METRICS ──────────────────────────────────────────────
    vSearch() {
        const q = val('vPatient').toLowerCase(); const res = el('vSearchRes'); if (!q) { res.innerHTML = ''; return; }
        res.innerHTML = this.db.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).slice(0, 4).map(p =>
            `<div class="recall-res" onclick="App.setVP('${p.id}','${p.name}')">${p.name} (${p.id})</div>`).join('');
    },
    setVP(pid, name) {
        this.activeVPID = pid; el('vPatient').value = name + ' (' + pid + ')'; el('vSearchRes').innerHTML = ''; el('vActivePatient').innerText = '▸ ' + name;
        el('vWeight').oninput = el('vHeight').oninput = () => { const w = parseFloat(val('vWeight')), h = parseFloat(val('vHeight')) / 100; if (w && h) el('vCreditRatio').value = (w / (h * h)).toFixed(1); };
    },
    async saveMetrics() {
        const pid = this.activeVPID; if (!pid) return alert('Select a student first.');
        const rec = { student_id: pid, student_name: el('vActivePatient').innerText.replace('▸ ', ''), attendance: val('vAR'), gpa: val('vPR'), behaviour: val('vTemp'), participation: val('vPart'), homework: val('vRR'), credits: val('vWeight'), total_credits: val('vHeight'), credit_ratio: val('vCreditRatio'), test_avg: val('vTestAvg'), notes: val('vNotes') };
        this.metricsLog.unshift(rec);
        await api('data', { action: 'save_metric', record: rec });
        this.log('METRICS', pid, `Attend:${rec.attendance} GPA:${rec.gpa}`, 'bc');
        ['vAR','vPR','vTemp','vPart','vRR','vWeight','vHeight','vCreditRatio','vTestAvg','vNotes'].forEach(id => { const e = el(id); if (e) e.value = ''; });
        this.renderMetrics(); alert('Metrics saved.');
    },
    renderMetrics() {
        try {
            const vl = el('metricsLog'); if (!vl) return;
            vl.innerHTML = this.metricsLog.slice(0, 20).map(v =>
                `<tr><td style="font-size:.68rem;">${v.created_at||'—'}</td><td>${v.student_name||'—'}</td><td>${v.attendance||'—'}</td><td>${v.gpa||'—'}</td><td>${v.behaviour||'—'}</td><td>${v.participation||'—'}</td><td>${v.credits||'—'}</td></tr>`).join('');
        } catch (e) {}
    },

    // ── EXAMS ────────────────────────────────────────────────
    examSearch() {
        const q = val('examStudent').toLowerCase(); const res = el('examSearchRes'); if (!q) { if (res) res.innerHTML = ''; return; }
        if (res) res.innerHTML = this.db.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).slice(0, 4).map(p =>
            `<div class="recall-res" onclick="App.setEP('${p.id}','${p.name}')">${p.name} (${p.id})</div>`).join('');
    },
    setEP(pid, name) { this.activeExamPID = pid; const lp = el('examStudent'); if (lp) lp.value = name + ' (' + pid + ')'; const lr = el('examSearchRes'); if (lr) lr.innerHTML = ''; const la = el('examActiveStudent'); if (la) la.innerText = '▸ ' + name; },
    async saveExam() {
        const pid = this.activeExamPID; if (!pid) return alert('Select a student.');
        const cat = val('examCat'); if (!cat) return alert('Select category.');
        const la = el('examActiveStudent');
        const rec = { id: uid('EXM'), pid, student_id: pid, student_name: la ? la.innerText.replace('▸ ', '') : '', cat, category: cat, note: val('examNote'), priority: val('examPriority'), teacher: val('examTeacher'), status: 'Pending', result: '' };
        this.exams.unshift(rec);
        await api('data', { action: 'save_exam', record: rec });
        this.log('EXAM REQUEST', rec.id, `${cat} for ${pid}`, 'bp');
        ['examNote','examTeacher'].forEach(id => { const e = el(id); if (e) e.value = ''; });
        this.activeExamPID = null; if (la) la.innerText = ''; this.renderExam();
    },
    openExamResult(idx) {
        const exam = this.exams[idx]; if (!exam) return;
        const rt = el('examResTitle'); if (rt) rt.innerText = '📝 ' + (exam.cat || exam.category);
        const ri = el('examResIdx'); if (ri) ri.value = idx;
        const rv = el('examResText'); if (rv) rv.value = exam.result || '';
        const rs = el('examResStatus'); if (rs) rs.value = exam.status;
        el('examResultModal').classList.add('open');
    },
    async saveExamResult() {
        const idx = parseInt(val('examResIdx')); if (isNaN(idx) || !this.exams[idx]) return;
        this.exams[idx].result = val('examResText'); this.exams[idx].status = val('examResStatus');
        await api('data', { action: 'save_exam', record: this.exams[idx] });
        this.log('EXAM RESULT', this.exams[idx].id, `Result: ${this.exams[idx].cat||this.exams[idx].category}`, 'bp');
        closeModal('examResultModal'); this.renderExam();
    },
    renderExam() {
        try {
            const ec = el('examCount'); if (ec) ec.innerText = this.exams.length;
            const ll = el('examList'); if (!ll) return;
            ll.innerHTML = this.exams.slice(0, 30).map((exam, i) =>
                `<tr><td style="font-size:.68rem;">${exam.created_at||'—'}</td>
                 <td>${exam.student_name||'—'}<br><span class="mono">${exam.pid||exam.student_id||'—'}</span></td>
                 <td><b>${exam.cat||exam.category||'—'}</b>${exam.note?`<br><span style="font-size:.65rem;color:var(--muted);">${exam.note}</span>`:''}</td>
                 <td><span class="bdg ${exam.priority==='STAT'?'br':exam.priority==='Urgent'?'by':'bb'}">${exam.priority||'Routine'}</span></td>
                 <td><span class="bdg ${exam.status==='Completed'?'bg':'by'}">${exam.status}</span></td>
                 <td><button class="tbl-btn" onclick="App.openExamResult(${i})">📋 Result</button></td></tr>`).join('');
        } catch (e) {}
    },

    // ── STUDENT RECORDS ──────────────────────────────────────
    renderDB() {
        try {
            const q = (val('dbSearch') || '').toLowerCase();
            const dc = el('dbCount'); if (dc) dc.innerText = this.db.length + ' RECORDS';
            const filtered = this.db.filter(p => !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
            const dispBadge = p => {
                if (!p.disposition) return '<span style="color:var(--muted);">—</span>';
                if (p.disposition === 'return')   return `<span class="bdg bg">🔄</span>`;
                if (p.disposition === 'referral') return `<span class="bdg by">🏫</span>`;
                if (p.disposition === 'transfer') return `<span class="bdg br">✅</span>`;
                return '';
            };
            const dbc = el('dbContent'); if (!dbc) return;
            dbc.innerHTML = [...filtered].reverse().map(p =>
                `<tr>
                    <td class="mono">${p.id}</td>
                    <td><b>${p.name}</b><br><span style="font-size:.65rem;color:var(--muted);">${p.gender||''}</span></td>
                    <td>${p.gender||'—'}</td>
                    <td>${p.blood?`<span class="bdg bb">${p.blood}</span>`:'—'}</td>
                    <td>${p.lastVisit||'—'}</td>
                    <td>${dispBadge(p)}</td>
                    <td>${p.roomAssigned?`<span class="bdg bp">${p.roomAssigned}</span>`:'—'}</td>
                    <td style="color:${(p.balance||0)>0?'var(--red)':'var(--green)'};font-weight:700;">KES ${(p.balance||0).toFixed(2)}</td>
                    <td style="display:flex;gap:4px;">
                        <button class="tbl-btn" onclick="App.openChart('${p.id}')">Chart</button>
                        <button class="tbl-btn" onclick="App.toBill('${p.id}')">Bill</button>
                    </td>
                </tr>`).join('');
            this.renderStats();
        } catch (e) {}
    },
    toBill(pid) {
        const p = this.db.find(x => x.id === pid); if (!p) return;
        const bp = el('billPatient'); if (bp) bp.value = p.id;
        const bap = el('billActivePatient'); if (bap) bap.innerText = '▸ ' + p.name;
        goTo('billing');
    },
    billSearch() {
        const q = val('billPatient').toLowerCase(); const res = el('billSearchRes'); if (!q) { if (res) res.innerHTML = ''; return; }
        if (res) res.innerHTML = this.db.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)).slice(0, 4).map(p =>
            `<div class="recall-res" onclick="App.setBP('${p.id}','${p.name}')">${p.name} (${p.id})</div>`).join('');
    },
    setBP(pid, name) { const bp = el('billPatient'); if (bp) bp.value = pid; const bsr = el('billSearchRes'); if (bsr) bsr.innerHTML = ''; const bap = el('billActivePatient'); if (bap) bap.innerText = '▸ ' + name; },
    renderStats() {
        try {
            const fr = RoomMgr.totalFree();
            const sr = el('statsRow'); if (!sr) return;
            sr.innerHTML = `
                <div class="stat"><div class="stat-val ca">${this.db.length}</div><div class="stat-lbl">Students</div></div>
                <div class="stat"><div class="stat-val cg">${this.db.filter(p=>p.disposition==='return').length}</div><div class="stat-lbl">Return Visits</div></div>
                <div class="stat"><div class="stat-val cy">${this.db.filter(p=>p.disposition==='referral').length}</div><div class="stat-lbl">Referred</div></div>
                <div class="stat"><div class="stat-val cp">${fr}</div><div class="stat-lbl">Seats Free</div></div>`;
        } catch (e) {}
    },

    // ── STAFF ────────────────────────────────────────────────
    async saveStaff() {
        const name = val('sfName').trim(); if (!name) return alert('Name required.');
        const rec = { id: uid('STF'), name, staffId: val('sfID'), staff_id: val('sfID'), role: val('sfRole'), dept: val('sfDept'), phone: val('sfPhone'), status: val('sfStatus'), spec: val('sfSpec'), joined: today() };
        this.staff.unshift(rec);
        await api('data', { action: 'save_staff', record: rec });
        this.log('STAFF ADDED', rec.id, `${name} — ${rec.role}`, 'bpk');
        ['sfName','sfID','sfPhone','sfSpec'].forEach(id => { const e = el(id); if (e) e.value = ''; });
        this.renderStaff();
    },
    renderStaff() {
        try {
            const sc = el('staffCount'); if (sc) sc.innerText = this.staff.length;
            const rc = { Teacher:'var(--accent)', Counsellor:'var(--green)', 'Academic Officer':'var(--cyan)', default:'var(--muted)' };
            const ss = { 'In Class':'cg', 'Off Campus':'cr', 'Night Duty':'cc', 'On Leave':'cy' };
            const sg = el('staffGrid'); if (!sg) return;
            sg.innerHTML = this.staff.map((s, i) =>
                `<div class="staff-card">
                    <div class="staff-avatar" style="background:${rc[s.role]||rc.default};">${s.name.charAt(0)}</div>
                    <div style="flex-grow:1;min-width:0;">
                        <div style="font-size:.82rem;font-weight:700;">${s.name}</div>
                        <div style="font-size:.65rem;color:var(--muted);">${s.role||'—'}</div>
                        <div style="font-size:.6rem;" class="${ss[s.status]||''}">● ${s.status||'—'}</div>
                    </div>
                    <button class="tbl-btn tbl-btn-r" onclick="(async()=>App.removeStaff(${i}))()">🗑</button>
                </div>`).join('');
        } catch (e) {}
    },
    async removeStaff(i) {
        const id = this.staff[i].id; this.staff.splice(i, 1);
        await api('data', { action: 'delete_staff', id });
        this.renderStaff();
    },

    // ── LEDGER ───────────────────────────────────────────────
    renderLedger() {
        try {
            const rows = this.logs.map(l =>
                `<tr><td>${l.time||'—'}</td><td style="color:var(--muted);">${l.user||'—'}</td><td><span class="bdg ${l.cls||'bb'}">${l.action||'—'}</span></td><td><b>${l.target||'—'}</b></td><td>${l.details||'—'}</td></tr>`).join('');
            const lc = el('ledgerContent');     if (lc)  lc.innerHTML  = rows;
            const alc = el('adminLedgerContent'); if (alc) alc.innerHTML = rows;
        } catch (e) {}
    },

    clearReg() {
        ['pName','pID','pDOB','pAddr','pPhone','pKin','pIns','pPol','pKinPhone','pKinRel','pOcc'].forEach(id => { const e = el(id); if (e) e.value = ''; });
        ['pGender','pBlood'].forEach(id => { const e = el(id); if (e) e.selectedIndex = 0; });
        this.activePID = null;
    },
};

// ════════════════════════════════════════════════════════════
//  NAVIGATION
// ════════════════════════════════════════════════════════════
function goTo(id) {
    const navEl = el('nav-' + id);
    if (navEl && navEl.classList.contains('locked')) { alert('⛔ You do not have access to this section.'); return; }
    document.querySelectorAll('.view').forEach(v  => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const v = el(id + '-view'), n = el('nav-' + id);
    if (v) v.classList.add('active'); if (n) n.classList.add('active');

    // Refresh data on key views
    const refreshViews = ['db','dash','rooms','staff','exam','metrics','billing','library'];
    if (refreshViews.includes(id)) {
        App.loadAll().then(() => {
            if (id === 'db')      App.renderDB();
            if (id === 'dash')    App.renderDash();
            if (id === 'rooms')   RoomMgr.render();
            if (id === 'staff')   App.renderStaff();
            if (id === 'exam')    App.renderExam();
            if (id === 'metrics') App.renderMetrics();
            if (id === 'billing') Billing.renderInvoices();
            if (id === 'library') { LibMgr.render(); LibMgr.populateResourceSelect(); }
        }).catch(() => {
            if (id === 'db')   App.renderDB();
            if (id === 'dash') App.renderDash();
        });
    } else {
        if (id === 'db')   App.renderDB();
        if (id === 'dash') App.renderDash();
        if (id === 'rooms') RoomMgr.render();
    }
    if (id === 'library') { LibMgr.render(); LibMgr.populateResourceSelect(); }
    if (id === 'billing') Billing.renderInvoices();
    if (id === 'staff')   App.renderStaff();
    if (id === 'metrics') App.renderMetrics();
    if (id === 'exam')    App.renderExam();
    if (id === 'ledger')  App.renderLedger();
    if (id === 'admin')   Auth.renderAdminPanel().catch(() => {});
}

function adminTab(name) {
    document.querySelectorAll('.adm-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.apanel').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
    const tab = el('atab-' + name), panel = el('apanel-' + name);
    if (tab)   tab.classList.add('active');
    if (panel) { panel.style.display = 'block'; panel.classList.add('active'); }
    if (name === 'logs')                       App.renderLedger();
    if (name === 'users' || name === 'overview') Auth.renderAdminPanel().catch(() => {});
}

function filterAdminUsers() {
    const q = (val('adminUserSearch') || '').toLowerCase();
    document.querySelectorAll('#allUsersList .admin-user-row').forEach(row => {
        row.style.display = (!q || (row.dataset.name||'').includes(q) || (row.dataset.role||'').includes(q)) ? '' : 'none';
    });
}

// ════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
    Auth.init().catch(e => {
        console.error('Boot error:', e);
        const aw = el('authWrap'); if (aw) aw.style.display = 'flex';
    });
});