(() => {
  const DEFAULT_BG_URL = "assets/source-images/background.jpg";
  const GALAXY_WORLD_PADDING = 120;
  const SYSTEM_WORLD_PADDING = 120;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };

  function fitScaleForBounds(canvas, bounds) {
    return Math.min(canvas.width / Math.max(bounds.width, 1), canvas.height / Math.max(bounds.height, 1));
  }

  function createBounds(minX, minY, maxX, maxY, pad = 0) {
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    return {
      x: minX - pad,
      y: minY - pad,
      width: width + pad * 2,
      height: height + pad * 2
    };
  }

  function expandBounds(bounds, pad = 0) {
    return {
      x: bounds.x - pad,
      y: bounds.y - pad,
      width: bounds.width + pad * 2,
      height: bounds.height + pad * 2
    };
  }

  function canvasPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * canvas.width / rect.width,
      y: (event.clientY - rect.top) * canvas.height / rect.height,
      rect
    };
  }

  function createWorldView(canvas, bounds, maxScale = 6, fitBounds = bounds) {
    const state = { bounds, scale: 1, viewX: bounds.x, viewY: bounds.y };

    const minScale = () => fitScaleForBounds(canvas, fitBounds);
    const viewSize = () => ({
      width: canvas.width / state.scale,
      height: canvas.height / state.scale
    });

    function clampState() {
      const minimum = minScale();
      state.scale = clamp(state.scale, minimum, Math.max(minimum, maxScale));
      const size = viewSize();
      const maxX = state.bounds.x + state.bounds.width - size.width;
      const maxY = state.bounds.y + state.bounds.height - size.height;

      if (size.width >= state.bounds.width) {
        state.viewX = state.bounds.x - (size.width - state.bounds.width) / 2;
      } else {
        state.viewX = clamp(state.viewX, state.bounds.x, maxX);
      }

      if (size.height >= state.bounds.height) {
        state.viewY = state.bounds.y - (size.height - state.bounds.height) / 2;
      } else {
        state.viewY = clamp(state.viewY, state.bounds.y, maxY);
      }
    }

    function reset() {
      state.scale = minScale();
      const size = viewSize();
      state.viewX = fitBounds.x + (fitBounds.width - size.width) / 2;
      state.viewY = fitBounds.y + (fitBounds.height - size.height) / 2;
      clampState();
    }

    function toScreenX(x) {
      return (x - state.viewX) * state.scale;
    }

    function toScreenY(y) {
      return (y - state.viewY) * state.scale;
    }

    function toWorldX(x) {
      return x / state.scale + state.viewX;
    }

    function toWorldY(y) {
      return y / state.scale + state.viewY;
    }

    function zoomAt(screenX, screenY, factor) {
      const worldX = toWorldX(screenX);
      const worldY = toWorldY(screenY);
      state.scale *= factor;
      clampState();
      state.viewX = worldX - screenX / state.scale;
      state.viewY = worldY - screenY / state.scale;
      clampState();
    }

    function panBy(screenDx, screenDy) {
      state.viewX -= screenDx / state.scale;
      state.viewY -= screenDy / state.scale;
      clampState();
    }

    function centerOn(x, y, scale = state.scale) {
      state.scale = scale;
      clampState();
      const size = viewSize();
      state.viewX = x - size.width / 2;
      state.viewY = y - size.height / 2;
      clampState();
    }

    reset();

    return {
      state,
      minScale,
      viewSize,
      reset,
      clampState,
      zoomAt,
      panBy,
      centerOn,
      toScreenX,
      toScreenY,
      toWorldX,
      toWorldY
    };
  }

  function positionTooltip(canvas, tooltip, event, text) {
    if (!tooltip) return;
    tooltip.textContent = text;
    const wrap = canvas.parentElement?.getBoundingClientRect();
    if (!wrap) return;
    const x = event.clientX - wrap.left;
    const y = event.clientY - wrap.top;
    tooltip.style.left = `${Math.max(12, Math.min(wrap.width - 24, x + 16))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(wrap.height - 24, y + 16))}px`;
    tooltip.style.display = "block";
  }

  function hideTooltip(tooltip) {
    if (!tooltip) return;
    tooltip.style.display = "none";
    tooltip.textContent = "";
  }

  function createStarfield(bounds, count, seed) {
    let state = seed || 1;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };

    return Array.from({ length: count }, () => ({
      x: bounds.x + random() * bounds.width,
      y: bounds.y + random() * bounds.height,
      r: 0.8 + random() * 1.8,
      alpha: 0.15 + random() * 0.45,
      color: random() > 0.86 ? "#b7efff" : "#ffffff"
    }));
  }

  function drawWorldGrid(ctx, view, bounds, spacing, color) {
    const left = view.toWorldX(0);
    const right = view.toWorldX(ctx.canvas.width);
    const top = view.toWorldY(0);
    const bottom = view.toWorldY(ctx.canvas.height);
    const startX = Math.floor(Math.max(bounds.x, left) / spacing) * spacing;
    const endX = Math.ceil(Math.min(bounds.x + bounds.width, right) / spacing) * spacing;
    const startY = Math.floor(Math.max(bounds.y, top) / spacing) * spacing;
    const endY = Math.ceil(Math.min(bounds.y + bounds.height, bottom) / spacing) * spacing;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (let x = startX; x <= endX; x += spacing) {
      const screenX = view.toScreenX(x);
      ctx.beginPath();
      ctx.moveTo(screenX, 0);
      ctx.lineTo(screenX, ctx.canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += spacing) {
      const screenY = view.toScreenY(y);
      ctx.beginPath();
      ctx.moveTo(0, screenY);
      ctx.lineTo(ctx.canvas.width, screenY);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStars(ctx, view, stars) {
    for (const star of stars) {
      const x = view.toScreenX(star.x);
      const y = view.toScreenY(star.y);
      if (x < -8 || y < -8 || x > ctx.canvas.width + 8 || y > ctx.canvas.height + 8) continue;
      const radius = clamp(star.r * Math.sqrt(view.state.scale), 0.7, 2.6);
      ctx.save();
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function backgroundImageFor(asset) {
    const image = new Image();
    image.src = asset?.url || DEFAULT_BG_URL;
    return image;
  }

  function drawBackgroundLayer(ctx, view, bounds, image, asset, alpha = 0.3) {
    const left = view.toScreenX(bounds.x);
    const top = view.toScreenY(bounds.y);
    const width = bounds.width * view.state.scale;
    const height = bounds.height * view.state.scale;
    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    if (image.complete && image.naturalWidth) {
      if (asset && Number.isFinite(asset.x) && Number.isFinite(asset.width) && Number.isFinite(asset.height)) {
        ctx.drawImage(image, asset.x, asset.y, asset.width, asset.height, left, top, width, height);
      } else {
        ctx.drawImage(image, left, top, width, height);
      }
    } else {
      ctx.fillStyle = "#0d1724";
      ctx.fillRect(left, top, width, height);
    }
    ctx.restore();
  }

  function drawSystemFocusMarker(ctx, x, y, radius) {
    const ringRadius = Math.max(radius + 10, 18);
    const tipY = y - ringRadius - 4;
    const headWidth = 14;
    const stemTop = tipY - 28;
    ctx.save();
    ctx.strokeStyle = "#6ee7f9";
    ctx.fillStyle = "#6ee7f9";
    ctx.shadowColor = "#6ee7f9";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, stemTop);
    ctx.lineTo(x, tipY - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, tipY);
    ctx.lineTo(x - headWidth, tipY - 18);
    ctx.lineTo(x + headWidth, tipY - 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function setupInteractiveScene(canvas, view, config) {
    let points = [];
    let pointerId = null;
    let dragging = false;
    let moved = false;
    let lastPoint = null;

    const redraw = () => {
      points = config.draw(view) || [];
    };

    const pick = (event) => {
      const point = canvasPoint(canvas, event);
      return points.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= item.hitRadius);
    };

    const setIdle = () => {
      if (config.readout) config.readout.textContent = config.idleText;
      if (!dragging) canvas.style.cursor = "grab";
      hideTooltip(config.tooltip);
    };

    const updateHover = (event) => {
      if (dragging) return;
      const hit = pick(event);
      if (!hit) {
        setIdle();
        return;
      }
      canvas.style.cursor = hit.url ? "pointer" : "grab";
      if (config.readout) config.readout.textContent = config.describe(hit.data);
      positionTooltip(canvas, config.tooltip, event, config.describe(hit.data));
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", (event) => {
      pointerId = event.pointerId;
      dragging = true;
      moved = false;
      lastPoint = canvasPoint(canvas, event);
      canvas.style.cursor = "grabbing";
      hideTooltip(config.tooltip);
      if (canvas.setPointerCapture) canvas.setPointerCapture(pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== pointerId) {
        updateHover(event);
        return;
      }
      const point = canvasPoint(canvas, event);
      const dx = point.x - lastPoint.x;
      const dy = point.y - lastPoint.y;
      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) moved = true;
      view.panBy(dx, dy);
      lastPoint = point;
      redraw();
    });

    const stopDrag = (event) => {
      if (event.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      lastPoint = null;
      canvas.style.cursor = "grab";
      if (canvas.releasePointerCapture) canvas.releasePointerCapture(event.pointerId);
    };

    canvas.addEventListener("pointerup", stopDrag);
    canvas.addEventListener("pointercancel", stopDrag);
    canvas.addEventListener("mouseleave", () => {
      if (!dragging) setIdle();
    });

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const point = canvasPoint(canvas, event);
      const factor = Math.exp(-event.deltaY * 0.0015);
      view.zoomAt(point.x, point.y, factor);
      redraw();
    }, { passive: false });

    canvas.addEventListener("dblclick", (event) => {
      event.preventDefault();
      view.reset();
      redraw();
    });

    canvas.addEventListener("click", (event) => {
      if (moved) {
        moved = false;
        return;
      }
      const hit = pick(event);
      if (hit?.url && config.onClick) config.onClick(hit.data);
    });

    config.toolbar?.forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.mapAction;
      if (action === "zoom-in") view.zoomAt(canvas.width / 2, canvas.height / 2, 1.2);
      if (action === "zoom-out") view.zoomAt(canvas.width / 2, canvas.height / 2, 1 / 1.2);
      if (action === "zoom-reset") view.reset();
      redraw();
    }));

    redraw();
    return { redraw };
  }

  function galaxyBackgroundBounds(systems, background) {
    const xs = systems.map((system) => toNumber(system.x));
    const ys = systems.map((system) => toNumber(system.y));
    const maxX = xs.length ? Math.max(...xs) : 0;
    const maxY = ys.length ? Math.max(...ys) : 0;
    if (background && Number.isFinite(background.width) && Number.isFinite(background.height)) {
      return {
        x: 0,
        y: 0,
        width: Math.max(background.width, maxX + 160),
        height: Math.max(background.height, maxY + 160)
      };
    }
    return createBounds(Math.min(...xs, 0), Math.min(...ys, 0), maxX, maxY, 140);
  }

  function galaxyBounds(systems, background) {
    return expandBounds(galaxyBackgroundBounds(systems, background), GALAXY_WORLD_PADDING);
  }

  function systemBackgroundBounds(data) {
    const entries = [];
    for (const body of data.bodies || []) {
      const radius = Math.max(toNumber(body.radius, 60), toNumber(body.warningRadius, 0));
      entries.push({ x: toNumber(body.x), y: toNumber(body.y), radius });
    }
    for (const spawner of data.spawners || []) {
      entries.push({ x: toNumber(spawner.x), y: toNumber(spawner.y), radius: 90 });
    }
    for (const boss of data.bosses || []) {
      entries.push({ x: toNumber(boss.x), y: toNumber(boss.y), radius: 110 });
    }
    if (!entries.length) return { x: -600, y: -400, width: 1200, height: 800 };
    const minX = Math.min(...entries.map((entry) => entry.x - entry.radius));
    const minY = Math.min(...entries.map((entry) => entry.y - entry.radius));
    const maxX = Math.max(...entries.map((entry) => entry.x + entry.radius));
    const maxY = Math.max(...entries.map((entry) => entry.y + entry.radius));
    return createBounds(minX, minY, maxX, maxY, 180);
  }

  function systemBounds(data) {
    return expandBounds(systemBackgroundBounds(data), SYSTEM_WORLD_PADDING);
  }

  function bodyDisplayName(body) {
    return String(body?.displayName || "").trim();
  }

  function bodyReadoutName(body) {
    return bodyDisplayName(body) || "Hidden location";
  }

  function filterGalaxySystems(systems, warpPaths, query, galaxy) {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    const base = systems.filter((system) => !galaxy || system.galaxy === galaxy);
    if (!normalizedQuery) {
      return base.map((system) => ({ system, match: false, neighbor: false }));
    }
    const matched = new Set(base.filter((system) => String(system.name || "").toLowerCase().includes(normalizedQuery)).map((system) => system.key));
    const linked = new Set(matched);
    for (const warpPath of warpPaths) {
      const a = warpPath.solarSystem1 || warpPath.stats?.solarSystem1;
      const b = warpPath.solarSystem2 || warpPath.stats?.solarSystem2;
      if (matched.has(a)) linked.add(b);
      if (matched.has(b)) linked.add(a);
    }
    return base.filter((system) => linked.has(system.key)).map((system) => ({
      system,
      match: matched.has(system.key),
      neighbor: !matched.has(system.key)
    }));
  }

  function drawGalaxyScene(ctx, canvas, view, scene, filters, backgroundImage) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#03070d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBackgroundLayer(ctx, view, scene.backgroundBounds, backgroundImage, scene.background, 0.92);
    drawStars(ctx, view, scene.stars);

    const query = String(filters.search?.value || "").trim().toLowerCase();
    const systems = filterGalaxySystems(scene.systems, scene.warpPaths, query, filters.galaxy?.value || "");
    const points = systems.map(({ system, match, neighbor }) => {
      const x = view.toScreenX(toNumber(system.x));
      const y = view.toScreenY(toNumber(system.y));
      const radius = clamp(Math.max(5, Math.min(14, toNumber(system.size, 8))) * Math.sqrt(view.state.scale), 5, 20);
      return {
        x,
        y,
        hitRadius: radius + 7,
        radius,
        data: { ...system, match, neighbor },
        url: scene.routes[system.key] || ""
      };
    });

    const byKey = new Map(points.map((point) => [point.data.key, point]));
    if (filters.paths?.checked !== false) {
      for (const warpPath of scene.warpPaths) {
        const a = byKey.get(warpPath.solarSystem1 || warpPath.stats?.solarSystem1);
        const b = byKey.get(warpPath.solarSystem2 || warpPath.stats?.solarSystem2);
        if (!a || !b) continue;
        if (query && !(a.data.match || b.data.match)) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const startX = a.x + dx / length * (a.radius + 3);
        const startY = a.y + dy / length * (a.radius + 3);
        const endX = b.x - dx / length * (b.radius + 3);
        const endY = b.y - dy / length * (b.radius + 3);
        ctx.strokeStyle = a.data.match || b.data.match ? "rgba(255,255,255,.72)" : (warpPath.transit ? "rgba(110,231,249,.52)" : "rgba(255,180,84,.36)");
        ctx.lineWidth = warpPath.transit ? 2.2 : 1.4;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    }

    for (const point of points) {
      const system = point.data;
      const color = system.destroyed ? "#ff6b52" : (String(system.type || "").includes("pvp") ? "#ffb454" : (() => {
        let hash = 0;
        for (const char of String(system.galaxy || "")) hash = (hash * 31 + char.charCodeAt(0)) % 360;
        return `hsl(${hash} 78% 66%)`;
      })());

      ctx.save();
      ctx.globalAlpha = system.neighbor ? 0.72 : 1;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = system.match ? 18 : 10;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (system.destroyed) {
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (system.match) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      if (view.state.scale > view.minScale() * 1.1 || point.radius > 8) {
        ctx.fillStyle = system.destroyed ? "#ffd6c9" : "#e6edf3";
        ctx.font = `${system.match ? "600 " : ""}13px system-ui`;
        ctx.fillText(system.name, point.x + point.radius + 6, point.y + 4);
      }
      ctx.restore();
    }

    return points;
  }

  function drawSystemScene(ctx, canvas, view, scene, backgroundImage) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#02050a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawBackgroundLayer(ctx, view, scene.backgroundBounds, backgroundImage, scene.background, scene.background ? 0.42 : 0.24);
    drawStars(ctx, view, scene.stars);
    drawWorldGrid(ctx, view, scene.backgroundBounds, 120, "rgba(110,231,249,.08)");

    const bodyByKey = new Map((scene.bodies || []).map((body) => [body.key, body]));
    for (const body of scene.bodies || []) {
      if (!body.parent || !bodyByKey.has(body.parent)) continue;
      const parent = bodyByKey.get(body.parent);
      const parentX = view.toScreenX(toNumber(parent.x));
      const parentY = view.toScreenY(toNumber(parent.y));
      const bodyX = view.toScreenX(toNumber(body.x));
      const bodyY = view.toScreenY(toNumber(body.y));
      ctx.save();
      ctx.strokeStyle = "rgba(180,210,230,.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(parentX, parentY, Math.hypot(bodyX - parentX, bodyY - parentY), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const body of (scene.bodies || []).filter((body) => body.type === "warning" && toNumber(body.warningRadius, 0) > 0)) {
      const x = view.toScreenX(toNumber(body.x));
      const y = view.toScreenY(toNumber(body.y));
      const radius = Math.max(18, toNumber(body.warningRadius, 0) * view.state.scale);
      ctx.save();
      ctx.fillStyle = "rgba(247,201,72,.08)";
      ctx.strokeStyle = "rgba(247,201,72,.62)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const colors = {
      sun: "#ffd166",
      planet: "#d7f5ff",
      warpGate: "#6ee7f9",
      research: "#ffb454",
      shop: "#7cc7ff",
      "junk yard": "#c792ea",
      hangar: "#ff8fa3",
      cantina: "#a5d6a7",
      paintShop: "#ff74c7",
      warning: "#f7c948",
      hidden: "#8a9bad",
      boss: "#ff6b52"
    };
    const focusBodyKey = scene.focus?.kind === "body" ? scene.focus.key : "";

    const points = [];
    for (const body of scene.bodies || []) {
      const x = view.toScreenX(toNumber(body.x));
      const y = view.toScreenY(toNumber(body.y));
      const baseRadius = body.type === "sun"
        ? 13
        : body.station
          ? 10
          : body.type === "warning"
            ? 5
            : body.hidden
              ? 4
              : Math.max(5, Math.min(11, Math.sqrt(Math.max(1, toNumber(body.radius, 80))) / 2.8));
      const radius = clamp(baseRadius * Math.sqrt(view.state.scale), 4, 18);
      const fill = colors[body.type] || "#d7f5ff";

      ctx.save();
      ctx.fillStyle = fill;
      ctx.strokeStyle = body.station ? "#ffffff" : "rgba(255,255,255,.45)";
      ctx.lineWidth = body.station ? 1.7 : 1;
      ctx.shadowColor = fill;
      ctx.shadowBlur = body.station || body.type === "sun" ? 12 : 5;
      if (body.station) {
        ctx.beginPath();
        ctx.moveTo(x, y - radius);
        ctx.lineTo(x + radius, y);
        ctx.lineTo(x, y + radius);
        ctx.lineTo(x - radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      if (body.type === "boss") {
        ctx.strokeStyle = "#ff6b52";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8);
        ctx.lineTo(x + 8, y + 8);
        ctx.moveTo(x + 8, y - 8);
        ctx.lineTo(x - 8, y + 8);
        ctx.stroke();
      }
      if (focusBodyKey && body.key === focusBodyKey) {
        drawSystemFocusMarker(ctx, x, y, radius);
      }
      const label = bodyDisplayName(body);
      if (label && (body.key === focusBodyKey || body.station || body.type === "sun" || body.type === "boss" || view.state.scale > view.minScale() * 1.15)) {
        ctx.fillStyle = body.type === "boss" ? "#ffd6c9" : "#e6edf3";
        ctx.font = "12px system-ui";
        ctx.fillText(label, x + radius + 6, y + 4);
      }
      ctx.restore();

      points.push({
        x,
        y,
        hitRadius: radius + 8,
        data: { kind: "body", item: body, url: scene.routes?.Bodies?.[body.key] || "" },
        url: scene.routes?.Bodies?.[body.key] || ""
      });
    }

    for (const spawner of scene.spawners || []) {
      const x = view.toScreenX(toNumber(spawner.x));
      const y = view.toScreenY(toNumber(spawner.y));
      ctx.save();
      ctx.fillStyle = spawner.bossSpawner ? "#ff6b52" : "#c792ea";
      ctx.strokeStyle = spawner.hidden ? "#8a9bad" : "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.rect(x - 5, y - 5, 10, 10);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      points.push({
        x,
        y,
        hitRadius: 12,
        data: { kind: "spawner", item: spawner, url: scene.routes?.Spawners?.[spawner.key] || "" },
        url: scene.routes?.Spawners?.[spawner.key] || ""
      });
    }

    for (const boss of scene.bosses || []) {
      const x = view.toScreenX(toNumber(boss.x));
      const y = view.toScreenY(toNumber(boss.y));
      ctx.save();
      ctx.strokeStyle = "#ff6b52";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#ffd6c9";
      ctx.font = "12px system-ui";
      ctx.fillText(boss.name, x + 20, y + 4);
      ctx.restore();
      points.push({
        x,
        y,
        hitRadius: 18,
        data: { kind: "boss", item: boss, url: scene.routes?.Bosses?.[boss.key] || "" },
        url: scene.routes?.Bosses?.[boss.key] || ""
      });
    }

    return points;
  }

  window.initGalaxyMap = function initGalaxyMap(id, systems, warpPaths, routes) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const controls = document.querySelector(`[data-map-controls="${id}"]`);
    const search = controls?.querySelector('input[type="search"]');
    const galaxy = controls?.querySelector("select");
    const paths = controls?.querySelector('input[type="checkbox"]');
    const readout = document.getElementById(`${id}-readout`);
    const tooltip = document.getElementById(`${id}-tooltip`);
    const toolbar = [...(controls?.querySelectorAll("[data-map-action]") || [])];
    const background = MAP_BACKGROUND?.url ? MAP_BACKGROUND : null;
    const backgroundBounds = galaxyBackgroundBounds(systems, background);
    const bounds = galaxyBounds(systems, background);
    const scene = {
      systems,
      warpPaths,
      routes,
      background,
      backgroundBounds,
      bounds,
      stars: createStarfield(backgroundBounds, 180, 41)
    };
    const view = createWorldView(canvas, bounds, 6, backgroundBounds);
    const backgroundImage = backgroundImageFor(background);
    const interaction = setupInteractiveScene(canvas, view, {
      toolbar,
      readout,
      tooltip,
      idleText: "Hover a system to inspect level range, galaxy, coordinates, and connected systems.",
      draw(currentView) {
        return drawGalaxyScene(canvas.getContext("2d"), canvas, currentView, scene, { search, galaxy, paths }, backgroundImage);
      },
      describe(system) {
        const links = (system.links || []).slice(0, 5).map((link) => link.name).join(", ");
        const status = system.status ? ` / ${system.status}${system.access ? ` - ${system.access}` : ""}` : "";
        return `${system.name}${status} / ${system.galaxy || "Unknown galaxy"} / ${system.type || "regular"} / coords ${system.x}, ${system.y}${links ? ` / links: ${links}` : ""}`;
      },
      onClick(system) {
        if (scene.routes[system.key]) location.href = scene.routes[system.key];
      }
    });

    [search, galaxy, paths].forEach((control) => control?.addEventListener("input", interaction.redraw));
    [search, galaxy, paths].forEach((control) => control?.addEventListener("change", interaction.redraw));
    backgroundImage.onload = interaction.redraw;
    interaction.redraw();
  };

  window.initSystemMap = function initSystemMap(id, data) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const readout = document.getElementById(`${id}-readout`);
    const tooltip = document.getElementById(`${id}-tooltip`);
    const toolbar = [...(canvas.parentElement?.querySelectorAll("[data-map-action]") || [])];
    const background = data.background?.url ? data.background : (MAP_BACKGROUND?.url ? MAP_BACKGROUND : null);
    const backgroundBounds = systemBackgroundBounds(data);
    const bounds = systemBounds(data);
    const scene = {
      ...data,
      background,
      backgroundBounds,
      bounds,
      stars: createStarfield(backgroundBounds, 150, 97)
    };
    const view = createWorldView(canvas, bounds, 7, backgroundBounds);
    const focusBody = scene.focus?.kind === "body"
      ? scene.bodies?.find((body) => body.key === scene.focus.key)
      : null;
    if (focusBody) {
      const baseReset = view.reset;
      const focusScale = Math.max(view.minScale(), Math.min(7, view.minScale() * 1.45));
      view.reset = () => {
        baseReset();
        view.centerOn(toNumber(focusBody.x), toNumber(focusBody.y), focusScale);
      };
      view.reset();
    }
    const backgroundImage = backgroundImageFor(background);
    const interaction = setupInteractiveScene(canvas, view, {
      toolbar,
      readout,
      tooltip,
      idleText: focusBody
        ? `Focused marker shows ${bodyReadoutName(focusBody)}. Hover a marker to inspect location, spawner, boss, or elite-zone data.`
        : "Hover a marker to inspect location, spawner, boss, or elite-zone data.",
      draw(currentView) {
        return drawSystemScene(canvas.getContext("2d"), canvas, currentView, scene, backgroundImage);
      },
      describe(target) {
        if (target.kind === "spawner") {
          return `Spawner: ${target.item.name}\nBody: ${target.item.bodyName || "Hidden location"}\nEnemy: ${target.item.enemyName || "no enemy"}\nDrops: ${((target.item.drops || []).join(", ")) || "n/a"}`;
        }
        if (target.kind === "boss") {
          return `Boss: ${target.item.name}\nCoords: ${coordinateLabel(target.item.x)}, ${coordinateLabel(target.item.y)}`;
        }
        const focusNote = focusBody && target.item.key === focusBody.key ? "\nFocus: current station" : "";
        return `${bodyReadoutName(target.item)}\nType: ${target.item.type || "body"}\nLevel: ${target.item.level || "n/a"}\nCoords: ${coordinateLabel(target.item.x)}, ${coordinateLabel(target.item.y)}${target.item.parent ? `\nOrbiting: ${target.item.parent}` : ""}${focusNote}`;
      },
      onClick(target) {
        if (target.url) location.href = target.url;
      }
    });

    backgroundImage.onload = interaction.redraw;
    interaction.redraw();
  };
})();
