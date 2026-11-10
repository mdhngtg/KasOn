"use strict";

const STORAGE_KEY = "mini-pos-bootstrap-v1";

const $ = selector => document.querySelector(selector);

const rupiah = value => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
}).format(value || 0);

const today = () => new Date().toLocaleDateString("en-CA");

const defaultProducts = [
    { id: "p1", name: "Air Mineral", price: 4000, stock: 25 },
    { id: "p2", name: "Roti Cokelat", price: 6000, stock: 18 },
    { id: "p3", name: "Teh Botol", price: 5000, stock: 12 },
    { id: "p4", name: "Mi Instan", price: 3500, stock: 4 },
    { id: "p5", name: "Keripik", price: 8000, stock: 0 },
    { id: "p6", name: "Kopi Sachet", price: 2500, stock: 30 }
];

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (saved && Array.isArray(saved.products) &&
            Array.isArray(saved.transactions)) {
            return saved;
        }
    } catch (error) {
        console.warn("Data Local Storage tidak dapat dibaca.", error);
    }

    return {
        products: defaultProducts.map(item => ({ ...item })),
        transactions: []
    };
}

let state = loadState();
let cart = [];
let paymentMethod = "Tunai";

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        showToast("Gagal menyimpan data.");
        console.error(error);
        return false;
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function getCartTotal() {
    return cart.reduce((sum, item) =>
        sum + item.price * item.quantity, 0
    );
}

function getProductStatus(stock) {
    if (stock === 0) {
        return { label: "Stok Habis", className: "out" };
    }

    if (stock < 5) {
        return { label: "Stok Menipis", className: "low" };
    }

    return { label: "Stok Aman", className: "safe" };
}

function renderMetrics() {
    const transactions = state.transactions.filter(
        item => item.date === today()
    );

    $("#revenueMetric").textContent = rupiah(
        transactions.reduce((sum, item) => sum + item.total, 0)
    );

    $("#stockMetric").textContent = state.products.reduce(
        (sum, item) => sum + item.stock, 0
    );

    $("#transactionMetric").textContent = transactions.length;
}

function renderProducts() {
    const query = $("#searchInput").value.trim().toLowerCase();

    const products = state.products.filter(item =>
        item.name.toLowerCase().includes(query)
    );

    $("#productGrid").innerHTML = products.length
        ? products.map(item => {
            const status = getProductStatus(item.stock);

            return `
                <div class="product">
                    <div class="product-name">
                        ${escapeHTML(item.name)}
                    </div>

                    <span class="badge ${status.className}">
                        ${status.label}
                    </span>

                    <p>Stok: ${item.stock}</p>
                    <strong>${rupiah(item.price)}</strong>

                    <div class="product-bottom">
                        <button class="secondary"
                            data-edit="${escapeHTML(item.id)}">
                            Edit
                        </button>

                        <button class="primary"
                            data-buy="${escapeHTML(item.id)}"
                            ${item.stock === 0 ? "disabled" : ""}>
                            Beli
                        </button>
                    </div>
                </div>
            `;
        }).join("")
        : `<div class="empty">Produk tidak ditemukan.</div>`;
}

function renderCart() {
    $("#cartList").innerHTML = cart.length
        ? cart.map(item => `
            <div class="cart-item">
                <div>
                    <strong>${escapeHTML(item.name)}</strong>
                    <p>${rupiah(item.price)}</p>

                    <div class="qty">
                        <button data-qty="${escapeHTML(item.id)}"
                            data-delta="-1">−</button>

                        <strong>${item.quantity}</strong>

                        <button data-qty="${escapeHTML(item.id)}"
                            data-delta="1"
                            ${item.quantity >= (
                                state.products.find(p => p.id === item.id)?.stock ?? 0
                            ) ? "disabled" : ""}>+</button>
                    </div>
                </div>

                <div>
                    <strong>${rupiah(item.price * item.quantity)}</strong>

                    <button class="danger"
                        data-remove="${escapeHTML(item.id)}">
                        Hapus
                    </button>
                </div>
            </div>
        `).join("")
        : `<div class="empty">Keranjang masih kosong.</div>`;

    const total = getCartTotal();

    $("#subtotal").textContent = rupiah(total);
    $("#grandTotal").textContent = rupiah(total);

    updatePaymentUI();
}

