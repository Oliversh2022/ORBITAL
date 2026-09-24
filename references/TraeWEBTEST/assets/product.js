(() => {
  const root = document.querySelector("[data-product]");
  const slug = new URLSearchParams(window.location.search).get("slug") || "ember-guard";
  const money = value => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);
  let selectedVariantId = "";

  const getVariant = product => product.variants?.find(variant => variant.id === selectedVariantId)
    || product.variants?.find(variant => variant.isActive !== false)
    || product.variants?.[0]
    || null;

  const isPurchasable = (product, variant) => {
    const stock = variant ? Number(variant.availableStock ?? variant.stock ?? 0) : Number(product.stock ?? 0);
    return product.availability === "active" && product.sellable === true && stock > 0 && (!variant || variant.isActive !== false);
  };

  const refreshVariantState = product => {
    const variant = getVariant(product);
    const purchasable = isPurchasable(product, variant);
    const price = Number(variant?.price ?? product.price);
    const priceNode = root.querySelector("[data-detail-price]");
    const statusNode = root.querySelector("[data-product-status]");
    const addButton = root.querySelector("[data-add-to-cart]");
    if (priceNode) priceNode.textContent = money(price);
    if (statusNode) {
      statusNode.textContent = purchasable
        ? `可购买 · ${variant?.sku || "标准款"}`
        : (variant?.isActive === false ? "当前规格暂不可购买" : "预览商品 · 暂不可购买");
    }
    if (addButton) {
      addButton.disabled = !purchasable;
      addButton.textContent = purchasable ? "加入购物袋" : "当前不可购买";
    }
    root.querySelectorAll("[data-variant-id]").forEach(button => {
      button.setAttribute("aria-pressed", button.dataset.variantId === variant?.id ? "true" : "false");
    });
  };

  const render = product => {
    if (!product) {
      root.innerHTML = '<div class="error"><h1>商品未找到</h1><p>这件商品暂时没有加入目录。</p><a class="recommend-link" href="/shop.html">返回商品目录 →</a></div>';
      return;
    }
    document.title = product.name + "｜ORBITAL";
    selectedVariantId = product.variants?.find(variant => variant.isActive !== false)?.id || product.variants?.[0]?.id || "";
    const variants = product.variants || [];
    root.innerHTML = `
      <div><img class="detail-image" src="${product.frontImage}" alt="${product.name}"></div>
      <div class="detail-copy">
        <p class="eyebrow">ORBITAL / Preview Catalog</p>
        <h1>${product.name}</h1>
        <p class="subtitle">${product.description}</p>
        <div class="detail-section"><span class="detail-price" data-detail-price>${money(product.price)}</span><p class="notice">价格由当前商品变体提供，最终报价由服务端确认。</p></div>
        ${variants.length ? `<div class="detail-section"><h2>规格 / SKU</h2><div class="variant-list" role="radiogroup" aria-label="商品规格">${variants.map(variant => `<button class="variant-option" type="button" data-variant-id="${variant.id}" aria-pressed="false"><span>${variant.title || "标准款"}</span><small>${variant.sku || "未设置 SKU"} · ${variant.isActive === false ? "暂不可售" : `库存 ${variant.availableStock ?? 0}`}</small></button>`).join("")}</div></div>` : ""}
        <div class="detail-section"><h2>Materials</h2><div class="material-list">${product.materials.map(item => `<span class="chip">${item}</span>`).join("")}</div></div>
        <div class="detail-section"><h2>Intentions</h2><div class="material-list">${product.intentions.map(item => `<span class="chip">${item}</span>`).join("")}</div></div>
        <div class="detail-section"><h2>状态</h2><p data-product-status>正在确认当前规格…</p></div>
        <button class="action" type="button" data-add-to-cart disabled>正在确认库存…</button>
        <a class="recommend-link" href="/shop.html">继续浏览精选手串 →</a>
      </div>`;
    root.querySelectorAll("[data-variant-id]").forEach(button => button.addEventListener("click", () => {
      selectedVariantId = button.dataset.variantId;
      refreshVariantState(product);
    }));
    refreshVariantState(product);
  };

  fetch(`/api/catalog/products/${encodeURIComponent(slug)}`).then(response => response.json()).then(data => {
    render(data.product);
    const addButton = root.querySelector("[data-add-to-cart]");
    if (addButton && window.ORBITALCart) {
      addButton.addEventListener("click", async () => {
        const variant = getVariant(data.product);
        addButton.disabled = true;
        try {
          await window.ORBITALCart.add(data.product.slug, 1, variant?.id);
          window.location.href = "/cart.html";
        } catch (error) {
          addButton.disabled = false;
          addButton.textContent = error.message || "暂时无法加入购物袋";
        }
      });
    }
  }).catch(() => { root.innerHTML = '<div class="error"><h1>目录加载失败</h1><p>请稍后刷新页面。</p></div>'; });
})();
