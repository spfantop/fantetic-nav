import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "logo192.png", "logo512.png"],
      manifest: {
        name: "Fantetic Nav",
        short_name: "Fantetic Nav",
        description: "Fantetic Nav",
        theme_color: "#000000",
        icons: [
          { src: "/logo192.png", sizes: "192x192", type: "image/png" },
          { src: "/logo512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,json,txt}"],
        runtimeCaching: [
          {
            urlPattern: /^https?.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "https-calls",
              networkTimeoutSeconds: 15,
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:6412",
    },
  },
  build: {
    outDir: "build",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/antd") || id.includes("@ant-design/icons")) {
            return "antd";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("react-router-dom")) {
            return "react";
          }
          if (id.includes("@dnd-kit")) {
            return "dnd";
          }
          return undefined;
        },
      },
    },
  },
});

