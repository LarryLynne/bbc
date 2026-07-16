const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// 🚨🚨 ВСТАВ СЮДИ СВОЄ ПОСИЛАННЯ НА APPS SCRIPT: 🚨🚨
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwInc9qMr6vP3ybAwnp76HsJPvA-PX1ayZREiIY1U4YuRRhXYaTaeviBMTJeeahlRfl/exec";

const user = tg.initDataUnsafe?.user || { id: 12345, first_name: "Тестовий", username: "test_user" };
document.getElementById('date').valueAsDate = new Date();

let allRides = [];
let currentTab = 'search';

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-search').classList.add('hidden');
    document.getElementById('tab-create').classList.add('hidden');
    document.getElementById('tab-subs').classList.add('hidden');
    document.getElementById('tab-my').classList.add('hidden');
    
    if (tab === 'search') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('tab-search').classList.remove('hidden');
        applyFilters();
    } else if (tab === 'create') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('tab-create').classList.remove('hidden');
    } else if (tab === 'subs') {
        document.querySelectorAll('.tab-btn')[2].classList.add('active');
        document.getElementById('tab-subs').classList.remove('hidden');
        loadSubs();
    } else if (tab === 'my') {
        document.querySelectorAll('.tab-btn')[3].classList.add('active');
        document.getElementById('tab-my').classList.remove('hidden');
        renderMyRides();
    }
}

function loadRides(isSilent = false) {
    if (!isSilent && currentTab === 'search') document.getElementById("rides-list").innerHTML = "<p style='text-align:center; margin-top:30px; color:#666;'>🔄 Завантаження актуальних поїздок...</p>";
    if (!isSilent && currentTab === 'my') document.getElementById("my-rides-list").innerHTML = "<p style='text-align:center; margin-top:30px; color:#666;'>🔄 Завантаження історії...</p>";

    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "get_rides", userId: user.id })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status !== "success") return;
        allRides = data.rides; 
        if (currentTab === 'my') renderMyRides(); else applyFilters();
    })
    .catch(err => { 
        if (currentTab === 'search') document.getElementById("rides-list").innerHTML = "❌ Помилка зв'язку з сервером.";
    });
}

function applyFilters() {
    if (currentTab !== 'search') return;
    const query = document.getElementById("filter-query").value.toLowerCase().trim();
    const filterDate = document.getElementById("filter-date").value;
    
    // 🚨 У ЗАГАЛЬНИЙ ПОШУК БЕРЕМО ТІЛЬКИ АКТИВНІ ПОЇЗДКИ:
    const filtered = allRides.filter(ride => {
        if (ride.status !== "Active") return false;
        const matchText = ride.from.toLowerCase().includes(query) || ride.to.toLowerCase().includes(query);
        const matchDate = !filterDate || (ride.dateRaw && ride.dateRaw.startsWith(filterDate));
        return matchText && matchDate;
    });
    renderSearchRides(filtered);
}

function resetFilters() {
    document.getElementById("filter-query").value = "";
    document.getElementById("filter-date").value = "";
    applyFilters();
}

// --- 🚨 МАЛЮВАННЯ В ЗАГАЛЬНОМУ ПОШУКУ ---
function renderSearchRides(rides) {
    const container = document.getElementById("rides-list");
    container.innerHTML = "";
    if (rides.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#888; margin-top:30px;'>Активних поїздок не знайдено.<br>Спробуйте змінити фільтри або створіть свою!</p>";
        return;
    }
    rides.forEach(ride => container.appendChild(createRideCardElement(ride, false)));
}

// --- 🚨 МАЛЮВАННЯ У ВКЛАДЦІ "МОЇ" (ВСІ СТАТУСИ) ---
function renderMyRides() {
    const container = document.getElementById("my-rides-list");
    container.innerHTML = "";
    const myRides = allRides.filter(ride => ride.isMyRide || ride.isBookedByMe);
    
    if (myRides.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#888; margin-top:30px;'>У вас поки немає створених або заброньованих поїздок.</p>";
        return;
    }
    myRides.forEach(ride => container.appendChild(createRideCardElement(ride, true)));
}

