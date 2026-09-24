(() => {
  const STORAGE_KEY = "orbital-cart-v1";
  const listeners = new Set();

  const normalizeItems = (items) => (Array.isArray(items) ? items : [])
    .filter((item) => item && item.slug && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0)
    .map((item) => ({
      slug: String(item.slug),
      quantity: Math.min(20, Number(item.quantity)),
      ...(item.variantId ? { variantId: item.variantId } : {}),
    }));

  const read = () => {
    try {
      return normalizeItems(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
    } catch (_) {
      return [];
    }
  };

  const write = (items) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    listeners.forEach((listener) => listener(items));
    return items;
  };

  const request = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.message || "购物袋请求失败。");
      Object.assign(error, data);
      throw error;
    }
    return data;
  };

  const serverItems = (data) => normalizeItems(data?.cart?.items || []);

  const bootstrap = async () => {
    const localItems = read();
    try {
      const remote = await request("/api/cart");
      let items = serverItems(remote);
      if (!items.length && localItems.length) {
        let migrated = null;
        for (const item of localItems) {
          try {
            migrated = await request("/api/cart/items", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item),
            });
          } catch (_) {
            break;
          }
        }
        if (migrated) items = serverItems(migrated);
      }
      write(items);
      return items;
    } catch (_) {
      return localItems;
    }
  };

  const ready = bootstrap();

  const api = {
    ready,
    get() { return read(); },
    count() { return read().reduce((sum, item) => sum + item.quantity, 0); },
    add(slug, quantity = 1, variantId) {
      const previous = read();
      const items = read();
      const existing = items.find((item) => item.slug === slug && item.variantId === variantId);
      if (existing) existing.quantity = Math.min(20, existing.quantity + Number(quantity));
      else items.push({ slug, quantity: Math.min(20, Number(quantity)), ...(variantId ? { variantId } : {}) });
      write(items);
      return ready.then(() => request("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, quantity, ...(variantId ? { variantId } : {}) }),
      })).then((data) => {
        write(serverItems(data));
        return data;
      }).catch((error) => {
        write(previous);
        throw error;
      });
    },
    update(slug, quantity, variantId) {
      const previous = read();
      const next = Number(quantity);
      write(read().map((item) => item.slug === slug && item.variantId === variantId ? { ...item, quantity: next } : item).filter((item) => item.quantity > 0));
      const key = variantId || slug;
      return ready.then(() => request(`/api/cart/items/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: next }),
      })).then((data) => {
        write(serverItems(data));
        return data;
      }).catch((error) => {
        write(previous);
        throw error;
      });
    },
    remove(slug, variantId) {
      const previous = read();
      write(read().filter((item) => !(item.slug === slug && item.variantId === variantId)));
      const key = variantId || slug;
      return ready.then(() => request(`/api/cart/items/${encodeURIComponent(key)}`, { method: "DELETE" }))
        .then((data) => { write(serverItems(data)); return data; })
        .catch((error) => {
          if (error.error === "cart_item_not_found") return { cart: { items: read() } };
          write(previous);
          throw error;
        });
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };

  window.ORBITALCart = api;
})();