function updatePaymentUI() {
    const total = getCartTotal();
    const cash = Math.max(0, Number($("#cashInput").value) || 0);
    const isCash = paymentMethod === "Tunai";

    $("#cashArea").hidden = !isCash;

    $("#paymentHint").textContent = isCash
        ? "Masukkan uang yang diterima."
        : `Metode pembayaran: ${paymentMethod}`;

    const valid = cart.length > 0 &&
        (!isCash || cash >= total);

    $("#checkoutBtn").disabled = !valid;

    $("#changeValue").textContent = rupiah(
        Math.max(0, cash - total)
    );
}

function render() {
    renderMetrics();
    renderProducts();
    renderCart();
}

function showToast(message) {
    const oldToast = $(".toast");

    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;

    Object.assign(toast.style, {
        position: "fixed",
        bottom: "20px",
        right: "20px",
        background: "#0f172a",
        color: "white",
        padding: "12px 18px",
        borderRadius: "8px",
        zIndex: "10"
    });

    document.body.append(toast);

    setTimeout(() => toast.remove(), 2600);
}

function addToCart(id) {
    const product = state.products.find(item => item.id === id);

    if (!product || product.stock <= 0) return;

    const existing = cart.find(item => item.id === id);

    if (existing) {
        if (existing.quantity >= product.stock) {
            return showToast("Stok tidak mencukupi.");
        }

        existing.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1
        });
    }

    renderCart();
}

function changeQuantity(id, delta) {
    const item = cart.find(product => product.id === id);
    const product = state.products.find(product => product.id === id);

    if (!item || !product) return;

    const quantity = item.quantity + delta;

    if (quantity <= 0) {
        cart = cart.filter(product => product.id !== id);
    } else if (quantity <= product.stock) {
        item.quantity = quantity;
    } else {
        return showToast("Stok tidak mencukupi.");
    }

    renderCart();
}

function openProductDialog(product = null) {
    $("#productForm").reset();

    $("#productId").value = product?.id || "";
    $("#dialogTitle").textContent = product
        ? "Edit Produk"
        : "Tambah Produk";

    $("#productName").value = product?.name || "";
    $("#productPrice").value = product?.price ?? "";
    $("#productStock").value = product?.stock ?? "";

    $("#productDialog").showModal();
}

function saveProduct(event) {
    event.preventDefault();

    const id = $("#productId").value;
    const name = $("#productName").value.trim();
    const price = Number($("#productPrice").value);
    const stock = Number($("#productStock").value);

    if (!name ||
        !Number.isSafeInteger(price) || price <= 0 ||
        !Number.isSafeInteger(stock) || stock < 0) {
        return showToast("Periksa kembali data produk.");
    }

    if (id) {
        const product = state.products.find(item => item.id === id);

        if (!product) return;

        Object.assign(product, { name, price, stock });

        const cartItem = cart.find(item => item.id === id);

        if (cartItem) {
            Object.assign(cartItem, { name, price });

            if (cartItem.quantity > stock) {
                cartItem.quantity = stock;
            }

            if (cartItem.quantity === 0) {
                cart = cart.filter(item => item.id !== id);
            }
        }
    } else {
        state.products.push({
            id: window.crypto?.randomUUID?.() ||
                `p-${Date.now()}-${Math.random()}`,
            name,
            price,
            stock
        });
    }

    saveState();

    $("#productDialog").close();

    render();

    showToast("Produk berhasil disimpan.");
}

