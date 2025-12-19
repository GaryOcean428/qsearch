import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"] ,
  theme: {
    extend: {
      colors: {
        neon: {
          "electric-blue": "#2563eb",
          "electric-cyan": "#00cec9",
          "electric-indigo": "#4f46e5",
          "electric-purple": "#6c5ce7",
          "electric-magenta": "#fd79a8",
          "electric-pink": "#ec4899",
          "electric-coral": "#ff4757",
          "electric-orange": "#ff7675",
          "electric-yellow": "#fdcb6e",
          "electric-green": "#22c55e",
          "electric-lavender": "#a29bfe"
        },
        light: {
          bg: {
            primary: "hsl(var(--bg-primary))",
            secondary: "hsl(var(--bg-secondary))"
          },
          text: {
            primary: "hsl(var(--text-primary))",
            secondary: "hsl(var(--text-secondary))"
          },
          border: "hsl(var(--border))",
          hover: "hsl(var(--hover))"
        },
        dark: {
          bg: {
            primary: "hsl(var(--bg-primary))",
            secondary: "hsl(var(--bg-secondary))"
          },
          text: {
            primary: "hsl(var(--text-primary))",
            secondary: "hsl(var(--text-secondary))"
          },
          border: "hsl(var(--border))",
          hover: "hsl(var(--hover))",
          accent: "hsl(var(--accent))"
        },
        status: {
          success: "#22c55e",
          warning: "#fdcb6e",
          error: "#ff4757",
          info: "#00cec9"
        },
        chat: {
          user: {
            light: "#2563eb",
            dark: "#a29bfe"
          },
          agent: {
            light: "#00cec9",
            dark: "#00cec9"
          },
          system: {
            light: "#6c5ce7",
            dark: "#6c5ce7"
          }
        }
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #2563eb 0%, #6c5ce7 50%, #fd79a8 100%)",
        "gradient-electric": "linear-gradient(135deg, #00cec9 0%, #2563eb 50%, #4f46e5 100%)",
        "gradient-neon": "linear-gradient(135deg, #22c55e 0%, #00cec9 50%, #fdcb6e 100%)",
        "gradient-sunset": "linear-gradient(135deg, #ff4757 0%, #ff7675 50%, #fdcb6e 100%)",
        "gradient-aurora": "linear-gradient(135deg, #a29bfe 0%, #00cec9 50%, #22c55e 100%)",
        "gradient-void": "radial-gradient(circle at 20% 20%, rgba(79,70,229,0.35), transparent 55%), radial-gradient(circle at 80% 30%, rgba(0,206,201,0.25), transparent 45%), radial-gradient(circle at 50% 90%, rgba(253,121,168,0.20), transparent 55%)"
      },
      boxShadow: {
        "glow-electric-blue": "0 0 24px rgba(37,99,235,0.45)",
        "glow-electric-cyan": "0 0 24px rgba(0,206,201,0.45)",
        "glow-electric-purple": "0 0 24px rgba(108,92,231,0.45)",
        "glow-electric-pink": "0 0 24px rgba(236,72,153,0.45)",
        "glow-electric-green": "0 0 24px rgba(34,197,94,0.45)"
      },
      keyframes: {
        glow: {
          "0%, 100%": { opacity: "0.8" },
          "50%": { opacity: "1" }
        },
        "pulse-soft": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.02)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" }
        },
        typing: {
          "0%": { width: "0" },
          "100%": { width: "100%" }
        },
        "neon-pulse": {
          "0%, 100%": { filter: "drop-shadow(0 0 10px rgba(0,206,201,0.4))" },
          "50%": { filter: "drop-shadow(0 0 18px rgba(0,206,201,0.8))" }
        }
      },
      animation: {
        glow: "glow 2.2s ease-in-out infinite",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
        shimmer: "shimmer 2.4s ease-in-out infinite",
        float: "float 4.5s ease-in-out infinite",
        typing: "typing 2.2s steps(30, end)",
        "neon-pulse": "neon-pulse 2.2s ease-in-out infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
