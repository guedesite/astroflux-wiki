export const PAGE_TABLES = {
  SolarSystems: { dir: "systems", title: "Solar Systems" },
  Bodies: { dir: "bodies", title: "Bodies" },
  Enemies: { dir: "enemies", title: "Enemies" },
  Bosses: { dir: "bosses", title: "Bosses" },
  Drops: { dir: "drops", title: "Drops" },
  Weapons: { dir: "weapons", title: "Weapons" },
  Projectiles: { dir: "projectiles", title: "Projectiles" },
  Ships: { dir: "ships", title: "Ships" },
  Engines: { dir: "engines", title: "Engines" },
  Turrets: { dir: "turrets", title: "Turrets" },
  Spawners: { dir: "spawners", title: "Spawners" },
  Commodities: { dir: "commodities", title: "Commodities" },
  ArtifactTypes: { dir: "artifacts", title: "Artifacts" },
  MissionTypes: { dir: "missions", title: "Missions" }
};

export const INDEX_TABLES = [
  "SolarSystems",
  "Bodies",
  "BodyAreas",
  "Spawners",
  "Enemies",
  "Bosses",
  "Drops",
  "Weapons",
  "Projectiles",
  "Ships",
  "Skins",
  "Engines",
  "Turrets",
  "Commodities",
  "ArtifactTypes",
  "MissionTypes",
  "Images",
  "Sounds",
  "WarpPaths"
];

export const REF_FIELDS = {
  SolarSystems: {
    background: "Images",
    musicAction: "Sounds",
    musicQuiet: "Sounds",
    musicStandard: "Sounds"
  },
  Bodies: {
    solarSystem: "SolarSystems",
    parent: "Bodies",
    bitmap: "Images",
    mission: "MissionTypes",
    payVaultItem: "PayVaultItems"
  },
  Spawners: {
    body: "Bodies",
    bitmap: "Images",
    enemy: "Enemies",
    enemy2: "Enemies",
    drops: "Drops",
    drops2: "Drops",
    explosionEffect: "Effects"
  },
  Enemies: {
    ship: "Ships",
    engine: "Engines",
    drops: "Drops"
  },
  Bosses: {
    bitmap: "Images",
    drops: "Drops",
    explosionEffect: "Effects",
    explosionSound: "Sounds"
  },
  Drops: {
    bitmap: "Images",
    effect: "Effects"
  },
  Weapons: {
    projectile: "Projectiles",
    techIcon: "Images",
    fireSound: "Sounds",
    hitSound: "Sounds",
    sound: "Sounds",
    fireEffect: "Effects",
    hitEffect: "Effects",
    dotEffect: "Effects"
  },
  Projectiles: {
    bitmap: "Images",
    explosionEffect: "Effects",
    impactEffect: "Effects",
    sound: "Sounds"
  },
  Ships: {
    bitmap: "Images",
    explosionEffect: "Effects",
    explosionSound: "Sounds"
  },
  Skins: {
    ship: "Ships",
    engine: "Engines",
    bitmap: "Images"
  },
  Engines: {
    bitmap: "Images",
    sound: "Sounds"
  },
  Turrets: {
    bitmap: "Images",
    weapon: "Weapons"
  },
  Commodities: {
    bitmap: "Images"
  },
  ArtifactTypes: {
    bitmap: "Images"
  }
};
