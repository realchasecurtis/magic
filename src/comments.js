// An anchored, non-modal canvas conversation. Its DOM is kept during canvas redraws.
export function createComments({
  viewport,
  getPage,
  getView,
  getNodes,
  change,
  makeNode,
  select,
  escape,
  authorName,
  onAuthor,
}) {
  const root = document.createElement("div");
  root.id = "inline-comment";
  root.hidden = true;
  viewport.append(root);
  let state = null;
  for (const event of [
    "pointerdown",
    "pointerup",
    "click",
    "dblclick",
    "wheel",
    "contextmenu",
  ])
    root.addEventListener(event, (e) => e.stopPropagation());
  function close() {
    state = null;
    root.hidden = true;
    root.replaceChildren();
  }
  function position() {
    if (!state) return;
    if (state.page !== getPage().id) {
      close();
      return;
    }
    const n = state.id ? getNodes().find((n) => n.id === state.id) : state.p;
    if (!n) {
      close();
      return;
    }
    const v = getView(),
      width = Math.min(340, viewport.clientWidth - 24);
    root.style.width = width + "px";
    const x = n.x * v.zoom + v.x + 44,
      y = n.y * v.zoom + v.y;
    root.style.left =
      Math.max(12, Math.min(x, viewport.clientWidth - width - 12)) + "px";
    root.style.top =
      Math.max(
        12,
        Math.min(y, viewport.clientHeight - root.offsetHeight - 80),
      ) + "px";
  }
  function show() {
    const n = state.id ? getNodes().find((n) => n.id === state.id) : null;
    root.hidden = false;
    root.className = n ? "comment-thread" : "comment-draft";
    root.innerHTML = `${n ? `<div class="comment-heading"><b>Discussion</b><button id="close-comment" title="Close discussion">×</button></div><div class="comment-messages">${n.comments.map((c) => `<div class="reply"><b>${escape(c.author)}</b><small>${new Date(c.date).toLocaleString()}</small><p>${escape(c.text)}</p></div>`).join("")}</div>` : '<button id="close-comment" class="comment-dismiss" title="Cancel comment">×</button>'}<form class="comment-compose"><textarea id="${n ? "reply-text" : "comment-text"}" aria-label="${n ? "Reply" : "Add a comment"}" placeholder="${n ? "Add a reply…" : "Add a comment…"}" rows="1"></textarea><button id="${n ? "post-reply" : "post-comment"}" type="submit" aria-label="${n ? "Send reply" : "Post comment"}" disabled>↑</button></form><div class="comment-meta"><label>As <input id="author" aria-label="Comment author" value="${escape(authorName())}" maxlength="80"></label><small>Saved with project</small></div>`;
    const textarea = root.querySelector("textarea"),
      send = root.querySelector("[type=submit]");
    textarea.oninput = () => {
      send.disabled = !textarea.value.trim();
      textarea.style.height = "auto";
      textarea.style.height = Math.min(140, textarea.scrollHeight) + "px";
      position();
    };
    textarea.onkeydown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        root.querySelector("form").requestSubmit();
      }
    };
    root.querySelector("#close-comment").onclick = close;
    root.querySelector("form").onsubmit = (e) => {
      e.preventDefault();
      const text = textarea.value.trim(),
        author = root.querySelector("#author").value.trim() || "You";
      if (!text) return;
      onAuthor(author);
      const entry = { author, text, date: new Date().toISOString() };
      if (n) {
        change(() => n.comments.push(entry));
      } else {
        const item = makeNode("comment", state.p.x, state.p.y, 36, 36, {
          name: "Comment",
          comments: [entry],
        });
        state.id = item.id;
        change(() => {
          getNodes().push(item);
          select(item.id);
        });
      }
      show();
    };
    position();
    textarea.focus();
    root.querySelector(".comment-messages")?.scrollTo(0, 999999);
  }
  return {
    openNew(p) {
      state = { page: getPage().id, p };
      show();
    },
    open(n) {
      state = { page: getPage().id, id: n.id };
      show();
    },
    position,
    close,
    get active() {
      return !!state;
    },
  };
}
