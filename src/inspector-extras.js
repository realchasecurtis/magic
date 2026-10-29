import { escape as esc, registerExportFont } from "./render.js";
export const templates = [
  ["Print", "Shipping label · 4 × 6 in", 1200, 1800],
  ["Print", "US Letter · 8.5 × 11 in", 2550, 3300],
  ["Print", "US Legal · 8.5 × 14 in", 2550, 4200],
  ["Print", "Tabloid · 11 × 17 in", 3300, 5100],
  ["Print", "A4 · 210 × 297 mm", 2480, 3508],
  ["Print", "A5 · 148 × 210 mm", 1748, 2480],
  ["Print", "A3 · 297 × 420 mm", 3508, 4961],
  ["Print", "Business card · 3.5 × 2 in", 1050, 600],
  ["Print", "Postcard · 6 × 4 in", 1800, 1200],
  ["Print", "Photo · 8 × 10 in", 2400, 3000],
  ["Social", "Square post", 1080, 1080],
  ["Social", "Portrait post · 4:5", 1080, 1350],
  ["Social", "Story / reel · 9:16", 1080, 1920],
  ["Social", "Video thumbnail · 16:9", 1280, 720],
  ["Social", "Social link card", 1200, 630],
  ["Social", "Wide banner · 3:1", 1500, 500],
  ["Social", "Channel banner", 2560, 1440],
  ["Social", "Profile avatar", 512, 512],
  ["Screen", "Full HD", 1920, 1080],
  ["Screen", "4K UHD", 3840, 2160],
  ["Screen", "Presentation · 4:3", 1024, 768],
  ["Screen", "Desktop web", 1440, 900],
  ["Screen", "Mobile portrait", 390, 844],
  ["Screen", "Tablet", 768, 1024],
  ["Icons", "Favicon · 16", 16, 16],
  ["Icons", "Favicon · 32", 32, 32],
  ["Icons", "Favicon · 48", 48, 48],
  ["Icons", "Touch icon", 180, 180],
  ["Icons", "App icon", 1024, 1024],
];
export const bundled = [
  ["Inter", "inter"],
  ["Lora", "lora"],
  ["Nunito", "nunito"],
  ["Oswald", "oswald"],
  ["Dancing Script", "dancingscript"],
  ["JetBrains Mono", "jetbrainsmono"],
  ["Bebas Neue", "bebasneue"],
];
const loaded = new Map();
async function load(name, src) {
  const key = name + src;
  if (loaded.has(key)) return loaded.get(key);
  const task = (async () => {
    if (!src.startsWith("data:")) {
      const response = await fetch(src);
      if (!response.ok) throw Error("Font unavailable");
      const blob = await response.blob();
      src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    registerExportFont(name, src);
    return new FontFace(name, `url("${src}")`, { weight: "100 900" })
      .load()
      .then((face) => {
        document.fonts.add(face);
        return face;
      });
  })();
  loaded.set(key, task);
  try {
    return await task;
  } catch (e) {
    loaded.delete(key);
    throw e;
  }
}
export async function loadFonts(project) {
  await Promise.allSettled([
    ...bundled.map(([name, file]) => load(name, `./assets/fonts/${file}.ttf`)),
    ...(project?.fonts || [])
      .filter(
        (f) =>
          typeof f.name === "string" &&
          /^data:(font\/|application\/octet-stream)/.test(f.src),
      )
      .map((f) => load(f.name, f.src)),
  ]);
}
export function enhanceInspector({
  n,
  project,
  change,
  fitText,
  dialog,
  toast,
}) {
  const $ = (s) => document.querySelector(s);
  if (n.type === "frame") {
    const section = document.createElement("div");
    section.className = "property-section";
    section.innerHTML =
      '<h3>Template</h3><select id="frame-template" aria-label="Frame template"><option value="">Custom size</option>' +
      ["Print", "Social", "Screen", "Icons"]
        .map(
          (cat) =>
            `<optgroup label="${cat}">${templates.map((t, i) => (t[0] === cat ? `<option value="${i}" ${n.w === t[2] && n.h === t[3] ? "selected" : ""}>${t[1]} — ${t[2]} × ${t[3]}</option>` : "")).join("")}</optgroup>`,
        )
        .join("") +
      '</select><p>Print sizes use 300 pixels/inch. Social sizes are starting points; check your destination’s crop.</p><button id="template-rotate">Swap width / height</button>';
    $("#inspector").children[0].after(section);
    $("#frame-template").onchange = (e) => {
      if (e.target.value === "") return;
      const t = templates[Number(e.target.value)];
      change(() => {
        n.w = t[2];
        n.h = t[3];
        n.template = t[1];
      });
    };
    $("#template-rotate").onclick = () =>
      change(() => {
        [n.w, n.h] = [n.h, n.w];
      });
  }
  if (n.type !== "text") return;
  const select = $('[data-prop="fontFamily"]'),
    label = select.parentElement;
  label.innerHTML =
    'Typeface<button id="font-picker" type="button">' +
    esc(n.fontFamily || "Arial") +
    " ▾</button>";
  $("#font-picker").onclick = () => {
    dialog(
      '<h2>Fonts</h2><input id="font-search" type="search" placeholder="Search typefaces" aria-label="Search typefaces"><div id="font-list"></div>',
    );
    const names = [
      ...new Set([
        ...bundled.map((x) => x[0]),
        ...(project.fonts || []).map((f) => f.name),
        "Arial",
        "Georgia",
        "Courier New",
        "Verdana",
      ]),
    ];
    const draw = () => {
      const q = $("#font-search").value.toLowerCase();
      $("#font-list").replaceChildren(
        ...names
          .filter((f) => f.toLowerCase().includes(q))
          .map((f) => {
            const b = document.createElement("button");
            b.textContent = f;
            b.style.fontFamily = f;
            b.className = n.fontFamily === f ? "active" : "";
            b.onclick = () => {
              change(() => {
                n.fontFamily = f;
                fitText(n);
              });
              $("#dialog").close();
            };
            return b;
          }),
      );
    };
    $("#font-search").oninput = draw;
    draw();
    $("#font-search").focus();
  };
  const align = $('[data-prop="align"]').parentElement;
  align.innerHTML =
    'Alignment<div class="text-align-buttons">' +
    ["left", "center", "right"]
      .map(
        (a) =>
          `<button type="button" data-text-align="${a}" title="Align ${a}" aria-label="Align ${a}" aria-pressed="${(n.align || "left") === a}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h18 M${a === "right" ? 9 : a === "center" ? 6 : 3} 10h12 M3 15h18 M${a === "right" ? 9 : a === "center" ? 6 : 3} 20h12"/></svg></button>`,
      )
      .join("") +
    "</div>";
  align.querySelectorAll("button").forEach(
    (b) =>
      (b.onclick = () =>
        change(() => {
          n.align = b.dataset.textAlign;
        })),
  );
  const drop = document.createElement("label");
  drop.id = "font-drop";
  drop.innerHTML =
    'Add your typeface<span>Drop TTF, OTF, WOFF or WOFF2 here, or choose a file</span><input id="font-import" type="file" accept=".ttf,.otf,.woff,.woff2" multiple>';
  label.closest(".property-section").append(drop);
  async function add(files) {
    for (const file of files) {
      try {
        if (!/\.(ttf|otf|woff2?)$/i.test(file.name))
          throw Error("Choose a TTF, OTF, WOFF or WOFF2 font.");
        const name = file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^\w -]/g, " ")
          .trim();
        const src = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () =>
            resolve(String(r.result).replace(/^data:[^;]+;/, "data:font/ttf;"));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        await load(name, src);
        change(() => {
          project.fonts = (project.fonts || []).filter((f) => f.name !== name);
          project.fonts.push({ name, src });
          n.fontFamily = name;
          fitText(n);
        });
        toast("Typeface added to this project.");
      } catch (e) {
        toast(e.message || "Could not load font.");
      }
    }
  }
  $("#font-import").onchange = (e) => add(e.target.files);
  drop.ondragover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.classList.add("drag-over");
  };
  drop.ondragleave = () => drop.classList.remove("drag-over");
  drop.ondrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    drop.classList.remove("drag-over");
    add(e.dataTransfer.files);
  };
}