// --- 🚨 РОЗУМНА ГЕНЕРАЦІЯ КАРТОЧКИ ПОЇЗДКИ ---
// --- 🚨 ІДЕАЛЬНА ГЕОМЕТРІЯ КАРТОЧКИ ПОЇЗДКИ ---
function createRideCardElement(ride, isMyTab) {
    let statusBadge = "";
    if (isMyTab) {
        if (ride.status === "Done") statusBadge = `<span class="seats-badge" style="background:#e2e3e5; color:#383d41;">🏁 Завершена</span>`;
        else if (ride.status === "Cancelled") statusBadge = `<span class="seats-badge" style="background:#f8d7da; color:#721c24;">❌ Скасована</span>`;
        else statusBadge = `<span class="seats-badge" style="background:#d4edda; color:#155724;">🟢 Активна (місць: ${ride.seats})</span>`;
    } else {
        statusBadge = `<span class="seats-badge">Вільних місць: ${ride.seats}</span>`;
        if (ride.isBookedByMe) statusBadge = `<span class="seats-badge badge-booked">✅ Заброньовано вами</span>`;
    }

    let actionBtns = "";
    
    // 1. ЯКЩО ЦЕ ПОЇЗДКА ВОДІЯ:
    if (ride.isMyRide) {
        let passBtn = `<button class="btn-small btn-chat" onclick="openPassengersModal('${ride.id}', ${ride.rowIdx}, '${ride.from}➔${ride.to} (${ride.dateTimeDisplay})')">👥 Пасажири (${ride.bookedCount})</button>`;
        let finishBtn = ride.status === "Active" ? `<button class="btn-small btn-finish" onclick="finishRide('${ride.id}', ${ride.rowIdx}, '${ride.from}➔${ride.to}')">🏁 Завершити</button>` : "";
        let cancelBtn = ride.status === "Active" ? `<button class="btn-small btn-cancel" onclick="cancelRide('${ride.id}', ${ride.rowIdx}, '${ride.from}➔${ride.to}')">❌ Скасувати</button>` : "";
        
        if (ride.status === "Active") {
            // Пасажири на 100% ширини зверху, а Завершити/Скасувати строго 50/50 знизу!
            actionBtns = `
                <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                    <div class="ride-actions-grid" style="border-top:none; padding-top:0;">${passBtn}</div>
                    <div class="ride-actions-grid" style="border-top:none; padding-top:0;">${finishBtn}${cancelBtn}</div>
                </div>`;
        } else {
            actionBtns = `<div class="ride-actions-grid" style="border-top:none; padding-top:0;">${passBtn}</div>`;
        }
    } 
    // 2. ЯКЩО ЦЕ ЧУЖА ПОЇЗДКА, ЯКУ Я ЗАБРОНЮВАВ:
    else if (ride.isBookedByMe) {
        let phoneBtn = ride.phone ? `<a href="tel:${ride.phone}" class="btn-small btn-call">📞 Дзвінок</a>` : "";
        let cancelBookBtn = ride.status === "Active" ? `<button class="btn-small btn-cancel" onclick="cancelBooking('${ride.id}', ${ride.rowIdx}, '${ride.driverId}', '${ride.from}➔${ride.to}')">❌ Скасувати бронь</button>` : "";
        actionBtns = `<div class="ride-actions-grid">${phoneBtn}${cancelBookBtn}</div>`;
    } 
    // 3. ЯКЩО ЦЕ ВІЛЬНА ПОЇЗДКА ДЛЯ БРОНЮВАННЯ:
    else if (ride.status === "Active" && ride.seats > 0) {
        let phoneBtn = ride.phone ? `<a href="tel:${ride.phone}" class="btn-small btn-call">📞 Дзвінок</a>` : "";
        let bookBtn = `<button class="btn-small btn-book" onclick="openBookModal('${ride.id}', ${ride.rowIdx}, '${ride.driverId}', '${ride.from}➔${ride.to} (${ride.dateTimeDisplay})', ${ride.seats})">Забронювати</button>`;
        // Якщо є телефон — кнопки Дзвінок і Забронювати стануть строго по 50%. Якщо ні — Забронювати займе 100%!
        actionBtns = `<div class="ride-actions-grid">${phoneBtn}${bookBtn}</div>`;
    }

    const card = document.createElement("div");
    card.className = "ride-card";
    if (ride.status !== "Active" && isMyTab) card.style.opacity = "0.7";
    
    // 🚨 Бейдж статусу сидить у своєму окремому поверсі (.ride-status-box), а кнопки — у своєму!
    card.innerHTML = `
        <div class="ride-route">🚗 ${ride.from} ➔ ${ride.to}</div>
        <div class="ride-info">
            📅 <b>${ride.dateTimeDisplay}</b><br>
            👤 Водій: ${ride.driverName} ${ride.phone ? `(📞 ${ride.phone})` : ""}<br>
            💰 Ціна: ${ride.price}
        </div>
        <div class="ride-status-box">${statusBadge}</div>
        ${actionBtns ? actionBtns : ''}
    `;
    return card;
}

