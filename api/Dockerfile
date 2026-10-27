FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Salin daftar dependensi lebih dulu agar layer ini bisa di-cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Salin kode aplikasi
COPY src ./src

# Jalankan sebagai pengguna biasa, bukan root
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]