(() => {
  const form = document.querySelector("[data-checkout-form]");
  const message = document.querySelector("[data-checkout-message]");
  const submit = document.querySelector("[data-checkout-submit]");
  const linesRoot = document.querySelector("[data-checkout-lines]");
  const subtotalRoot = document.querySelector("[data-checkout-subtotal]");
  const shippingRoot = document.querySelector("[data-checkout-shipping]");
  const totalRoot = document.querySelector("[data-checkout-total]");
  const totalNote = document.querySelector("[data-checkout-total-note]");
  const shippingNote = document.querySelector("[data-shipping-note]");
  if (!form || !window.ORBITALCart) return;

  const money = value => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(value);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
  let catalog = [];
  let quoteReady = false;
  let shippingReady = false;
  let activeReservationIds = [];

  const setMessage = (text, state = "") => {
    message.textContent = text;
    message.dataset.state = state;
  };

  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.message || "请求失败。"), data);
    return data;
  };

  const renderLines = (items, quote) => {
    const products = new Map(catalog.map(product => [product.slug, product]));
    const quoteLines = new Map((quote?.lines || []).map(line => [`${line.slug}:${line.variantId || ""}`, line]));
    const visible = items.map(item => {
      const product = products.get(item.slug);
      const variant = product?.variants?.find(entry => entry.id === item.variantId);
      return { item, product, variant, quote: quoteLines.get(`${item.slug}:${item.variantId || ""}`) };
    }).filter(line => line.product);
    if (!visible.length) {
      linesRoot.innerHTML = '<p class="checkout-muted">购物袋为空。<a href="/shop.html">去寻物看看 →</a></p>';
      subtotalRoot.textContent = "—";
      totalRoot.textContent = "—";
      quoteReady = false;
      return;
    }
    linesRoot.innerHTML = visible.map(({ item, product, variant, quote: lineQuote }) => {
      const unitPrice = lineQuote?.unitPrice ?? variant?.price ?? product.price;
      const variantLabel = variant ? `${variant.title} · ${variant.sku}` : "规格信息待确认";
      return `<div class="checkout-line"><span>${escapeHtml(product.name)}<small>${escapeHtml(variantLabel)} × ${item.quantity}</small></span><span class="checkout-line__price">${money(unitPrice * item.quantity)}</span></div>`;
    }).join("");
    if (quote) {
      subtotalRoot.textContent = money(quote.subtotal);
      if (shippingReady) totalRoot.textContent = money(quote.subtotal + Number(shippingRoot.dataset.fee));
      quoteReady = true;
    } else {
      subtotalRoot.textContent = "待校验";
      quoteReady = false;
    }
  };

  const loadCheckout = async () => {
    submit.disabled = true;
    submit.textContent = "正在核对商品…";
    try {
      await window.ORBITALCart.ready;
      const [cartData, catalogData, shippingData] = await Promise.all([
        request("/api/cart"), request("/api/catalog/products"), request("/api/checkout/shipping-quote?method=standard"),
      ]);
      catalog = catalogData.products || [];
      const shipping = shippingData.shipping;
      shippingReady = shipping.status === "configured";
      if (shippingReady) {
        shippingRoot.textContent = money(shipping.fee);
        shippingRoot.dataset.fee = String(shipping.fee);
        shippingNote.textContent = "普通配送费用已配置，最终金额以提交时服务端复核为准。";
        totalNote.textContent = "应付总额包含商品小计与普通配送费用。";
      } else {
        shippingRoot.textContent = "待配置";
        totalRoot.textContent = "待配置";
        shippingNote.textContent = "普通配送费用尚未配置，因此暂不能确认结账或暂留库存。";
        totalNote.textContent = "配置配送费用后，页面才会显示最终应付总额。";
      }
      const items = cartData.cart.items || [];
      if (!items.length) {
        renderLines(items, null);
        setMessage("购物袋为空，请先选择商品。", "error");
        submit.textContent = "购物袋为空";
        return;
      }
      const quote = await request("/api/cart/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: items.map(item => ({ slug: item.slug, variantId: item.variantId, quantity: item.quantity })) }),
      });
      renderLines(items, quote);
      if (shippingReady) {
        setMessage("商品与普通配送报价均已通过服务端校验。", "");
        submit.disabled = false;
        submit.textContent = "确认信息并暂留库存";
      } else {
        setMessage("商品报价已校验，但普通配送费用尚未配置；当前不会暂留库存。", "error");
        submit.disabled = true;
        submit.textContent = "等待配送费率配置";
      }
    } catch (error) {
      const cartData = await request("/api/cart").catch(() => null);
      const catalogData = await request("/api/catalog/products").catch(() => ({ products: [] }));
      catalog = catalogData.products || [];
      renderLines(cartData?.cart?.items || [], null);
      const reason = error?.details?.[0]?.message || error.message || "商品暂时无法报价。";
      setMessage(`${reason} 商品开放购买后即可继续结账。`, "error");
      submit.textContent = "商品暂不可结账";
    }
  };

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!quoteReady || !form.reportValidity()) return;
    if (!shippingReady) {
      setMessage("普通配送费用尚未配置，暂时不能结账或暂留库存。", "error");
      return;
    }
    submit.disabled = true;
    submit.textContent = "正在校验并暂留库存…";
    setMessage("正在复核商品价格和可用库存…");
    try {
      const fields = Object.fromEntries(new FormData(form).entries());
      const result = await request("/api/checkout/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      activeReservationIds = (result.reservation.reservations || []).map(item => item.reservation_id);
      renderLines(window.ORBITALCart.get(), result.quote);
      shippingRoot.textContent = money(result.delivery.fee);
      totalRoot.textContent = money(result.quote.total);
      setMessage(`订单草稿 ${result.order.order_number} 已创建，库存暂留 15 分钟。收货信息未保存，也未创建支付或履约任务。`, "success");
      const resultBox = document.createElement("div");
      resultBox.className = "checkout-result";
      resultBox.innerHTML = `<h3>订单草稿已创建</h3><p class="checkout-muted">${escapeHtml(result.message)}</p><button class="checkout-release" type="button">释放库存并返回购物袋</button>`;
      form.replaceChildren(resultBox);
      resultBox.querySelector("button").addEventListener("click", async () => {
        await Promise.all(activeReservationIds.map(id => request(`/api/inventory/reservations/${encodeURIComponent(id)}/release`, { method: "POST" }).catch(() => null)));
        window.location.href = "/cart.html";
      });
    } catch (error) {
      setMessage(error?.details?.[0]?.message || error.message || "暂时无法确认库存，请返回购物袋重试。", "error");
      submit.disabled = !quoteReady || !shippingReady;
      submit.textContent = "重新校验并暂留库存";
    }
  });

  loadCheckout();
})();
