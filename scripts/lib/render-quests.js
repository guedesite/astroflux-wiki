import path from "node:path";

import { numberValue, percentLabel, rangeText, statCard, valueLabel } from "./display-utils.js";
import { entityLink, refKey } from "./entity-links.js";
import { escapeAttr, escapeHtml, slugify } from "./html-utils.js";
import { bodyDisplayName, bodyLocationInfo } from "./location-utils.js";
import { DIST_DIR } from "./project-paths.js";
import { titleFor } from "./record-utils.js";
import { cleanText } from "./text-utils.js";

function entryKey(entry) {
  return entry.id.split(":")[1];
}
export function questCategoryInfo(record = {}) {
  const majorType = String(record?.majorType || "").toLowerCase();
  if (majorType === "time") return { id: "timed", label: "Timed" };
  if (majorType === "pvpchain") return { id: "pvp", label: "PvP" };
  return { id: "story", label: "Story" };
}

function cleanQuestText(value) {
  return cleanText(value)
    .replace(/\u0008/g, "")
    .replace(/\[(\/?)h\]/gi, "")
    .replace(/\[player\]/gi, "player")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function questHasPlaceholders(value) {
  return /\[(amount|location\d+|player)\]/i.test(String(value || ""));
}

function renderQuestNarrative(value, fallback = "") {
  const text = cleanQuestText(value);
  if (!text) return fallback ? `<p class="muted">${escapeHtml(fallback)}</p>` : "";
  return text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part)}</p>`)
    .join("");
}

function missionStarterInfo(missionKey, cache) {
  const hit = Object.entries(cache.Bodies || {}).find(([, body]) => body.mission === missionKey);
  if (!hit) return null;
  const [bodyKey, body] = hit;
  return {
    bodyKey,
    bodyName: bodyDisplayName(bodyKey, body, cache),
    bodyType: body.type || "",
    systemKey: body.solarSystem,
    systemName: titleFor(cache.SolarSystems?.[body.solarSystem], body.solarSystem)
  };
}

function missionPreviousKey(missionKey, cache) {
  return Object.entries(cache.MissionTypes || {}).find(([, mission]) => mission.nextMission === missionKey)?.[0] || "";
}

function missionChainEntries(missionKey, cache) {
  let startKey = missionKey;
  const backSeen = new Set();
  while (startKey) {
    const prev = missionPreviousKey(startKey, cache);
    if (!prev || backSeen.has(prev)) break;
    backSeen.add(prev);
    startKey = prev;
  }
  const chain = [];
  let current = startKey;
  const forwardSeen = new Set();
  while (current && cache.MissionTypes?.[current] && !forwardSeen.has(current)) {
    forwardSeen.add(current);
    chain.push(current);
    current = cache.MissionTypes[current].nextMission;
  }
  return chain;
}

function missionChainStartKey(missionKey, cache) {
  return missionChainEntries(missionKey, cache)[0] || missionKey;
}

function missionChainTitle(startKey, cache) {
  const chain = missionChainEntries(startKey, cache);
  const preferredKey = chain.find((key) => {
    const name = titleFor(cache.MissionTypes?.[key], key);
    return name && name !== key;
  }) || startKey;
  const preferredName = titleFor(cache.MissionTypes?.[preferredKey], preferredKey);
  if (preferredName && preferredName !== preferredKey) {
    const normalized = preferredName
      .replace(/\s*[:\-]\s*part\s*1$/i, "")
      .replace(/\s*\(\s*part\s*1\s*\)$/i, "")
      .trim();
    return normalized || preferredName;
  }
  const starter = missionStarterInfo(startKey, cache);
  if (starter?.bodyName) return `${starter.bodyName} story chain`;
  return `Story chain ${startKey.slice(0, 8)}`;
}

function missionChainSlug(startKey, cache) {
  return slugify(`${missionChainTitle(startKey, cache)}-${startKey}`);
}

function missionChainUrl(startKey, cache) {
  return `/quests/story/${missionChainSlug(startKey, cache)}.html`;
}

export function storyMissionChains(entries, cache) {
  const storyEntries = entries.filter((entry) => questCategoryInfo(cache.MissionTypes?.[entryKey(entry)]).id === "story");
  const chains = [...new Map(storyEntries.map((entry) => {
    const key = entryKey(entry);
    const startKey = missionChainStartKey(key, cache);
    const chain = missionChainEntries(startKey, cache);
    const firstRecord = cache.MissionTypes?.[startKey];
    return [startKey, {
      startKey,
      chain,
      title: missionChainTitle(startKey, cache),
      slug: missionChainSlug(startKey, cache),
      url: missionChainUrl(startKey, cache),
      record: firstRecord
    }];
  })).values()];
  return chains.sort((a, b) => a.title.localeCompare(b.title, "en", { numeric: true }));
}

function missionCountValue(record) {
  for (const field of ["value", "targetLvlReq", "reqLvl"]) {
    if (record?.[field] !== undefined && record[field] !== null && record[field] !== "") return record[field];
  }
  return "";
}

function missionLevelRange(record) {
  const min = numberValue(record?.minLvl, 0);
  const max = numberValue(record?.maxLvl, 0);
  if (min > 0 && max <= 0) return valueLabel(min);
  if (min <= 0 && max > 0) return valueLabel(max);
  if (min === 0 && max === 0) return "0";
  return rangeText(record?.minLvl, record?.maxLvl);
}

function missionItemInfo(record, cache) {
  const key = refKey("Commodities", record?.item);
  return key ? { key, name: titleFor(cache.Commodities?.[key], key) } : null;
}

function missionEnemyTargets(record, cache) {
  const entries = [];
  if (record?.enemy) {
    const key = refKey("Enemies", record.enemy);
    if (key) entries.push({ table: "Enemies", key, name: titleFor(cache.Enemies?.[key], key) });
  }
  if (record?.boss) {
    const key = refKey("Bosses", record.boss);
    if (key) entries.push({ table: "Bosses", key, name: titleFor(cache.Bosses?.[key], key) });
  }
  for (const key of record?.addedEnemies || []) {
    if (!key) continue;
    if (cache.Bosses?.[key]) {
      entries.push({ table: "Bosses", key, name: titleFor(cache.Bosses?.[key], key) });
    } else if (cache.Enemies?.[key]) {
      entries.push({ table: "Enemies", key, name: titleFor(cache.Enemies?.[key], key) });
    }
  }
  return [...new Map(entries.map((item) => [`${item.table}:${item.key}`, item])).values()];
}

function missionBodyTargets(record, cache) {
  const bodyKeys = [refKey("Bodies", record?.body), ...(record?.addedBodies || []).map((item) => refKey("Bodies", item))].filter(Boolean);
  return [...new Map(bodyKeys.map((bodyKey) => {
    const body = cache.Bodies?.[bodyKey];
    const location = bodyLocationInfo(bodyKey, cache);
    return [bodyKey, {
      bodyKey,
      bodyName: bodyDisplayName(bodyKey, body, cache),
      bodyType: body?.type || "",
      systemKey: location?.systemKey || body?.solarSystem || "",
      systemName: location?.systemName || titleFor(cache.SolarSystems?.[body?.solarSystem], body?.solarSystem)
    }];
  })).values()];
}

function missionSystemTargets(record, cache) {
  const systemKeys = [record?.solarsystem, record?.solarSystem, ...(record?.addedSystems || [])].filter(Boolean);
  for (const body of missionBodyTargets(record, cache)) {
    if (body.systemKey) systemKeys.push(body.systemKey);
  }
  return [...new Map(systemKeys.map((systemKey) => [systemKey, {
    systemKey,
    systemName: titleFor(cache.SolarSystems?.[systemKey], systemKey)
  }])).values()];
}

function missionObjectiveSummaryHtml(record, cache, routes) {
  const amount = missionCountValue(record);
  const item = missionItemInfo(record, cache);
  const enemies = missionEnemyTargets(record, cache);
  const bodies = missionBodyTargets(record, cache);
  const systems = missionSystemTargets(record, cache);
  const enemyLinks = enemies.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ");
  const bodyLinks = bodies.map((body) => entityLink("Bodies", body.bodyKey, cache, routes, body.bodyName)).join(", ");
  const systemLinks = systems.map((system) => entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)).join(", ");
  switch (record.type) {
    case "kill":
      return `${amount ? `Defeat ${escapeHtml(valueLabel(amount))}` : "Defeat"} ${enemyLinks || (record.subtype === "player" ? "another player" : record.subtype === "boss" ? "the boss target" : record.subtype === "spawner" ? "the required spawners" : "the quest targets")}${systemLinks ? ` in ${systemLinks}` : ""}`;
    case "pickup":
      return `${amount ? `Collect ${escapeHtml(valueLabel(amount))}` : "Collect"} ${item ? entityLink("Commodities", item.key, cache, routes, item.name) : "the required item"}`;
    case "recycle":
      return `${amount ? `Recycle ${escapeHtml(valueLabel(amount))}` : "Recycle"} ${item ? entityLink("Commodities", item.key, cache, routes, item.name) : "the required material"}`;
    case "transport":
      return bodyLinks ? `Travel / deliver to ${bodyLinks}` : systemLinks ? `Travel to ${systemLinks}` : "Travel to the linked story location";
    case "level":
      return `Reach level ${escapeHtml(valueLabel(amount || record.minLvl || record.maxLvl || record.reqLvl || ""))}`;
    case "explore":
      return bodyLinks || systemLinks || "Explore the target area";
    default:
      return escapeHtml(valueLabel(record.type || "Quest objective"));
  }
}

function missionRewardArticle(record, cache, routes) {
  const dropKey = refKey("Drops", record.drop);
  const drop = cache.Drops?.[dropKey];
  if (!dropKey || !drop) return `<article><h2>Rewards</h2><p class="muted">No mission reward table was resolved from the downloaded client cache.</p></article>`;
  const rows = (drop.dropItems || []).slice(0, 12).map((item) => `<tr><td>${entityLink(item.table, item.item, cache, routes)}</td><td>${escapeHtml(percentLabel(item.chance))}</td><td>${escapeHtml(rangeText(item.min, item.max))}</td></tr>`).join("");
  return `<article><h2>Rewards</h2><div class="stat-grid">${statCard("Reward table", drop.name || dropKey)}${statCard("XP", rangeText(drop.xpMin, drop.xpMax))}${statCard("Flux", rangeText(drop.fluxMin, drop.fluxMax))}${statCard("Items", (drop.dropItems || []).length)}</div><p>Resolved from ${entityLink("Drops", dropKey, cache, routes)}.</p>${rows ? `<div class="table-wrap"><table><thead><tr><th>Reward</th><th>Chance</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table></div>` : ""}</article>`;
}

function missionSolutionSteps(key, record, cache, routes) {
  const steps = [];
  const starter = missionStarterInfo(key, cache);
  const item = missionItemInfo(record, cache);
  const enemies = missionEnemyTargets(record, cache);
  const bodies = missionBodyTargets(record, cache);
  const systems = missionSystemTargets(record, cache);
  const amount = missionCountValue(record);
  if (starter) steps.push(`Start at ${entityLink("Bodies", starter.bodyKey, cache, routes, starter.bodyName)} in ${entityLink("SolarSystems", starter.systemKey, cache, routes, starter.systemName)}.`);
  if (bodies.length) {
    steps.push(`Travel to ${bodies.map((body) => entityLink("Bodies", body.bodyKey, cache, routes, body.bodyName)).join(", ")}.`);
  } else if (systems.length) {
    steps.push(`Go to ${systems.map((system) => entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)).join(", ")}.`);
  }
  switch (record.type) {
    case "kill":
      steps.push(`${amount ? `Defeat ${escapeHtml(valueLabel(amount))}` : "Defeat"} ${enemies.length ? enemies.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ") : record.subtype === "player" ? "another player" : record.subtype === "boss" ? "the boss target" : record.subtype === "spawner" ? "the required spawners" : "the required hostiles"}.`);
      break;
    case "pickup":
      steps.push(`${amount ? `Collect ${escapeHtml(valueLabel(amount))}` : "Collect"} ${item ? entityLink("Commodities", item.key, cache, routes, item.name) : "the required item"}.`);
      break;
    case "recycle":
      steps.push(`${amount ? `Collect ${escapeHtml(valueLabel(amount))}` : "Collect"} ${item ? entityLink("Commodities", item.key, cache, routes, item.name) : "the required material"} and recycle it at the requested station.`);
      break;
    case "transport":
      steps.push(bodies.length ? "Land or interact at the target location(s) to advance the quest." : "Follow the travel objective described in the quest text.");
      break;
    case "level":
      steps.push(`Reach level ${escapeHtml(valueLabel(amount || record.minLvl || record.maxLvl || record.reqLvl || ""))}.`);
      break;
    default:
      if (item) steps.push(`Use ${entityLink("Commodities", item.key, cache, routes, item.name)} as the structured quest target.`);
      break;
  }
  if (record.nextMission) steps.push(`Turn in the quest to unlock ${entityLink("MissionTypes", record.nextMission, cache, routes)}.`);
  if (questHasPlaceholders(record.description) || questHasPlaceholders(record.completeDescription)) {
    steps.push("Some exact counts or destination names still come from placeholder text in the client cache, so the narrative text remains important.");
  }
  return steps.length ? `<article><h2>Detected Solution Path</h2><p class="muted">This path is reconstructed from structured quest fields, linked locations, targets, and the mission text.</p><ol class="steps">${steps.map((step) => `<li>${step}</li>`).join("")}</ol></article>` : "";
}

