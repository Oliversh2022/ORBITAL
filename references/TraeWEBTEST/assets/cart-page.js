(() => {
  const root = document.querySelector("[data-cart-root]");
  if (!root || !window.ORBITALCart) return;

  const money = (value) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);
  let catalog = [];

  const render = () => {
    const items = window.ORBITALCart.get();
    if (!items.length) {
      root.innerHTML = '<div class="empty"><h2>购物袋还是空的</h2><p>先去精选手串里寻找一件与你相契合的随身之物。</p><a class="recommend-link" href="/shop.html">浏览精选手串 →</a></div>';
      return;
    }
    const bySlug = new Map(catalog.map((product) => [product.slug, product]));
    const lines = items.map((item) => {
      const product = bySlug.get(item.slug);
      const variant = product?.variants?.find((candidate) => candidate.id === item.variantId) || product?.variants?.find((candidate) => candidate.isActive !== false);
      return { item, product, variant };
    }).filter((line) => line.product);
    if (!lines.length) {
      root.innerHTML = '<div class="empty">购物袋中的商品已经不在当前目录中。</div>';
      return;
    }
    root.innerHTML = `<div class="cart-lines">${lines.map(({ item, product, variant }) => `
      <article class="cart-line">
        <img src="${product.frontImage}" alt="${product.name}">
        <div class="cart-line__copy"><h2>${product.name}</h2>${variant ? `<small>${variant.title}${variant.sku ? ` · ${variant.sku}` : ""}</small>` : ""}<p>${product.description}</p><span>${money(variant?.price ?? product.price)}</span></div>
        <label class="cart-line__quantity">数量<input type="number" min="1" max="20" value="${item.quantity}" data-quantity="${product.slug}" data-variant-id="${item.variantId || ""}"></label>
        <button type="button" class="cart-line__remove" data-remove="${product.slug}" data-variant-id="${item.variantId || ""}">移除</button>
      </article>`).join("")}</div><aside class="cart-summary"><p>当前购物袋小计</p><strong data-subtotal>—</strong><p class="notice" data-cart-validation>正在向 Medusa 核对商品与价格…</p><button class="action" type="button" data-checkout-next disabled>继续结账</button></aside>`;
    root.querySelectorAll("[data-quantity]").forEach((input) => input.addEventListener("change", () => {
      window.ORBITALCart.update(input.dataset.quantity, input.value, input.dataset.variantId).catch(() => render());
    }));
    root.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
      window.ORBITALCart.remove(button.dataset.remove, button.dataset.variantId).catch(() => render());
    }));
    const subtotal = lines.reduce((sum, line) => sum + (line.variant?.price ?? line.product.price) * line.item.quantity, 0);
    root.querySelector("[data-subtotal]").textContent = money(subtotal);

    fetch("/api/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((item) => ({ slug: item.slug, quantity: item.quantity, ...(item.variantId ? { variantId: item.variantId } : {}) })) }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw data;
        return data;
      })
      .then((quote) => {
        root.querySelector("[data-subtotal]").textContent = money(quote.subtotal);
        root.querySelector("[data-cart-validation]").textContent = "商品与价格已通过 Medusa 校验；配置销售地区与配送费率后即可继续结账。";
        const checkout = root.querySelector("[data-checkout-next]");
        checkout.disabled = false;
        checkout.addEventListener("click", () => { window.location.href = "/checkout.html"; });
      })
      .catch((error) => {
        const message = error?.details?.[0]?.message || error?.message || "服务端暂时无法确认这组商品。";
        root.querySelector("[data-cart-validation]").textContent = message;
      });
  };

  fetch("/api/catalog/products")
    .then((response) => response.json())
    .then((data) => { catalog = data.products || []; render(); })
    .catch(() => { root.innerHTML = '<div class="empty">购物袋暂时无法加载，请稍后再试。</div>'; });
  window.ORBITALCart.subscribe(render);
})();
