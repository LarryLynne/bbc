const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// 🚨🚨 ВСТАВ СЮДИ СВОЄ ПОСИЛАННЯ НА APPS SCRIPT: 🚨🚨
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwInc9qMr6vP3ybAwnp76HsJPvA-PX1ayZREiIY1U4YuRRhXYaTaeviBMTJeeahlRfl/exec";

const user = tg.initDataUnsafe?.user || { id: 12345, first_name: "Тестовий", username: "test_user" };
document.getElementById('date').valueAsDate = new Date();

let allRides = [];

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-search').classList.add('hidden');
    document.getElementById('tab-create').classList.add('hidden');
    document.getElementById('tab-subs').classList.add('hidden');
    
    if (tab === 'search') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('tab-search').classList.remove('hidden');
        loadRides(false);
    } else if (tab === 'create') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('tab-create').classList.remove('hidden');
    } else if (tab === 'subs') {
        document.querySelectorAll('.tab-btn')[2].classList.add('active');
        document.getElementById('tab-subs').classList.remove('hidden');
        loadSubs();
    }
}

function loadRides(isSilent = false) {
    const container = document.getElementById("rides-list");
    const cachedHTML = localStorage.getItem("rides_cache_" + user.id);
    if (cachedHTML && !isSilent && allRides.length === 0) container.innerHTML = cachedHTML;
    else if (!isSilent && !cachedHTML) container.innerHTML = "<p style='text-align:center;'>🔄 Завантаження поїздок...</p>";

    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "get_rides", userId: user.id })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status !== "success") return;
        allRides = data.rides; applyFilters();
    })
    .catch(err => { if (!cachedHTML) container.innerHTML = "❌ Помилка зв'язку з сервером."; });
}

function applyFilters() {
    const query = document.getElementById("filter-query").value.toLowerCase().trim();
    const filterDate = document.getElementById("filter-date").value;
    const filtered = allRides.filter(ride => {
        const matchText = ride.from.toLowerCase().includes(query) || ride.to.toLowerCase().includes(query);
        const matchDate = !filterDate || (ride.dateRaw && ride.dateRaw.startsWith(filterDate));
        return matchText && matchDate;
    });
    renderRides(filtered);
}

function resetFilters() {
    document.getElementById("filter-query").value = "";
    document.getElementById("filter-date").value = "";
    applyFilters();
}

function renderRides(rides) {
    const container = document.getElementById("rides-list");
    container.innerHTML = "";
    
    if (rides.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#888; margin-top:30px;'>Поїздок не знайдено.<br>Спробуйте змінити фільтри або створіть свою!</p>";
        return;
    }

    rides.forEach(ride => {
        let badgeHtml = `<span class="seats-badge">Вільних місць: ${ride.seats}</span>`;
        // 🚨 Натискання кнопки відкриває модальне вікно вибору кількості місць
        let actionBtnHtml = `<button class="btn btn-action" onclick="openBookModal('${ride.id}', ${ride.rowIdx}, '${ride.driverId}', '${ride.from}➔${ride.to} (${ride.dateTimeDisplay})', ${ride.seats})">Забронювати</button>`;

        if (ride.isMyRide) {
            badgeHtml = `<button class="btn-small btn-chat" onclick="openPassengersModal('${ride.id}', ${ride.rowIdx}, '${ride.from}➔${ride.to} (${ride.dateTimeDisplay})')">👥 Пасажири (${ride.bookedCount})</button>`;
            actionBtnHtml = `<button class="btn btn-action btn-cancel" onclick="cancelRide('${ride.id}', ${ride.rowIdx}, '${ride.from}➔${ride.to} (${ride.dateTimeDisplay})')">❌ Скасувати поїздку</button>`;
        } else if (ride.isBookedByMe) {
            badgeHtml = `<span class="seats-badge badge-booked">✅ Заброньовано вами</span>`;
            actionBtnHtml = `<button class="btn btn-action btn-cancel" onclick="cancelBooking('${ride.id}', ${ride.rowIdx}, '${ride.driverId}', '${ride.from}➔${ride.to} (${ride.dateTimeDisplay})')">❌ Скасувати бронь</button>`;
        }

        const card = document.createElement("div");
        card.className = "ride-card";
        card.innerHTML = `
            <div class="ride-route">🚗 ${ride.from} ➔ ${ride.to}</div>
            <div class="ride-info">
                📅 <b>${ride.dateTimeDisplay}</b><br>
                👤 Водій: ${ride.driverName} <br>
                💰 Ціна: ${ride.price}
            </div>
            <div class="ride-meta">${badgeHtml}${actionBtnHtml}</div>
        `;
        container.appendChild(card);
    });

    if (!document.getElementById("filter-query").value && !document.getElementById("filter-date").value) {
        localStorage.setItem("rides_cache_" + user.id, container.innerHTML);
    }
}