// --- ЛОГІКА ВІКНА ВИБОРУ КІЛЬКОСТІ МІСЦЬ ---
let pendingBookRideId = "", pendingBookRowIdx = 0, pendingBookDriverId = "", pendingBookDetails = "";

function openBookModal(rideId, rowIdx, driverId, rideDetails, maxSeats) {
    pendingBookRideId = rideId; pendingBookRowIdx = rowIdx; pendingBookDriverId = driverId; pendingBookDetails = rideDetails;
    document.getElementById("book-modal-details").innerText = `Маршрут: ${rideDetails}\nВільних місць у салоні: ${maxSeats}`;
    const select = document.getElementById("book-seats-select");
    select.innerHTML = "";
    for (let i = 1; i <= maxSeats; i++) {
        const opt = document.createElement("option"); opt.value = i;
        opt.innerText = i === 1 ? "1 місце" : `${i} місця/місць`;
        select.appendChild(opt);
    }
    document.getElementById("book-modal-overlay").classList.remove("hidden");
}

function closeBookModal() { document.getElementById("book-modal-overlay").classList.add("hidden"); }
document.getElementById("book-modal-overlay").addEventListener("click", function(event) { if (event.target === this) closeBookModal(); });

function confirmBooking() {
    const seatsToBook = parseInt(document.getElementById("book-seats-select").value, 10) || 1;
    closeBookModal();
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "book_ride", rideId: pendingBookRideId, rowIdx: pendingBookRowIdx, driverId: pendingBookDriverId, rideDetails: pendingBookDetails, seatsToBook: seatsToBook, passenger: { id: user.id, name: user.first_name, username: user.username } })
    })
    .then(res => res.json()).then(data => { 
        if (data.status === "success") { alert(`🎉 Успішно заброньовано місць: ${seatsToBook}!\nВодію надіслано ТГ-сповіщення.`); loadRides(true); } 
        else alert("❌ Помилка: " + data.message); 
    });
}

// --- ЛОГІКА ПІДПИСОК ---
function loadSubs() {
    const list = document.getElementById("subs-list");
    list.innerHTML = "<p style='text-align:center;'>🔄 Завантаження підписок...</p>";
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "get_subscriptions", userId: user.id })
    })
    .then(res => res.json()).then(data => {
        if (data.status !== "success") { list.innerHTML = "❌ Помилка завантаження."; return; }
        if (data.subs.length === 0) { list.innerHTML = "<p style='text-align:center; color:#888;'>У вас поки немає активних підписок.</p>"; return; }
        list.innerHTML = "";
        data.subs.forEach(s => {
            const item = document.createElement("div"); item.className = "sub-card";
            item.innerHTML = `<div class="sub-info"><div class="sub-route">🚗 ${s.from} ➔ ${s.to}</div>📅 <b>${s.dateDisplay}</b></div><button class="btn-small btn-kick" onclick="deleteSub(${s.rowIdx})">🗑️ Видалити</button>`;
            list.appendChild(item);
        });
    });
}

function submitSub() {
    const from = document.getElementById("sub-from").value.trim(), to = document.getElementById("sub-to").value.trim(), date = document.getElementById("sub-date").value;
    if (!from || !to) return alert("Будь ласка, вкажіть звідки і куди ви хочете їхати!");
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "add_subscription", user: { id: user.id, name: user.first_name, username: user.username }, from, to, date })
    })
    .then(res => res.json()).then(data => {
        if (data.status === "success") { alert("🔔 Підписку створено!"); document.getElementById("sub-date").value = ""; loadSubs(); } else alert("Помилка: " + data.message);
    });
}

function deleteSub(rowIdx) {
    if (!confirm("Видалити цю підписку?")) return;
    fetch(APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "delete_subscription", rowIdx: rowIdx }) })
    .then(res => res.json()).then(data => { if (data.status === "success") loadSubs(); });
}

// --- МОДАЛЬНЕ ВІКНО ПАСАЖИРІВ ТА ІНШІ ФУНКЦІЇ ---
let activeModalRideRowIdx = 0, activeModalRideDetails = "";

