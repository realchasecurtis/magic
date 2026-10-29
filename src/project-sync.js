const copy = (x) => structuredClone(x),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function fields(a, b, exclude = []) {
  const changes = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (
      exclude.includes(k) ||
      ["__proto__", "prototype", "constructor"].includes(k)
    )
      continue;
    if (!same(a[k], b[k])) changes[k] = k in b ? copy(b[k]) : null;
  }
  return changes;
}
export function projectPatch(before, after) {
  const ops = [];
  const root = fields(before, after, ["id", "pages", "activePage"]);
  if (Object.keys(root).length) ops.push({ kind: "project", fields: root });
  for (const old of before.pages)
    if (!after.pages.some((p) => p.id === old.id))
      ops.push({ kind: "deletePage", id: old.id });
  for (const page of after.pages) {
    const old = before.pages.find((p) => p.id === page.id);
    if (!old) {
      ops.push({ kind: "addPage", page: copy(page) });
      continue;
    }
    const f = fields(old, page, ["nodes", "view", "id"]);
    if (Object.keys(f).length)
      ops.push({ kind: "page", id: page.id, fields: f });
    for (const n of old.nodes)
      if (!page.nodes.some((v) => v.id === n.id))
        ops.push({ kind: "deleteNode", page: page.id, id: n.id });
    for (const n of page.nodes) {
      const prev = old.nodes.find((v) => v.id === n.id);
      if (!prev) ops.push({ kind: "addNode", page: page.id, node: copy(n) });
      else {
        const f = fields(prev, n, ["id"]);
        if (Object.keys(f).length)
          ops.push({ kind: "node", page: page.id, id: n.id, fields: f });
      }
    }
    if (
      !same(
        old.nodes.map((n) => n.id),
        page.nodes.map((n) => n.id),
      )
    )
      ops.push({
        kind: "order",
        page: page.id,
        ids: page.nodes.map((n) => n.id),
      });
  }
  return ops;
}
export function applyPatch(project, ops) {
  const result = copy(project);
  const assign = (target, fields) => {
    if (!target) return;
    for (const [k, v] of Object.entries(fields || {})) {
      if (
        [
          "__proto__",
          "constructor",
          "prototype",
          "id",
          "pages",
          "nodes",
          "activePage",
          "view",
        ].includes(k)
      )
        continue;
      target[k] = copy(v);
    }
  };
  for (const op of ops) {
    const page = result.pages.find((p) => p.id === (op.page || op.id));
    switch (op.kind) {
      case "project":
        assign(result, op.fields);
        break;
      case "addPage":
        if (!result.pages.some((p) => p.id === op.page.id))
          result.pages.push(copy(op.page));
        break;
      case "deletePage":
        result.pages = result.pages.filter((p) => p.id !== op.id);
        break;
      case "page":
        assign(page, op.fields);
        break;
      case "addNode":
        if (page && !page.nodes.some((n) => n.id === op.node.id))
          page.nodes.push(copy(op.node));
        break;
      case "deleteNode":
        if (page) page.nodes = page.nodes.filter((n) => n.id !== op.id);
        break;
      case "node":
        assign(
          page?.nodes.find((n) => n.id === op.id),
          op.fields,
        );
        break;
      case "order":
        if (page) {
          const ranks = new Map(op.ids.map((id, i) => [id, i]));
          page.nodes.sort(
            (a, b) => (ranks.get(a.id) ?? 1e9) - (ranks.get(b.id) ?? 1e9),
          );
        }
        break;
    }
  }
  // Deleting a container releases children instead of leaving orphan references.
  for (const page of result.pages) {
    const ids = new Set(page.nodes.map((n) => n.id));
    for (const n of page.nodes)
      if (n.parent && !ids.has(n.parent)) n.parent = null;
  }
  if (!result.pages.length) throw Error("A shared project must retain a page.");
  return result;
}