// --- 🚨 ЛОГІКА ВІКНА ВИБОРУ КІЛЬКОСТІ МІСЦЬ ---
let pendingBookRideId = "";
let pendingBookRowIdx = 0;
let pendingBookDriverId = "";
let pendingBookDetails = "";

function openBookModal(rideId, rowIdx, driverId, rideDetails, maxSeats) {
    pendingBookRideId = rideId;
    pendingBookRowIdx = rowIdx;
    pendingBookDriverId = driverId;
    pendingBookDetails = rideDetails;
    
    document.getElementById("book-modal-details").innerText = `Маршрут: ${rideDetails}\nВільних місць у салоні: ${maxSeats}`;
    
    const select = document.getElementById("book-seats-select");
    select.innerHTML = "";
    for (let i = 1; i <= maxSeats; i++) {
        const opt = document.createElement("option");
        opt.value = i;
        opt.innerText = i === 1 ? "1 місце" : `${i} місця/місць`;
        select.appendChild(opt);
    }
    
    document.getElementById("book-modal-overlay").classList.remove("hidden");
}

function closeBookModal() {
    document.getElementById("book-modal-overlay").classList.add("hidden");
}

document.getElementById("book-modal-overlay").addEventListener("click", function(event) {
    if (event.target === this) closeBookModal();
});

function confirmBooking() {
    const seatsToBook = parseInt(document.getElementById("book-seats-select").value, 10) || 1;
    closeBookModal();
    
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ 
            action: "book_ride", 
            rideId: pendingBookRideId, 
            rowIdx: pendingBookRowIdx, 
            driverId: pendingBookDriverId, 
            rideDetails: pendingBookDetails,
            seatsToBook: seatsToBook,
            passenger: { id: user.id, name: user.first_name, username: user.username } 
        })
    })
    .then(res => res.json()).then(data => { 
        if (data.status === "success") { 
            alert(`🎉 Успішно заброньовано місць: ${seatsToBook}!\nВодію надіслано ТГ-сповіщення.`); 
            loadRides(true); 
        } else alert("❌ Помилка: " + data.message); 
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
    .then(res => res.json())
    .then(data => {
        if (data.status !== "success") { list.innerHTML = "❌ Помилка завантаження."; return; }
        if (data.subs.length === 0) {
            list.innerHTML = "<p style='text-align:center; color:#888;'>У вас поки немає активних підписок.</p>";
            return;
        }
        list.innerHTML = "";
        data.subs.forEach(s => {
            const item = document.createElement("div");
            item.className = "sub-card";
            item.innerHTML = `
                <div class="sub-info">
                    <div class="sub-route">🚗 ${s.from} ➔ ${s.to}</div>
                    📅 <b>${s.dateDisplay}</b>
                </div>
                <button class="btn-small btn-kick" onclick="deleteSub(${s.rowIdx})">🗑️ Видалити</button>
            `;
            list.appendChild(item);
        });
    });
}

function submitSub() {
    const from = document.getElementById("sub-from").value.trim();
    const to = document.getElementById("sub-to").value.trim();
    const date = document.getElementById("sub-date").value;
    
    if (!from || !to) return alert("Будь ласка, вкажіть звідки і куди ви хочете їхати!");
    
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "add_subscription", user: { id: user.id, name: user.first_name, username: user.username }, from, to, date })
    })
    .then(res => res.json()).then(data => {
        if (data.status === "success") {
            alert("🔔 Підписку створено! Ми повідомимо вас у Telegram, коли з'явиться поїздка.");
            document.getElementById("sub-date").value = "";
            loadSubs();
        } else alert("Помилка: " + data.message);
    });
}

function deleteSub(rowIdx) {
    if (!confirm("Видалити цю підписку?")) return;
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "delete_subscription", rowIdx: rowIdx })
    })
    .then(res => res.json()).then(data => { if (data.status === "success") loadSubs(); });
}

// --- МОДАЛЬНЕ ВІКНО ПАСАЖИРІВ ТА ІНШІ ФУНКЦІЇ ---
let activeModalRideRowIdx = 0;
let activeModalRideDetails = "";

