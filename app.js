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
    
    if (tab === 'search') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('tab-search').classList.remove('hidden');
        loadRides(false);
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('tab-create').classList.remove('hidden');
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

// --- 🚨 МАЛЮВАННЯ КАРТОК (З КНОПКОЮ "ПАСАЖИРИ") ---
function renderRides(rides) {
    const container = document.getElementById("rides-list");
    container.innerHTML = "";
    
    if (rides.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#888; margin-top:30px;'>Поїздок не знайдено.<br>Спробуйте змінити фільтри або створіть свою!</p>";
        return;
    }

    rides.forEach(ride => {
        let badgeHtml = `<span class="seats-badge">Вільних місць: ${ride.seats}</span>`;
        let actionBtnHtml = `<button class="btn btn-action" onclick="bookRide('${ride.id}', ${ride.rowIdx}, '${ride.driverId}', '${ride.from}➔${ride.to} (${ride.dateTimeDisplay})')">Забронювати</button>`;

        if (ride.isMyRide) {
            // 🚨 НАША НОВА КНОПКА ДЛЯ ВОДІЯ:
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

// --- 🚨 ЛОГІКА МОДАЛЬНОГО ВІКНА ТА ВИСАДКИ ---
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
            item.innerHTML = `
                <div class="passenger-info">👤 ${p.name}</div>
                <div class="passenger-actions">
                    <a href="${chatUrl}" target="_blank" class="btn-small btn-chat">💬 Чат</a>
                    <button class="btn-small btn-kick" onclick="kickPassenger('${rideId}', '${p.id}', '${p.name}', ${p.bookingRowIdx})">🚫 Відмовити</button>
                </div>
            `;
            list.appendChild(item);
        });
    });
}

function closeModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
}

// 🚨 ДОДАЄМО: закриття вікна при кліку на темний фон навколо нього
document.getElementById("modal-overlay").addEventListener("click", function(event) {
    if (event.target === this) {
        closeModal();
    }
});

function kickPassenger(rideId, passId, passName, bookingRowIdx) {
    if (!confirm(`Точно відмовити пасажиру ${passName} у поїздці?\nЙому буде надіслано ввічливе сповіщення від бота, а місце повернеться вам.`)) return;

    document.getElementById("passengers-list").innerHTML = "⏳ Видаляємо...";
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ 
            action: "kick_passenger", rideId: rideId, passengerId: passId, 
            bookingRowIdx: bookingRowIdx, rideRowIdx: activeModalRideRowIdx, rideDetails: activeModalRideDetails 
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === "success") {
            alert("✅ Пасажиру відмовлено, місце повернуто у вашу поїздку!");
            closeModal();
            loadRides(true);
        } else alert("❌ Помилка: " + data.message);
    });
}

// --- ІНШІ ФУНКЦІЇ ---
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
    if (!confirm(`Бронюємо 1 місце на поїздку:\n${rideDetails}?`)) return;
    fetch(APPS_SCRIPT_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "book_ride", rideId, rowIdx, driverId, rideDetails, passenger: { id: user.id, name: user.first_name, username: user.username } })
    })
    .then(res => res.json()).then(data => { if (data.status === "success") { alert("🎉 Місце заброньовано!\nВодію надіслано ТГ-сповіщення."); loadRides(true); } else alert("❌ Помилка: " + data.message); });
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