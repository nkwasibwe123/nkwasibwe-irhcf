"use strict";
(() => {
  const API = "https://nkwasibwe-irhcf.onrender.com/api/commerce";
  const TOKEN_KEY = "nkwasibwe_auth_token";
  const $ = id => document.getElementById(id);
  const state = { products: [], cart: [], orders: [] };
  const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
  const authHeaders = () => token() ? { Authorization: "Bearer " + token() } : {};
  const money = (minor, currency) => {
    const integerCurrencies = new Set(["RWF", "UGX", "XAF", "XOF", "JPY"]);
    const amount = Number(minor) / (integerCurrencies.has(currency) ? 1 : 100);
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: integerCurrencies.has(currency) ? 0 : 2 }).format(amount); }
    catch { return String(currency) + " " + amount; }
  };
  async function request(path, options = {}) {
    const response = await fetch(API + path, {
      ...options,
      headers: { ...authHeaders(), ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || ("Request failed (" + response.status + ")"));
    return data;
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function showAuthNotice() {
    $("authNotice").replaceChildren();
    if (token()) {
      $("authNotice").textContent = "You are signed in. Your cart and orders are linked to your account.";
      return;
    }
    $("authNotice").append(document.createTextNode("You can browse products without signing in. To save your cart and place an order, "));
    const link = element("a", "", "sign in to Nkwasibwe IRHCF");
    link.href = "index.html";
    $("authNotice").append(link, document.createTextNode("."));
  }
  async function loadProducts() {
    const grid = $("productGrid");
    grid.replaceChildren(element("p", "muted", "Loading products…"));
    try {
      const result = await request("/products");
      state.products = result.products || [];
      $("productCount").textContent = state.products.length + (state.products.length === 1 ? " item" : " items");
      grid.replaceChildren();
      if (!state.products.length) {
        grid.append(element("p", "muted", "The catalogue is empty. An authorized shop administrator must add the first products."));
        return;
      }
      for (const product of state.products) {
        const card = element("article", "product-card");
        const imageUrl = String(product.image_url || "");
        if (imageUrl.startsWith("https://")) {
          const image = element("img", "product-image");
          image.src = imageUrl; image.alt = String(product.name || "Product"); image.loading = "lazy"; image.referrerPolicy = "no-referrer";
          image.addEventListener("error", () => image.replaceWith(element("div", "product-placeholder", "▧")), { once: true });
          card.append(image);
        } else card.append(element("div", "product-placeholder", "▧"));
        const body = element("div", "product-body");
        body.append(element("h3", "", product.name));
        if (product.description) body.append(element("p", "", product.description));
        body.append(element("div", "product-price", money(product.price_minor, product.currency)));
        body.append(element("span", "stock", Number(product.stock_quantity) > 0 ? Number(product.stock_quantity) + " in stock" : "Out of stock"));
        const add = element("button", "", token() ? "Add to cart" : "Sign in to add");
        add.type = "button"; add.disabled = Number(product.stock_quantity) < 1;
        add.addEventListener("click", async () => {
          if (!token()) { $("checkoutMessage").textContent = "Please sign in through Nkwasibwe IRHCF first."; return; }
          add.disabled = true;
          try {
            const current = state.cart.find(item => String(item.product_id) === String(product.id));
            await request("/cart/items/" + encodeURIComponent(product.id), { method: "PUT", body: JSON.stringify({ quantity: Math.min(99, Number(current?.quantity || 0) + 1) }) });
            $("checkoutMessage").textContent = product.name + " added to your cart.";
            await loadCart();
          } catch (error) { $("checkoutMessage").textContent = error.message; }
          finally { add.disabled = false; }
        });
        body.append(add); card.append(body); grid.append(card);
      }
    } catch (error) { grid.replaceChildren(element("p", "muted", "Could not load products: " + error.message)); }
  }
  async function loadCart() {
    const box = $("cartItems");
    if (!token()) {
      state.cart = []; box.replaceChildren(element("p", "muted", "Sign in to load and save your cart."));
      $("cartCount").textContent = "0 items"; $("cartTotal").textContent = "—"; $("checkoutButton").disabled = true; return;
    }
    try {
      const result = await request("/cart");
      state.cart = result.items || [];
      box.replaceChildren();
      let total = 0;
      if (!state.cart.length) box.append(element("p", "muted", "Your cart is empty. Add something from the catalogue."));
      for (const item of state.cart) {
        total += Number(item.line_total_minor || 0);
        const row = element("div", "cart-row");
        const info = element("div", "cart-info");
        info.append(element("strong", "", item.name), element("small", "", money(item.price_minor, item.currency) + " each · " + money(item.line_total_minor, item.currency)));
        const controls = element("div", "cart-controls");
        const qty = document.createElement("input"); qty.type = "number"; qty.min = "0"; qty.max = "99"; qty.step = "1"; qty.value = String(item.quantity); qty.setAttribute("aria-label", "Quantity for " + item.name);
        const update = element("button", "", "Update"); update.type = "button";
        update.addEventListener("click", async () => {
          const quantity = Number(qty.value);
          if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) { $("checkoutMessage").textContent = "Quantity must be from 0 to 99."; return; }
          update.disabled = true;
          try { await request("/cart/items/" + encodeURIComponent(item.product_id), { method: "PUT", body: JSON.stringify({ quantity }) }); await loadCart(); }
          catch (error) { $("checkoutMessage").textContent = error.message; }
          finally { update.disabled = false; }
        });
        controls.append(qty, update); row.append(info, controls); box.append(row);
      }
      $("cartCount").textContent = state.cart.reduce((sum, item) => sum + Number(item.quantity), 0) + " items";
      const currency = state.cart[0]?.currency;
      $("cartTotal").textContent = currency && state.cart.every(item => item.currency === currency) ? money(total, currency) : (state.cart.length ? "Mixed currencies" : "—");
      $("checkoutButton").disabled = !state.cart.length || !state.cart.every(item => item.currency === currency);
    } catch (error) {
      box.replaceChildren(element("p", "muted", "Could not load cart: " + error.message));
      $("checkoutButton").disabled = true;
    }
  }
  async function loadOrders() {
    const box = $("ordersList");
    if (!token()) { box.replaceChildren(element("p", "muted", "Sign in to view orders.")); return; }
    box.replaceChildren(element("p", "muted", "Loading orders…"));
    try {
      const result = await request("/orders");
      state.orders = result.orders || []; box.replaceChildren();
      if (!state.orders.length) { box.append(element("p", "muted", "No orders yet.")); return; }
      for (const order of state.orders) {
        const row = element("div", "order-row");
        const info = element("div", "cart-info");
        info.append(element("strong", "", "Order #" + order.id), element("small", "", new Date(order.created_at).toLocaleString() + " · " + money(order.total_minor, order.currency)));
        const status = element("span", "status " + String(order.status), order.status);
        row.append(info, status);
        if (order.status === "pending" && order.checkout_url && order.checkout_url.startsWith("https://")) {
          const link = element("a", "", "Resume checkout"); link.href = order.checkout_url; link.rel = "noopener noreferrer"; link.target = "_blank"; row.append(link);
        }
        box.append(row);
      }
    } catch (error) { box.replaceChildren(element("p", "muted", "Could not load orders: " + error.message)); }
  }
  $("checkoutButton").addEventListener("click", async () => {
    if (!token()) { $("checkoutMessage").textContent = "Sign in first to check out."; return; }
    $("checkoutButton").disabled = true; $("checkoutMessage").textContent = "Creating hosted checkout…";
    try {
      const result = await request("/checkout", { method: "POST", body: JSON.stringify({ items: state.cart.map(item => ({ productId: Number(item.product_id), quantity: Number(item.quantity) })) }) });
      if (!result.checkoutUrl || !result.checkoutUrl.startsWith("https://")) throw new Error("The server did not return a valid hosted checkout URL.");
      window.location.assign(result.checkoutUrl);
    } catch (error) { $("checkoutMessage").textContent = error.message; $("checkoutButton").disabled = false; }
  });
  $("productForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = $("adminMessage"); message.textContent = "Creating product…";
    const body = {
      name: String(form.get("name") || "").trim(),
      description: String(form.get("description") || "").trim(),
      priceMinor: Number(form.get("priceMinor")),
      currency: String(form.get("currency") || "RWF"),
      stockQuantity: Number(form.get("stockQuantity")),
      imageUrl: String(form.get("imageUrl") || "").trim() || null,
      sku: String(form.get("sku") || "").trim() || null
    };
    try {
      const result = await request("/products", { method: "POST", body: JSON.stringify(body) });
      message.textContent = "Product created: " + result.product.name;
      event.currentTarget.reset(); await loadProducts();
    } catch (error) { message.textContent = error.message; }
  });
  $("reloadButton").addEventListener("click", async () => { showAuthNotice(); await loadProducts(); await loadCart(); if (token()) await loadOrders(); });
  $("ordersButton").addEventListener("click", loadOrders);
  showAuthNotice();
  loadProducts();
  loadCart();
  if (token()) loadOrders();
})();