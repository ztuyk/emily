// ===== CMS (Supabase) =====
const SB_URL  = "https://opkhgpybppengmntfkae.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wa2hncHlicHBlbmdtbnRma2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTkxNzEsImV4cCI6MjA3MDU5NTE3MX0.iMafxgfUm96zP1gYzYlU0NycGGfVQR6yIId1yRZg_DY";

function loadSupabaseJs() {
  return new Promise((r) => {
    if (window.supabase) return r();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = r;
    document.head.appendChild(s);
  });
}

async function cmsLoad() {
  await loadSupabaseJs();
  const client = supabase.createClient(SB_URL, SB_ANON);

  // ----- Accordion: dynamic mount if #accordion-mount exists, else map onto existing shells -----
  const accMount = document.getElementById("accordion-mount");
  if (accMount) {
    const { data: sections, error } = await client
      .from("sections").select("*").eq("published", true)
      .order("position", { ascending: true });
    if (error) console.warn("sections error:", error);

    accMount.innerHTML = "";
    (sections || []).forEach((sec) => {
      const wrap = document.createElement("div");
      wrap.className = "accordion";

      const h = document.createElement("h4");
      h.className = "accordion__title";
      h.textContent = sec.title || "";

      const icon = document.createElement("i");
      icon.className = "accordion__icon";
      icon.innerHTML = '<div class="line-01"></div><div class="line-02"></div>';
      h.appendChild(icon);

      const c = document.createElement("div");
      c.className = "accordion__content";
      c.innerHTML = sec.content_html || "";

      wrap.append(h, c);
      accMount.appendChild(wrap);
    });
  } else {
    const accEls = Array.from(document.querySelectorAll(".accordion"));
    if (accEls.length) {
      const { data: sections, error } = await client
        .from("sections").select("*").eq("published", true)
        .order("position", { ascending: true });
      if (error) console.warn("sections error:", error);

      const list = sections || [];
      const n = Math.min(accEls.length, list.length);
      for (let i = 0; i < n; i++) {
        const acc = accEls[i];
        const sec = list[i] || {};
        const titleEl = acc.querySelector(".accordion__title");
        const contentEl = acc.querySelector(".accordion__content");
        if (titleEl) {
          const icon = titleEl.querySelector(".accordion__icon");
          if (icon) {
            [...titleEl.childNodes].forEach((node) => { if (node !== icon) titleEl.removeChild(node); });
            titleEl.insertBefore(document.createTextNode(sec.title || ""), icon);
          } else {
            titleEl.textContent = sec.title || "";
          }
        }
        if (contentEl) contentEl.innerHTML = sec.content_html || "";
      }
    }
  }

  // ----- Slider: fill from CMS with shape class -----
  const sliderEl = document.getElementById("slider");
  if (sliderEl) {
    const { data: slides, error } = await client
      .from("slides").select("*").eq("published", true)
      .order("position", { ascending: true });
    if (error) console.warn("slides error:", error);

    const shapeClass = (shape) => {
      const s = (shape || "square").toLowerCase();
      return s === "portrait" ? "slide--narrow" : s === "landscape" ? "slide--wide" : "slide--square";
    };

    sliderEl.innerHTML = "";
    (slides || []).forEach((s) => {
      const div = document.createElement("div");
      div.className = "keen-slider__slide " + shapeClass(s.shape);
      const img = document.createElement("img");
      img.alt = s.alt || "";
      img.src = s.thumb_url || s.full_url;
      img.setAttribute("data-full", s.full_url);
      div.appendChild(img);
      sliderEl.appendChild(div);
    });
  }
}

// ------- Accordion (vanilla, delegated) -------
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".accordion__title");
  if (!btn) return;

  const wrapper = btn.closest(".accordion");
  const content = wrapper.querySelector(".accordion__content");
  const openClass = "accordion--open";
  const split = document.querySelector(".split");

  document.querySelectorAll(".accordion." + openClass).forEach((acc) => {
    if (acc !== wrapper) {
      acc.classList.remove(openClass);
      acc.querySelector(".accordion__content")?.style.setProperty("display", "none");
    }
  });

  if (wrapper.classList.contains(openClass)) {
    content.style.display = "none";
    wrapper.classList.remove(openClass);
  } else {
    wrapper.classList.add(openClass);
    content.style.display = "block";
    if (split) split.scrollTo({ top: wrapper.offsetTop, behavior: "smooth" });
  }
});

// ------- Lazy reveal helper -------
function revealImage(img) {
  if (img.complete && img.naturalHeight) {
    requestAnimationFrame(() => img.classList.add("visible"));
  } else {
    img.addEventListener("load", () => img.classList.add("visible"), { once: true });
    img.addEventListener("error", () => console.warn("Image failed:", img.src), { once: true });
  }
}

