import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  server: {
    // 'host: true' is critical so your Note 9 can find the server via your IP
    host: true,
    https: true,
  },
  plugins: [mkcert()],
});
