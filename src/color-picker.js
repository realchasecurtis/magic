const clamp = (v) => Math.max(0, Math.min(1, v));
function hsv(hex) {
  const [r, g, b] = hex
      .match(/[a-f0-9]{2}/gi)
      .map((v) => parseInt(v, 16) / 255),
    max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = d
    ? (max === r
        ? (g - b) / d + (g < b ? 6 : 0)
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4) * 60
    : 0;
  return { h, s: max ? d / max : 0, v: max };
}
function hex({ h, s, v }) {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return (
    "#" +
    rgb
      .map((n) =>
        Math.round((n + m) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function installColorPicker() {
  let active = null,
    values = null,
    start = null,
    opacity = null,
    startOpacity = null;
  const root = document.createElement("div");
  root.id = "paint-picker";
  root.hidden = true;
  document.body.append(root);
  const emit = (type) => {
    if (active?.isConnected)
      active.dispatchEvent(new Event(type, { bubbles: true }));
  };
  function close(commit = true) {
    if (active) {
      if (!commit) {
        active.value = start;
        emit("input");
        if (opacity?.isConnected) {
          opacity.value = startOpacity;
          opacity.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      emit("change");
      if (opacity?.isConnected)
        opacity.dispatchEvent(new Event("change", { bubbles: true }));
    }
    root.hidden = true;
    active = null;
  }
  function update() {
    const value = hex(values);
    active.value = value;
    root.querySelector("#picker-hex").value = value.slice(1).toUpperCase();
    root.querySelector(".saturation-plane").style.backgroundColor =
      `hsl(${values.h} 100% 50%)`;
    const marker = root.querySelector(".color-position");
    marker.style.left = values.s * 100 + "%";
    marker.style.top = (1 - values.v) * 100 + "%";
    emit("input");
  }
  document.addEventListener(
    "click",
    (e) => {
      const input = e.target.closest('input[type="color"][data-paint]');
      if (!input) return;
      e.preventDefault();
      if (active === input) {
        close();
        return;
      }
      close();
      active = input;
      start = input.value;
      opacity = input
        .closest(".paint-row")
        ?.querySelector('[data-key="opacity"]');
      startOpacity = opacity?.value || "100";
      values = hsv(start);
      root.hidden = false;
      root.innerHTML =
        '<div class="picker-heading"><b>Color</b><button id="close-picker" title="Done">✓</button></div><div class="saturation-plane" role="slider" tabindex="0" aria-label="Color saturation and brightness"><i class="color-position"></i></div><label>Hue<input id="picker-hue" type="range" min="0" max="359" step="1"></label><label>Opacity <output id="picker-opacity-label"></output><input id="picker-opacity" type="range" min="0" max="100" step="1" aria-label="Paint opacity"></label><label class="picker-code">#<input id="picker-hex" aria-label="HTML color" maxlength="6"></label><small>Live preview · Escape to cancel</small>';
      const box = input.getBoundingClientRect();
      root.style.left =
        Math.max(8, Math.min(innerWidth - 240, box.left - 242)) + "px";
      root.style.top = Math.max(8, Math.min(innerHeight - 355, box.top)) + "px";
      const alpha = root.querySelector("#picker-opacity"),
        alphaLabel = root.querySelector("#picker-opacity-label");
      alpha.value = startOpacity;
      alphaLabel.textContent = startOpacity + "%";
      alpha.oninput = () => {
        if (opacity?.isConnected) {
          opacity.value = alpha.value;
          alphaLabel.textContent = alpha.value + "%";
          opacity.dispatchEvent(new Event("input", { bubbles: true }));
        }
      };
      const plane = root.querySelector(".saturation-plane");
      const drag = (e) => {
        const r = plane.getBoundingClientRect();
        values.s = clamp((e.clientX - r.left) / r.width);
        values.v = 1 - clamp((e.clientY - r.top) / r.height);
        update();
      };
      plane.onpointerdown = (e) => {
        plane.setPointerCapture(e.pointerId);
        drag(e);
      };
      plane.onpointermove = (e) => {
        if (plane.hasPointerCapture(e.pointerId)) drag(e);
      };
      plane.onpointerup = (e) => {
        if (plane.hasPointerCapture(e.pointerId))
          plane.releasePointerCapture(e.pointerId);
      };
      plane.onkeydown = (e) => {
        if (!e.key.startsWith("Arrow")) return;
        e.preventDefault();
        values.s = clamp(
          values.s +
            (e.key === "ArrowRight" ? 0.01 : e.key === "ArrowLeft" ? -0.01 : 0),
        );
        values.v = clamp(
          values.v +
            (e.key === "ArrowUp" ? 0.01 : e.key === "ArrowDown" ? -0.01 : 0),
        );
        update();
      };
      root.querySelector("#picker-hue").value = values.h;
      root.querySelector("#picker-hue").oninput = (e) => {
        values.h = Number(e.target.value);
        update();
      };
      root.querySelector("#picker-hex").oninput = (e) => {
        if (/^[0-9a-f]{6}$/i.test(e.target.value)) {
          values = hsv("#" + e.target.value);
          root.querySelector("#picker-hue").value = values.h;
          update();
        }
      };
      root.querySelector("#close-picker").onclick = () => close();
      // Paint once without recording a change for opening the picker.
      root.querySelector("#picker-hex").value = start.slice(1).toUpperCase();
      plane.style.backgroundColor = `hsl(${values.h} 100% 50%)`;
      root.querySelector(".color-position").style.cssText =
        `left:${values.s * 100}%;top:${(1 - values.v) * 100}%`;
    },
    true,
  );
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (active && !root.contains(e.target) && e.target !== active) close();
    },
    true,
  );
  root.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close(false);
    }
  });
  root.addEventListener("click", (e) => e.stopPropagation());
}
