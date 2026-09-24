(() => {
  const cards = Array.from(document.querySelectorAll("[data-home-product]"));
  if (!cards.length) return;

  const setText = (selector, value, card) => {
    const node = card.querySelector(selector);
    if (node) node.textContent = value;
  };

  const bindProductLinks = (card) => {
    card.querySelectorAll("[data-product-link]").forEach((link) => {
      if (link.dataset.productBound === "true") return;
      link.dataset.productBound = "true";
      link.addEventListener("pointerdown", (event) => event.stopPropagation());
      link.addEventListener("click", (event) => event.stopPropagation());
    });
  };

  const hydrate = (product, card) => {
    card.dataset.productSlug = product.slug;
    card.setAttribute("aria-label", `翻转查看${product.name}，点击价格或详情按钮进入商品详情`);
    const productUrl = `product.html?slug=${encodeURIComponent(product.slug)}`;
    card.querySelectorAll("[data-product-link]").forEach((link) => { link.href = productUrl; });
    bindProductLinks(card);

    card.querySelectorAll("img").forEach((image) => {
      image.src = product.frontImage;
      image.alt = image.alt ? product.name : "";
    });
    setText(".flip-card__product-info h3", product.name, card);
    setText(".flip-card__product-info p", product.description, card);
    setText(".flip-card__product-price", `¥ ${product.price.toLocaleString("zh-CN")}`, card);

  };

  cards.forEach(bindProductLinks);
  fetch("/api/catalog/products?featured=true")
    .then((response) => response.json())
    .then((data) => {
      (data.products || []).filter((product) => product.featured).slice(0, cards.length)
        .forEach((product, index) => hydrate(product, cards[index]));
    })
    .catch(() => {});
})();