export function dailyMissionCatalog(cache) {
  return Object.entries(cache.DailyMissions || {})
    .map(([key, record]) => {
      const slug = slugify(`${record.name || key}-${key}`);
      return { key, name: record.name || key, record, slug: `quests/daily/${slug}`, url: `/quests/daily/${slug}.html` };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function dailyMissionRewards(record, cache) {
  return (record.reward || []).map((rewardKey) => {
    const reward = cache.DailyMissionRewards?.[rewardKey];
    const low = Math.min(numberValue(reward?.k1, 0), numberValue(reward?.k2, numberValue(reward?.k1, 0)));
    const high = Math.max(numberValue(reward?.k1, 0), numberValue(reward?.k2, numberValue(reward?.k1, 0)));
    return {
      key: rewardKey,
      reward,
      itemKey: reward?.itemKey || "",
      itemName: reward?.itemKey ? titleFor(cache.Commodities?.[reward.itemKey], reward.itemKey) : "",
      amount: reward ? rangeText(low || reward.k1 || "", high || reward.k2 || reward.k1 || "") : ""
    };
  });
}

export function renderMissionPage(key, record, cache, routes) {
  const category = questCategoryInfo(record);
  const starter = missionStarterInfo(key, cache);
  const systems = missionSystemTargets(record, cache);
  const bodies = missionBodyTargets(record, cache);
  const enemies = missionEnemyTargets(record, cache);
  const item = missionItemInfo(record, cache);
  const amount = missionCountValue(record);
  const previousKey = missionPreviousKey(key, cache);
  const chain = missionChainEntries(key, cache);
  const chainStartKey = chain[0] || key;
  const chainUrl = missionChainUrl(chainStartKey, cache);
  const chainRows = chain.map((missionKey, index) => {
    const mission = cache.MissionTypes?.[missionKey];
    return `<tr><td>${index + 1}</td><td>${missionKey === key ? `<strong>${entityLink("MissionTypes", missionKey, cache, routes)}</strong>` : entityLink("MissionTypes", missionKey, cache, routes)}</td><td>${escapeHtml(questCategoryInfo(mission).label)}</td><td>${escapeHtml(valueLabel(mission?.type))}</td></tr>`;
  }).join("");
  return `<section class="content-grid">
    <article><h2>Quest Overview</h2><div class="stat-grid">${statCard("Category", category.label)}${statCard("Type", record.type)}${statCard("Subtype", record.subtype || "n/a")}${statCard("Level range", missionLevelRange(record))}${statCard("Target value", amount || "n/a")}${statCard("Expires", record.expires || "n/a")}${statCard("In order", record.mustBeInorder)}${statCard("Starter", starter?.bodyName || "No explicit starter body")}</div><p>${missionObjectiveSummaryHtml(record, cache, routes)}</p></article>
    <article><h2>Start Here</h2><ul class="link-list">${starter ? `<li>Start location: ${entityLink("Bodies", starter.bodyKey, cache, routes, starter.bodyName)}</li><li>System: ${entityLink("SolarSystems", starter.systemKey, cache, routes, starter.systemName)}</li><li>Location type: ${escapeHtml(valueLabel(starter.bodyType))}</li>` : "<li>No explicit starter body was linked in <code>Bodies.mission</code>; this quest may start automatically, from another quest, or from a hidden trigger.</li>"}</ul></article>
    <article><h2>Where To Go</h2><ul class="link-list">${systems.length ? systems.map((system) => `<li>System: ${entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)}</li>`).join("") : "<li>No fixed system was resolved from the structured fields.</li>"}${bodies.length ? bodies.map((body) => `<li>Location: ${entityLink("Bodies", body.bodyKey, cache, routes, body.bodyName)}${body.systemKey ? ` <span class="muted">in ${entityLink("SolarSystems", body.systemKey, cache, routes, body.systemName)}</span>` : ""}</li>`).join("") : ""}</ul></article>
    <article><h2>What To Kill / Collect</h2><ul class="link-list">${enemies.length ? `<li>Targets: ${enemies.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ")}</li>` : ""}${item ? `<li>Item: ${entityLink("Commodities", item.key, cache, routes, item.name)}</li>` : ""}${!enemies.length && !item ? "<li>No explicit enemy or item target was exposed in the structured fields.</li>" : ""}</ul></article>
    ${missionRewardArticle(record, cache, routes)}
    ${chainRows ? `<article><h2>Quest Chain</h2><div class="stat-grid">${statCard("Previous", previousKey ? titleFor(cache.MissionTypes?.[previousKey], previousKey) : "Start of chain")}${statCard("Next", record.nextMission ? titleFor(cache.MissionTypes?.[record.nextMission], record.nextMission) : "End of chain")}${statCard("Chain size", chain.length || 1)}${statCard("Current step", chain.includes(key) ? `${chain.indexOf(key) + 1}/${chain.length}` : "n/a")}</div>${category.id === "story" ? `<p><a class="button-link" href="${escapeAttr(chainUrl)}">Open grouped chain page</a></p>` : ""}<div class="table-wrap"><table><thead><tr><th>Step</th><th>Quest</th><th>Category</th><th>Type</th></tr></thead><tbody>${chainRows}</tbody></table></div></article>` : ""}
    ${missionSolutionSteps(key, record, cache, routes)}
    <article><h2>Quest Text</h2><h3>Description</h3>${renderQuestNarrative(record.description, "No description was exposed for this quest.")}<h3>Completion</h3>${renderQuestNarrative(record.completeDescription, "No completion text was exposed for this quest.")}${questHasPlaceholders(record.description) || questHasPlaceholders(record.completeDescription) ? `<p class="muted">This quest still contains placeholder markers in the client cache, so some counts or location names may only be partially resolved automatically.</p>` : ""}</article>
  </section>`;
}

function renderDailyMissionPage(item, cache, media, routes, { renderImageCard } = {}) {
  const record = item.record;
  const image = cache.Images?.[record.bitmap];
  const targets = record.targets || {};
  const systemKey = targets.solarsystem || "";
  const planetKey = targets.planet || "";
  const enemyTargets = (targets.enemies || []).map((key) => cache.Bosses?.[key]
    ? { table: "Bosses", key }
    : { table: "Enemies", key });
  const rewards = dailyMissionRewards(record, cache);
  const rewardRows = rewards.map((reward) => `<tr><td>${reward.itemKey ? entityLink("Commodities", reward.itemKey, cache, routes, reward.itemName) : escapeHtml(reward.key.toUpperCase())}</td><td>${escapeHtml(reward.amount || reward.key)}</td></tr>`).join("");
  const objective = record.type === "kill"
    ? `Defeat ${escapeHtml(valueLabel(targets.count || 1))} ${enemyTargets.length ? enemyTargets.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ") : targets.any ? "enemies of any kind" : "enemies"}${systemKey ? ` in ${entityLink("SolarSystems", systemKey, cache, routes)}` : ""}.`
    : record.type === "pickup"
      ? `Collect ${escapeHtml(valueLabel(targets.count || 1))} ${targets.type ? entityLink("Commodities", targets.type, cache, routes) : "target items"}.`
      : record.type === "land_on_planet"
        ? `Land on ${entityLink("Bodies", planetKey, cache, routes)}.`
        : record.type === "upgrade_tech"
          ? "Upgrade one ship tech in your fleet."
          : escapeHtml(cleanQuestText(record.description));
  const steps = [
    systemKey ? `Travel to ${entityLink("SolarSystems", systemKey, cache, routes)}.` : "",
    planetKey ? `Land on ${entityLink("Bodies", planetKey, cache, routes)}.` : "",
    record.type === "kill" ? `Complete ${escapeHtml(valueLabel(targets.count || 1))} kill(s)${enemyTargets.length ? ` against ${enemyTargets.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ")}` : targets.any ? " against any enemy" : ""}.` : "",
    record.type === "pickup" ? `Collect ${escapeHtml(valueLabel(targets.count || 1))} ${targets.type ? entityLink("Commodities", targets.type, cache, routes) : "target items"}.` : "",
    record.type === "upgrade_tech" ? "Open the ship tech screen and upgrade any ship tech once." : "",
    "Claim the daily reward after the objective completes."
  ].filter(Boolean);
  const visual = image ? `<div class="hero-visual">${renderImageCard(image, record.bitmap, media, true)}</div>` : "";
  return `<section class="entity-hero">${visual}<div class="hero-main"><p class="eyebrow">Daily quest</p><h1>${escapeHtml(item.name)}</h1><span class="pill">Daily</span></div><div class="hero-facts"><div class="stat-grid compact">${statCard("Level", record.level)}${statCard("Type", record.type)}${statCard("Target count", targets.count || 1)}${statCard("Rewards", rewards.length)}</div></div></section>
<section class="content-grid">
  <article><h2>Objective</h2><div class="stat-grid">${statCard("Level", record.level)}${statCard("Type", record.type)}${statCard("System", systemKey ? titleFor(cache.SolarSystems?.[systemKey], systemKey) : "n/a")}${statCard("Planet", planetKey ? titleFor(cache.Bodies?.[planetKey], planetKey) : "n/a")}${statCard("Count", targets.count || 1)}</div><p>${objective}</p>${renderQuestNarrative(record.description)}</article>
  <article><h2>Targets</h2><ul class="link-list">${systemKey ? `<li>System: ${entityLink("SolarSystems", systemKey, cache, routes)}</li>` : ""}${planetKey ? `<li>Planet: ${entityLink("Bodies", planetKey, cache, routes)}</li>` : ""}${enemyTargets.length ? `<li>Enemies / bosses: ${enemyTargets.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ")}</li>` : ""}${targets.type ? `<li>Item: ${entityLink("Commodities", targets.type, cache, routes)}</li>` : ""}${targets.any ? "<li>Any matching target is valid.</li>" : ""}</ul></article>
  <article><h2>Rewards</h2>${rewardRows ? `<div class="table-wrap"><table><thead><tr><th>Reward</th><th>Amount / roll</th></tr></thead><tbody>${rewardRows}</tbody></table></div>` : `<p class="muted">No resolved reward rows were found for this daily quest.</p>`}</article>
  <article><h2>Detected Solution Path</h2><ol class="steps">${steps.map((step) => `<li>${step}</li>`).join("")}</ol></article>
</section>`;
}

function renderStoryQuestRows(entries, cache, routes) {
  return storyMissionChains(entries, cache).map((item) => {
    const starter = missionStarterInfo(item.startKey, cache);
    const systems = [...new Map(item.chain.flatMap((missionKey) => missionSystemTargets(cache.MissionTypes?.[missionKey], cache))
      .map((system) => [system.systemKey, system])).values()];
    const rewards = [...new Map(item.chain.map((missionKey) => {
      const record = cache.MissionTypes?.[missionKey];
      return record?.drop ? [record.drop, cache.Drops?.[record.drop]] : null;
    }).filter(Boolean)).entries()];
    const objective = missionObjectiveSummaryHtml(cache.MissionTypes?.[item.startKey], cache, routes);
    return `<tr data-search="${escapeAttr(`${item.title} story chain ${starter?.bodyName || ""} ${systems.map((system) => system.systemName).join(" ")}`)}" data-steps="${escapeAttr(String(item.chain.length))}"><td><a href="${escapeAttr(item.url)}">${escapeHtml(item.title)}</a></td><td>${item.chain.length}</td><td>${starter ? `${entityLink("Bodies", starter.bodyKey, cache, routes, starter.bodyName)}<div class="muted">${entityLink("SolarSystems", starter.systemKey, cache, routes, starter.systemName)}</div>` : `<span class="muted">No explicit starter body</span>`}</td><td>${systems.length ? systems.map((system) => entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)).join(", ") : `<span class="muted">No fixed system</span>`}</td><td>${objective}</td><td>${rewards.length ? rewards.map(([dropKey, drop]) => entityLink("Drops", dropKey, cache, routes, drop?.name || dropKey)).join(", ") : `<span class="muted">No reward table</span>`}</td></tr>`;
  }).join("");
}

function renderStoryQuestChainPage(item, cache, routes) {
  const starter = missionStarterInfo(item.startKey, cache);
  const systems = [...new Map(item.chain.flatMap((missionKey) => missionSystemTargets(cache.MissionTypes?.[missionKey], cache))
    .map((system) => [system.systemKey, system])).values()];
  const bodies = [...new Map(item.chain.flatMap((missionKey) => missionBodyTargets(cache.MissionTypes?.[missionKey], cache))
    .map((body) => [body.bodyKey, body])).values()];
  const enemies = [...new Map(item.chain.flatMap((missionKey) => missionEnemyTargets(cache.MissionTypes?.[missionKey], cache))
    .map((enemy) => [`${enemy.table}:${enemy.key}`, enemy])).values()];
  const itemTargets = [...new Map(item.chain.map((missionKey) => {
    const target = missionItemInfo(cache.MissionTypes?.[missionKey], cache);
    return target ? [target.key, target] : null;
  }).filter(Boolean)).values()];
  const rewardDrops = [...new Map(item.chain.map((missionKey) => {
    const record = cache.MissionTypes?.[missionKey];
    return record?.drop ? [record.drop, cache.Drops?.[record.drop]] : null;
  }).filter(Boolean)).entries()];
  const stepRows = item.chain.map((missionKey, index) => {
    const mission = cache.MissionTypes?.[missionKey];
    return `<tr><td>${index + 1}</td><td>${entityLink("MissionTypes", missionKey, cache, routes)}</td><td>${escapeHtml(valueLabel(mission?.type))}</td><td>${missionObjectiveSummaryHtml(mission, cache, routes)}</td><td>${mission?.drop ? entityLink("Drops", mission.drop, cache, routes, cache.Drops?.[mission.drop]?.name || mission.drop) : `<span class="muted">No reward table</span>`}</td></tr>`;
  }).join("");
  const stepSections = item.chain.map((missionKey, index) => {
    const mission = cache.MissionTypes?.[missionKey];
    const category = questCategoryInfo(mission);
    return `<article><h2>Part ${index + 1}: ${entityLink("MissionTypes", missionKey, cache, routes)}</h2><div class="stat-grid">${statCard("Category", category.label)}${statCard("Type", mission?.type || "n/a")}${statCard("Subtype", mission?.subtype || "n/a")}${statCard("Level range", missionLevelRange(mission))}${statCard("Reward", mission?.drop ? titleFor(cache.Drops?.[mission.drop], mission.drop) : "No reward table")}</div><p>${missionObjectiveSummaryHtml(mission, cache, routes)}</p>${missionSolutionSteps(missionKey, mission, cache, routes)}<h3>Description</h3>${renderQuestNarrative(mission?.description, "No description was exposed for this quest.")}<h3>Completion</h3>${renderQuestNarrative(mission?.completeDescription, "No completion text was exposed for this quest.")}</article>`;
  }).join("");
  return `<section class="entity-hero"><div class="hero-main"><p class="eyebrow">Story quest chain</p><h1>${escapeHtml(item.title)}</h1><span class="pill">${escapeHtml(valueLabel(item.chain.length))} parts</span></div><div class="hero-facts"><div class="stat-grid compact">${statCard("Starter", starter?.bodyName || "No explicit starter body")}${statCard("Systems", systems.length || "n/a")}${statCard("Targets", enemies.length + itemTargets.length || "n/a")}${statCard("Rewards", rewardDrops.length || "n/a")}</div></div></section>
<section class="content-grid">
  <article><h2>Chain Overview</h2><div class="stat-grid">${statCard("Start", starter ? starter.bodyName : "No explicit starter body")}${statCard("System", starter?.systemName || "n/a")}${statCard("Parts", item.chain.length)}${statCard("First quest", titleFor(cache.MissionTypes?.[item.startKey], item.startKey))}</div><p>${missionObjectiveSummaryHtml(cache.MissionTypes?.[item.startKey], cache, routes)}</p></article>
  <article><h2>Route & Targets</h2><ul class="link-list">${systems.length ? systems.map((system) => `<li>System: ${entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)}</li>`).join("") : "<li>No fixed system was resolved from the structured fields.</li>"}${bodies.length ? bodies.map((body) => `<li>Location: ${entityLink("Bodies", body.bodyKey, cache, routes, body.bodyName)}${body.systemKey ? ` <span class="muted">in ${entityLink("SolarSystems", body.systemKey, cache, routes, body.systemName)}</span>` : ""}</li>`).join("") : ""}${enemies.length ? `<li>Targets: ${enemies.map((enemy) => entityLink(enemy.table, enemy.key, cache, routes)).join(", ")}</li>` : ""}${itemTargets.length ? `<li>Items: ${itemTargets.map((target) => entityLink("Commodities", target.key, cache, routes, target.name)).join(", ")}</li>` : ""}</ul></article>
  <article><h2>Reward Tables Across The Chain</h2>${rewardDrops.length ? `<div class="table-wrap"><table><thead><tr><th>Reward table</th><th>XP</th><th>Flux</th><th>Source step</th></tr></thead><tbody>${rewardDrops.map(([dropKey, drop]) => {
    const firstIndex = item.chain.findIndex((missionKey) => cache.MissionTypes?.[missionKey]?.drop === dropKey);
    return `<tr><td>${entityLink("Drops", dropKey, cache, routes, drop?.name || dropKey)}</td><td>${escapeHtml(rangeText(drop?.xpMin, drop?.xpMax))}</td><td>${escapeHtml(rangeText(drop?.fluxMin, drop?.fluxMax))}</td><td>${firstIndex >= 0 ? `Part ${firstIndex + 1}` : `<span class="muted">n/a</span>`}</td></tr>`;
  }).join("")}</tbody></table></div>` : `<p class="muted">No structured reward tables were linked anywhere in this story chain.</p>`}</article>
  <article><h2>All Parts</h2><div class="table-wrap"><table><thead><tr><th>Step</th><th>Quest</th><th>Type</th><th>Objective</th><th>Reward</th></tr></thead><tbody>${stepRows}</tbody></table></div></article>
  ${stepSections}
</section>`;
}

function renderQuestRows(entries, cache, routes, predicate) {
  return entries
    .filter((entry) => predicate(cache.MissionTypes?.[entryKey(entry)], entry))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const key = entryKey(entry);
      const record = cache.MissionTypes?.[key];
      if (!record) return "";
      const category = questCategoryInfo(record);
      const starter = missionStarterInfo(key, cache);
      const systems = missionSystemTargets(record, cache);
      const rewards = cache.Drops?.[record.drop];
      const chain = missionChainEntries(key, cache);
      const index = chain.indexOf(key);
      const chainText = chain.length > 1 ? `Part ${index + 1} / ${chain.length}` : "Standalone";
      return `<tr data-search="${escapeAttr(`${entry.name} ${category.label} ${record.type || ""} ${record.subtype || ""} ${starter?.bodyName || ""} ${systems.map((system) => system.systemName).join(" ")}`)}" data-kind="${escapeAttr(record.type || "")}"><td><a href="/${entry.slug}.html">${escapeHtml(entry.name)}</a></td><td>${escapeHtml(category.label)}</td><td>${escapeHtml(valueLabel(record.type))}</td><td>${starter ? `${entityLink("Bodies", starter.bodyKey, cache, routes, starter.bodyName)}<div class="muted">${entityLink("SolarSystems", starter.systemKey, cache, routes, starter.systemName)}</div>` : `<span class="muted">No explicit starter body</span>`}</td><td>${systems.length ? systems.map((system) => entityLink("SolarSystems", system.systemKey, cache, routes, system.systemName)).join(", ") : `<span class="muted">No fixed system</span>`}</td><td>${missionObjectiveSummaryHtml(record, cache, routes)}</td><td>${rewards ? entityLink("Drops", record.drop, cache, routes, rewards.name || record.drop) : `<span class="muted">No reward table</span>`}</td><td>${escapeHtml(chainText)}</td></tr>`;
    })
    .join("");
}

function renderDailyQuestRows(cache, routes) {
  return dailyMissionCatalog(cache).map((item) => {
    const record = item.record;
    const rewards = dailyMissionRewards(record, cache);
    const targetText = record.targets?.enemies?.length
      ? record.targets.enemies.map((key) => cache.Bosses?.[key] ? entityLink("Bosses", key, cache, routes) : entityLink("Enemies", key, cache, routes)).join(", ")
      : record.targets?.type
        ? entityLink("Commodities", record.targets.type, cache, routes)
        : record.targets?.planet
          ? entityLink("Bodies", record.targets.planet, cache, routes)
          : record.targets?.solarsystem
            ? entityLink("SolarSystems", record.targets.solarsystem, cache, routes)
            : "<span class=\"muted\">General objective</span>";
    return `<tr data-search="${escapeAttr(`${item.name} daily ${record.type || ""} ${record.description || ""}`)}" data-kind="${escapeAttr(record.type || "")}"><td><a href="${escapeAttr(item.url)}">${escapeHtml(item.name)}</a></td><td>${escapeHtml(valueLabel(record.level))}</td><td>${escapeHtml(valueLabel(record.type))}</td><td>${record.targets?.solarsystem ? entityLink("SolarSystems", record.targets.solarsystem, cache, routes) : record.targets?.planet ? entityLink("Bodies", record.targets.planet, cache, routes) : `<span class="muted">Any</span>`}</td><td>${targetText}</td><td>${rewards.map((reward) => reward.itemKey ? entityLink("Commodities", reward.itemKey, cache, routes, reward.itemName) : escapeHtml(reward.key.toUpperCase())).join(", ")}</td></tr>`;
  }).join("");
}

function renderQuestCategoryPage(title, description, tableId, rows) {
  return `<h1>${escapeHtml(title)}</h1><p class="muted">${escapeHtml(description)}</p><div class="filter-panel" data-table-filter="${escapeAttr(tableId)}"><input id="${escapeAttr(tableId)}-filter-text" name="${escapeAttr(tableId)}-filter-text" data-filter-text type="search" placeholder="Search quest, type, target, system"></div><div class="table-wrap"><table id="${escapeAttr(tableId)}" class="sortable filterable"><thead><tr><th>Quest</th><th>Category</th><th>Type</th><th>Start</th><th>System</th><th>Objective</th><th>Reward</th><th>Chain</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderStoryQuestCategoryPage(rows) {
  return `<h1>Story Quests</h1><p class="muted">Story quests are grouped by their main chain title here. Open a chain page to read every part in order, with the linked systems, targets, rewards, and mission text on one page.</p><div class="filter-panel" data-table-filter="story-quests-table"><input id="story-quests-filter-text" name="story-quests-filter-text" data-filter-text type="search" placeholder="Search story chain, starter, system"></div><div class="table-wrap"><table id="story-quests-table" class="sortable filterable"><thead><tr><th>Story chain</th><th>Parts</th><th>Start</th><th>Systems</th><th>Opening objective</th><th>Rewards</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderDailyCategoryPage(cache, routes) {
  return `<h1>Daily Quests</h1><p class="muted">Daily quests use a cleaner data structure than story missions, so the targets and rewards can be resolved much more directly.</p><div class="filter-panel" data-table-filter="daily-quests-table"><input id="daily-quests-filter-text" name="daily-quests-filter-text" data-filter-text type="search" placeholder="Search daily, target, system"><select id="daily-quests-filter-kind" name="daily-quests-filter-kind" data-filter-attr="kind"><option value="">All daily types</option><option value="kill">Kill</option><option value="pickup">Pickup</option><option value="land_on_planet">Land on planet</option><option value="upgrade_tech">Upgrade tech</option></select></div><div class="table-wrap"><table id="daily-quests-table" class="sortable filterable"><thead><tr><th>Quest</th><th>Level</th><th>Type</th><th>Place</th><th>Target</th><th>Rewards</th></tr></thead><tbody>${renderDailyQuestRows(cache, routes)}</tbody></table></div>`;
}

export function buildQuestPages(manifest, cache, media, routes, { writePage, renderImageCard } = {}) {
  const missionEntries = manifest.MissionTypes || [];
  const storyChains = storyMissionChains(missionEntries, cache);
  const storyRows = renderStoryQuestRows(missionEntries, cache, routes);
  const timedRows = renderQuestRows(missionEntries, cache, routes, (record) => questCategoryInfo(record).id === "timed");
  const pvpRows = renderQuestRows(missionEntries, cache, routes, (record) => questCategoryInfo(record).id === "pvp");
  const cards = [
    ["Story", "/quests/story/", storyChains.length, "Main story chains grouped by their root quest."],
    ["Timed", "/quests/timed/", missionEntries.filter((entry) => questCategoryInfo(cache.MissionTypes?.[entryKey(entry)]).id === "timed").length, "Timed missions with rotating objectives and placeholder-heavy text."],
    ["Daily", "/quests/daily/", Object.keys(cache.DailyMissions || {}).length, "Structured daily missions with resolved targets and rewards."],
    ["PvP", "/quests/pvp/", missionEntries.filter((entry) => questCategoryInfo(cache.MissionTypes?.[entryKey(entry)]).id === "pvp").length, "PvP chains and progression quests."]
  ].map(([label, href, count, desc]) => `<a class="card" href="${escapeAttr(href)}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(valueLabel(count))} quests</span><span>${escapeHtml(desc)}</span></a>`).join("");
  writePage(path.join(DIST_DIR, "quests", "index.html"), "Quests", `<h1>Quests</h1><p class="muted">This hub groups story quests, timed quests, daily missions, and PvP chains. Story and timed pages reuse the enriched mission detail pages, while daily quests get dedicated pages under <code>/quests/daily/</code>.</p><section class="cards">${cards}</section><section class="notice"><strong>Tip:</strong> use the category pages to filter by objective, then open a quest detail page for the full chain, reward table, and detected solution path.</section>`);
  writePage(path.join(DIST_DIR, "quests", "story", "index.html"), "Story Quests", renderStoryQuestCategoryPage(storyRows));
  writePage(path.join(DIST_DIR, "quests", "timed", "index.html"), "Timed Quests", renderQuestCategoryPage("Timed Quests", "Timed missions often rely on placeholder-heavy text, so the guide keeps both structured targets and the raw narrative hints.", "timed-quests-table", timedRows));
  writePage(path.join(DIST_DIR, "quests", "pvp", "index.html"), "PvP Quests", renderQuestCategoryPage("PvP Quests", "PvP chains are separated here so they do not get mixed into regular progression quests.", "pvp-quests-table", pvpRows));
  writePage(path.join(DIST_DIR, "quests", "daily", "index.html"), "Daily Quests", renderDailyCategoryPage(cache, routes));
  for (const item of storyChains) {
    writePage(path.join(DIST_DIR, "quests", "story", `${item.slug}.html`), item.title, renderStoryQuestChainPage(item, cache, routes));
  }
  for (const item of dailyMissionCatalog(cache)) {
    writePage(path.join(DIST_DIR, `${item.slug}.html`), item.name, renderDailyMissionPage(item, cache, media, routes, { renderImageCard }));
  }
}


