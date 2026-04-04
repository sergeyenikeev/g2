export interface Theme {
  id: string;
  name: string;
  price: number;
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
}

export const THEMES: Theme[] = [
  {
    id: "lume",
    name: "Lume Classic",
    price: 20,
    atmosphere: {
      skyTop: "#27445f",
      skyMid: "#16263a",
      skyBottom: "#0a1119",
      bloomA: "rgba(68, 255, 209, 0.22)",
      bloomB: "rgba(255, 179, 71, 0.18)",
      bloomC: "rgba(111, 168, 255, 0.14)",
      mesh: "rgba(215, 236, 255, 0.05)",
      surfaceGlow: "rgba(68, 255, 209, 0.16)"
    },
    palette: {
      background: "#0e1524",
      board: "#101a2a",
      grid: "rgba(120, 150, 180, 0.25)",
      block: "#44ffd1",
      blockEdge: "#2cc3a4",
      glow: "rgba(68, 255, 209, 0.5)",
      highlight: "rgba(255, 220, 120, 0.55)",
      accent: "#44ffd1",
      accentAlt: "#ffb347"
    }
  },
  {
    id: "ember",
    name: "Ember Ash",
    price: 35,
    atmosphere: {
      skyTop: "#4a2a22",
      skyMid: "#251613",
      skyBottom: "#100b0c",
      bloomA: "rgba(255, 138, 91, 0.24)",
      bloomB: "rgba(255, 209, 102, 0.18)",
      bloomC: "rgba(179, 74, 52, 0.16)",
      mesh: "rgba(255, 228, 215, 0.045)",
      surfaceGlow: "rgba(255, 138, 91, 0.16)"
    },
    palette: {
      background: "#19120f",
      board: "#221512",
      grid: "rgba(220, 140, 120, 0.25)",
      block: "#ff8a5b",
      blockEdge: "#e66b43",
      glow: "rgba(255, 140, 90, 0.55)",
      highlight: "rgba(255, 210, 140, 0.6)",
      accent: "#ff8a5b",
      accentAlt: "#ffd166"
    }
  },
  {
    id: "aqua",
    name: "Aqua Drift",
    price: 50,
    atmosphere: {
      skyTop: "#13394a",
      skyMid: "#0a2230",
      skyBottom: "#061219",
      bloomA: "rgba(81, 214, 255, 0.24)",
      bloomB: "rgba(91, 255, 182, 0.18)",
      bloomC: "rgba(112, 170, 255, 0.15)",
      mesh: "rgba(216, 249, 255, 0.05)",
      surfaceGlow: "rgba(81, 214, 255, 0.16)"
    },
    palette: {
      background: "#0b1c20",
      board: "#0f2430",
      grid: "rgba(90, 190, 210, 0.25)",
      block: "#51d6ff",
      blockEdge: "#2aa0cc",
      glow: "rgba(81, 214, 255, 0.55)",
      highlight: "rgba(160, 255, 220, 0.55)",
      accent: "#51d6ff",
      accentAlt: "#5bffb6"
    }
  },
  {
    id: "forest",
    name: "Forest Pulse",
    price: 70,
    atmosphere: {
      skyTop: "#173b2b",
      skyMid: "#10241b",
      skyBottom: "#08120d",
      bloomA: "rgba(109, 255, 140, 0.22)",
      bloomB: "rgba(255, 239, 128, 0.16)",
      bloomC: "rgba(58, 170, 118, 0.16)",
      mesh: "rgba(231, 255, 224, 0.045)",
      surfaceGlow: "rgba(109, 255, 140, 0.16)"
    },
    palette: {
      background: "#0d1c17",
      board: "#11251f",
      grid: "rgba(110, 190, 160, 0.25)",
      block: "#6dff8c",
      blockEdge: "#49c96b",
      glow: "rgba(109, 255, 140, 0.55)",
      highlight: "rgba(255, 246, 180, 0.55)",
      accent: "#6dff8c",
      accentAlt: "#ffef80"
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
  }
}
