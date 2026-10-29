const assetKeys = new Map(),
  persisted = new Set();
export function compactState(value, store, newKeys = []) {
  if (Array.isArray(value))
    return value.map((v) => compactState(v, store, newKeys));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => {
        if (key === "src" && typeof v === "string" && v.startsWith("data:")) {
          let id = assetKeys.get(v);
          if (!id) {
            id = "asset:" + crypto.randomUUID();
            assetKeys.set(v, id);
          }
          if (!persisted.has(id) && !newKeys.includes(id)) {
            store.put(v, id);
            newKeys.push(id);
          }
          return [key, { magicAsset: id }];
        }
        return [key, compactState(v, store, newKeys)];
      }),
    );
  }
  return value;
}
export function markStored(keys) {
  keys.forEach((k) => persisted.add(k));
}
export async function hydrateState(value, db) {
  const refs = [];
  function scan(v) {
    if (!v || typeof v !== "object") return;
    for (const [key, item] of Object.entries(v)) {
      if (key === "src" && item?.magicAsset)
        refs.push([v, key, item.magicAsset]);
      else scan(item);
    }
  }
  scan(value);
  await Promise.all(
    refs.map(
      ([parent, key, id]) =>
        new Promise((resolve, reject) => {
          const r = db
            .transaction("workspace")
            .objectStore("workspace")
            .get(id);
          r.onsuccess = () => {
            if (typeof r.result !== "string")
              return reject(Error("Missing saved asset"));
            parent[key] = r.result;
            assetKeys.set(r.result, id);
            persisted.add(id);
            resolve();
          };
          r.onerror = () => reject(r.error);
        }),
    ),
  );
  return value;
}
