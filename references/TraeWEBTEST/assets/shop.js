(() => {
  const grid = document.querySelector("[data-catalog]");
  const search = document.querySelector("[data-search]");
  const sort = document.querySelector("[data-sort]");
  const filters = document.querySelectorAll("[data-filter]");
  let products = [];
  let activeFilter = "all";

  const money = value => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);
  const matches = product => {
    const query = (search.value || "").trim().toLowerCase();
    const haystack = [product.name, product.nameEn, product.description, ...(product.materials || []), ...(product.intentions || [])].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (activeFilter === "all" || (product.intentions || []).includes(activeFilter));
  };
  const render = () => {
    const visible = products.filter(matches).sort((a, b) => sort.value === "price-desc" ? b.price - a.price : sort.value === "price-asc" ? a.price - b.price : Number(b.featured) - Number(a.featured));
    grid.innerHTML = visible.length ? visible.map(product => `
      <article class="product-card">
        <a href="/product.html?slug=${encodeURIComponent(product.slug)}">
          <div class="product-media"><img src="${product.frontImage}" alt="${product.name}" loading="lazy" decoding="async"><span class="status">预览商品</span></div>
          <div class="product-content">
            <h2>${product.name}</h2>
            <p>${product.description}</p>
            <div class="product-meta"><span>${money(product.price)}</span><span>${product.materials.length} 种材质</span></div>
            <div class="product-intentions">${product.intentions.map(tag => `<span class="chip">${tag}</span>`).join("")}</div>
            <div class="card-link"><span>查看商品详情</span><span aria-hidden="true">↗</span></div>
          </div>
        </a>
      </article>`).join("") : '<div class="empty">没有找到符合当前条件的商品。</div>';
  };
  fetch("/api/catalog/products").then(response => response.json()).then(data => { products = data.products || []; render(); }).catch(() => { grid.innerHTML = '<div class="empty">商品目录暂时无法加载，请稍后再试。</div>'; });
  search.addEventListener("input", render);
  sort.addEventListener("change", render);
  filters.forEach(button => button.addEventListener("click", () => { activeFilter = button.dataset.filter; filters.forEach(item => item.setAttribute("aria-pressed", String(item === button))); render(); }));
})();