function openPassengersModal(rideId, rowIdx, rideDetails) {
    activeModalRideRowIdx = rowIdx;
    activeModalRideDetails = rideDetails;
    document.getElementById("modal-title").innerText = `👥 Пасажири`;
    document.getElementById("passengers-list").innerHTML = "🔄 Завантаження...";
    document.getElementById("modal-overlay").classList.remove("hidden");

    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "get_passengers", rideId: rideId })
    })
    .then(res => res.json())
    .then(data => {
        const list = document.getElementById("passengers-list");
        if (data.status !== "success") { list.innerHTML = "❌ Помилка завантаження."; return; }
        if (data.passengers.length === 0) { list.innerHTML = "<p style='text-align:center; color:#888;'>На цю поїздку ще ніхто не забронював місця.</p>"; return; }

        list.innerHTML = "";
        data.passengers.forEach(p => {
            const chatUrl = p.username ? `https://t.me/${p.username}` : `tg://user?id=${p.id}`;
            const item = document.createElement("div");
            item.className = "passenger-item";
            // 🚨 Відображаємо кількість заброньованих місць для кожного пасажира
            item.innerHTML = `
                <div class="passenger-info">👤 ${p.name} <span style="color:#0066cc; font-size:13px;">(${p.seats} місц.)</span></div>
                <div class="passenger-actions">
                    <a href="${chatUrl}" target="_blank" class="btn-small btn-chat">💬 Чат</a>
                    <button class="btn-small btn-kick" onclick="kickPassenger('${rideId}', '${p.id}', '${p.name}', ${p.bookingRowIdx})">🚫 Відмовити</button>
                </div>
            `;
            list.appendChild(item);
        });
    });
}

function closeModal() { document.getElementById("modal-overlay").classList.add("hidden"); }

document.getElementById("modal-overlay").addEventListener("click", function(event) {
    if (event.target === this) closeModal();
});

function kickPassenger(rideId, passId, passName, bookingRowIdx) {
    if (!confirm(`Точно відмовити пасажиру ${passName} у поїздці?\nЙому буде надіслано ввічливе сповіщення від бота, а всі заброньовані ним місця повернуться вам.`)) return;
    document.getElementById("passengers-list").innerHTML = "⏳ Видаляємо...";
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "kick_passenger", rideId: rideId, passengerId: passId, bookingRowIdx: bookingRowIdx, rideRowIdx: activeModalRideRowIdx, rideDetails: activeModalRideDetails })
    })
    .then(res => res.json()).then(data => {
        if (data.status === "success") { alert("✅ Пасажиру відмовлено, місця повернуто у вашу поїздку!"); closeModal(); loadRides(true); } 
        else alert("❌ Помилка: " + data.message);
    });
}

function submitRide() {
    const from = document.getElementById("from").value, to = document.getElementById("to").value;
    const date = document.getElementById("date").value, time = document.getElementById("time").value;
    const seats = document.getElementById("seats").value, price = document.getElementById("price").value;
    if (!from || !to || !date || !time) return alert("Будь ласка, заповніть усі поля!");
    const btn = document.getElementById("btn-submit");
    btn.innerText = "⏳ Публікуємо..."; btn.disabled = true;
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "create_ride", user: { id: user.id, name: user.first_name, username: user.username }, from, to, date, time, seats, price })
    })
    .then(res => res.json()).then(data => {
        btn.innerText = "🚀 Опублікувати поїздку"; btn.disabled = false;
        if (data.status === "success") { alert("✅ Поїздку успішно створено!"); switchTab('search'); } else alert("Помилка: " + data.message);
    });
}

function bookRide(rideId, rowIdx, driverId, rideDetails) {
    // Ця функція більше не використовується безпосередньо, замість неї викликається openBookModal
}

function cancelRide(rideId, rowIdx, rideDetails) {
    if (!confirm(`Скасувати поїздку:\n${rideDetails}?\nПасажирам прийде сповіщення.`)) return;
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "cancel_ride", rideId, rowIdx, rideDetails })
    })
    .then(res => res.json()).then(data => { if (data.status === "success") { alert("🗑️ Скасовано!"); loadRides(true); } });
}

function cancelBooking(rideId, rowIdx, driverId, rideDetails) {
    if (!confirm(`Скасувати бронювання:\n${rideDetails}?`)) return;
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "cancel_booking", rideId, rowIdx, driverId, rideDetails, userId: user.id, userName: user.first_name })
    })
    .then(res => res.json()).then(data => { if (data.status === "success") { alert("✅ Бронь скасовано!"); loadRides(true); } });
}

loadRides();