function openPassengersModal(rideId, rowIdx, rideDetails) {
    activeModalRideRowIdx = rowIdx; activeModalRideDetails = rideDetails;
    document.getElementById("modal-title").innerText = `👥 Пасажири`;
    document.getElementById("passengers-list").innerHTML = "🔄 Завантаження...";
    document.getElementById("modal-overlay").classList.remove("hidden");

    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "get_passengers", rideId: rideId })
    })
    .then(res => res.json()).then(data => {
        const list = document.getElementById("passengers-list");
        if (data.status !== "success") { list.innerHTML = "❌ Помилка завантаження."; return; }
        if (data.passengers.length === 0) { list.innerHTML = "<p style='text-align:center; color:#888;'>На цю поїздку ще ніхто не забронював місця.</p>"; return; }
        list.innerHTML = "";
        data.passengers.forEach(p => {
            const chatUrl = p.username ? `https://t.me/${p.username}` : `tg://user?id=${p.id}`;
            const item = document.createElement("div"); item.className = "passenger-item";
            item.innerHTML = `<div class="passenger-info">👤 ${p.name} <span style="color:#0066cc; font-size:13px;">(${p.seats} місц.)</span></div><div class="passenger-actions"><a href="${chatUrl}" target="_blank" class="btn-small btn-chat">💬 Чат</a><button class="btn-small btn-kick" onclick="kickPassenger('${rideId}', '${p.id}', '${p.name}', ${p.bookingRowIdx})">🚫 Відмовити</button></div>`;
            list.appendChild(item);
        });
    });
}

function closeModal() { document.getElementById("modal-overlay").classList.add("hidden"); }
document.getElementById("modal-overlay").addEventListener("click", function(event) { if (event.target === this) closeModal(); });

function kickPassenger(rideId, passId, passName, bookingRowIdx) {
    if (!confirm(`Точно відмовити пасажиру ${passName} у поїздці?\nЙому буде надіслано ввічливе сповіщення від бота.`)) return;
    document.getElementById("passengers-list").innerHTML = "⏳ Видаляємо...";
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "kick_passenger", rideId: rideId, passengerId: passId, bookingRowIdx: bookingRowIdx, rideRowIdx: activeModalRideRowIdx, rideDetails: activeModalRideDetails })
    })
    .then(res => res.json()).then(data => {
        if (data.status === "success") { alert("✅ Пасажиру відмовлено, місця повернуто!"); closeModal(); loadRides(true); } else alert("❌ Помилка: " + data.message);
    });
}

function submitRide() {
    const from = document.getElementById("from").value, to = document.getElementById("to").value;
    const date = document.getElementById("date").value, time = document.getElementById("time").value;
    const seats = document.getElementById("seats").value, price = document.getElementById("price").value;
    const phone = document.getElementById("phone").value.trim();
    
    if (!from || !to || !date || !time) return alert("Будь ласка, заповніть усі поля!");
    if (new Date(`${date}T${time}:00`) < new Date()) return alert("❌ Помилка: Ви не можете створити поїздку в минулому часі!");

    const btn = document.getElementById("btn-submit");
    btn.innerText = "⏳ Публікуємо..."; btn.disabled = true;
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "create_ride", user: { id: user.id, name: user.first_name, username: user.username }, from, to, date, time, seats, price, phone })
    })
    .then(res => res.json()).then(data => {
        btn.innerText = "🚀 Опублікувати поїздку"; btn.disabled = false;
        if (data.status === "success") { 
            alert("✅ Поїздку успішно створено!"); 
            switchTab('search');
            loadRides(false); // 🚨 ДОБАВИЛИ ЭТУ СТРОКУ: принудительно запрашиваем свежий список с сервера!
        } else alert("Помилка: " + data.message);
    });
}

// --- 🚨 РУЧНЕ ЗАВЕРШЕННЯ ПОЇЗДКИ ВОДІЄМ ---
function finishRide(rideId, rowIdx, rideDetails) {
    if (!confirm(`Завершити поїздку:\n${rideDetails}?\nВона перейде в статус завершених і зникне з загального пошуку.`)) return;
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "finish_ride", rowIdx: rowIdx })
    })
    .then(res => res.json()).then(data => { if (data.status === "success") { alert("🏁 Поїздку завершено!"); loadRides(false); } });
}

function cancelRide(rideId, rowIdx, rideDetails) {
    if (!confirm(`Скасувати поїздку:\n${rideDetails}?\nПасажирам прийде сповіщення.`)) return;
    fetch(APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "cancel_ride", rideId, rowIdx, rideDetails }) })
    .then(res => res.json()).then(data => { if (data.status === "success") { alert("🗑️ Скасовано!"); loadRides(true); } });
}

function cancelBooking(rideId, rowIdx, driverId, rideDetails) {
    if (!confirm(`Скасувати бронювання:\n${rideDetails}?`)) return;
    fetch(APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "cancel_booking", rideId, rowIdx, driverId, rideDetails, userId: user.id, userName: user.first_name }) })
    .then(res => res.json()).then(data => { if (data.status === "success") { alert("✅ Бронь скасовано!"); loadRides(true); } });
}

loadRides();