function buildReceipt(transaction) {
    const rows = transaction.items.map(item => `
        <div style="display:flex;justify-content:space-between">
            <span>${escapeHTML(item.name)} x${item.quantity}</span>
            <span>${rupiah(item.price * item.quantity)}</span>
        </div>
    `).join("");

    $("#receipt").innerHTML = `
        <div style="max-width:300px;margin:auto">
            <h2 style="text-align:center">MINI POS</h2>
            <p style="text-align:center">SMK Negeri 9 Medan</p>
            <hr>

            <p>
                No: ${escapeHTML(transaction.id)}<br>
                ${new Date(transaction.timestamp).toLocaleString("id-ID")}
            </p>

            <hr>

            ${rows}

            <hr>

            <div style="display:flex;justify-content:space-between">
                <strong>TOTAL</strong>
                <strong>${rupiah(transaction.total)}</strong>
            </div>

            <p>Metode: ${escapeHTML(transaction.method)}</p>

            ${transaction.method === "Tunai" ? `
                <p>Uang diterima: ${rupiah(transaction.cash)}</p>
                <p>Kembalian: ${rupiah(transaction.change)}</p>
            ` : ""}

            <hr>
            <p style="text-align:center">Terima kasih!</p>
        </div>
    `;

    window.print();
}

function checkout() {
    const total = getCartTotal();
    const cash = Math.max(0, Number($("#cashInput").value) || 0);

    if (!cart.length ||
        (paymentMethod === "Tunai" && cash < total)) {
        return;
    }

    for (const item of cart) {
        const product = state.products.find(p => p.id === item.id);

        if (!product || product.stock < item.quantity) {
            showToast("Stok tidak mencukupi.");
            render();
            return;
        }
    }

    const transaction = {
        id: `TRX-${Date.now()}`,
        timestamp: new Date().toISOString(),
        date: today(),
        items: cart.map(item => ({ ...item })),
        total,
        method: paymentMethod,
        cash: paymentMethod === "Tunai" ? cash : total,
        change: paymentMethod === "Tunai" ? cash - total : 0
    };

    cart.forEach(item => {
        const product = state.products.find(p => p.id === item.id);
        product.stock -= item.quantity;
    });

    state.transactions.push(transaction);

    if (!saveState()) return;

    cart = [];
    $("#cashInput").value = "";

    render();

    showToast("Transaksi berhasil disimpan.");

    buildReceipt(transaction);
}

$("#openProductForm").addEventListener("click", () => {
    openProductDialog();
});

$("#cancelDialog").addEventListener("click", () => {
    $("#productDialog").close();
});

$("#productForm").addEventListener("submit", saveProduct);

$("#searchInput").addEventListener("input", renderProducts);

$("#cashInput").addEventListener("input", updatePaymentUI);

$("#paymentOptions").addEventListener("click", event => {
    const button = event.target.closest("[data-method]");

    if (!button) return;

    paymentMethod = button.dataset.method;

    $("#paymentOptions").querySelectorAll("[data-method]")
        .forEach(option => {
            option.classList.toggle("active", option === button);
        });

    updatePaymentUI();
});

$("#productGrid").addEventListener("click", event => {
    const buy = event.target.closest("[data-buy]");
    const edit = event.target.closest("[data-edit]");

    if (buy && !buy.disabled) {
        addToCart(buy.dataset.buy);
    }

    if (edit) {
        const product = state.products.find(
            item => item.id === edit.dataset.edit
        );

        openProductDialog(product);
    }
});

$("#cartList").addEventListener("click", event => {
    const quantity = event.target.closest("[data-qty]");
    const remove = event.target.closest("[data-remove]");

    if (quantity) {
        changeQuantity(
            quantity.dataset.qty,
            Number(quantity.dataset.delta)
        );
    }

    if (remove) {
        cart = cart.filter(item => item.id !== remove.dataset.remove);
        renderCart();
    }
});

$("#clearCart").addEventListener("click", () => {
    cart = [];
    renderCart();
});

$("#checkoutBtn").addEventListener("click", checkout);

render();