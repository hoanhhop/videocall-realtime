FROM node:18-slim as builder

WORKDIR /app

# Sao chép package.json trước để tận dụng cache
COPY package*.json ./
RUN npm install

# Sao chép source code
COPY . .

# Build React app với Vite
RUN npm run build

# Stage 2: Tạo image nhẹ với Nginx để serve static files
FROM nginx:alpine

# Sao chép cấu hình Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Sao chép built app từ stage trước đó
COPY --from=builder /app/dist /usr/share/nginx/html

# Mở cổng
EXPOSE 80

# Khởi động Nginx
CMD ["nginx", "-g", "daemon off;"]