// ------- Keen slider setup -------
document.addEventListener("DOMContentLoaded", async () => {
  try { await cmsLoad(); } catch (e) { console.warn("cmsLoad failed:", e); }

  const sliders = document.querySelectorAll("#slider");
  if (sliders.length !== 1) {
    console.error(`Expected 1 #slider, found ${sliders.length}`);
    return;
  }
  const sliderEl = sliders[0];
  if (sliderEl.querySelector(".keen-slider .keen-slider")) {
    console.error("Nested .keen-slider detected.");
    return;
  }

  const slides = Array.from(sliderEl.querySelectorAll(":scope > .keen-slider__slide"));
  for (let i = slides.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slides[i], slides[j]] = [slides[j], slides[i]];
  }
  const frag = document.createDocumentFragment();
  slides.forEach((s) => frag.appendChild(s));
  sliderEl.appendChild(frag);

  let autoDir = 1;
  const baseSpeedPx = 0.5;
  let currentSpeedPx = baseSpeedPx;

  function autoplay(slider) {
    let rafId;
    const loop = () => {
      const w = slider.container.clientWidth || 1;
      slider.track.add((currentSpeedPx / w) * autoDir);
      rafId = requestAnimationFrame(loop);
    };
    slider.on("created", () => {
      slider.container.classList.add("ready");
      rafId = requestAnimationFrame(loop);
    });
    slider.on("destroyed", () => cancelAnimationFrame(rafId));
    slider.on("dragStart", () => cancelAnimationFrame(rafId));
    slider.on("dragEnd", ({ track }) => {
      const v = Math.abs(track.details?.velocity ?? 0);
      currentSpeedPx = Math.max(baseSpeedPx, v * (1000 / 60));
      rafId = requestAnimationFrame(loop);
    });
  }

  const slider = new KeenSlider(
    sliderEl,
    { loop: true, mode: "free", renderMode: "performance", slides: { perView: "auto", spacing: 10 } },
    [autoplay]
  );

  const ctr = slider.container;
  let dragging = false;
  ctr.addEventListener("pointerdown", () => (dragging = true));
  ctr.addEventListener("pointermove", (e) => { if (dragging) autoDir = e.movementX > 0 ? -1 : 1; });
  ctr.addEventListener("pointerup", () => (dragging = false));
  ctr.addEventListener("pointercancel", () => (dragging = false));

  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      (target.decode ? target.decode().catch(() => {}) : Promise.resolve())
        .finally(() => revealImage(target));
      io.unobserve(target);
    });
  }, { root: document.getElementById('slider'), rootMargin: '150px' });

  document.querySelectorAll('#slider .keen-slider__slide img').forEach((img) => io.observe(img));

  const lb = document.getElementById("lightbox");
  const lbImg = lb?.querySelector(".lightbox-image");
  const lbVideo = lb?.querySelector(".lightbox-video");
  const lbCap = lb?.querySelector(".lightbox-caption");
  const lbClose = lb?.querySelector(".lightbox-close");

  const bindTap = (el, onTap, threshold = 5) => {
    let moved = 0, sx = 0, sy = 0;
    el.addEventListener("pointerdown", (e) => { moved = 0; sx = e.clientX; sy = e.clientY; }, { passive: true });
    el.addEventListener("pointermove", (e) => {
      moved += Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy);
      sx = e.clientX; sy = e.clientY;
    }, { passive: true });
    el.addEventListener("click", (e) => { if (moved < threshold) onTap(e); });
  };

  function openLightbox(src, caption = "") {
    const lbImg = document.querySelector(".lightbox-image");
    const lbVideo = document.querySelector(".lightbox-video");
    const lbCap = document.querySelector(".lightbox-caption");
    const lb = document.getElementById("lightbox");
    if (!lb) return;
    if (lbImg) lbImg.style.display = "none";
    if (lbVideo) lbVideo.style.display = "none";

    if (/\.(mp4|webm|ogg)$/i.test(src)) {
      if (lbVideo) { lbVideo.src = src; lbVideo.style.display = "block"; lbVideo.play(); }
    } else {
      if (lbImg) { lbImg.src = src; lbImg.style.display = "block"; }
    }
    if (lbCap) lbCap.textContent = caption;
    lb.setAttribute("aria-hidden", "false");
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    const lbImg = document.querySelector(".lightbox-image");
    const lbVideo = document.querySelector(".lightbox-video");
    const lb = document.getElementById("lightbox");
    if (!lb) return;
    lb.setAttribute("aria-hidden", "true");
    lb.classList.remove("open");
    document.body.style.overflow = "";
    if (lbImg) lbImg.removeAttribute("src");
    if (lbVideo) { lbVideo.pause(); lbVideo.removeAttribute("src"); }
  }

  document.querySelectorAll("#slider .keen-slider__slide img, #slider .keen-slider__slide video, .lightbox-trigger")
    .forEach((el) => bindTap(el, () => {
      const src = el.dataset?.full || el.currentSrc || el.src;
      const cap = el.getAttribute?.("alt") || "";
      openLightbox(src, cap);
    }));

  document.querySelector(".lightbox-close")?.addEventListener("click", closeLightbox);
  document.getElementById("lightbox")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });
});
