export interface Theme {
  id: string;
  name: string;
  price: number;
  unlockType?: "free" | "tokens" | "offer";
  offerId?: "starter_pack" | "theme_bundle";
  atmosphere: {
    skyTop: string;
    skyMid: string;
    skyBottom: string;
    bloomA: string;
    bloomB: string;
    bloomC: string;
    mesh: string;
    surfaceGlow: string;
  };
  palette: {
    background: string;
    board: string;
    grid: string;
    block: string;
    blockEdge: string;
    glow: string;
    highlight: string;
    accent: string;
    accentAlt: string;
  };
  style: {
    scenePattern:
      | "lattice"
      | "forge"
      | "crystal"
      | "signal"
      | "ember"
      | "tide"
      | "sunset"
      | "aurora"
      | "canopy";
    blockPattern:
      | "glass"
      | "alloy"
      | "frost"
      | "signal"
      | "ember"
      | "wave"
      | "horizon"
      | "aurora"
      | "leaf";
    boardFrame: string;
    boardGlow: string;
    boardSheen: string;
    blockTop: string;
    blockBottom: string;
    blockInner: string;
    patternColor: string;
    sparkle: string;
  };
}

export const THEMES: Theme[] = [
  {
    id: "lume",
    name: "Prism Pulse",
    price: 20,
    atmosphere: {
      skyTop: "#183a5c",
      skyMid: "#0d1c2f",
      skyBottom: "#050b14",
      bloomA: "rgba(89, 239, 221, 0.22)",
      bloomB: "rgba(255, 203, 107, 0.16)",
      bloomC: "rgba(118, 186, 255, 0.12)",
      mesh: "rgba(221, 241, 255, 0.05)",
      surfaceGlow: "rgba(89, 239, 221, 0.16)"
    },
    palette: {
      background: "#08131f",
      board: "#0d1930",
      grid: "rgba(130, 180, 213, 0.2)",
      block: "#6ef7dc",
      blockEdge: "#2ec4a6",
      glow: "rgba(110, 247, 220, 0.58)",
      highlight: "rgba(255, 221, 133, 0.5)",
      accent: "#59efdd",
      accentAlt: "#ffcb6b"
    },
    style: {
      scenePattern: "lattice",
      blockPattern: "glass",
      boardFrame: "rgba(126, 229, 255, 0.32)",
      boardGlow: "rgba(89, 239, 221, 0.18)",
      boardSheen: "rgba(210, 247, 255, 0.14)",
      blockTop: "#9bfced",
      blockBottom: "#2dbb9e",
      blockInner: "rgba(255, 245, 206, 0.58)",
      patternColor: "rgba(214, 255, 250, 0.28)",
      sparkle: "rgba(255, 214, 128, 0.88)"
    }
  },
  {
    id: "copper",
    name: "Solar Forge",
    price: 12,
    unlockType: "tokens",
    atmosphere: {
      skyTop: "#592d1b",
      skyMid: "#2d150f",
      skyBottom: "#120a08",
      bloomA: "rgba(255, 159, 95, 0.22)",
      bloomB: "rgba(255, 208, 138, 0.16)",
      bloomC: "rgba(211, 109, 62, 0.14)",
      mesh: "rgba(255, 232, 214, 0.04)",
      surfaceGlow: "rgba(255, 159, 95, 0.15)"
    },
    palette: {
      background: "#17100d",
      board: "#24150f",
      grid: "rgba(240, 177, 133, 0.16)",
      block: "#ffb370",
      blockEdge: "#d86a35",
      glow: "rgba(255, 159, 95, 0.55)",
      highlight: "rgba(255, 224, 173, 0.5)",
      accent: "#ff9f5f",
      accentAlt: "#ffd08a"
    },
    style: {
      scenePattern: "forge",
      blockPattern: "alloy",
      boardFrame: "rgba(255, 190, 140, 0.28)",
      boardGlow: "rgba(255, 159, 95, 0.18)",
      boardSheen: "rgba(255, 224, 170, 0.12)",
      blockTop: "#ffd09a",
      blockBottom: "#dc6d38",
      blockInner: "rgba(255, 238, 217, 0.48)",
      patternColor: "rgba(255, 229, 200, 0.18)",
      sparkle: "rgba(255, 196, 115, 0.84)"
    }
  },
  {
    id: "frost",
    name: "Glacier Glass",
    price: 18,
    unlockType: "tokens",
    atmosphere: {
      skyTop: "#173a53",
      skyMid: "#0c1f30",
      skyBottom: "#050d15",
      bloomA: "rgba(141, 230, 255, 0.22)",
      bloomB: "rgba(223, 248, 255, 0.18)",
      bloomC: "rgba(144, 194, 230, 0.13)",
      mesh: "rgba(234, 250, 255, 0.05)",
      surfaceGlow: "rgba(141, 230, 255, 0.15)"
    },
    palette: {
      background: "#08141e",
      board: "#0c2130",
      grid: "rgba(148, 214, 236, 0.18)",
      block: "#8de6ff",
      blockEdge: "#46afd5",
      glow: "rgba(141, 230, 255, 0.55)",
      highlight: "rgba(229, 247, 255, 0.55)",
      accent: "#8de6ff",
      accentAlt: "#dff8ff"
    },
    style: {
      scenePattern: "crystal",
      blockPattern: "frost",
      boardFrame: "rgba(171, 234, 255, 0.32)",
      boardGlow: "rgba(141, 230, 255, 0.16)",
      boardSheen: "rgba(225, 250, 255, 0.18)",
      blockTop: "#d7f8ff",
      blockBottom: "#5abfe3",
      blockInner: "rgba(255, 255, 255, 0.62)",
      patternColor: "rgba(234, 252, 255, 0.26)",
      sparkle: "rgba(214, 244, 255, 0.92)"
    }
  },
  {
    id: "midnight",
    name: "Void Circuit",
    price: 28,
    unlockType: "tokens",
    atmosphere: {
      skyTop: "#16224c",
      skyMid: "#0a1330",
      skyBottom: "#030815",
      bloomA: "rgba(111, 137, 255, 0.22)",
      bloomB: "rgba(92, 240, 220, 0.14)",
      bloomC: "rgba(79, 99, 201, 0.15)",
      mesh: "rgba(220, 228, 255, 0.04)",
      surfaceGlow: "rgba(111, 137, 255, 0.16)"
    },
    palette: {
      background: "#071129",
      board: "#0b1735",
      grid: "rgba(110, 130, 212, 0.2)",
      block: "#7d9cff",
      blockEdge: "#4d66d1",
      glow: "rgba(125, 156, 255, 0.55)",
      highlight: "rgba(113, 246, 231, 0.42)",
      accent: "#90a8ff",
      accentAlt: "#5cf0dc"
    },
    style: {
      scenePattern: "signal",
      blockPattern: "signal",
      boardFrame: "rgba(146, 167, 255, 0.28)",
      boardGlow: "rgba(111, 137, 255, 0.18)",
      boardSheen: "rgba(168, 255, 245, 0.12)",
      blockTop: "#b8c7ff",
      blockBottom: "#4d66d1",
      blockInner: "rgba(163, 255, 241, 0.42)",
      patternColor: "rgba(200, 210, 255, 0.2)",
      sparkle: "rgba(96, 247, 226, 0.84)"
    }
  },
  {
    id: "ember",
    name: "Inferno Bloom",
    price: 35,
    atmosphere: {
      skyTop: "#5b231c",
      skyMid: "#2b0f0d",
      skyBottom: "#110707",
      bloomA: "rgba(255, 120, 72, 0.24)",
      bloomB: "rgba(255, 207, 112, 0.18)",
      bloomC: "rgba(207, 74, 42, 0.16)",
      mesh: "rgba(255, 224, 212, 0.045)",
      surfaceGlow: "rgba(255, 120, 72, 0.16)"
    },
    palette: {
      background: "#170b0b",
      board: "#24100f",
      grid: "rgba(255, 148, 111, 0.16)",
      block: "#ff8b52",
      blockEdge: "#e14c27",
      glow: "rgba(255, 126, 71, 0.6)",
      highlight: "rgba(255, 210, 146, 0.55)",
      accent: "#ff8b52",
      accentAlt: "#ffcf70"
    },
    style: {
      scenePattern: "ember",
      blockPattern: "ember",
      boardFrame: "rgba(255, 149, 104, 0.32)",
      boardGlow: "rgba(255, 120, 72, 0.22)",
      boardSheen: "rgba(255, 216, 161, 0.14)",
      blockTop: "#ffbe87",
      blockBottom: "#e14c27",
      blockInner: "rgba(255, 235, 196, 0.46)",
      patternColor: "rgba(255, 219, 176, 0.2)",
      sparkle: "rgba(255, 197, 90, 0.86)"
    }
  },
  {
    id: "aqua",
    name: "Tidal Bloom",
    price: 50,
    atmosphere: {
      skyTop: "#0b3f55",
      skyMid: "#072233",
      skyBottom: "#03111a",
      bloomA: "rgba(79, 224, 255, 0.24)",
      bloomB: "rgba(121, 255, 201, 0.18)",
      bloomC: "rgba(92, 162, 255, 0.13)",
      mesh: "rgba(218, 249, 255, 0.05)",
      surfaceGlow: "rgba(79, 224, 255, 0.16)"
    },
    palette: {
      background: "#07161d",
      board: "#0a2330",
      grid: "rgba(110, 217, 224, 0.18)",
      block: "#4fe0ff",
      blockEdge: "#1e92be",
      glow: "rgba(79, 224, 255, 0.58)",
      highlight: "rgba(153, 255, 224, 0.46)",
      accent: "#4fe0ff",
      accentAlt: "#79ffc9"
    },
    style: {
      scenePattern: "tide",
      blockPattern: "wave",
      boardFrame: "rgba(104, 232, 255, 0.3)",
      boardGlow: "rgba(79, 224, 255, 0.18)",
      boardSheen: "rgba(178, 255, 236, 0.14)",
      blockTop: "#9bf7ff",
      blockBottom: "#209ac6",
      blockInner: "rgba(212, 255, 242, 0.48)",
      patternColor: "rgba(204, 255, 248, 0.22)",
      sparkle: "rgba(137, 255, 212, 0.84)"
    }
  },
  {
    id: "sunset",
    name: "Velvet Sundown",
    price: 0,
    unlockType: "offer",
    offerId: "starter_pack",
    atmosphere: {
      skyTop: "#6b2c31",
      skyMid: "#32141e",
      skyBottom: "#120913",
      bloomA: "rgba(255, 123, 111, 0.22)",
      bloomB: "rgba(255, 211, 120, 0.18)",
      bloomC: "rgba(255, 142, 116, 0.14)",
      mesh: "rgba(255, 229, 220, 0.04)",
      surfaceGlow: "rgba(255, 123, 111, 0.16)"
    },
    palette: {
      background: "#160b13",
      board: "#24111a",
      grid: "rgba(244, 148, 135, 0.18)",
      block: "#ff8e74",
      blockEdge: "#e55b66",
      glow: "rgba(255, 142, 116, 0.56)",
      highlight: "rgba(255, 219, 145, 0.5)",
      accent: "#ff8e74",
      accentAlt: "#ffd36d"
    },
    style: {
      scenePattern: "sunset",
      blockPattern: "horizon",
      boardFrame: "rgba(255, 163, 135, 0.3)",
      boardGlow: "rgba(255, 123, 111, 0.18)",
      boardSheen: "rgba(255, 213, 170, 0.14)",
      blockTop: "#ffc195",
      blockBottom: "#e55b66",
      blockInner: "rgba(255, 240, 199, 0.42)",
      patternColor: "rgba(255, 224, 196, 0.18)",
      sparkle: "rgba(255, 201, 116, 0.82)"
    }
  },
  {
    id: "aurora",
    name: "Polar Veil",
    price: 0,
    unlockType: "offer",
    offerId: "theme_bundle",
    atmosphere: {
      skyTop: "#0e3650",
      skyMid: "#081d2b",
      skyBottom: "#051018",
      bloomA: "rgba(115, 255, 209, 0.22)",
      bloomB: "rgba(141, 213, 255, 0.18)",
      bloomC: "rgba(171, 255, 190, 0.14)",
      mesh: "rgba(219, 248, 255, 0.05)",
      surfaceGlow: "rgba(115, 255, 209, 0.16)"
    },
    palette: {
      background: "#08161d",
      board: "#0d2029",
      grid: "rgba(116, 214, 201, 0.17)",
      block: "#73ffd1",
      blockEdge: "#3cc8a0",
      glow: "rgba(115, 255, 209, 0.56)",
      highlight: "rgba(176, 247, 255, 0.5)",
      accent: "#73ffd1",
      accentAlt: "#8bd5ff"
    },
    style: {
      scenePattern: "aurora",
      blockPattern: "aurora",
      boardFrame: "rgba(123, 255, 222, 0.3)",
      boardGlow: "rgba(115, 255, 209, 0.18)",
      boardSheen: "rgba(191, 255, 229, 0.14)",
      blockTop: "#b9ffe8",
      blockBottom: "#3cc8a0",
      blockInner: "rgba(199, 243, 255, 0.48)",
      patternColor: "rgba(215, 255, 239, 0.22)",
      sparkle: "rgba(150, 225, 255, 0.88)"
    }
  },
  {
    id: "forest",
    name: "Emerald Canopy",
    price: 70,
    atmosphere: {
      skyTop: "#123b2e",
      skyMid: "#081d17",
      skyBottom: "#040e0b",
      bloomA: "rgba(114, 243, 154, 0.22)",
      bloomB: "rgba(255, 224, 126, 0.14)",
      bloomC: "rgba(66, 171, 106, 0.14)",
      mesh: "rgba(231, 255, 224, 0.04)",
      surfaceGlow: "rgba(114, 243, 154, 0.16)"
    },
    palette: {
      background: "#07140f",
      board: "#0d2219",
      grid: "rgba(119, 206, 165, 0.18)",
      block: "#72f39a",
      blockEdge: "#38a95e",
      glow: "rgba(114, 243, 154, 0.58)",
      highlight: "rgba(255, 228, 140, 0.48)",
      accent: "#72f39a",
      accentAlt: "#ffe082"
    },
    style: {
      scenePattern: "canopy",
      blockPattern: "leaf",
      boardFrame: "rgba(126, 233, 172, 0.28)",
      boardGlow: "rgba(114, 243, 154, 0.18)",
      boardSheen: "rgba(226, 255, 198, 0.12)",
      blockTop: "#b6ffc2",
      blockBottom: "#3aad62",
      blockInner: "rgba(255, 244, 185, 0.42)",
      patternColor: "rgba(226, 255, 224, 0.22)",
      sparkle: "rgba(255, 226, 126, 0.84)"
    }
  }
];

export class ThemeManager {
  private currentTheme: Theme = THEMES[0];

  setTheme(themeId: string): Theme {
    const theme = THEMES.find((item) => item.id === themeId) ?? THEMES[0];
    this.currentTheme = theme;
    this.applyTheme(theme);
    return theme;
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  applyTheme(theme: Theme): void {
    const root = document.documentElement;
    root.style.setProperty("--scene-top", theme.atmosphere.skyTop);
    root.style.setProperty("--scene-mid", theme.atmosphere.skyMid);
    root.style.setProperty("--scene-bottom", theme.atmosphere.skyBottom);
    root.style.setProperty("--scene-bloom-a", theme.atmosphere.bloomA);
    root.style.setProperty("--scene-bloom-b", theme.atmosphere.bloomB);
    root.style.setProperty("--scene-bloom-c", theme.atmosphere.bloomC);
    root.style.setProperty("--scene-mesh", theme.atmosphere.mesh);
    root.style.setProperty("--surface-glow", theme.atmosphere.surfaceGlow);
    root.style.setProperty("--accent", theme.palette.accent);
    root.style.setProperty("--accent-2", theme.palette.accentAlt);
    root.style.setProperty("--glow", theme.palette.glow);
  }
}
