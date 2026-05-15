export function routeForEntry(entry) {
  const [table] = entry.id.split(":");
  const slug = table === "Bodies" ? entry.slug.replace(/^bodies\//, "stations/") : entry.slug;
  return `/${slug}.html`;
}

export function routeMap(manifest, { cache = null, isVisibleSystem = () => true, uniqueArtifacts = () => [] } = {}) {
  const routes = new Map();
  for (const entries of Object.values(manifest)) {
    for (const entry of entries) {
      const [table, key] = entry.id.split(":");
      if (cache && table === "SolarSystems" && !isVisibleSystem(cache.SolarSystems?.[key], key)) continue;
      routes.set(entry.id, routeForEntry(entry));
    }
  }
  if (cache) {
    for (const item of uniqueArtifacts(cache)) {
      routes.set(`UniqueArtifacts:${item.key}`, item.url);
    }
  }
  return routes;
}
